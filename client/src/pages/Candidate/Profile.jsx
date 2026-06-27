//client/src/pages/Candidate/Profile.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../utils/api";
import { useAuth } from "../../context/authContext";
import "./Profile.css";

const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:5000";

const resolveFileUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url}`;
};

const EMPTY_PROFILE = {
  fullName: "",
  email: "",
  phone: "",
  city: "",
  bio: "",
  skills: [],
  skillsText: "",
  photoUrl: "",
  jobTitle: "",
  targetRole: "",
  jobType: "",
  preferredLocations: "",
  expectedSalary: "",
  willingToRelocate: "",
  linkedin: "",
  github: "",
  portfolio: "",

  // Kept here only to avoid deleting old saved profile data accidentally.
  // These sections are no longer shown in the Candidate Profile UI.
  aiInterviewHistory: [],
  jobMatchInsights: [],
};

const EMPTY_PERFORMANCE_DASHBOARD = {
  completedInterviews: 0,
  averageScore: 0,
  averageIntegrityScore: 100,
  strongSkills: [],
  weakAreas: [],
  progressLastFive: [],
  recentInterviews: [],
  recommendations: [],
};

const formatScore = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0%";
  return `${Math.round(num)}%`;
};

const formatDate = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "—";
  }
};

const Profile = () => {
  const navigate = useNavigate();
  const { logoutAuth } = useAuth();
  const [activeSection, setActiveSection] = useState("summary");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [performanceDashboard, setPerformanceDashboard] = useState(
    EMPTY_PERFORMANCE_DASHBOARD,
  );
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [performanceError, setPerformanceError] = useState("");

  // controls UI: Save vs Edit/Delete for editable profile sections
  const [editingSections, setEditingSections] = useState({
    overview: true,
    preferences: true,
    social: true,
  });

  // status message after saving
  const [saveStatus, setSaveStatus] = useState({
    section: null,
    message: "",
  });

  /* ---------- Load profile from API ---------- */

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/profile/me");
        const data = res.data || {};
        setProfile({
          ...EMPTY_PROFILE,
          ...data,
          skills: Array.isArray(data.skills) ? data.skills : [],
          skillsText: Array.isArray(data.skills) ? data.skills.join(", ") : "",
        });
      } catch (err) {
        console.error("Load profile error:", err?.response || err);
        setProfile(EMPTY_PROFILE);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  /* ---------- Load real interview performance dashboard ---------- */

  const fetchPerformanceDashboard = async () => {
    try {
      setPerformanceLoading(true);
      setPerformanceError("");

      const res = await api.get("/interview/candidate/performance-dashboard");
      setPerformanceDashboard({
        ...EMPTY_PERFORMANCE_DASHBOARD,
        ...(res.data || {}),
        strongSkills: Array.isArray(res.data?.strongSkills)
          ? res.data.strongSkills
          : [],
        weakAreas: Array.isArray(res.data?.weakAreas) ? res.data.weakAreas : [],
        progressLastFive: Array.isArray(res.data?.progressLastFive)
          ? res.data.progressLastFive
          : [],
        recentInterviews: Array.isArray(res.data?.recentInterviews)
          ? res.data.recentInterviews
          : [],
        recommendations: Array.isArray(res.data?.recommendations)
          ? res.data.recommendations
          : [],
      });
    } catch (err) {
      console.error("Performance dashboard error:", err?.response || err);
      setPerformanceError(
        err?.response?.data?.message ||
          "Unable to load real interview performance dashboard.",
      );
      setPerformanceDashboard(EMPTY_PERFORMANCE_DASHBOARD);
    } finally {
      setPerformanceLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceDashboard();
  }, []);

  /* ---------- Completion % ---------- */

  const completion = useMemo(() => {
    // 3 sections: overview, preferences, social
    let total = 3;
    let done = 0;

    const hasOverview =
      profile.fullName &&
      profile.email &&
      profile.phone &&
      profile.city &&
      profile.bio &&
      profile.skillsText &&
      profile.skillsText.trim().length > 0;

    const hasPreferences =
      (profile.jobTitle || profile.targetRole) &&
      profile.jobType &&
      profile.preferredLocations &&
      profile.expectedSalary &&
      profile.willingToRelocate;

    const hasSocial = profile.linkedin && profile.github && profile.portfolio;

    if (hasOverview) done++;
    if (hasPreferences) done++;
    if (hasSocial) done++;

    if (!done) return 0;
    return Math.round((done / total) * 100);
  }, [profile]);

  /* ---------- Save helpers ---------- */

  const buildPayload = (override = {}) => {
    const merged = { ...profile, ...override };
    const skillsArr = (merged.skillsText || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      fullName: merged.fullName,
      email: merged.email,
      phone: merged.phone,
      city: merged.city,
      bio: merged.bio,
      skills: skillsArr,
      jobTitle: merged.jobTitle,
      targetRole: merged.targetRole,
      jobType: merged.jobType,
      preferredLocations: merged.preferredLocations,
      expectedSalary: merged.expectedSalary,
      willingToRelocate: merged.willingToRelocate,
      linkedin: merged.linkedin,
      github: merged.github,
      portfolio: merged.portfolio,

      // Preserve old saved data, but do not show it in UI anymore.
      aiInterviewHistory: merged.aiInterviewHistory || [],
      jobMatchInsights: merged.jobMatchInsights || [],
    };
  };

  const saveProfile = async (override = {}, sectionKey = null) => {
    try {
      setSaving(true);
      const payload = buildPayload(override);

      const res = await api.put("/profile/me", payload);

      const data = res.data || {};
      setProfile({
        ...EMPTY_PROFILE,
        ...data,
        skills: Array.isArray(data.skills) ? data.skills : [],
        skillsText: Array.isArray(data.skills) ? data.skills.join(", ") : "",
      });

      if (sectionKey) {
        setEditingSections((prev) => ({
          ...prev,
          [sectionKey]: false,
        }));
        setSaveStatus({
          section: sectionKey,
          message: "Your changes are saved.",
        });
      }
    } catch (err) {
      console.error("Save profile error:", err?.response || err);
      alert("Failed to save profile. Check console for details.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditSection = (sectionKey) => {
    setEditingSections((prev) => ({
      ...prev,
      [sectionKey]: true,
    }));
    setSaveStatus({ section: null, message: "" });
    setActiveSection(sectionKey);
  };

  const handleClearSection = (sectionKey) => {
    let overrides = {};
    switch (sectionKey) {
      case "overview":
        overrides = {
          fullName: "",
          email: "",
          phone: "",
          city: "",
          bio: "",
          skills: [],
          skillsText: "",
        };
        break;
      case "preferences":
        overrides = {
          jobTitle: "",
          targetRole: "",
          jobType: "",
          preferredLocations: "",
          expectedSalary: "",
          willingToRelocate: "",
        };
        break;
      case "social":
        overrides = {
          linkedin: "",
          github: "",
          portfolio: "",
        };
        break;
      default:
        break;
    }

    if (Object.keys(overrides).length) {
      saveProfile(overrides, sectionKey);
    }
  };

  const handleLogout = async () => {
    await logoutAuth();
    navigate("/login");
  };

  const handleDeleteProfile = async () => {
    if (
      !window.confirm(
        "Are you sure you want to clear your profile data (but keep your login account)?",
      )
    ) {
      return;
    }
    try {
      await api.delete("/profile/me");
      setProfile(EMPTY_PROFILE);
    } catch (err) {
      console.error("Delete profile error:", err?.response || err);
      alert("Failed to delete profile.");
    }
  };

  const handleDeleteAccount = async () => {
    const sure = window.confirm(
      "This will permanently delete your candidate account and profile data. This action cannot be undone. Continue?",
    );
    if (!sure) return;

    try {
      await api.delete("/account/me");
      await logoutAuth();
      navigate("/login");
    } catch (err) {
      console.error("Delete account error:", err?.response || err);
      alert("Failed to delete account. Please try again.");
    }
  };

  /* ---------- Photo upload ---------- */

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("photo", file);

    try {
      const res = await api.post("/profile/photo", form, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const { photoUrl, profile: updated } = res.data;

      setProfile((prev) => ({
        ...prev,
        photoUrl: photoUrl || prev.photoUrl,
        ...updated,
        skillsText: Array.isArray(updated?.skills)
          ? updated.skills.join(", ")
          : prev.skillsText,
      }));
    } catch (err) {
      console.error("Upload photo error:", err?.response || err);
      alert("Failed to upload photo.");
    }
  };

  /* ---------- AI Performance Dashboard renderer ---------- */

  const renderPerformanceDashboard = () => {
    const hasCompletedInterviews =
      Number(performanceDashboard.completedInterviews || 0) > 0;

    return (
      <div className="profile-card">
        <div className="dashboard-title-row">
          <div>
            <h2 className="profile-card-title">AI Performance Dashboard</h2>
            <p className="profile-card-subtitle">
              Real interview performance based on completed recruiter-scheduled
              interviews.
            </p>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={fetchPerformanceDashboard}
            disabled={performanceLoading}
          >
            {performanceLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {performanceLoading ? (
          <p className="hint">Loading your real interview performance...</p>
        ) : performanceError ? (
          <div className="dashboard-empty-state">
            <h3>Dashboard unavailable</h3>
            <p>{performanceError}</p>
          </div>
        ) : !hasCompletedInterviews ? (
          <div className="dashboard-empty-state">
            <h3>No completed real interviews yet</h3>
            <p>
              Your performance dashboard will appear here after you complete a
              recruiter-scheduled interview. Mock interviews are not included in
              this dashboard.
            </p>
          </div>
        ) : (
          <>
            <div className="performance-kpi-grid">
              <div className="performance-kpi-card">
                <span className="kpi-label">Overall Score</span>
                <strong>
                  {formatScore(performanceDashboard.averageScore)}
                </strong>
                <small>Average across completed real interviews</small>
              </div>

              <div className="performance-kpi-card">
                <span className="kpi-label">Completed Interviews</span>
                <strong>{performanceDashboard.completedInterviews}</strong>
                <small>Total real interviews completed</small>
              </div>

              <div className="performance-kpi-card">
                <span className="kpi-label">Strong Skills</span>
                <strong>{performanceDashboard.strongSkills.length}</strong>
                <small>Skills detected from high-scoring answers</small>
              </div>

              <div className="performance-kpi-card">
                <span className="kpi-label">Integrity Score</span>
                <strong>
                  {formatScore(performanceDashboard.averageIntegrityScore)}
                </strong>
                <small>Based on interview monitoring risk</small>
              </div>
            </div>

            <div className="dashboard-two-column">
              <div className="dashboard-panel">
                <h3>Strong Skills</h3>
                {performanceDashboard.strongSkills.length ? (
                  <div className="skill-chip-list">
                    {performanceDashboard.strongSkills.map((item, idx) => (
                      <div className="skill-score-chip strong" key={idx}>
                        <span>{item.skill}</span>
                        <strong>{formatScore(item.averageScore)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hint">
                    No strong skill has been detected yet. Complete more real
                    interviews for better analysis.
                  </p>
                )}
              </div>

              <div className="dashboard-panel">
                <h3>Weak Areas</h3>
                {performanceDashboard.weakAreas.length ? (
                  <div className="skill-chip-list">
                    {performanceDashboard.weakAreas.map((item, idx) => (
                      <div className="skill-score-chip weak" key={idx}>
                        <span>{item.skill}</span>
                        <strong>
                          {item.averageScore === null ||
                          item.averageScore === undefined
                            ? "Needs practice"
                            : formatScore(item.averageScore)}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hint">
                    No weak area detected yet. Keep completing interviews to
                    build a more accurate analysis.
                  </p>
                )}
              </div>
            </div>

            <div className="dashboard-panel">
              <h3>Progress Graph - Last 5 Real Interviews</h3>

              {performanceDashboard.progressLastFive.length ? (
                <div className="progress-graph">
                  {performanceDashboard.progressLastFive.map((item, idx) => {
                    const height = Math.max(
                      8,
                      Math.min(100, Number(item.score || 0)),
                    );

                    return (
                      <div
                        className="progress-bar-item"
                        key={item.interviewId || idx}
                      >
                        <div className="progress-bar-track">
                          <div
                            className="progress-bar-value"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="progress-score">
                          {formatScore(item.score)}
                        </span>
                        <span className="progress-label" title={item.jobTitle}>
                          {item.jobTitle || `Interview ${idx + 1}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="hint">
                  Progress graph will appear after interviews.
                </p>
              )}
            </div>

            <div className="dashboard-panel">
              <h3>Recent Real Interview Breakdown</h3>

              {performanceDashboard.recentInterviews.length ? (
                <div className="performance-table">
                  <div className="performance-table-header">
                    <span>Job Title</span>
                    <span>Date</span>
                    <span>Score</span>
                    <span>Integrity</span>
                    <span>Questions</span>
                  </div>

                  {performanceDashboard.recentInterviews.map((item, idx) => (
                    <div
                      className="performance-table-row"
                      key={item.interviewId || idx}
                    >
                      <span>{item.jobTitle || "Interview"}</span>
                      <span>{formatDate(item.completedAt)}</span>
                      <span>{formatScore(item.overallScore)}</span>
                      <span>{formatScore(item.integrityScore)}</span>
                      <span>
                        {item.answeredQuestions || 0}/{item.totalQuestions || 0}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="hint">No recent interview data available.</p>
              )}
            </div>

            <div className="dashboard-panel">
              <h3>AI Suggestions</h3>
              {performanceDashboard.recommendations.length ? (
                <ul className="recommendation-list">
                  {performanceDashboard.recommendations.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="hint">
                  Suggestions will appear after the AI has enough real interview
                  data.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  /* ---------- Summary renderer ---------- */

  const renderSummarySection = () => {
    const hasOverview =
      profile.fullName ||
      profile.email ||
      profile.phone ||
      profile.city ||
      profile.bio ||
      (profile.skillsText && profile.skillsText.trim().length > 0);

    const hasPreferences =
      profile.jobTitle ||
      profile.targetRole ||
      profile.jobType ||
      profile.preferredLocations ||
      profile.expectedSalary ||
      profile.willingToRelocate;

    const hasSocial = profile.linkedin || profile.github || profile.portfolio;

    return (
      <div className="profile-card">
        <h2 className="profile-card-title">Profile Summary</h2>
        <p className="profile-card-subtitle">
          A quick overview of your profile, preferences and social links.
        </p>

        <div className="profile-summary-grid">
          {/* Overview Summary */}
          <div className="summary-section-card">
            <div className="summary-header">
              <h3 className="summary-title">Profile Overview</h3>
              <button
                type="button"
                className="summary-edit-btn"
                onClick={() => handleEditSection("overview")}
                title="Edit Profile Overview"
              >
                <i className="fa-solid fa-pen"></i>
              </button>
            </div>

            {hasOverview ? (
              <ul className="summary-list">
                {profile.fullName && (
                  <li>
                    <strong>Name:</strong> {profile.fullName}
                  </li>
                )}
                {profile.email && (
                  <li>
                    <strong>Email:</strong> {profile.email}
                  </li>
                )}
                {profile.phone && (
                  <li>
                    <strong>Phone:</strong> {profile.phone}
                  </li>
                )}
                {profile.city && (
                  <li>
                    <strong>City:</strong> {profile.city}
                  </li>
                )}
                {profile.bio && (
                  <li>
                    <strong>Bio:</strong> {profile.bio}
                  </li>
                )}
                {profile.skillsText && (
                  <li>
                    <strong>Skills:</strong> {profile.skillsText}
                  </li>
                )}
              </ul>
            ) : (
              <p className="summary-empty">No overview details added yet.</p>
            )}
          </div>

          {/* Preferences Summary */}
          <div className="summary-section-card">
            <div className="summary-header">
              <h3 className="summary-title">Preferences</h3>
              <button
                type="button"
                className="summary-edit-btn"
                onClick={() => handleEditSection("preferences")}
                title="Edit Preferences"
              >
                <i className="fa-solid fa-pen"></i>
              </button>
            </div>

            {hasPreferences ? (
              <ul className="summary-list">
                {profile.jobTitle && (
                  <li>
                    <strong>Job Title:</strong> {profile.jobTitle}
                  </li>
                )}
                {profile.targetRole && (
                  <li>
                    <strong>Target Role:</strong> {profile.targetRole}
                  </li>
                )}
                {profile.jobType && (
                  <li>
                    <strong>Job Type:</strong> {profile.jobType}
                  </li>
                )}
                {profile.preferredLocations && (
                  <li>
                    <strong>Preferred Locations:</strong>{" "}
                    {profile.preferredLocations}
                  </li>
                )}
                {profile.expectedSalary && (
                  <li>
                    <strong>Expected Salary:</strong> {profile.expectedSalary}
                  </li>
                )}
                {profile.willingToRelocate && (
                  <li>
                    <strong>Willing to Relocate:</strong>{" "}
                    {profile.willingToRelocate}
                  </li>
                )}
              </ul>
            ) : (
              <p className="summary-empty">No preferences added yet.</p>
            )}
          </div>

          {/* Social Links Summary */}
          <div className="summary-section-card">
            <div className="summary-header">
              <h3 className="summary-title">Social Links</h3>
              <button
                type="button"
                className="summary-edit-btn"
                onClick={() => handleEditSection("social")}
                title="Edit Social Links"
              >
                <i className="fa-solid fa-pen"></i>
              </button>
            </div>

            {hasSocial ? (
              <ul className="summary-list">
                {profile.linkedin && (
                  <li>
                    <strong>LinkedIn:</strong>{" "}
                    <a href={profile.linkedin} target="_blank" rel="noreferrer">
                      {profile.linkedin}
                    </a>
                  </li>
                )}
                {profile.github && (
                  <li>
                    <strong>GitHub:</strong>{" "}
                    <a href={profile.github} target="_blank" rel="noreferrer">
                      {profile.github}
                    </a>
                  </li>
                )}
                {profile.portfolio && (
                  <li>
                    <strong>Portfolio:</strong>{" "}
                    <a
                      href={profile.portfolio}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {profile.portfolio}
                    </a>
                  </li>
                )}
              </ul>
            ) : (
              <p className="summary-empty">No social links added yet.</p>
            )}
          </div>

          {/* AI Performance Summary */}
          <div className="summary-section-card">
            <div className="summary-header">
              <h3 className="summary-title">AI Performance</h3>
              <button
                type="button"
                className="summary-edit-btn"
                onClick={() => setActiveSection("performance")}
                title="Open AI Performance Dashboard"
              >
                <i className="fa-solid fa-chart-line"></i>
              </button>
            </div>

            {performanceLoading ? (
              <p className="summary-empty">Loading performance...</p>
            ) : Number(performanceDashboard.completedInterviews || 0) > 0 ? (
              <ul className="summary-list">
                <li>
                  <strong>Overall Score:</strong>{" "}
                  {formatScore(performanceDashboard.averageScore)}
                </li>
                <li>
                  <strong>Completed Interviews:</strong>{" "}
                  {performanceDashboard.completedInterviews}
                </li>
                <li>
                  <strong>Strong Skills:</strong>{" "}
                  {performanceDashboard.strongSkills
                    .slice(0, 3)
                    .map((s) => s.skill)
                    .join(", ") || "—"}
                </li>
                <li>
                  <strong>Weak Areas:</strong>{" "}
                  {performanceDashboard.weakAreas
                    .slice(0, 3)
                    .map((s) => s.skill)
                    .join(", ") || "—"}
                </li>
              </ul>
            ) : (
              <p className="summary-empty">
                No completed real interview data yet.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ---------- Section renderers ---------- */

  const renderSection = () => {
    switch (activeSection) {
      case "summary":
        return renderSummarySection();

      case "overview":
        return (
          <div className="profile-card">
            <h2 className="profile-card-title">Profile Overview</h2>
            <p className="profile-card-subtitle">
              Basic information about you as a candidate.
            </p>

            <div className="profile-grid-2">
              <div className="profile-photo-block">
                {profile.photoUrl ? (
                  // <img
                  //   src={`${API_BASE}${profile.photoUrl}`}
                  //   alt="Profile"
                  //   className="profile-photo-img"
                  // />
                  <img
                    src={resolveFileUrl(profile.photoUrl)}
                    alt="Profile"
                    className="profile-photo-img"
                  />
                ) : (
                  <div className="profile-photo-placeholder">
                    <span>Upload Photo</span>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="photo-upload-input"
                />
              </div>

              <div className="profile-form">
                <div className="form-row">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={profile.fullName}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        fullName: e.target.value,
                      }))
                    }
                    placeholder="Sania Abdul Jalil"
                    disabled={!editingSections.overview}
                  />
                </div>

                <div className="form-row">
                  <label>Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        email: e.target.value,
                      }))
                    }
                    placeholder="you@example.com"
                    disabled={!editingSections.overview}
                  />
                </div>

                <div className="form-row">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        phone: e.target.value,
                      }))
                    }
                    placeholder="+92-300-0000000"
                    disabled={!editingSections.overview}
                  />
                </div>

                <div className="form-row">
                  <label>City</label>
                  <input
                    type="text"
                    value={profile.city}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        city: e.target.value,
                      }))
                    }
                    placeholder="Karachi / Islamabad"
                    disabled={!editingSections.overview}
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <label>Short Bio / Summary</label>
              <textarea
                rows={3}
                value={profile.bio}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, bio: e.target.value }))
                }
                placeholder="Short 2–3 line summary about your experience and goals."
                disabled={!editingSections.overview}
              />
            </div>

            <div className="form-row">
              <label>Skills</label>
              <input
                type="text"
                value={profile.skillsText}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    skillsText: e.target.value,
                  }))
                }
                placeholder="e.g. React, Node.js, SQL, Communication"
                disabled={!editingSections.overview}
              />
              <small className="hint">
                Separate skills with commas. These will be saved as tags.
              </small>
            </div>

            <div className="profile-actions-row">
              {editingSections.overview ? (
                <button
                  className="btn-primary"
                  onClick={() => saveProfile({}, "overview")}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              ) : (
                <>
                  <span className="save-message">
                    {saveStatus.section === "overview" && saveStatus.message
                      ? saveStatus.message
                      : "Your changes are saved."}
                  </span>
                  <div className="actions-buttons">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleEditSection("overview")}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-light-danger"
                      onClick={() => handleClearSection("overview")}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case "preferences":
        return (
          <div className="profile-card">
            <h2 className="profile-card-title">Preferences</h2>
            <p className="profile-card-subtitle">
              Tell us what kind of roles you are looking for.
            </p>

            <div className="form-row">
              <label>Job Title</label>
              <input
                type="text"
                value={profile.jobTitle}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, jobTitle: e.target.value }))
                }
                placeholder="e.g. Junior Software Engineer"
                disabled={!editingSections.preferences}
              />
            </div>

            <div className="form-row">
              <label>Target Job Role</label>
              <input
                type="text"
                value={profile.targetRole}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, targetRole: e.target.value }))
                }
                placeholder="e.g. Backend Developer, Data Engineer"
                disabled={!editingSections.preferences}
              />
            </div>

            <div className="form-row">
              <label>Job Type</label>
              <select
                value={profile.jobType}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, jobType: e.target.value }))
                }
                disabled={!editingSections.preferences}
              >
                <option value="">Select...</option>
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Remote</option>
                <option>Internship</option>
              </select>
            </div>

            <div className="form-row">
              <label>Preferred Locations</label>
              <input
                type="text"
                value={profile.preferredLocations}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    preferredLocations: e.target.value,
                  }))
                }
                placeholder="e.g. Karachi, Islamabad, Remote"
                disabled={!editingSections.preferences}
              />
            </div>

            <div className="form-row">
              <label>Expected Salary</label>
              <input
                type="text"
                value={profile.expectedSalary}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    expectedSalary: e.target.value,
                  }))
                }
                placeholder="e.g. 60,000 - 80,000 / month"
                disabled={!editingSections.preferences}
              />
            </div>

            <div className="form-row">
              <label>Willing to Relocate</label>
              <select
                value={profile.willingToRelocate}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    willingToRelocate: e.target.value,
                  }))
                }
                disabled={!editingSections.preferences}
              >
                <option value="">Select...</option>
                <option>Yes</option>
                <option>No</option>
                <option>Maybe</option>
              </select>
            </div>

            <div className="profile-actions-row">
              {editingSections.preferences ? (
                <button
                  className="btn-primary"
                  onClick={() => saveProfile({}, "preferences")}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Preferences"}
                </button>
              ) : (
                <>
                  <span className="save-message">
                    {saveStatus.section === "preferences" && saveStatus.message
                      ? saveStatus.message
                      : "Your changes are saved."}
                  </span>
                  <div className="actions-buttons">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleEditSection("preferences")}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-light-danger"
                      onClick={() => handleClearSection("preferences")}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case "social":
        return (
          <div className="profile-card">
            <h2 className="profile-card-title">Social Links</h2>
            <p className="profile-card-subtitle">
              Add your professional profiles and portfolio.
            </p>

            <div className="form-row">
              <label>LinkedIn</label>
              <input
                type="url"
                value={profile.linkedin}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    linkedin: e.target.value,
                  }))
                }
                placeholder="https://www.linkedin.com/in/username"
                disabled={!editingSections.social}
              />
            </div>

            <div className="form-row">
              <label>GitHub</label>
              <input
                type="url"
                value={profile.github}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    github: e.target.value,
                  }))
                }
                placeholder="https://github.com/username"
                disabled={!editingSections.social}
              />
            </div>

            <div className="form-row">
              <label>Portfolio Website</label>
              <input
                type="url"
                value={profile.portfolio}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    portfolio: e.target.value,
                  }))
                }
                placeholder="https://your-portfolio.example.com"
                disabled={!editingSections.social}
              />
            </div>

            <div className="profile-actions-row">
              {editingSections.social ? (
                <button
                  className="btn-primary"
                  onClick={() => saveProfile({}, "social")}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Links"}
                </button>
              ) : (
                <>
                  <span className="save-message">
                    {saveStatus.section === "social" && saveStatus.message
                      ? saveStatus.message
                      : "Your changes are saved."}
                  </span>
                  <div className="actions-buttons">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleEditSection("social")}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-light-danger"
                      onClick={() => handleClearSection("social")}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case "performance":
        return renderPerformanceDashboard();

      case "settings":
        return (
          <div className="profile-card">
            <h2 className="profile-card-title">Account Settings</h2>
            <p className="profile-card-subtitle">
              Manage your account data and sign-out.
            </p>

            <div
              className="profile-actions-row"
              style={{ justifyContent: "flex-start" }}
            >
              <button className="btn-text" onClick={handleLogout}>
                Logout from this account
              </button>
            </div>

            <hr className="section-divider" />

            <div className="danger-zone">
              <h3>Danger Zone</h3>
              <p className="hint">
                <strong>Delete profile data</strong> will clear your profile
                details, preferences and social links. Your login account will
                remain.
              </p>

              <button className="btn-danger" onClick={handleDeleteProfile}>
                Delete Profile Data
              </button>

              <p className="hint" style={{ marginTop: "12px" }}>
                <strong>Delete account</strong> will permanently remove your
                candidate user account and profile from the system. This cannot
                be undone.
              </p>

              <button
                className="btn-danger"
                style={{ marginTop: "4px" }}
                onClick={handleDeleteAccount}
              >
                Delete Account Permanently
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return <div className="profile-page">Loading profile…</div>;
  }

  return (
    <div className="profile-page">
      {/* Show completion bar until 100% */}
      {completion < 100 && (
        <div className="profile-progress">
          <div className="profile-progress-header">
            <span>Profile completion: {completion}%</span>
            <span>
              Fill <strong>Overview</strong>, <strong>Preferences</strong> &{" "}
              <strong>Social Links</strong> to reach 100%.
            </span>
          </div>
          <div className="profile-progress-bar">
            <div
              className="profile-progress-fill"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      )}

      <div className="profile-container">
        {/* LEFT MENU */}
        <aside className="profile-sidebar">
          <h2 className="profile-sidebar-title">Candidate Profile</h2>

          <ul className="profile-menu">
            <li>
              <button
                className={
                  activeSection === "summary"
                    ? "profile-menu-item active"
                    : "profile-menu-item"
                }
                onClick={() => setActiveSection("summary")}
              >
                <i className="fa-regular fa-id-card"></i>
                <span>Profile Summary</span>
              </button>
            </li>

            <li>
              <button
                className={
                  activeSection === "overview"
                    ? "profile-menu-item active"
                    : "profile-menu-item"
                }
                onClick={() => setActiveSection("overview")}
              >
                <i className="fa-regular fa-user"></i>
                <span>Profile Overview</span>
              </button>
            </li>

            <li>
              <button
                className={
                  activeSection === "preferences"
                    ? "profile-menu-item active"
                    : "profile-menu-item"
                }
                onClick={() => setActiveSection("preferences")}
              >
                <i className="fa-solid fa-sliders"></i>
                <span>Preferences</span>
              </button>
            </li>

            <li>
              <button
                className={
                  activeSection === "social"
                    ? "profile-menu-item active"
                    : "profile-menu-item"
                }
                onClick={() => setActiveSection("social")}
              >
                <i className="fa-solid fa-share-nodes"></i>
                <span>Social Links</span>
              </button>
            </li>

            <li>
              <button
                className={
                  activeSection === "performance"
                    ? "profile-menu-item active"
                    : "profile-menu-item"
                }
                onClick={() => setActiveSection("performance")}
              >
                <i className="fa-solid fa-chart-line"></i>
                <span>AI Performance Dashboard</span>
              </button>
            </li>

            <li>
              <button
                className={
                  activeSection === "settings"
                    ? "profile-menu-item active"
                    : "profile-menu-item"
                }
                onClick={() => setActiveSection("settings")}
              >
                <i className="fa-solid fa-gear"></i>
                <span>Account Settings</span>
              </button>
            </li>

            <li className="profile-menu-divider" />

            <li>
              <button
                className="profile-menu-item logout"
                onClick={handleLogout}
              >
                <i className="fa-solid fa-right-from-bracket"></i>
                <span>Logout</span>
              </button>
            </li>
          </ul>
        </aside>

        {/* RIGHT CONTENT */}
        <section className="profile-content">{renderSection()}</section>
      </div>
    </div>
  );
};

export default Profile;
