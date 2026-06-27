// client/src/pages/Recruiter/MyJobPosts.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { jobApi } from "../../utils/jobApi";
import { api } from "../../utils/api";
import "./myjobposts.css";

const money = (n) => (typeof n === "number" ? n.toLocaleString() : "—");

const timeAgo = (d) => {
  try {
    const diffSec = (Date.now() - new Date(d).getTime()) / 1000;
    const days = Math.floor(diffSec / 86400);
    if (Number.isNaN(days)) return "";
    if (days < 1) return "today";
    if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
    const w = Math.floor(days / 7);
    return `${w} week${w > 1 ? "s" : ""} ago`;
  } catch {
    return "";
  }
};

const fmtDate = (d) => {
  try {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString();
  } catch {
    return String(d);
  }
};

const fmtDateTime = (d) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleString();
  } catch {
    return "—";
  }
};

const fmtInterviewScore = (v) => {
  if (typeof v !== "number") return "—";
  return `${Number(v).toFixed(1)} / 10`;
};

const fmtRisk = (v) => {
  if (typeof v !== "number") return "—";
  return `${Math.round(v)}%`;
};

const riskLevel = (risk) => {
  const n = Number(risk || 0);
  if (n >= 61) return "High";
  if (n >= 26) return "Medium";
  return "Low";
};

const decisionLabel = (status) => {
  if (status === "Shortlisted") return "Shortlisted";
  if (status === "Rejected") return "Rejected";
  if (status === "Hired") return "Hired";
  return "Pending";
};

const decisionClass = (status) => {
  if (status === "Shortlisted") return "interviewdetail-decision shortlisted";
  if (status === "Rejected") return "interviewdetail-decision rejected";
  if (status === "Hired") return "interviewdetail-decision hired";
  return "interviewdetail-decision pending";
};

export default function MyJobPosts() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  // Search + sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // 'newest' or 'oldest'

  // NEW: active job for the detail CARD modal
  const [activeJob, setActiveJob] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Interview details modal state
  const [interviewModal, setInterviewModal] = useState({
    open: false,
    job: null,
    rows: [],
  });
  const [loadingInterviewDetails, setLoadingInterviewDetails] = useState(false);
  const [selectedInterviewSummary, setSelectedInterviewSummary] =
    useState(null);
  const [selectedCameraSummary, setSelectedCameraSummary] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await jobApi.mine();
        setJobs(Array.isArray(data) ? data : data?.jobs || []);
      } catch (e) {
        console.error(e);
        alert("❌ Failed to load your jobs.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSortBy("newest");
  };

  // Filter + sort jobs
  const rows = useMemo(() => {
    let list = [...jobs];

    const query = searchQuery.toLowerCase().trim();
    if (query) {
      list = list.filter((j) => {
        const title = (j.title || "").toLowerCase();
        const created = fmtDate(j.createdAt || "").toLowerCase();
        const deadline = fmtDate(j.applicationDeadline || "").toLowerCase();
        return (
          title.includes(query) ||
          created.includes(query) ||
          deadline.includes(query)
        );
      });
    }

    list.sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return sortBy === "newest" ? bTime - aTime : aTime - bTime;
    });

    return list;
  }, [jobs, searchQuery, sortBy]);

  const closeDetailCard = () => setActiveJob(null);

  // Delete handler for the detail card
  const handleDelete = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this job post?")) {
      return;
    }
    try {
      setDeleting(true);
      // Adjust method name if your jobApi uses a different one (e.g. jobApi.delete)
      await jobApi.remove(jobId);
      setJobs((prev) => prev.filter((j) => j._id !== jobId));
      setActiveJob(null);
    } catch (e) {
      console.error(e);
      alert("❌ Failed to delete job. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDecision = async (row, decision) => {
  if (!row?.applicationId) {
    alert("Application id missing.");
    return;
  }

  const confirmText =
    decision === "Shortlisted"
      ? "Shortlist this candidate and send email?"
      : decision === "Rejected"
        ? "Reject this candidate and send email?"
        : "Mark this candidate as hired and send email?";

  if (!window.confirm(confirmText)) return;

  try {
    const res = await api.put(`/applications/${row.applicationId}/decision`, {
      decision,
    });

    const updatedStatus =
      res.data?.application?.status || res.data?.decision || decision;

    setInterviewModal((prev) => ({
      ...prev,
      rows: prev.rows.map((item) =>
        String(item.applicationId) === String(row.applicationId)
          ? { ...item, applicationStatus: updatedStatus }
          : item,
      ),
    }));

    setSelectedInterviewSummary((prev) =>
      prev && String(prev.applicationId) === String(row.applicationId)
        ? { ...prev, applicationStatus: updatedStatus }
        : prev,
    );

    alert(
      res.data?.emailSent
        ? `Candidate ${updatedStatus.toLowerCase()} and email sent.`
        : `Candidate ${updatedStatus.toLowerCase()}, but email was not sent.`,
    );
  } catch (err) {
    console.error("Decision update failed:", err);
    alert(err?.response?.data?.message || "Failed to update decision.");
  }
};

  const openInterviewDetails = async (job) => {
    if (!job?._id) return;

    try {
      setLoadingInterviewDetails(true);
      setSelectedInterviewSummary(null);
      setSelectedCameraSummary(null);

      const res = await api.get(`/interview/job/${job._id}/interview-details`);
      setInterviewModal({
        open: true,
        job,
        rows: Array.isArray(res.data?.candidates) ? res.data.candidates : [],
      });
    } catch (e) {
      console.error("Failed to load interview details:", e);
      alert(e?.response?.data?.message || "Failed to load interview details.");
    } finally {
      setLoadingInterviewDetails(false);
    }
  };

  const closeInterviewDetails = () => {
    setInterviewModal({ open: false, job: null, rows: [] });
    setSelectedInterviewSummary(null);
    setSelectedCameraSummary(null);
  };

  if (loading) return <p style={{ padding: 16 }}>Loading…</p>;

  return (
    <div className="myjobs-container">
      <h2>My Job Posts</h2>

      <p className="myjobs-subtext">
        You have posted {jobs.length} job{jobs.length !== 1 ? "s" : ""}.
      </p>

      {/* Search + Sort + Clear Filters (90vw) */}
      <div className="myjobs-search-row">
        <input
          type="text"
          placeholder="Search by Job Title or Date (e.g. 1/11/2026)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="myjobs-search-input"
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="myjobs-sort-select"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>

        <button
          onClick={handleClearFilters}
          className="myjobs-clear-btn"
          type="button"
        >
          <i className="fas fa-times" style={{ marginRight: 5 }}></i>
          Clear Filters
        </button>
      </div>

      {/* Horizontal job cards only (no table) */}
      <div className="myjobs-card-list">
        {rows.map((j) => {
          const company = j.createdBy?.companyName || "Company";
          const showLocation =
            j.workArrangement === "Remote"
              ? j.remote?.mustReside
                ? j.remote?.location || "Remote (restricted)"
                : "Remote"
              : j.jobLocation || "Location";
          const open = !j.isClosed;

          return (
            <div key={j._id} className="myjobs-card">
              {/* Left side: main text */}
              <div className="myjobs-card-main">
                <div className="myjobs-title">{j.title}</div>
                <div className="myjobs-company">{company}</div>

                {/* Row: location + salary + deadline (small font) */}
                <div className="myjobs-meta-row">
                  <span className="myjobs-meta-item">
                    <i className="fas fa-map-marker-alt myjobs-icon" />
                    {showLocation}
                  </span>

                  {j.salaryVisible === "Yes" && (
                    <span className="myjobs-meta-item">
                      <i className="fas fa-dollar-sign myjobs-icon" />
                      {money(j.salaryMin)} - {money(j.salaryMax)} /month
                    </span>
                  )}

                  <span className="myjobs-meta-item">
                    <i className="far fa-calendar-alt myjobs-icon" />
                    Deadline: {fmtDate(j.applicationDeadline)}
                  </span>
                </div>

                {/* Status + posted below meta */}
                <div className="myjobs-bottom-wrap">
                  <span
                    className={
                      open
                        ? "myjobs-status myjobs-status-open"
                        : "myjobs-status myjobs-status-closed"
                    }
                  >
                    {open ? "Actively hiring" : "Closed"}
                  </span>

                  <div className="myjobs-posted">
                    <i className="far fa-clock myjobs-icon" />
                    Posted {timeAgo(j.createdAt)}
                  </div>
                </div>
              </div>

              {/* Right side: actions */}
              <div className="myjobs-actions">
                <button
                  type="button"
                  onClick={() => setActiveJob(j)} // open detail CARD
                  className="myjobs-btn-primary"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => nav(`/recruiter/jobs/${j._id}/applications`)}
                  className="myjobs-btn-primary myjobs-btn-secondary"
                >
                  View applications
                </button>
                <button
                  type="button"
                  onClick={() => openInterviewDetails(j)}
                  className="myjobs-btn-primary myjobs-btn-secondary"
                  disabled={loadingInterviewDetails}
                >
                  Interview Details
                </button>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <p className="myjobs-empty">No job posts match your filters.</p>
        )}
      </div>

      {/* INTERVIEW DETAILS MODAL */}
      {interviewModal.open && (
        <div className="interviewdetail-overlay">
          <div className="interviewdetail-card">
            <button
              type="button"
              className="interviewdetail-close"
              onClick={closeInterviewDetails}
            >
              <i className="fas fa-times"></i>
            </button>

            <h3 className="interviewdetail-title">Interview Details</h3>
            <div className="interviewdetail-company">
              {interviewModal.job?.title || "Job"} •{" "}
              {interviewModal.job?.createdBy?.companyName || "Company"}
            </div>

            <div className="interviewdetail-table-wrap">
              <table className="interviewdetail-table">
                <thead>
                  <tr>
                    <th>Candidate Name</th>
                    <th>Email</th>
                    <th>Interview Date</th>
                    <th>Score</th>
                    <th>Integrity Risk</th>
                    <th>Integrity Score</th>
                    <th>Summary</th>
                    <th>Camera Summary</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {interviewModal.rows.map((row) => (
                    <tr key={row.interviewId || row.applicationId}>
                      <td>{row.candidateName || "—"}</td>
                      <td>{row.candidateEmail || "—"}</td>
                      <td>{fmtDateTime(row.interviewDate)}</td>
                      <td>{fmtInterviewScore(row.overallScore)}</td>
                      <td>
                        <span
                          className={
                            Number(row.integrityRisk || 0) >= 61
                              ? "interviewdetail-risk interviewdetail-risk-high"
                              : Number(row.integrityRisk || 0) >= 26
                                ? "interviewdetail-risk interviewdetail-risk-medium"
                                : "interviewdetail-risk interviewdetail-risk-low"
                          }
                        >
                          {fmtRisk(row.integrityRisk)}
                        </span>
                      </td>
                      <td>{fmtRisk(row.integrityScore)}</td>
                      <td>
                        <button
                          type="button"
                          className="interviewdetail-linkbtn"
                          onClick={() => setSelectedInterviewSummary(row)}
                          disabled={!row.answers || row.answers.length === 0}
                        >
                          Show Summary
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="interviewdetail-linkbtn"
                          onClick={() => setSelectedCameraSummary(row)}
                        >
                          Show Camera
                        </button>
                      </td>
                      <td>
                        {["Shortlisted", "Rejected", "Hired"].includes(
                          row.applicationStatus || row.status,
                        ) ? (
                          <span
                            className={decisionClass(
                              row.applicationStatus || row.status,
                            )}
                          >
                            {decisionLabel(row.applicationStatus || row.status)}
                          </span>
                        ) : (
                          <div className="interviewdetail-decision-actions">
                            <button
                              type="button"
                              className="interviewdetail-decision-btn shortlist"
                              onClick={() => handleDecision(row, "Shortlisted")}
                            >
                              Shortlist
                            </button>

                            <button
                              type="button"
                              className="interviewdetail-decision-btn reject"
                              onClick={() => handleDecision(row, "Rejected")}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}

                  {interviewModal.rows.length === 0 && (
                    <tr>
                      <td colSpan="9" className="interviewdetail-empty">
                        No completed interview records found for this job yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION ANSWER SUMMARY CARD */}
      {selectedInterviewSummary && (
        <div className="interviewdetail-small-overlay">
          <div className="interviewdetail-small-card">
            <button
              type="button"
              className="interviewdetail-close"
              onClick={() => setSelectedInterviewSummary(null)}
            >
              <i className="fas fa-times"></i>
            </button>

            <h3 className="interviewdetail-title">Interview Summary</h3>
            <div className="interviewdetail-company">
              {selectedInterviewSummary.candidateName} •{" "}
              {selectedInterviewSummary.candidateEmail}
            </div>
            <div className="interviewdetail-top-summary">
              <div>
                <strong>Overall Score:</strong>{" "}
                {fmtInterviewScore(selectedInterviewSummary.overallScore)}
              </div>

              <div>
                <strong>Integrity Risk:</strong>{" "}
                {fmtRisk(selectedInterviewSummary.integrityRisk)}
              </div>

              <div>
                <strong>Integrity Score:</strong>{" "}
                {fmtRisk(selectedInterviewSummary.integrityScore)}
              </div>

              <div>
                <strong>Decision:</strong>{" "}
                <span
                  className={decisionClass(
                    selectedInterviewSummary.applicationStatus ||
                      selectedInterviewSummary.status,
                  )}
                >
                  {decisionLabel(
                    selectedInterviewSummary.applicationStatus ||
                      selectedInterviewSummary.status,
                  )}
                </span>
              </div>
            </div>

            <div className="interviewdetail-summary-list">
              {(selectedInterviewSummary.answers || []).map((ans, index) => (
                <div
                  key={`${ans.questionId}-${index}`}
                  className="interviewdetail-summary-item"
                >
                  <div className="interviewdetail-summary-q">
                    Q{index + 1}. {ans.question || "—"}
                  </div>
                  <div className="interviewdetail-summary-a">
                    <strong>Answer:</strong>{" "}
                    {ans.answerText || ans.transcriptText || "—"}
                  </div>
                  <div className="interviewdetail-summary-meta">
                    <span>
                      Score:{" "}
                      {typeof ans.score === "number"
                        ? `${ans.score} / 10`
                        : "—"}
                    </span>
                    <span>Correctness: {ans.grading?.correctness || "—"}</span>
                    <span>
                      Completeness: {ans.grading?.completeness || "—"}
                    </span>
                  </div>
                  {ans.feedback && (
                    <div className="interviewdetail-summary-a">
                      <strong>Feedback:</strong> {ans.feedback}
                    </div>
                  )}
                  {Array.isArray(ans.grading?.missing_points) &&
                    ans.grading.missing_points.length > 0 && (
                      <div className="interviewdetail-summary-a">
                        <strong>Missing points:</strong>{" "}
                        {ans.grading.missing_points.join(", ")}
                      </div>
                    )}
                  {Array.isArray(ans.grading?.misconceptions) &&
                    ans.grading.misconceptions.length > 0 && (
                      <div className="interviewdetail-summary-a">
                        <strong>Misconceptions:</strong>{" "}
                        {ans.grading.misconceptions.join(", ")}
                      </div>
                    )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CAMERA SUMMARY CARD */}
      {selectedCameraSummary && (
        <div className="interviewdetail-small-overlay">
          <div className="interviewdetail-small-card interviewdetail-camera-card">
            <button
              type="button"
              className="interviewdetail-close"
              onClick={() => setSelectedCameraSummary(null)}
            >
              <i className="fas fa-times"></i>
            </button>

            <h3 className="interviewdetail-title">Camera Detection Summary</h3>
            <div className="interviewdetail-company">
              {selectedCameraSummary.candidateName} • Risk Level:{" "}
              {riskLevel(selectedCameraSummary.cameraSummary?.cameraRiskScore)}
            </div>

            <div className="interviewdetail-camera-grid">
              <div>
                <strong>Face Missing:</strong>{" "}
                {selectedCameraSummary.cameraSummary?.noFaceCount ?? 0}
              </div>
              <div>
                <strong>Multiple Faces:</strong>{" "}
                {selectedCameraSummary.cameraSummary?.multipleFacesCount ?? 0}
              </div>
              <div>
                <strong>Looking Away:</strong>{" "}
                {selectedCameraSummary.cameraSummary?.lookingAwayCount ?? 0}
              </div>
              <div>
                <strong>Camera Off:</strong>{" "}
                {selectedCameraSummary.cameraSummary?.cameraOffCount ?? 0}
              </div>
              <div>
                <strong>Total Frames Analyzed:</strong>{" "}
                {selectedCameraSummary.cameraSummary?.totalFramesAnalyzed ?? 0}
              </div>
              <div>
                <strong>Snapshots Captured:</strong>{" "}
                {selectedCameraSummary.cameraSummary?.snapshotsCount ?? 0}
              </div>
              <div>
                <strong>Camera Risk Score:</strong>{" "}
                {fmtRisk(selectedCameraSummary.cameraSummary?.cameraRiskScore)}
              </div>
              <div>
                <strong>Integrity Score:</strong>{" "}
                {fmtRisk(selectedCameraSummary.integrityScore)}
              </div>
              <div>
                <strong>Risk Level:</strong>{" "}
                {riskLevel(
                  selectedCameraSummary.cameraSummary?.cameraRiskScore,
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL CARD MODAL */}
      {activeJob && (
        <div className="jobdetail-overlay">
          <div className="jobdetail-card">
            {/* Close (X) */}
            <button
              type="button"
              className="jobdetail-close"
              onClick={closeDetailCard}
            >
              <i className="fas fa-times"></i>
            </button>

            {/* Title + company */}
            <h3 className="jobdetail-title">{activeJob.title}</h3>
            <div className="jobdetail-company">
              {activeJob.createdBy?.companyName || "Company"}
            </div>

            {/* Top meta line: location / arrangement */}
            <div className="jobdetail-meta-row">
              {activeJob.careerLevel && (
                <span className="jobdetail-meta-item">
                  <i className="fas fa-briefcase jobdetail-icon"></i>
                  {activeJob.careerLevel}
                </span>
              )}
              {activeJob.workArrangement && (
                <span className="jobdetail-meta-item">
                  <i className="fas fa-building jobdetail-icon"></i>
                  {activeJob.workArrangement}
                </span>
              )}
              <span className="jobdetail-meta-item">
                <i className="fas fa-map-marker-alt jobdetail-icon"></i>
                {activeJob.jobLocation || "Location"}
              </span>
            </div>

            {/* Second meta: salary, positions, qualification, deadline, status */}
            <div className="jobdetail-meta-row jobdetail-meta-row--second">
              {activeJob.salaryVisible === "Yes" && (
                <span className="jobdetail-meta-item">
                  <i className="fas fa-dollar-sign jobdetail-icon"></i>
                  {money(activeJob.salaryMin)} - {money(activeJob.salaryMax)} /
                  month
                </span>
              )}

              {/* {activeJob.noOfPositions && (
                <span className="jobdetail-meta-item">
                  <i className="fas fa-users jobdetail-icon"></i>
                  Positions: {activeJob.noOfPositions}
                </span>
              )} */}
              {activeJob.numberOfPositions && (
                <span className="jobdetail-meta-item">
                  <i className="fas fa-users jobdetail-icon"></i>
                  Positions: {activeJob.numberOfPositions}
                </span>
              )}
              {activeJob.qualification && (
                <span className="jobdetail-meta-item">
                  <i className="fas fa-graduation-cap jobdetail-icon"></i>
                  {activeJob.qualification}
                </span>
              )}

              <span className="jobdetail-meta-item">
                <i className="far fa-calendar-alt jobdetail-icon"></i>
                Deadline: {fmtDate(activeJob.applicationDeadline)}
              </span>

              <span
                className={
                  !activeJob.isClosed
                    ? "jobdetail-status jobdetail-status-open"
                    : "jobdetail-status jobdetail-status-closed"
                }
              >
                {!activeJob.isClosed ? "Open" : "Closed"}
              </span>
            </div>

            {/* Posted info */}
            <div className="jobdetail-posted">
              <i className="far fa-clock jobdetail-icon"></i>
              Posted {timeAgo(activeJob.createdAt)}
            </div>

            {/* Description */}
            <div className="jobdetail-section">
              <h4 className="jobdetail-section-title">Description</h4>
              <div className="jobdetail-desc">
                {typeof activeJob.description === "string" &&
                activeJob.description.trim() ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: activeJob.description,
                    }}
                  />
                ) : (
                  <p>No description provided.</p>
                )}
              </div>
            </div>

            {/* Skills (if you have them) */}
            {Array.isArray(activeJob.skillsRequired) &&
              activeJob.skillsRequired.length > 0 && (
                <div className="jobdetail-section">
                  <h4 className="jobdetail-section-title">Skills</h4>
                  <div className="jobdetail-skills">
                    {activeJob.skillsRequired.map((sk, idx) => (
                      <span key={idx} className="jobdetail-skill-pill">
                        {sk}
                        {activeJob.rateSkills?.[sk]
                          ? ` • ${activeJob.rateSkills[sk]}`
                          : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* Bottom actions: Edit (blue), Delete (red) */}
            <div className="jobdetail-actions">
              <button
                type="button"
                className="jobdetail-btn jobdetail-btn-edit"
                onClick={() => nav(`/recruiter/post-job/${activeJob._id}`)}
              >
                <i className="fas fa-edit" style={{ marginRight: 6 }}></i>
                Edit
              </button>
              <button
                type="button"
                className="jobdetail-btn jobdetail-btn-delete"
                onClick={() => handleDelete(activeJob._id)}
                disabled={deleting}
              >
                <i className="fas fa-trash-alt" style={{ marginRight: 6 }}></i>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
