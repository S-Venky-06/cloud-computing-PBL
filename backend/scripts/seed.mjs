import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const questionsPath = path.join(__dirname, '..', 'seed-questions.json');
const rawData = fs.readFileSync(questionsPath, 'utf-8');
const questions = JSON.parse(rawData);

const tempItemPath = path.join(__dirname, 'temp_item.json');
const forwardSlashPath = tempItemPath.replace(/\\/g, '/');

let count = 0;
for (const q of questions) {
  const dynamoItem = {
    quizId: { S: q.quizId },
    questionId: { S: q.questionId },
    question: { S: q.question },
    options: { L: q.options.map(opt => ({ S: opt })) },
    correctAnswer: { S: q.correctAnswer },
    explanation: { S: q.explanation }
  };

  fs.writeFileSync(tempItemPath, JSON.stringify(dynamoItem, null, 2), 'utf-8');

  try {
    execSync(
      `aws dynamodb put-item --table-name QuizQuestions --item "file://${forwardSlashPath}" --region ap-southeast-2 --profile default`,
      { stdio: 'pipe' }
    );
    count++;
    console.log(`[OK] Inserted ${q.quizId} - ${q.questionId}: "${q.question.substring(0, 40)}..."`);
  } catch (err) {
    console.error(`[ERR] Failed to insert ${q.questionId}:`, err.message);
  }
}

if (fs.existsSync(tempItemPath)) {
  fs.unlinkSync(tempItemPath);
}

console.log(`\nAll done! Successfully inserted ${count} questions into AWS DynamoDB table 'QuizQuestions'.`);
