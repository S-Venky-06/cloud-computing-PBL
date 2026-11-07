import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const QUIZ_QUESTIONS_TABLE = process.env.QUESTIONS_TABLE || 'QuizQuestions';
const QUIZ_RESULTS_TABLE = process.env.RESULTS_TABLE || 'QuizResults';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
};

const QUIZZES_CATALOG = [
  {
    quizId: 'aws-cloud-basics',
    title: 'AWS Cloud Practitioner Essentials',
    description: 'Test your understanding of EC2, S3, Cloud Deployment models, and the Shared Responsibility Model.',
    category: 'Core Fundamentals',
    questionCount: 5,
    durationMinutes: 5,
    difficulty: 'Beginner'
  },
  {
    quizId: 'serverless-deep-dive',
    title: 'Serverless Architecture & Lambda',
    description: 'Deep dive into event-driven computing, AWS Lambda cold starts, API Gateway, and DynamoDB NoSQL design.',
    category: 'Serverless Computing',
    questionCount: 5,
    durationMinutes: 5,
    difficulty: 'Intermediate'
  },
  {
    quizId: 'cloud-security-iam',
    title: 'Cloud Security & IAM Best Practices',
    description: 'Explore least privilege principles, IAM Roles, CloudTrail audit logs, and Security Groups.',
    category: 'Security & Governance',
    questionCount: 5,
    durationMinutes: 5,
    difficulty: 'Advanced'
  }
];

export const handler = async (event) => {
  console.log('Incoming Event:', JSON.stringify(event));

  // Determine HTTP Method and Route Path
  const httpMethod = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const rawPath = event.rawPath || event.path || '/';

  // Handle CORS preflight
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: 'CORS Preflight OK' })
    };
  }

  try {
    // ROUTE 1: GET /quizzes
    if (httpMethod === 'GET' && (rawPath.endsWith('/quizzes') || rawPath === '/api/quizzes')) {
      return response(200, {
        success: true,
        quizzes: QUIZZES_CATALOG
      });
    }

    // ROUTE 2: GET /questions?quizId=...
    if (httpMethod === 'GET' && (rawPath.endsWith('/questions') || rawPath === '/api/questions')) {
      const queryParams = event.queryStringParameters || {};
      const quizId = queryParams.quizId || 'aws-cloud-basics';

      const cmd = new QueryCommand({
        TableName: QUIZ_QUESTIONS_TABLE,
        KeyConditionExpression: 'quizId = :qid',
        ExpressionAttributeValues: {
          ':qid': quizId
        }
      });

      const data = await docClient.send(cmd);
      const items = data.Items || [];

      // Mask correctAnswer and explanation so students cannot inspect browser network tools
      const maskedQuestions = items.map((item) => ({
        quizId: item.quizId,
        questionId: item.questionId,
        question: item.question,
        options: item.options
      }));

      // Sort by questionId (q1, q2, ...)
      maskedQuestions.sort((a, b) => a.questionId.localeCompare(b.questionId, undefined, { numeric: true }));

      return response(200, {
        success: true,
        quizId,
        totalQuestions: maskedQuestions.length,
        questions: maskedQuestions
      });
    }

    // ROUTE 3: POST /submit
    if (httpMethod === 'POST' && (rawPath.endsWith('/submit') || rawPath === '/api/submit')) {
      let body = {};
      if (typeof event.body === 'string') {
        body = JSON.parse(event.body || '{}');
      } else if (event.body) {
        body = event.body;
      }

      const { quizId, username, answers = {}, timeSpentSeconds = 0 } = body;

      if (!quizId || !username) {
        return response(400, { error: 'Missing required fields: quizId and username are mandatory.' });
      }

      // Fetch official answer keys from DynamoDB
      const cmd = new QueryCommand({
        TableName: QUIZ_QUESTIONS_TABLE,
        KeyConditionExpression: 'quizId = :qid',
        ExpressionAttributeValues: {
          ':qid': quizId
        }
      });

      const data = await docClient.send(cmd);
      const officialQuestions = data.Items || [];

      let score = 0;
      const review = [];

      for (const q of officialQuestions) {
        const studentChoice = answers[q.questionId] || 'Unanswered';
        const isCorrect = studentChoice === q.correctAnswer;
        if (isCorrect) score++;

        review.push({
          questionId: q.questionId,
          question: q.question,
          selectedAnswer: studentChoice,
          correctAnswer: q.correctAnswer,
          isCorrect,
          explanation: q.explanation
        });
      }

      const total = officialQuestions.length || 1;
      const percentage = Math.round((score / total) * 100);
      const passed = percentage >= 60;
      const resultId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const submittedAt = new Date().toISOString();

      // Record result in DynamoDB QuizResults table
      const putResultCmd = new PutCommand({
        TableName: QUIZ_RESULTS_TABLE,
        Item: {
          quizId,
          resultId,
          username,
          score,
          total,
          percentage,
          passed,
          timeSpentSeconds,
          submittedAt
        }
      });

      await docClient.send(putResultCmd);

      return response(200, {
        success: true,
        resultId,
        quizId,
        username,
        score,
        total,
        percentage,
        passed,
        timeSpentSeconds,
        submittedAt,
        review
      });
    }

    // ROUTE 4: GET /leaderboard?quizId=...
    if (httpMethod === 'GET' && (rawPath.endsWith('/leaderboard') || rawPath === '/api/leaderboard')) {
      const queryParams = event.queryStringParameters || {};
      const quizId = queryParams.quizId || 'aws-cloud-basics';

      const cmd = new QueryCommand({
        TableName: QUIZ_RESULTS_TABLE,
        KeyConditionExpression: 'quizId = :qid',
        ExpressionAttributeValues: {
          ':qid': quizId
        }
      });

      const data = await docClient.send(cmd);
      const results = data.Items || [];

      // Sort by percentage descending, then by timeSpentSeconds ascending
      results.sort((a, b) => {
        if (b.percentage !== a.percentage) {
          return b.percentage - a.percentage;
        }
        return (a.timeSpentSeconds || 0) - (b.timeSpentSeconds || 0);
      });

      // Return top 10 entries
      const top10 = results.slice(0, 10).map((r, index) => ({
        rank: index + 1,
        username: r.username,
        score: r.score,
        total: r.total,
        percentage: r.percentage,
        timeSpentSeconds: r.timeSpentSeconds,
        submittedAt: r.submittedAt
      }));

      return response(200, {
        success: true,
        quizId,
        leaderboard: top10
      });
    }

    // ROUTE 5: POST /questions (Admin Add Question)
    if (httpMethod === 'POST' && (rawPath.endsWith('/questions') || rawPath === '/api/questions')) {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
      const { quizId, questionId, question, options, correctAnswer, explanation } = body;

      if (!quizId || !questionId || !question || !options || !correctAnswer) {
        return response(400, { error: 'Missing mandatory question attributes.' });
      }

      const putCmd = new PutCommand({
        TableName: QUIZ_QUESTIONS_TABLE,
        Item: {
          quizId,
          questionId,
          question,
          options,
          correctAnswer,
          explanation: explanation || ''
        }
      });

      await docClient.send(putCmd);

      return response(201, {
        success: true,
        message: 'Question created successfully in DynamoDB.',
        questionId
      });
    }

    // Fallback: Health check / info
    return response(200, {
      message: 'Serverless Quiz API is running on AWS Lambda & DynamoDB',
      region: REGION,
      supportedRoutes: ['GET /quizzes', 'GET /questions', 'POST /submit', 'GET /leaderboard', 'POST /questions']
    });

  } catch (error) {
    console.error('Handler Error:', error);
    return response(500, {
      error: 'Internal Serverless Handler Error',
      details: error.message
    });
  }
};

function response(statusCode, bodyObj) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(bodyObj)
  };
}
