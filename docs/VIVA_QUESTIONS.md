# Cloud Computing PBL - Top 20 Viva Questions & Answers

Master these questions and answers to confidently answer any question your professor or external evaluator asks during your project presentation!

---

### Category 1: Serverless & Architecture Concepts

#### Q1: What does "Serverless" actually mean? Are there really no servers?
> **Answer**:  
> "Serverless does not mean there are no servers. It means that as developers, we do **not have to provision, manage, patch, or scale servers**. Cloud providers (AWS) handle the server infrastructure automatically. We only write code (Functions-as-a-Service) and pay strictly for the milliseconds of compute time used while our code is running."

#### Q2: Why choose AWS Lambda over Amazon EC2 for this quiz application?
> **Answer**:  
> "An online quiz has unpredictable traffic — students take quizzes at specific times, leaving the system idle most of the day. With EC2, we would have to pay 24/7 for a virtual machine whether students use it or not. With Lambda, if nobody takes a quiz, our compute cost is **\$0.00**. When 1,000 students submit at once, Lambda automatically scales to 1,000 parallel instances in milliseconds."

#### Q3: What is a Lambda "Cold Start" and how did you manage it?
> **Answer**:  
> "A cold start is the slight delay (typically 100–300ms for Node.js) when AWS initializes a new container sandbox and loads runtime dependencies for the first invocation after being idle. Because we used **Node.js 20.x** and lightweight built-in AWS SDK v3 without heavy external node_modules, our cold start latency is minimal and subsequent invocations are 'warm' (taking under 20ms)."

#### Q4: Explain the 3-Tier Architecture in your project.
> **Answer**:  
> "Our application follows a decoupled 3-tier cloud architecture:
> 1. **Presentation Tier (Frontend)**: Responsive Single Page App (HTML5, CSS3, JavaScript) that can run on Amazon S3 or any browser.
> 2. **API & Logic Tier (Backend)**: Amazon API Gateway routing REST requests to AWS Lambda functions for business logic.
> 3. **Data Tier (Storage)**: Amazon DynamoDB NoSQL database storing questions and student results."

---

### Category 2: Amazon DynamoDB & Data Modeling

#### Q5: Why did you choose DynamoDB (NoSQL) instead of a relational database like MySQL or RDS?
> **Answer**:  
> "Three reasons:
> 1. **Serverless Scaling**: DynamoDB operates in On-Demand mode with zero server provisioning and scales automatically with zero connection pooling limits.
> 2. **Performance**: Provides single-digit millisecond response times regardless of table size.
> 3. **Cost**: Under the AWS Always Free Tier, DynamoDB offers 25 GB of storage and 200 million requests/month forever at zero cost, whereas RDS instances incur hourly charges."

#### Q6: Explain your DynamoDB primary key design for `QuizQuestions`.
> **Answer**:  
> "We used a **composite primary key**:
> * **Partition Key (HASH)**: `quizId` (e.g. `aws-cloud-basics`). This groups all questions belonging to the same quiz topic together on the same physical database partition.
> * **Sort Key (RANGE)**: `questionId` (e.g. `q1`, `q2`). This allows us to query all questions for a specific quiz with a single fast `Query` operation."

#### Q7: What is the difference between `Scan` and `Query` in DynamoDB? Which one did you use?
> **Answer**:  
> "A `Query` finds items based on primary key values and only searches the specific partition, making it very fast and efficient. A `Scan` examines every single item in the entire table, which is slower and consumes more read capacity. We used **`Query`** for fetching quiz questions and submitting results."

#### Q8: What DynamoDB capacity mode did you choose and why?
> **Answer**:  
> "We chose **On-Demand (Pay-Per-Request)** mode. In this mode, we don't have to guess or provision Read/Write Capacity Units (RCUs/WCUs). DynamoDB instantly accommodates bursts in traffic and charges strictly per read/write unit, which falls completely within the AWS Free Tier."

---

### Category 3: Amazon API Gateway & Security

#### Q9: What role does Amazon API Gateway play in your architecture?
> **Answer**:  
> "Amazon API Gateway acts as the secure 'front door' for our backend. It receives incoming HTTP/HTTPS requests from the browser, handles routing (`/quizzes`, `/questions`, `/submit`, `/leaderboard`), manages CORS preflight checks, and securely triggers our AWS Lambda function via Lambda Proxy Integration."

#### Q10: What is CORS and why is it important in this project?
> **Answer**:  
> "CORS (Cross-Origin Resource Sharing) is a browser security mechanism that restricts web pages from making AJAX requests to a different domain or port than the one serving the page. Because our frontend runs on one origin and our API Gateway endpoint is on `amazonaws.com`, we configured API Gateway and Lambda to return CORS headers (`Access-Control-Allow-Origin: *`) so our frontend can communicate safely."

#### Q11: How do you prevent students from cheating by inspecting the browser network tab?
> **Answer**:  
> "In our Lambda function, when `GET /questions` is called, our code queries DynamoDB but **explicitly strips out the `correctAnswer` and `explanation` attributes** before returning the JSON payload to the client. The browser never receives the answer keys. Scoring is performed exclusively inside the secure Lambda execution environment on AWS."

#### Q12: What IAM role did you configure for AWS Lambda?
> **Answer**:  
> "We created `CCQuizLambdaRole` adhering to the **Principle of Least Privilege (PoLP)**. Instead of full admin access, it is restricted to:
> 1. `AWSLambdaBasicExecutionRole` (permission to create CloudWatch log streams).
> 2. Specific DynamoDB permissions (`GetItem`, `PutItem`, `Query`) restricted only to the ARNs of `QuizQuestions` and `QuizResults` in `ap-southeast-2`."

---

### Category 4: Cloud Computing Models & AWS Free Tier

#### Q13: In which cloud service category does this project belong: IaaS, PaaS, or FaaS/Serverless?
> **Answer**:  
> "It belongs to **FaaS (Function-as-a-Service)** and **Serverless**. Unlike IaaS (like AWS EC2, where we manage OS and middleware) or PaaS (like Elastic Beanstalk), Serverless requires zero infrastructure management. The cloud provider takes full responsibility for server maintenance, scaling, high availability, and runtime environments."

#### Q14: How much does running this application on AWS cost?
> **Answer**:  
> "**\$0.00 (Zero dollars)**. It operates 100% within the AWS Free Tier:
> * Lambda includes 1 Million free requests/month (Always Free).
> * DynamoDB includes 25 GB storage and 200 Million requests/month (Always Free).
> * API Gateway includes 1 Million calls/month.
> * S3 includes 5 GB storage."

#### Q15: In which AWS Region is your project deployed and why?
> **Answer**:  
> "Our resources are deployed in **`ap-southeast-2` (Sydney)**. Choosing an AWS region close to our project location minimizes network latency and complies with AWS project governance and data residency best practices."

#### Q16: How do you monitor and debug your serverless application?
> **Answer**:  
> "We use **Amazon CloudWatch**. Every time Lambda executes, it automatically logs request IDs, execution duration (in milliseconds), memory utilized, and any runtime errors or console logs into CloudWatch Log Groups (`/aws/lambda/CCQuizHandler`)."

---

### Category 5: Live Demonstration & Code Flow

#### Q17: Walk me through what happens when a student clicks "Submit Quiz".
> **Answer**:  
> "1. The browser gathers the student's selected options and sends a `POST /submit` JSON payload via HTTPS to Amazon API Gateway.  
> 2. API Gateway validates the route and triggers the `CCQuizHandler` Lambda function.  
> 3. Lambda queries DynamoDB `QuizQuestions` to retrieve the hidden official answer keys.  
> 4. Lambda compares each answer, computes the score, percentage, and pass/fail status.  
> 5. Lambda writes the submission record to the `QuizResults` DynamoDB table.  
> 6. Lambda returns a 200 OK response with the evaluated score breakdown and cloud explanations to the frontend."

#### Q18: What happens if 5,000 students submit their quiz at the exact same second?
> **Answer**:  
> "AWS Lambda automatically scales out by spinning up concurrent function instances to process all 5,000 requests in parallel. Because DynamoDB is in On-Demand mode, it automatically scales read and write request units without throttling. API Gateway effortlessly throttles and handles traffic bursts up to 10,000 requests per second by default."

#### Q19: If you had more time, what cloud enhancements would you add?
> **Answer**:  
> "1. **Amazon Cognito**: Add user authentication with Google/University email sign-in.  
> 2. **Amazon Bedrock (Generative AI)**: Automatically generate new quiz questions from uploaded lecture notes or PDFs using an LLM like Claude 3.5.  
> 3. **Amazon CloudFront**: Global CDN for single-digit millisecond latency across worldwide locations.  
> 4. **Amazon SNS / SES**: Send email alerts and certificates to students upon passing the quiz."

#### Q20: What is the main takeaway you learned from this Cloud Computing PBL project?
> **Answer**:  
> "The key takeaway is how cloud-native serverless architecture eliminates the trade-off between scalability and cost. By composing event-driven microservices (API Gateway + Lambda + DynamoDB), we built an enterprise-grade, highly available quiz engine that scales to thousands of users on demand while costing literally \$0.00 when idle."
