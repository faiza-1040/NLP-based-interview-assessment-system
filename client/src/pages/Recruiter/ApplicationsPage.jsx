
// client/src/pages/Recruiter/ApplicationsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import "./ApplicationsPage.css";
import { getApplicationResumeBlob } from "../../utils/resumeApi";
import { api } from "../../utils/api";

const fmtDateTime = (d) => {
  try {
    const x = new Date(d);
    return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleString();
  } catch {
    return String(d);
  }
};

// helper to format score nicely
const fmtScore = (v) => {
  if (typeof v !== "number") return "—";
  if (v <= 1 && v >= 0) return `${Math.round(v * 100)}%`;
  return `${Math.round(v)}%`;
};

export default function ApplicationsPage() {
  const { jobId: pathId } = useParams();
  const { search, state } = useLocation();

  const queryId = useMemo(
    () => new URLSearchParams(search).get("jobId"),
    [search]
  );

  const [resumeModal, setResumeModal] = useState({
    open: false,
    url: null,
  });



  const isObjectId = (v) =>
    typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);

  const jobId = useMemo(() => {
    if (isObjectId(pathId)) return pathId;
    if (isObjectId(queryId)) return queryId;
    if (isObjectId(state?.jobId)) return state.jobId;
    return null;
  }, [pathId, queryId, state]);

  const [job, setJob] = useState(null);
  const [apps, setApps] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");

  const [inviteModal, setInviteModal] = useState({
    open: false,
    app: null,
  });
  const [inviteDates, setInviteDates] = useState(["", "", ""]);


  useEffect(() => {
  return () => {
    if (resumeModal.url) {
      URL.revokeObjectURL(resumeModal.url);
    }
  };
}, [resumeModal.url]);

  const closeResumeModal = () => {
    if (resumeModal.url) {
      URL.revokeObjectURL(resumeModal.url);
    }
    setResumeModal({ open: false, url: null });
  };

  const handleCallInterview = (app) => {
    setInviteModal({ open: true, app });
    setInviteDates(["", "", ""]);
  };

  const closeModal = () => {
    setInviteModal({ open: false, app: null });
  };

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
            : a
        )
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
        e?.response?.data?.message || "❌ Failed to send invitation."
      );
      setTimeout(() => setActionMsg(""), 2000);
    }
  };

const previewResume = async (appId) => {
  try {
    const res = await getApplicationResumeBlob(appId);

    const blob = new Blob([res.data], {
      type: res.headers["content-type"] || "application/octet-stream",
    });

    const url = URL.createObjectURL(blob);

    setResumeModal((prev) => {
      if (prev.url) {
        URL.revokeObjectURL(prev.url);
      }
      return { open: true, url };
    });
  } catch (err) {
    console.error("Preview failed:", err);
    alert(err?.response?.data?.message || "Could not preview resume.");
  }
};

  const downloadResume = async (appId) => {
    try {
      const res = await getApplicationResumeBlob(appId);

      const blob = new Blob([res.data], {
        type: res.headers["content-type"] || "application/octet-stream",
      });

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "resume";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Download failed:", err);
      alert(err?.response?.data?.message || "Download failed.");
    }
  };

  useEffect(() => {
    if (!jobId) {
      setErr("Invalid job id in URL.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await api.get(`/applications/job/${jobId}`);
        setJob(res.data.job);
        setApps(res.data.applications || []);
      } catch (e) {
        const status = e?.response?.status;
        const msg =
          e?.response?.data?.message ||
          (status === 403
            ? "You are not allowed to view these applications."
            : status === 404
            ? "Job not found."
            : status === 400
            ? "Invalid job id."
            : "Failed to load applications.");
        setErr(msg);
      } finally {
        setLoading(false);
      }
    })();

  }, [jobId]);

  const rankedApps = useMemo(() => {
    const copy = [...apps];
    copy.sort((a, b) => {
      const sa =
        typeof a.matchScore === "number" ? a.matchScore : -Infinity;
      const sb =
        typeof b.matchScore === "number" ? b.matchScore : -Infinity;
      return sb - sa;
    });
    return copy;
  }, [apps]);

  if (loading) return <p style={{ padding: 16 }}>Loading…</p>;
  if (err) return <p style={{ padding: 16, color: "#dc2626" }}>{err}</p>;

  return (
    <div className="apps-container">
      <h2 className="apps-heading">
        Applications {job?.title ? `for “${job.title}”` : ""}
      </h2>

      {actionMsg && <div className="apps-alert">{actionMsg}</div>}

      {inviteModal.open && (
        <div className="apps-modal-overlay">
          <div className="apps-modal-card">
            <button
              type="button"
              className="apps-modal-close"
              onClick={closeModal}
            >
              <i className="fas fa-times" />
            </button>

            <h3 className="apps-modal-title">Call for Interview</h3>
            <p className="apps-modal-text">
              Select <strong>2–3 date/time</strong> options to invite{" "}
              {inviteModal.app?.candidate?.name || "the candidate"}.
            </p>

            {inviteDates.map((v, idx) => (
              <div key={idx} className="apps-modal-field">
                <label className="apps-modal-label">
                  Option {idx + 1}
                </label>
                <input
                  type="datetime-local"
                  value={v}
                  onChange={(e) => {
                    const copy = [...inviteDates];
                    copy[idx] = e.target.value;
                    setInviteDates(copy);
                  }}
                  className="apps-modal-input"
                />
              </div>
            ))}

            <div className="apps-modal-actions">
              <button
                type="button"
                onClick={submitInvite}
                className="apps-modal-btn-primary"
              >
                Invite Candidate for Interview
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="apps-list">
        {rankedApps.map((a) => {
          const confirmed = a.status === "InterviewConfirmed";
          const invited = a.status === "Invited, not yet confirmed";

          const statusStr =
            a.status === "InterviewConfirmed"
              ? "Interview Confirmed"
              : a.status || "Applied";

          return (
            <div key={a._id} className="app-card">
              <div className="app-main">
                <div className="app-name">
                  {a.candidate?.name || "—"}
                </div>
                <div className="app-email">
                  {a.candidate?.email || "—"}
                </div>

                {typeof a.matchScore === "number" && (
                  <div className="app-score">
                    Match score: <strong>{fmtScore(a.matchScore)}</strong>
                  </div>
                )}

                <div className="app-row">
                  <span className="app-row-item">
                    <i className="far fa-file-alt app-icon" />
                    {a.resumeSource ? (
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => previewResume(a._id)}
                          className="app-link"
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          {a.resumeName || "Resume"}
                        </button>

                        <button
                          onClick={() => downloadResume(a._id)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: "1px solid #2563eb",
                            background: "#2563eb",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Download
                        </button>
                      </div>
                    ) : (
                      "No resume"
                    )}
                  </span>

                  <span className="app-row-item">
                    <i className="fas fa-folder-open app-icon" />
                    {a.resumeSource || "default"}
                  </span>
                </div>

                <div className="app-row app-row-bottom">
                  <span
                    className={
                      confirmed
                        ? "app-status app-status-confirmed"
                        : invited
                        ? "app-status app-status-invited"
                        : "app-status"
                    }
                  >
                    {statusStr}
                  </span>

                  {a.chosenDate && (
                    <span className="app-confirmed-date">
                      <i className="fas fa-check-circle app-icon app-icon-green" />
                      Confirmed: {fmtDateTime(a.chosenDate)}
                    </span>
                  )}

                  <span className="app-applied-date">
                    <i className="far fa-clock app-icon" />
                    Applied: {fmtDateTime(a.createdAt)}
                  </span>
                </div>
              </div>

              <div className="app-actions">
                <button
                  type="button"
                  onClick={() =>
                    !invited && !confirmed && handleCallInterview(a)
                  }
                  disabled={invited || confirmed}
                  className={
                    invited || confirmed
                      ? "apps-btn-primary apps-btn-disabled"
                      : "apps-btn-primary"
                  }
                  title={
                    confirmed
                      ? "Interview Confirmed"
                      : invited
                      ? "Invitation already sent"
                      : "Call for Interview"
                  }
                >
                  {confirmed
                    ? "Interview Confirmed"
                    : invited
                    ? "Invited; not yet confirmed"
                    : "Call for Interview"}
                </button>
              </div>
            </div>
          );
        })}

        {!rankedApps.length && (
          <p className="apps-empty">No applications yet.</p>
        )}
      </div>

      {resumeModal.open && (
        <div className="apps-modal-overlay" onClick={closeResumeModal}>
          <div
            className="apps-modal-card"
            style={{ width: "80%", height: "80%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="apps-modal-close"
              onClick={closeResumeModal}
            >
              ✖
            </button>

            <iframe
              src={resumeModal.url}
              title="Resume Preview"
              width="100%"
              height="100%"
              style={{ border: "none", borderRadius: 8 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
