// client/src/pages/Recruiter/ViewAppliedCandidates.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { api } from "../../utils/api";
import "./ViewAppliedCandidates.css";

const fmtDateTime = (d) => {
  try {
    const x = new Date(d);
    return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleString();
  } catch {
    return String(d);
  }
};

const fmtScore = (v) => {
  if (typeof v !== "number") return "—";
  if (v <= 1 && v >= 0) return `${Math.round(v * 100)}%`;
  return `${Math.round(v)}%`;
};

// ✅ helper: convert Date/ISO -> datetime-local value safely
const toDateTimeLocalValue = (d) => {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = dt.getFullYear();
    const mm = pad(dt.getMonth() + 1);
    const dd = pad(dt.getDate());
    const hh = pad(dt.getHours());
    const mi = pad(dt.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  } catch {
    return "";
  }
};

export default function ViewAppliedCandidates() {
  const { jobId: pathId } = useParams();
  const { search, state } = useLocation();

  const queryId = useMemo(
    () => new URLSearchParams(search).get("jobId"),
    [search],
  );

  const isObjectId = (v) =>
    typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);

  const jobId = useMemo(() => {
    if (isObjectId(pathId)) return pathId;
    if (isObjectId(queryId)) return queryId;
    if (isObjectId(state?.jobId)) return state.jobId;
    return null;
  }, [pathId, queryId, state]);

  const [apps, setApps] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filterJob, setFilterJob] = useState("all");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");

  const [inviteModal, setInviteModal] = useState({ open: false, app: null });
  const [answersModal, setAnswersModal] = useState({
    open: false,
    app: null,
    job: null,
  });
  const [inviteDates, setInviteDates] = useState(["", "", ""]);

  // ✅ NEW: resume preview modal
  const [resumeModal, setResumeModal] = useState({
    open: false,
    url: null,
    title: "",
  });

  const closeResumeModal = () => {
    if (resumeModal.url) {
      URL.revokeObjectURL(resumeModal.url);
    }

    setResumeModal({
      open: false,
      url: null,
      title: "",
    });
  };

  const previewResume = async (app) => {
    try {
      const res = await api.get(`/applications/${app._id}/resume`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: res.headers["content-type"] || "application/pdf",
      });

      const url = URL.createObjectURL(blob);

      setResumeModal((prev) => {
        if (prev.url) {
          URL.revokeObjectURL(prev.url);
        }

        return {
          open: true,
          url,
          title: app.resumeName || "Submitted Resume",
        };
      });
    } catch (err) {
      console.error("Resume preview failed:", err);
      alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Could not open resume.",
      );
    }
  };

  const downloadResume = async (app) => {
    try {
      const res = await api.get(`/applications/${app._id}/resume`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: res.headers["content-type"] || "application/pdf",
      });

      const url = URL.createObjectURL(blob);

      const aTag = document.createElement("a");
      aTag.href = url;
      aTag.download = app.resumeName || "submitted-resume.pdf";
      document.body.appendChild(aTag);
      aTag.click();
      document.body.removeChild(aTag);

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Resume download failed:", err);
      alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Could not download resume.",
      );
    }
  };

  // ✅ cleanup blob URL when page unmounts
  useEffect(() => {
    return () => {
      if (resumeModal.url) {
        URL.revokeObjectURL(resumeModal.url);
      }
    };
  }, [resumeModal.url]);

  useEffect(() => {
    if (jobId) {
      setFilterJob(jobId);
    }
  }, [jobId]);

  const invitedSet = useMemo(() => {
    return new Set(
      apps
        .filter((a) => a.status === "Invited, not yet confirmed")
        .map((a) => a._id),
    );
  }, [apps]);

  // ✅ NEW: reschedule modal approve/decline
  const [rescheduleModal, setRescheduleModal] = useState({
    open: false,
    app: null,
  });
  const [resNewDate, setResNewDate] = useState("");
  const [resNote, setResNote] = useState("");

  const findJobDetails = (jobId) => {
    return jobs.find((j) => String(j._id) === String(jobId));
  };

  const handleCallInterview = (app) => {
    setInviteModal({ open: true, app });
    setInviteDates(["", "", ""]);
  };

  const handleViewAnswers = async (app) => {
    const jobId = app.job?._id || app.job;
    if (!jobId) return;

    try {
      const res = await api.get(`/applications/job/${jobId}`);
      const jobDetailsWithQs = res.data.job;
      setAnswersModal({ open: true, app, job: jobDetailsWithQs });
    } catch (e) {
      console.error("Failed to fetch job details for answers:", e);
      alert("Failed to load screening questions for this job.");
    }
  };

  const closeModal = () => setInviteModal({ open: false, app: null });

  const closeAnswersModal = () =>
    setAnswersModal({ open: false, app: null, job: null });

  const submitInvite = async () => {
    const filled = inviteDates.filter(Boolean);
    if (filled.length < 2) {
      setActionMsg("❌ Please select at least 2 interview date options.");
      setTimeout(() => setActionMsg(""), 1500);
      return;
    }

    const id = inviteModal.app?._id;
    if (!id) return closeModal();

    try {
      const res = await api.put(`/applications/${id}/invite`, {
  inviteDates: filled,
});

      setApps((prev) =>
        prev.map((a) =>
          a._id === id
            ? {
                ...a,
                status: "Invited, not yet confirmed",
                inviteDates: filled,
              }
            : a,
        ),
      );

      setActionMsg(
  res.data?.emailSent
    ? "✅ Invitation sent and email delivered to candidate."
    : "✅ Invitation saved, but email could not be sent."
);
      setInviteModal({ open: false, app: null });
      setTimeout(() => setActionMsg(""), 1500);
    } catch (e) {
      console.error(e);
      setActionMsg(
        e?.response?.data?.message || "❌ Failed to send invitation.",
      );
      setTimeout(() => setActionMsg(""), 2000);
    }
  };

  const openRescheduleModal = (app) => {
    const requested = app?.reschedule?.requestedDate;
    setResNewDate(toDateTimeLocalValue(requested || new Date()));
    setResNote("");
    setRescheduleModal({ open: true, app });
  };

  const closeRescheduleModal = () => {
    setRescheduleModal({ open: false, app: null });
    setResNewDate("");
    setResNote("");
  };

  const approveReschedule = async () => {
    const app = rescheduleModal.app;
    const id = app?._id;
    if (!id) return closeRescheduleModal();

    if (!resNewDate) {
      setActionMsg("❌ Please select a date/time to approve.");
      setTimeout(() => setActionMsg(""), 1500);
      return;
    }

    try {
      const res = await api.put(`/applications/${id}/reschedule-approve`, {
        newDate: resNewDate,
        note: resNote,
      });

      const updated = res?.data?.application;

      setApps((prev) =>
        prev.map((a) => (a._id === id ? { ...a, ...updated } : a)),
      );

      setActionMsg("✅ Reschedule approved and interview confirmed.");
      setTimeout(() => setActionMsg(""), 1800);
      closeRescheduleModal();
    } catch (e) {
      console.error(e);
      setActionMsg(
        e?.response?.data?.message || "❌ Failed to approve reschedule.",
      );
      setTimeout(() => setActionMsg(""), 2000);
    }
  };

  const declineReschedule = async () => {
    const app = rescheduleModal.app;
    const id = app?._id;
    if (!id) return closeRescheduleModal();

    try {
      const res = await api.put(`/applications/${id}/reschedule-decline`, {
        note: resNote,
      });

      const updated = res?.data?.application;

      setApps((prev) =>
        prev.map((a) => (a._id === id ? { ...a, ...updated } : a)),
      );

      setActionMsg("✅ Reschedule declined.");
      setTimeout(() => setActionMsg(""), 1800);
      closeRescheduleModal();
    } catch (e) {
      console.error(e);
      setActionMsg(
        e?.response?.data?.message || "❌ Failed to decline reschedule.",
      );
      setTimeout(() => setActionMsg(""), 2000);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/applications/recruiter/all");
        setApps(res.data.applications || []);
        setJobs(res.data.jobs || []);
      } catch (e) {
        const status = e?.response?.status;
        const msg =
          e?.response?.data?.message ||
          (status === 401
            ? "Please sign in as recruiter."
            : "Failed to load applications.");
        setErr(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  const filtered = useMemo(() => {
    if (filterJob === "all") return apps;
    return apps.filter((a) => String(a.job?._id || a.job) === filterJob);
  }, [apps, filterJob]);

  const rows = useMemo(() => {
    if (!jobId) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const sa = typeof a.matchScore === "number" ? a.matchScore : -Infinity;
      const sb = typeof b.matchScore === "number" ? b.matchScore : -Infinity;
      return sb - sa;
    });
    return copy;
  }, [filtered, jobId]);

  if (loading) return <p style={{ padding: 16 }}>Loading…</p>;
  if (err) return <p style={{ padding: 16, color: "#dc2626" }}>{err}</p>;

  return (
    <div className="vac-container">
      <h2 className="vac-heading">Applied Candidates</h2>

      {actionMsg && <div className="vac-alert">{actionMsg}</div>}

      {/* Resume Preview Modal */}
      {resumeModal.open && (
        <div className="vac-modal-overlay">
          <div
            className="vac-modal-card"
            style={{
              width: "80vw",
              maxWidth: "900px",
              height: "85vh",
            }}
          >
            <button
              type="button"
              className="vac-modal-close"
              onClick={closeResumeModal}
            >
              ×
            </button>

            <h3 className="vac-modal-title">{resumeModal.title}</h3>

            <iframe
              src={resumeModal.url}
              title="Resume Preview"
              style={{
                width: "100%",
                height: "calc(100% - 60px)",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                background: "#fff",
              }}
            />
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal.open && (
        <div className="vac-modal-overlay">
          <div className="vac-modal-card">
            <button
              type="button"
              className="vac-modal-close"
              onClick={closeRescheduleModal}
            >
              ×
            </button>

            <h3 className="vac-modal-title">Reschedule Request</h3>
            <p className="vac-modal-text">
              Candidate requested:{" "}
              <strong>
                {fmtDateTime(rescheduleModal.app?.reschedule?.requestedDate)}
              </strong>
            </p>

            <div className="vac-modal-field">
              <label className="vac-modal-label">Approve date/time</label>
              <input
                type="datetime-local"
                value={resNewDate}
                onChange={(e) => setResNewDate(e.target.value)}
                className="vac-modal-input"
              />
            </div>

            <div className="vac-modal-field">
              <label className="vac-modal-label">Note optional</label>
              <input
                type="text"
                value={resNote}
                onChange={(e) => setResNote(e.target.value)}
                className="vac-modal-input"
                placeholder="Message to candidate optional"
              />
            </div>

            <div
              className="vac-modal-actions"
              style={{ display: "flex", gap: 10, justifyContent: "center" }}
            >
              <button
                type="button"
                className="vac-modal-primary-btn"
                onClick={approveReschedule}
              >
                Approve
              </button>

              <button
                type="button"
                className="vac-modal-primary-btn"
                onClick={declineReschedule}
                style={{
                  background: "#ef4444",
                  borderColor: "#ef4444",
                }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModal.open && (
        <div className="vac-modal-overlay">
          <div className="vac-modal-card">
            <button
              type="button"
              className="vac-modal-close"
              onClick={closeModal}
            >
              ×
            </button>

            <h3 className="vac-modal-title">Call for Interview</h3>
            <p className="vac-modal-text">
              Select <strong>2–3 date/time</strong> options to invite{" "}
              {inviteModal.app?.candidate?.name || "the candidate"}.
            </p>

            {inviteDates.map((v, idx) => (
              <div key={idx} className="vac-modal-field">
                <label className="vac-modal-label">Option {idx + 1}</label>
                <input
                  type="datetime-local"
                  value={v}
                  onChange={(e) => {
                    const copy = [...inviteDates];
                    copy[idx] = e.target.value;
                    setInviteDates(copy);
                  }}
                  className="vac-modal-input"
                />
              </div>
            ))}

            <div className="vac-modal-actions">
              <button
                onClick={submitInvite}
                type="button"
                className="vac-modal-primary-btn"
              >
                Invite Candidate for Interview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screening Answers Modal */}
      {answersModal.open && answersModal.app && answersModal.job && (
        <div className="vac-answers-overlay">
          <div className="vac-answers-card">
            <button
              type="button"
              className="vac-answers-close"
              onClick={closeAnswersModal}
            >
              ×
            </button>

            <h3
              style={{
                marginTop: 0,
                marginBottom: 10,
                color: "#1f2937",
                fontSize: "1rem",
              }}
            >
              Screening Answers from{" "}
              {answersModal.app.candidate?.name || "Candidate"}
            </h3>

            <p
              style={{
                color: "#64748b",
                marginBottom: 15,
                fontSize: "0.85rem",
              }}
            >
              Job: <strong>{answersModal.job.title}</strong>
            </p>

            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {answersModal.job.screeningQuestions &&
              answersModal.app.screeningAnswers ? (
                answersModal.job.screeningQuestions.map((question, index) => (
                  <div
                    key={index}
                    style={{
                      marginBottom: 15,
                      padding: 10,
                      border: "1px solid #f1f5f9",
                      borderRadius: 8,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        color: "#2563eb",
                        fontSize: "0.85rem",
                      }}
                    >
                      {index + 1}. {question}
                    </p>

                    <p
                      style={{
                        margin: "5px 0 0 0",
                        padding: "5px 8px",
                        background: "#f8fafc",
                        borderRadius: 4,
                        whiteSpace: "pre-wrap",
                        fontSize: "0.85rem",
                      }}
                    >
                      {answersModal.app.screeningAnswers[index] ||
                        "No answer provided"}
                    </p>
                  </div>
                ))
              ) : (
                <p
                  style={{
                    color: "#9ca3af",
                    textAlign: "center",
                    fontSize: "0.85rem",
                  }}
                >
                  No screening questions found for this job, or candidate did
                  not provide answers.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter row */}
      <div className="vac-filter-row">
        <label htmlFor="jobFilter" className="vac-filter-label">
          Filter by job:
        </label>

        <select
          id="jobFilter"
          value={filterJob}
          onChange={(e) => setFilterJob(e.target.value)}
          className="vac-filter-select"
        >
          <option value="all">All jobs ({jobs.length})</option>
          {jobs.map((j) => (
            <option key={j._id} value={j._id}>
              {j.title}
            </option>
          ))}
        </select>

        <div className="vac-filter-count">
          Showing {filtered.length} application
          {filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="vac-table-wrap">
        <table className="vac-table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Candidate</th>
              <th>Email</th>
              <th>Resume</th>
              <th>Source</th>
              {jobId && <th>Score</th>}
              <th>Status</th>
              <th>Applied At</th>
              <th>Screening Answers</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((a) => {
              const confirmed = a.status === "InterviewConfirmed";
              const invited =
                a.status === "Invited, not yet confirmed" ||
                invitedSet.has(a._id);

              const hasAnswers =
                Array.isArray(a.screeningAnswers) &&
                a.screeningAnswers.length > 0;

              const currentJob = findJobDetails(a.job?._id || a.job);

              const statusStr =
                a.status === "InterviewConfirmed"
                  ? "Interview Confirmed"
                  : a.status || "Applied";

              let btnClass = "vac-btn-primary";
              if (confirmed) btnClass += " vac-btn-confirmed";
              else if (invited) btnClass += " vac-btn-invited";

              const resStatus = a?.reschedule?.status || "none";
              const hasRescheduleRequest = resStatus === "requested";

              const hasResume =
                a.resumePath ||
                a.submittedResume?.filePath ||
                a.submittedResume?.fileUrl;

              return (
                <tr key={a._id}>
                  <td>{a.job?.title || "—"}</td>
                  <td>{a.candidate?.name || "—"}</td>
                  <td>{a.candidate?.email || "—"}</td>

                  <td>
                    {hasResume ? (
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => previewResume(a)}
                          className="vac-link"
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            font: "inherit",
                          }}
                        >
                          {a.resumeName || "Resume Built in Builder"}
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadResume(a)}
                          className="vac-btn-secondary"
                        >
                          Download
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td>{a.resumeSource || "default"}</td>

                  {jobId && <td>{fmtScore(a.matchScore)}</td>}

                  <td>
                    <span className="vac-status-text">{statusStr}</span>

                    {a.chosenDate && (
                      <div className="vac-confirmed-inline">
                        Confirmed: {fmtDateTime(a.chosenDate)}
                      </div>
                    )}

                    {hasRescheduleRequest && (
                      <div
                        className="vac-confirmed-inline"
                        style={{ color: "#b45309" }}
                      >
                        Reschedule requested:{" "}
                        {fmtDateTime(a.reschedule?.requestedDate)}
                      </div>
                    )}

                    {resStatus === "approved" && (
                      <div
                        className="vac-confirmed-inline"
                        style={{ color: "#15803d" }}
                      >
                        Reschedule approved ✅
                      </div>
                    )}

                    {resStatus === "declined" && (
                      <div
                        className="vac-confirmed-inline"
                        style={{ color: "#dc2626" }}
                      >
                        Reschedule declined ❌
                      </div>
                    )}
                  </td>

                  <td>{fmtDateTime(a.createdAt)}</td>

                  <td>
                    {hasAnswers && currentJob ? (
                      <button
                        type="button"
                        onClick={() => handleViewAnswers(a)}
                        className="vac-btn-secondary"
                      >
                        View ({a.screeningAnswers.length})
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() =>
                        !invited && !confirmed && handleCallInterview(a)
                      }
                      disabled={invited || confirmed}
                      className={btnClass}
                      title={
                        confirmed
                          ? "Interview Confirmed"
                          : invited
                            ? "Invitation sent"
                            : "Call for Interview"
                      }
                    >
                      {confirmed
                        ? "Interview Confirmed"
                        : invited
                          ? "Invited; not yet confirmed"
                          : "Call for Interview"}
                    </button>

                    {hasRescheduleRequest && (
                      <button
                        type="button"
                        onClick={() => openRescheduleModal(a)}
                        className="vac-btn-secondary"
                        style={{
                          background: "#f59e0b",
                          borderColor: "#f59e0b",
                        }}
                        title="Candidate requested reschedule"
                      >
                        Review Reschedule
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {!filtered.length && (
              <tr>
                <td colSpan={jobId ? 10 : 9} className="vac-empty">
                  No applications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards View */}
      <div className="vac-mobile-card-list">
        {rows.map((a) => {
          const confirmed = a.status === "InterviewConfirmed";
          const invited =
            a.status === "Invited, not yet confirmed" || invitedSet.has(a._id);

          const hasAnswers =
            Array.isArray(a.screeningAnswers) &&
            a.screeningAnswers.length > 0;

          const currentJob = findJobDetails(a.job?._id || a.job);

          const statusStr =
            a.status === "InterviewConfirmed"
              ? "Interview Confirmed"
              : a.status || "Applied";

          let btnClass = "vac-btn-primary";
          if (confirmed) btnClass += " vac-btn-confirmed";
          else if (invited) btnClass += " vac-btn-invited";

          const resStatus = a?.reschedule?.status || "none";
          const hasRescheduleRequest = resStatus === "requested";

          const hasResume =
            a.resumePath ||
            a.submittedResume?.filePath ||
            a.submittedResume?.fileUrl;

          return (
            <div key={a._id} className="vac-mobile-card">
              <div className="vac-mobile-card-header">
                <div>
                  <h3 className="vac-mobile-job-title">
                    {a.job?.title || "—"}
                  </h3>

                  <p className="vac-mobile-candidate">
                    {a.candidate?.name || "—"}
                  </p>
                </div>

                {jobId && (
                  <span className="vac-mobile-score">
                    {fmtScore(a.matchScore)}
                  </span>
                )}
              </div>

              <div className="vac-mobile-info">
                <div className="vac-mobile-row">
                  <span>Email</span>
                  <strong>{a.candidate?.email || "—"}</strong>
                </div>

                <div className="vac-mobile-row">
                  <span>Source</span>
                  <strong>{a.resumeSource || "default"}</strong>
                </div>

                <div className="vac-mobile-row">
                  <span>Status</span>
                  <strong>{statusStr}</strong>
                </div>

                {a.chosenDate && (
                  <div className="vac-mobile-note">
                    Confirmed: {fmtDateTime(a.chosenDate)}
                  </div>
                )}

                {hasRescheduleRequest && (
                  <div className="vac-mobile-note vac-mobile-note-warning">
                    Reschedule requested:{" "}
                    {fmtDateTime(a.reschedule?.requestedDate)}
                  </div>
                )}

                {resStatus === "approved" && (
                  <div className="vac-mobile-note">
                    Reschedule approved ✅
                  </div>
                )}

                {resStatus === "declined" && (
                  <div className="vac-mobile-note vac-mobile-note-danger">
                    Reschedule declined ❌
                  </div>
                )}

                <div className="vac-mobile-row">
                  <span>Applied At</span>
                  <strong>{fmtDateTime(a.createdAt)}</strong>
                </div>
              </div>

              <div className="vac-mobile-actions">
                {hasResume && (
                  <>
                    <button
                      type="button"
                      onClick={() => previewResume(a)}
                      className="vac-mobile-outline-btn"
                    >
                      View Resume
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadResume(a)}
                      className="vac-btn-secondary"
                    >
                      Download
                    </button>
                  </>
                )}

                {hasAnswers && currentJob && (
                  <button
                    type="button"
                    onClick={() => handleViewAnswers(a)}
                    className="vac-btn-secondary"
                  >
                    Screening Answers ({a.screeningAnswers.length})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    !invited && !confirmed && handleCallInterview(a)
                  }
                  disabled={invited || confirmed}
                  className={btnClass}
                  title={
                    confirmed
                      ? "Interview Confirmed"
                      : invited
                        ? "Invitation sent"
                        : "Call for Interview"
                  }
                >
                  {confirmed
                    ? "Interview Confirmed"
                    : invited
                      ? "Invited; not yet confirmed"
                      : "Call for Interview"}
                </button>

                {hasRescheduleRequest && (
                  <button
                    type="button"
                    onClick={() => openRescheduleModal(a)}
                    className="vac-btn-secondary vac-mobile-warning-btn"
                    title="Candidate requested reschedule"
                  >
                    Review Reschedule
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!filtered.length && (
          <p className="vac-empty">No applications found.</p>
        )}
      </div>
    </div>
  );
}
