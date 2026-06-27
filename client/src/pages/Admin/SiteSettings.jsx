// client/src/pages/Admin/SiteSettings.jsx
import React from "react";
import "./dashboard.css";

const SiteSettings = () => {
  return (
    <div className="admin-dashboard">
      <section className="admin-page-hero">
        <div>
          <p className="admin-eyebrow">System Configuration</p>
          <h1>Site Settings</h1>
          <p>
            Manage platform-level settings for authentication, recruiter
            approval, job posting, interviews, and AI matching workflow.
          </p>
        </div>
      </section>

      <section className="settings-grid">
        <div className="settings-card">
          <h3>Authentication</h3>
          <p>Cookie-based access and refresh token authentication is enabled.</p>
          <span className="status-pill status-approved">Active</span>
        </div>

        <div className="settings-card">
          <h3>Email Verification</h3>
          <p>Candidates and recruiters must verify email before continuing.</p>
          <span className="status-pill status-approved">Enabled</span>
        </div>

        <div className="settings-card">
          <h3>Recruiter Approval</h3>
          <p>Recruiters require admin approval before accessing dashboard.</p>
          <span className="status-pill status-pending">Manual Review</span>
        </div>

        <div className="settings-card">
          <h3>AI Matching</h3>
          <p>Applications are processed through background matching queue.</p>
          <span className="status-pill status-approved">Enabled</span>
        </div>

        <div className="settings-card">
          <h3>Interview Module</h3>
          <p>Candidate interviews include proctoring, camera checks, and scoring.</p>
          <span className="status-pill status-approved">Enabled</span>
        </div>

        <div className="settings-card">
          <h3>Job Expiry</h3>
          <p>Jobs automatically become closed after the application deadline.</p>
          <span className="status-pill status-approved">Enabled</span>
        </div>
      </section>
    </div>
  );
};

export default SiteSettings;
