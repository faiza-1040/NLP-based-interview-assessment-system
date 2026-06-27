// server/index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { verifyTransport } = require('./utils/mailer');
const applicationRoutes = require('./routes/applicationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const jobRoutes = require('./routes/jobRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const profileRoutes = require('./routes/profileRoutes');
const accountRoutes = require('./routes/accountRoutes');


// 🔹 NEW: recruiter profile routes
const recruiterProfileRoutes = require('./routes/recruiterProfileRoutes');

const interviewRoutes = require("./routes/interviewRoutes");
const mockInterviewRoutes = require("./routes/mockInterviewRoutes");
const transcribeRoutes = require("./routes/transcribeRoutes"); // ← VOICE: NEW

const app = express();

/* Middlewares FIRST */
const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.options(/^\/.*$/, cors(corsOptions));
app.use(cookieParser());
/* Static */
app.use(
  '/uploads/resumes',
  express.static(path.join(__dirname, 'uploads/resumes'))
);
app.use(
  '/uploads/profile-photos',
  express.static(path.join(__dirname, 'uploads/profile-photos'))
);

// 🔹 NEW: serve company logos
app.use(
  '/uploads/company-logos',
  express.static(path.join(__dirname, 'uploads/company-logos'))
);

// 🔹 NEW: serve company verification docs
app.use(
  '/uploads/company-docs',
  express.static(path.join(__dirname, 'uploads/company-docs'))
);

/* Routes */
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', adminRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/applications', applicationRoutes);

// candidate profile
app.use('/api/profile', profileRoutes);
app.use("/api/mock", mockInterviewRoutes);
// 🔹 NEW: recruiter profile base URL
app.use('/api/recruiter/profile', recruiterProfileRoutes);

app.use('/api/account', accountRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/transcribe", transcribeRoutes); // ← VOICE: NEW

verifyTransport();

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(process.env.PORT || 5000, () => {
      console.log('✅ Server is running...');
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });