//src/App.jsx
// import React, { useEffect } from 'react';
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { api } from './utils/api';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import RecruiterLayout from './layouts/RecruiterLayout';
import CandidateLayout from './layouts/CandidateLayout';
import AuthLayout from './layouts/AuthLayout';

// Landing page
import LandingPage from './pages/LandingPage';

// Admin Pages
import AdminDashboard from './pages/Admin/Dashboard';
import VerifyRecruiters from './pages/Admin/VerifyRecruiters';
import ManageUsers from './pages/Admin/ManageUsers';
import SiteSettings from './pages/Admin/SiteSettings';
import ManageJobs from './pages/Admin/ManageJobs';
import Reports from './pages/Admin/Reports';
import AdminProfile from './pages/Admin/Profile';

// Recruiter Pages
import RecruiterDashboard from './pages/Recruiter/Dashboard';
import PostJob from './pages/Recruiter/PostJob';
import MyJobPosts from './pages/Recruiter/MyJobPosts';
import ApplicationsPage from './pages/Recruiter/ApplicationsPage';
import ViewAppliedCandidates from './pages/Recruiter/ViewAppliedCandidates';
import RecruiterProfile from './pages/Recruiter/Profile';
import RecruiterOnboarding from './pages/Recruiter/RecruiterOnboarding';
import RecruiterPending from './pages/Recruiter/RecruiterPending';
import RecruiterDeclined from './pages/Recruiter/RecruiterDeclined';
import JobDetails from './pages/Recruiter/JobDetails';

// Candidate Pages
import CandidateDashboard from './pages/Candidate/Dashboard';
import ResumeBuilder from './pages/Candidate/ResumeBuilder';
import AppliedJobs from './pages/Candidate/AppliedJobs';
import CandidateProfile from './pages/Candidate/Profile';
import JobSearch from './pages/Candidate/JobSearch';
import ManageCV from './pages/Candidate/ManageCV';
import MockStartPage from "./pages/Candidate/MockStartPage";
import MockDetailedFeedbackPage from "./pages/Candidate/MockDetailedFeedbackPage";
import MockSessionPage from "./pages/Candidate/MockSessionPage";
import MockAnalyticsPage from "./pages/Candidate/MockAnalyticsPage";
import CVRanking from './pages/Candidate/CVRanking';
import InterviewInvitation from './pages/Candidate/InterviewInvitation';
import Interview from './pages/Candidate/Interview';
import JobApply from './pages/Candidate/JobApply';

// Auth Pages
import Login from './auth/Login';
import Signup from './auth/Signup';
import ChooseRole from './auth/ChooseRole';
import ForgotPassword from './auth/ForgotPassword';
import ForgotStatus from './auth/ForgotStatus';
import ResetPassword from './auth/ResetPassword';

// Route protection
import PrivateRoute from './utils/PrivateRoute';

function App() {

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/choose-role" element={<ChooseRole />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/forgot/sent" element={<ForgotStatus />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/recruiter/onboarding" element={<RecruiterOnboarding />} />
        <Route path="/recruiter/pending" element={<RecruiterPending />} />
        <Route path="/recruiter/declined" element={<RecruiterDeclined />} />
      </Route>

      {/* ── Admin ── */}
      <Route
        path="/admin"
        element={
          <PrivateRoute role="admin">
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="verify-recruiters" element={<VerifyRecruiters />} />
        <Route path="manage-users" element={<ManageUsers />} />
        <Route path="site-settings" element={<SiteSettings />} />
        <Route path="manage-jobs" element={<ManageJobs />} />
        <Route path="reports" element={<Reports />} />
        <Route path="profile" element={<AdminProfile />} />
      </Route>

      {/* ── Recruiter ── */}
      <Route
        path="/recruiter"
        element={
          <PrivateRoute role="recruiter">
            <RecruiterLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<RecruiterDashboard />} />
        <Route path="post-job" element={<PostJob />} />
        <Route path="post-job/:id" element={<PostJob />} />
        <Route path="my-jobs" element={<MyJobPosts />} />
        <Route path="my-jobs/:id" element={<JobDetails />} />
        <Route path="jobs/:jobId/applications" element={<ApplicationsPage />} />
        <Route path="view-applied-candidates" element={<ViewAppliedCandidates />} />
        <Route path="profile" element={<RecruiterProfile />} />
      </Route>

      {/* ── Candidate ── */}
      <Route
        path="/candidate"
        element={
          <PrivateRoute role="candidate">
            <CandidateLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<CandidateDashboard />} />
        <Route path="dashboard" element={<CandidateDashboard />} />
        <Route path="resume-builder" element={<ResumeBuilder />} />
        <Route path="applied-jobs" element={<AppliedJobs />} />
        <Route path="profile" element={<CandidateProfile />} />
        <Route path="job-search" element={<JobSearch />} />
        <Route path="manage-cv" element={<ManageCV />} />
        <Route path="mock-interview" element={<MockStartPage />} />
        <Route path="mock-interview/analytics/:sessionId/feedback" element={<MockDetailedFeedbackPage />}/>
        <Route path="mock-interview/session/:sessionId" element={<MockSessionPage />} />
        <Route path="mock-interview/analytics" element={<MockAnalyticsPage />} />
        <Route path="jobs/:jobId/apply" element={<JobApply />} />
        <Route path="cv-ranking" element={<CVRanking />} />
        <Route path="interview-invitation" element={<InterviewInvitation />} />
        <Route path="interview-invitation/:appId" element={<InterviewInvitation />} />
        {/* ✅ Fixed: relative path, correct component */}
        <Route path="interview/:appId" element={<Interview />} />
      </Route>

      <Route path="*" element={<h2>404 - Page Not Found</h2>} />
    </Routes>
  );
}

export default App;
