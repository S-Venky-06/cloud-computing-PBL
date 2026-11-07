// CloudQuiz Application Client-side Logic (Hallmark Redesign)

let activeQuizId = null;
let activeStudentName = '';
let activeQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {}; // { q1: "Option text", ... }
let quizTimerInterval = null;
let timeRemaining = 300; // 5 minutes in seconds
let timeSpentSeconds = 0;
let quizStartTime = null;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  const settingsInput = document.getElementById('settingsApiUrl');
  if (settingsInput) {
    settingsInput.value = CONFIG.API_BASE_URL;
  }
  loadQuizzes();
});

// View Navigation
function navigateTo(viewName) {
  if (viewName !== 'quiz' && quizTimerInterval) {
    clearInterval(quizTimerInterval);
  }

  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`nav${capitalize(viewName)}`);
  if (activeBtn) activeBtn.classList.add('active');

  document.querySelectorAll('.view-section').forEach((sec) => sec.classList.remove('active'));
  const targetSection = document.getElementById(`view${capitalize(viewName)}`);
  if (targetSection) targetSection.classList.add('active');

  if (viewName === 'leaderboard') {
    const sel = document.getElementById('leaderboardQuizSelect');
    loadLeaderboard(sel ? sel.value : 'aws-cloud-basics');
  } else if (viewName === 'catalog') {
    loadQuizzes();
  }
}

// 1. Load Quizzes Catalog
async function loadQuizzes() {
  const grid = document.getElementById('quizzesGrid');
  grid.innerHTML = `<div style="grid-column: 1 / -1; color: var(--color-muted); padding-block: var(--space-xl); font-family: var(--font-outlier); font-size: var(--text-sm);">
    Querying assessments from Amazon API Gateway...
  </div>`;

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/quizzes`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.quizzes || data.quizzes.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; color: var(--color-muted); padding-block: var(--space-xl); font-family: var(--font-outlier); font-size: var(--text-sm);">
        No active assessments found in DynamoDB.
      </div>`;
      return;
    }

    grid.innerHTML = data.quizzes.map((q) => {
      return `
        <article class="assessment-card">
          <div class="card-tag">${escapeHtml(q.category)} / ${escapeHtml(q.difficulty.toLowerCase())}</div>
          <h2 class="card-title">${escapeHtml(q.title)}</h2>
          <p class="card-desc">${escapeHtml(q.description)}</p>
          <div class="card-meta-row">
            <span>${q.questionCount} questions</span>
            <span>${q.durationMinutes} min allotment</span>
          </div>
          <button class="btn btn--primary btn--full" onclick="promptStartQuiz('${q.quizId}')">
            Begin assessment
          </button>
        </article>
      `;
    }).join('');

    updateCloudStatus(true);
  } catch (err) {
    console.error('Error fetching quizzes:', err);
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; color: var(--color-error); padding-block: var(--space-xl); font-family: var(--font-outlier); font-size: var(--text-sm);">
        Failed to load assessments from API Gateway: ${escapeHtml(err.message)}
      </div>
    `;
    updateCloudStatus(false);
  }
}

// 2. Student Prompt
function promptStartQuiz(quizId) {
  activeQuizId = quizId;
  const modal = document.getElementById('modalStudent');
  modal.classList.add('active');
  const input = document.getElementById('studentNameInput');
  input.value = activeStudentName || '';
  input.focus();
}

function closeStudentModal() {
  document.getElementById('modalStudent').classList.remove('active');
}

// 3. Start Quiz
async function startQuizConfirmed(event) {
  event.preventDefault();
  const input = document.getElementById('studentNameInput');
  const name = input.value.trim();
  if (!name) return;

  activeStudentName = name;
  closeStudentModal();

  navigateTo('quiz');
  document.getElementById('questionText').innerText = 'Retrieving question set from DynamoDB...';
  document.getElementById('optionsList').innerHTML = '';

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/questions?quizId=${encodeURIComponent(activeQuizId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    activeQuestions = data.questions || [];
    currentQuestionIndex = 0;
    userAnswers = {};

    if (activeQuestions.length === 0) {
      alert('No questions configured for this quiz.');
      navigateTo('catalog');
      return;
    }

    const quizTitles = {
      'aws-cloud-basics': 'AWS Cloud Practitioner Essentials',
      'serverless-deep-dive': 'Serverless Architecture & Lambda',
      'cloud-security-iam': 'Cloud Security & IAM Best Practices'
    };
    document.getElementById('activeQuizTitle').innerText = quizTitles[activeQuizId] || 'Cloud Computing Assessment';
    document.getElementById('totalQuestionsNum').innerText = activeQuestions.length;

    timeRemaining = 300;
    timeSpentSeconds = 0;
    quizStartTime = Date.now();
    startTimer();

    renderQuestion();

  } catch (err) {
    console.error('Failed to load questions:', err);
    alert('Error connecting to AWS API Gateway: ' + err.message);
    navigateTo('catalog');
  }
}

// 4. Timer Logic
function startTimer() {
  if (quizTimerInterval) clearInterval(quizTimerInterval);

  const timerText = document.getElementById('timerText');
  const timerBox = document.getElementById('timerBox');
  timerBox.classList.remove('warning');

  updateTimerDisplay();

  quizTimerInterval = setInterval(() => {
    timeRemaining--;
    timeSpentSeconds++;

    if (timeRemaining <= 60) {
      timerBox.classList.add('warning');
    }

    if (timeRemaining <= 0) {
      clearInterval(quizTimerInterval);
      showToast('Time expired. Submitting recorded answers.');
      submitQuizToAWS();
    } else {
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  document.getElementById('timerText').innerText = 
    `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 5. Render Question
function renderQuestion() {
  const q = activeQuestions[currentQuestionIndex];
  if (!q) return;

  document.getElementById('currentQuestionNum').innerText = currentQuestionIndex + 1;
  const progressPercent = ((currentQuestionIndex + 1) / activeQuestions.length) * 100;
  document.getElementById('progressBar').style.width = `${progressPercent}%`;

  document.getElementById('questionText').innerText = `${currentQuestionIndex + 1}. ${q.question}`;

  const optionsContainer = document.getElementById('optionsList');
  const selectedAnswer = userAnswers[q.questionId];

  optionsContainer.innerHTML = q.options.map((opt) => {
    const isSelected = selectedAnswer === opt;
    return `
      <div class="option-cell ${isSelected ? 'selected' : ''}" tabindex="0" onclick="selectOption('${q.questionId}', '${escapeHtml(opt)}')" onkeydown="if(event.key==='Enter'||event.key===' '){selectOption('${q.questionId}', '${escapeHtml(opt)}');}">
        <div class="option-marker"></div>
        <div class="option-label">${escapeHtml(opt)}</div>
      </div>
    `;
  }).join('');

  document.getElementById('btnPrev').disabled = currentQuestionIndex === 0;

  if (currentQuestionIndex === activeQuestions.length - 1) {
    document.getElementById('btnNext').style.display = 'none';
    document.getElementById('btnSubmit').style.display = 'inline-flex';
  } else {
    document.getElementById('btnNext').style.display = 'inline-flex';
    document.getElementById('btnSubmit').style.display = 'none';
  }
}

function selectOption(questionId, optionText) {
  userAnswers[questionId] = optionText;
  renderQuestion();
}

function nextQuestion() {
  if (currentQuestionIndex < activeQuestions.length - 1) {
    currentQuestionIndex++;
    renderQuestion();
  }
}

function prevQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuestion();
  }
}

function confirmSubmitQuiz() {
  const answeredCount = Object.keys(userAnswers).length;
  const totalCount = activeQuestions.length;

  if (answeredCount < totalCount) {
    const unanswered = totalCount - answeredCount;
    if (!confirm(`${unanswered} question(s) remain unanswered. Confirm submission?`)) {
      return;
    }
  }
  submitQuizToAWS();
}

// 6. Submit to AWS Lambda & DynamoDB
async function submitQuizToAWS() {
  if (quizTimerInterval) clearInterval(quizTimerInterval);

  showToast('Evaluating submission via AWS Lambda...');

  const payload = {
    quizId: activeQuizId,
    username: activeStudentName,
    answers: userAnswers,
    timeSpentSeconds: timeSpentSeconds
  };

  const startTime = performance.now();

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const elapsedMs = (performance.now() - startTime).toFixed(0);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    renderResults(data, elapsedMs);
  } catch (err) {
    console.error('Error submitting quiz:', err);
    alert('Submission failed: ' + err.message);
  }
}

// 7. Render Score & Review View
function renderResults(data, elapsedMs) {
  navigateTo('results');

  const pct = data.percentage || 0;
  document.getElementById('resPercentage').innerText = `${pct}%`;

  document.getElementById('resStudentGreeting').innerText = 
    `Assessment records for ${data.username || activeStudentName}`;

  const passBadge = document.getElementById('resPassBadge');
  if (data.passed) {
    passBadge.className = 'outcome-badge passed';
    passBadge.innerText = `Passed (${pct}%)`;
  } else {
    passBadge.className = 'outcome-badge failed';
    passBadge.innerText = `Revision recommended (${pct}%)`;
  }

  document.getElementById('resCorrectCount').innerText = `${data.score} / ${data.total}`;

  const mins = Math.floor((data.timeSpentSeconds || timeSpentSeconds) / 60);
  const secs = (data.timeSpentSeconds || timeSpentSeconds) % 60;
  document.getElementById('resTimeSpent').innerText = `${mins}m ${secs}s`;

  document.getElementById('resAwsLatency').innerText = `${(elapsedMs / 1000).toFixed(2)}s`;

  const reviewContainer = document.getElementById('reviewList');
  if (data.review && data.review.length > 0) {
    reviewContainer.innerHTML = data.review.map((item, idx) => {
      const isCorrect = item.isCorrect;
      return `
        <div class="review-item-row">
          <div class="review-q-text">
            ${idx + 1}. ${escapeHtml(item.question)}
          </div>
          <div class="review-answer-pair">
            <div>
              <span style="color: var(--color-muted)">Selected:</span> 
              <strong style="color: ${isCorrect ? 'var(--color-green)' : 'var(--color-error)'}">
                ${escapeHtml(item.selectedAnswer)} (${isCorrect ? 'Correct' : 'Incorrect'})
              </strong>
            </div>
            ${!isCorrect ? `
              <div>
                <span style="color: var(--color-muted)">Correct answer:</span> 
                <strong style="color: var(--color-ink)">${escapeHtml(item.correctAnswer)}</strong>
              </div>
            ` : ''}
          </div>
          ${item.explanation ? `
            <div class="review-explanation-box">
              ${escapeHtml(item.explanation)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } else {
    reviewContainer.innerHTML = '<p style="color: var(--color-muted); font-size: var(--text-xs);">No review records available.</p>';
  }
}

// 8. Load Leaderboard from DynamoDB
async function loadLeaderboard(quizId) {
  const tbody = document.getElementById('leaderboardBody');
  tbody.innerHTML = `<tr><td colspan="6" style="padding-block: var(--space-xl); text-align: center; color: var(--color-muted); font-family: var(--font-outlier); font-size: var(--text-xs);">
    Querying records from DynamoDB...
  </td></tr>`;

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/leaderboard?quizId=${encodeURIComponent(quizId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const leaderboard = data.leaderboard || [];

    if (leaderboard.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding-block: var(--space-xl); text-align: center; color: var(--color-muted); font-family: var(--font-outlier); font-size: var(--text-xs);">
        No submissions recorded for this assessment.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = leaderboard.map((row) => {
      const mins = Math.floor((row.timeSpentSeconds || 0) / 60);
      const secs = (row.timeSpentSeconds || 0) % 60;
      const formattedDate = row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() + ' ' + new Date(row.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';

      return `
        <tr>
          <td><span class="rank-index num">${row.rank}</span></td>
          <td><strong>${escapeHtml(row.username)}</strong></td>
          <td class="num">${row.score} / ${row.total}</td>
          <td class="num" style="color: ${row.percentage >= 60 ? 'var(--color-green)' : 'var(--color-error)'}; font-weight: 500;">${row.percentage}%</td>
          <td class="num">${mins}m ${secs}s</td>
          <td class="num" style="color: var(--color-muted); font-size: var(--text-xs);">${formattedDate}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading leaderboard:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="padding-block: var(--space-xl); text-align: center; color: var(--color-error); font-family: var(--font-outlier); font-size: var(--text-xs);">
      Query failed: ${escapeHtml(err.message)}
    </td></tr>`;
  }
}

// 9. Admin Add Question
function openAdminModal() {
  document.getElementById('modalAdmin').classList.add('active');
}

function closeAdminModal() {
  document.getElementById('modalAdmin').classList.remove('active');
}

async function handleAdminSubmit(event) {
  event.preventDefault();

  const quizId = document.getElementById('admQuizId').value;
  const question = document.getElementById('admQuestion').value.trim();
  const optA = document.getElementById('admOptA').value.trim();
  const optB = document.getElementById('admOptB').value.trim();
  const optC = document.getElementById('admOptC').value.trim();
  const optD = document.getElementById('admOptD').value.trim();
  const correctAnswer = document.getElementById('admCorrectAnswer').value.trim();
  const explanation = document.getElementById('admExplanation').value.trim();

  const options = [optA, optB, optC, optD];

  if (!options.includes(correctAnswer)) {
    alert('The correct answer must match one of the four options exactly.');
    return;
  }

  const questionId = `q_custom_${Date.now()}`;
  showToast('Writing question item to DynamoDB...');

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId,
        questionId,
        question,
        options,
        correctAnswer,
        explanation
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    closeAdminModal();
    showToast('Question committed to DynamoDB.');
    document.querySelector('#modalAdmin form').reset();

  } catch (err) {
    console.error('Error creating question:', err);
    alert('Failed to save to DynamoDB: ' + err.message);
  }
}

// 10. Settings Modal
function openSettingsModal() {
  document.getElementById('modalSettings').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('modalSettings').classList.remove('active');
}

function showToast(msg) {
  const toast = document.getElementById('toastMessage');
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function updateCloudStatus(isOnline) {
  const badge = document.getElementById('cloudStatusBadge');
  const text = document.getElementById('cloudStatusText');
  if (isOnline) {
    text.innerText = 'Sydney ap-southeast-2 active';
    badge.querySelector('.status-indicator').style.backgroundColor = 'var(--color-green)';
  } else {
    text.innerText = 'Gateway offline';
    badge.querySelector('.status-indicator').style.backgroundColor = 'var(--color-error)';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
