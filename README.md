# 🧠 NLP-Based Interview Assessment System

An **AI-powered recruitment platform** that streamlines the hiring process through intelligent resume screening, AI-driven interviews, automated candidate evaluation, and recruiter analytics.

Developed as a **Final Year Project**, the platform combines **Natural Language Processing (NLP)**, **Large Language Models (LLMs)**, **AI**,and modern full-stack technologies to automate recruitment workflows while improving hiring efficiency and candidate assessment.

---

##  Key Features

### 👨‍💼 Candidate Portal

* Secure authentication (Email & Google OAuth)
* AI-powered Resume Builder with multiple templates
* Resume upload and management
* Intelligent job search and applications
* AI Mock Interviews with voice interaction
* Real-time interview scoring and performance analytics
* Interview invitations and application tracking

### 🏢 Recruiter Portal

* Recruiter registration and verification
* Job posting and management
* AI-powered resume screening and candidate ranking
* Candidate shortlisting and interview scheduling
* Interview evaluation and recruitment analytics

### 🛡️ Admin Portal

* Recruiter verification
* User and job management
* Platform reports and analytics
* System administration

---

##  AI Capabilities

* AI-powered resume parsing and candidate ranking
* Semantic matching between resumes and job descriptions
* AI-generated interview questions
* Automated interview evaluation and scoring
* Real-time speech transcription
* AI-powered resume generation and PDF export
* Mock interview analytics and feedback

---

##  Technology Stack

### Frontend

* React.js (Vite)
* React Router
* Axios
* Tailwind CSS / CSS
* Monaco Editor
* Google OAuth

### Backend

* Node.js
* Express.js
* MongoDB & Mongoose
* JWT Authentication
* BullMQ & Redis
* Cloudinary
* Nodemailer

### AI & NLP

* FastAPI
* Python
* Groq (LLaMA)
* Hugging Face Transformers
* BM25 Search
* Semantic Similarity
* OCR Processing

---

##  Project Architecture

```text
Client (React)
      │
      ▼
Express.js REST API
      │
      ├──────── MongoDB
      │
      ├──────── Redis + BullMQ
      │
      ▼
Python FastAPI NLP Service
      │
      ├── Resume Parsing
      ├── Semantic Matching
      ├── Interview Generation
      ├── AI Evaluation
      └── Resume Builder
```

---

##  Core Modules

* Authentication & Authorization
* Resume Builder
* Resume Parsing
* AI Candidate Ranking
* Job Management
* Application Management
* Mock Interviews
*  AI Interview (text, video, voice)
* AI Interview Assessment
* Speech-to-Text
* Resume PDF Generation
* Recruiter Dashboard
* Admin Dashboard

---

##  Project Structure

```text
client/          React Frontend
server/          Express REST API
nlp-service/     Python FastAPI AI Service
```

---

##  Installation

```bash
git clone https://github.com/faiza-1040/NLP-based-interview-assessment-system.git
cd NLP-based-interview-assessment-system
```

Install dependencies for each service:

```bash
cd client && npm install

cd ../server && npm install

cd ../nlp-service && pip install -r requirements.txt
```

Configure the required `.env` files before running the application.

---

## ▶️ Running the Application

Start the services in the following order:

1. MongoDB
2. Redis
3. FastAPI NLP Service
4. Express Server
5. BullMQ Workers
6. React Frontend

---

##  User Roles

| Role      | Responsibilities                                                 |
| --------- | ---------------------------------------------------------------- |
| Candidate | Resume creation, job applications, AI interviews                 |
| Recruiter | Job posting, AI candidate screening, interview management        |
| Admin     | User management, recruiter verification, platform administration |

---

##  Highlights

* Full-stack microservice architecture
* AI-powered recruitment workflow
* Resume semantic matching
* Real-time AI interview evaluation
* Background job processing using BullMQ
* Secure authentication with JWT & Google OAuth
* Modern, responsive React interface

---


