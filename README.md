# Serverless Online Quiz Application

A production-grade, event-driven serverless web application built for the **Cloud Computing Project-Based Learning (PBL)** curriculum. Powered entirely by **AWS Lambda**, **Amazon API Gateway (HTTP API v2)**, and **Amazon DynamoDB**, delivering sub-100ms response times, auto-scaling to thousands of concurrent users, and operating 100% within the **AWS Always Free Tier** (\$0.00 cost).

---

## Architecture Overview

```
                      ┌─────────────────────────────────┐
                      │   Client Browser (Web UI)       │
                      │   HTML5 / CSS3 / Vanilla JS     │
                      └────────────────┬────────────────┘
                                       │ HTTPS / JSON
                                       ▼
                      ┌─────────────────────────────────┐
                      │    Amazon API Gateway v2        │
                      │    (HTTP API + CORS Enabled)    │
                      └────────────────┬────────────────┘
                                       │ Lambda Proxy v2.0
                                       ▼
                      ┌─────────────────────────────────┐
                      │       AWS Lambda Function       │
                      │     CCQuizHandler (Node 20.x)   │
                      └────────┬───────────────┬────────┘
                               │               │
                 Query / Scan  │               │ PutItem (Submissions)
                               ▼               ▼
        ┌────────────────────────────┐   ┌────────────────────────────┐
        │    Amazon DynamoDB Table   │   │    Amazon DynamoDB Table   │
        │       QuizQuestions        │   │        QuizResults         │
        │   PK: quizId | SK: qId     │   │  PK: quizId | SK: resultId │
        └────────────────────────────┘   └────────────────────────────┘
```

---

## Key Features

* **Event-Driven Serverless Compute**: Zero persistent servers to manage or patch. AWS Lambda executes only on demand during quiz interaction and shuts down immediately.
* **Anti-Cheat Answer Masking**: When questions are retrieved from the API (`GET /questions`), Lambda strips all `correctAnswer` and `explanation` attributes before returning JSON, preventing inspection via browser developer tools.
* **Serverless Scoring Engine**: Answers are submitted to `POST /submit`. Lambda queries trusted answer keys from DynamoDB, calculates score and percentage, records the attempt, and returns a detailed question-by-question review.
* **Real-time Leaderboard**: Queries top student scores dynamically from the DynamoDB `QuizResults` table.
* **On-Demand NoSQL Scaling**: Uses DynamoDB in `PAY_PER_REQUEST` billing mode, scaling automatically with zero capacity planning or connection pooling limits.
* **Editorial Hallmark UI**: Modern, dark-mode design with clean typography (Red Hat Display, Red Hat Text, Red Hat Mono), countdown timers, and keyboard navigation.

---

## Live AWS Cloud Deployment Details

* **AWS Region**: `ap-southeast-2` (Sydney)
* **API Gateway Invoke URL**:  
  `https://vxbfwcvxt2.execute-api.ap-southeast-2.amazonaws.com`
* **AWS Services Utilized**:
  * **AWS Lambda**: `CCQuizHandler` (Runtime: `Node.js 20.x`, Memory: 256 MB)
  * **Amazon API Gateway**: `CCQuizAPI` (Protocol: HTTP API v2, Stage: `$default`)
  * **Amazon DynamoDB**:
    * `QuizQuestions` (Partition Key: `quizId`, Sort Key: `questionId`)
    * `QuizResults` (Partition Key: `quizId`, Sort Key: `resultId`)
  * **AWS IAM**: `CCQuizLambdaRole` (Least-privilege DynamoDB read/write policy)

---

## API Specification

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/quizzes` | Returns available quiz topics with metadata (title, category, duration, question count). |
| `GET` | `/questions?quizId={id}` | Fetches questions for a quiz with answer keys masked for security. |
| `POST` | `/submit` | Validates submitted student answers against DynamoDB answer keys, records result, returns score breakdown. |
| `GET` | `/leaderboard?quizId={id}` | Retrieves top 10 ranked student submissions sorted by score and completion time. |
| `POST` | `/questions` | Admin endpoint to dynamically add new questions to DynamoDB. |

---

## Project Structure

```
CC-PBL/
├── backend/
│   ├── lambda/
│   │   ├── index.mjs             # AWS Lambda handler (ES Modules)
│   │   └── function.zip          # Packaged Lambda deployment artifact
│   ├── iam/
│   │   ├── assume-role-policy.json
│   │   └── dynamodb-policy.json
│   ├── scripts/
│   │   └── seed.mjs              # DynamoDB question seeder script
│   └── seed-questions.json       # 15 Cloud Computing & AWS questions
├── frontend/
│   ├── css/
│   │   ├── base.css              # Reset & accessibility rules
│   │   ├── style.css             # Main styling
│   │   └── tokens.css            # Dark mode tokens (OKLCH palette)
│   ├── js/
│   │   ├── app.js                # Frontend client logic & API fetch
│   │   └── config.js             # API Gateway configuration
│   └── index.html                # Responsive Single Page Application
├── docs/
│   ├── PBL_REPORT.md             # Complete academic PBL project report
│   └── VIVA_QUESTIONS.md         # Top 20 viva interview questions & answers
├── infrastructure/
│   └── template.yaml             # AWS CloudFormation / SAM IaC template
├── server.mjs                    # Zero-dependency local web server
└── package.json                  # Project metadata and scripts
```

---

## Quickstart (Running Locally)

### Prerequisites
* Node.js v18+ (tested on Node.js v26)

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/S-Venky-06/cloud-computing-PBL.git
   cd cloud-computing-PBL
   ```

2. Start the local frontend server:
   ```bash
   npm start
   ```

3. Open your browser:
   ```
   http://localhost:3000
   ```
   The frontend automatically connects to the live AWS API Gateway in Sydney (`ap-southeast-2`).

---

## Cost Optimization (AWS Free Tier Verification)

| AWS Service | Free Tier Allocation | Project Usage | Cost |
| :--- | :--- | :--- | :--- |
| **AWS Lambda** | 1,000,000 requests/month (Always Free) | ~5,000 requests | **\$0.00** |
| **Amazon DynamoDB** | 25 GB storage & 200M requests/month (Always Free) | < 5 MB | **\$0.00** |
| **Amazon API Gateway** | 1,000,000 calls/month | ~5,000 calls | **\$0.00** |
| **Total Cost** | | | **\$0.00** |

---

## Academic Documentation

* **[PBL Project Report](docs/PBL_REPORT.md)**: Detailed report with problem statement, 3-tier architecture, NoSQL data modeling, and security principles.
* **[Viva Questions & Answers](docs/VIVA_QUESTIONS.md)**: 20 high-yield interview questions covering cold starts, DynamoDB Query vs Scan, CORS, and serverless scalability.
* **[CloudFormation Template](infrastructure/template.yaml)**: Complete Infrastructure as Code (IaC) template.

---

## License

This project is licensed under the MIT License.
