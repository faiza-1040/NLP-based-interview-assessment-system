// client/src/pages/Candidate/InterviewInvitation.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../../utils/api";
import { useNavigate } from "react-router-dom";
import "./CandidatePages.css";

const fmtDateTime = (d) => {
  try {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleString();
  } catch {
    return String(d);
  }
};

async function fetchMyApplications() {
  const res = await api.get("/applications/mine");
  const data = res.data;
  return Array.isArray(data) ? data : data?.applications || data || [];
}

const START_BEFORE_MINUTES = 2;
const START_AFTER_MINUTES = 2;

// ── Start window state ──
// This is ONLY for first Start Interview, not for Continue Interview.
function getWindowState(chosenDate) {
  if (!chosenDate) return "unknown";

  const scheduledAt = new Date(chosenDate).getTime();
  if (!Number.isFinite(scheduledAt)) return "unknown";

  const diff = Date.now() - scheduledAt;

  if (diff < -START_BEFORE_MINUTES * 60 * 1000) {
    return "upcoming";
  }

  if (diff <= START_AFTER_MINUTES * 60 * 1000) {
    return "live";
  }

  return "expired";
}

function getActiveRemainingMs(iv) {
  const n = Number(iv?.activeTimeRemainingMs);
  return Number.isFinite(n) ? n : null;
}

function hasContinueWindowExpired(iv) {
  if (!iv?.continueAllowedUntil) return false;

  const t = new Date(iv.continueAllowedUntil).getTime();
  return Number.isFinite(t) && Date.now() > t;
}

function hasActiveTimeExpired(iv) {
  const remaining = getActiveRemainingMs(iv);
  return remaining !== null && remaining <= 0;
}

function canContinueInterview(iv, appInterviewStatus) {
  const inProgress =
    iv?.status === "in_progress" || appInterviewStatus === "in_progress";

  if (!inProgress) return false;

  return !hasContinueWindowExpired(iv) && !hasActiveTimeExpired(iv);
}

function isStartedButExpired(iv, appInterviewStatus) {
  const inProgress =
    iv?.status === "in_progress" || appInterviewStatus === "in_progress";

  if (!inProgress) return false;

  return hasContinueWindowExpired(iv) || hasActiveTimeExpired(iv);
}

function formatTime(ms) {
  const safe = Math.max(0, Number(ms || 0));
  const totalSeconds = Math.floor(safe / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;

  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Resume attempt tracking (sessionStorage per appId) ──
function getResumeCount(appId) {
  try {
    return parseInt(sessionStorage.getItem(`iv_resume_${appId}`) || "0", 10);
  } catch {
    return 0;
  }
}
function incResumeCount(appId) {
  try {
    const n = getResumeCount(appId) + 1;
    sessionStorage.setItem(`iv_resume_${appId}`, String(n));
    return n;
  } catch {
    return 1;
  }
}

// ── Popup retry tracking (sessionStorage per appId) ──
// popup shows max 5 times, with 2 min gap between each
function getPopupState(appId) {
  try {
    return JSON.parse(
      sessionStorage.getItem(`iv_popup_${appId}`) || '{"count":0,"nextShow":0}',
    );
  } catch {
    return { count: 0, nextShow: 0 };
  }
}
function updatePopupState(appId, state) {
  try {
    sessionStorage.setItem(`iv_popup_${appId}`, JSON.stringify(state));
  } catch {}
}

function hasStartedInterview(appId) {
  try {
    return sessionStorage.getItem(`iv_started_${appId}`) === "true";
  } catch {
    return false;
  }
}

function markInterviewStarted(appId) {
  try {
    sessionStorage.setItem(`iv_started_${appId}`, "true");
  } catch {}
}

export default function InterviewInvitation() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [apps, setApps] = useState([]);
  const [toast, setToast] = useState("");
  const [popup, setPopup] = useState(null);
  const [windowStates, setWindowStates] = useState({});
  // ivStatus: appId -> { status, answeredCount, totalCount, overallScore }
  const [ivStatus, setIvStatus] = useState({});

  const tickRef = useRef(null);

  const fetchStatus = async (appId) => {
    try {
      const r = await api.get(`/interview/${appId}/status`);
      setIvStatus((prev) => ({ ...prev, [String(appId)]: r.data }));
    } catch {
      setIvStatus((prev) => ({ ...prev, [String(appId)]: { status: "none" } }));
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchMyApplications();
        const confirmed = list.filter(
          (a) => a.status === "InterviewConfirmed" && a.chosenDate,
        );
        setApps(confirmed);
        await Promise.all(confirmed.map((a) => fetchStatus(a._id)));
      } catch (e) {
        console.error(e);
        setErr(
          e?.response?.data?.message || "Failed to load interview invitations.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Tick every 15 s — update window states + popup retry logic ──
  const computeWindowStates = useCallback(() => {
    const next = {};
    const now = Date.now();

    apps.forEach((app) => {
      const appId = String(app._id);
      const ws = getWindowState(app.chosenDate);
      next[appId] = ws;

      // Popup retry: show up to 5 times, every 2 min gap, only while live
      // if (ws === "live" && (ivStatus[appId]?.status || "none") !== "completed") {
      //   const ps = getPopupState(appId);
      //   if (ps.count < 5 && now >= ps.nextShow) {
      //     updatePopupState(appId, { count: ps.count + 1, nextShow: now + 2 * 60 * 1000 });
      //     const jobTitle = app?.job?.title || "Interview";
      //     const company  = app?.job?.createdBy?.companyName || app?.job?.companyName || app?.job?.createdBy?.name || "";
      //     setPopup({ appId, jobTitle, company, scheduledAt: app.chosenDate });
      //   }
      // }

      // Popup retry: show only before interview starts
      const currentStatus = ivStatus[appId]?.status || "none";
      const appInterviewStatus = app.interviewStatus || "none";

      const shouldShowPopup =
        ws === "live" &&
        currentStatus !== "in_progress" &&
        currentStatus !== "completed" &&
        appInterviewStatus !== "in_progress" &&
        appInterviewStatus !== "completed" &&
        !hasStartedInterview(appId) &&
        !popup;

      if (shouldShowPopup) {
        const ps = getPopupState(appId);

        if (ps.count < 5 && now >= ps.nextShow) {
          updatePopupState(appId, {
            count: ps.count + 1,
            nextShow: now + 2 * 60 * 1000,
          });

          const jobTitle = app?.job?.title || "Interview";
          const company =
            app?.job?.createdBy?.companyName ||
            app?.job?.companyName ||
            app?.job?.createdBy?.name ||
            "";

          setPopup({
            appId,
            jobTitle,
            company,
            scheduledAt: app.chosenDate,
          });
        }
      }
    });
    setWindowStates(next);
  }, [apps, ivStatus, popup]);

  useEffect(() => {
    computeWindowStates();
    tickRef.current = setInterval(computeWindowStates, 15_000);
    return () => clearInterval(tickRef.current);
  }, [computeWindowStates]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const dismissPopup = () => setPopup(null);
  // Dismiss without resetting count — popup will retry after 2 min if count < 5

  const goToInterview = (app) => {
    const appId = String(app._id);
    const iv = ivStatus[appId] || { status: "none" };
    const appInterviewStatus = app.interviewStatus || "none";

    const isCompleted =
      iv.status === "completed" || appInterviewStatus === "completed";

    if (isCompleted) {
      showToast("This interview has already been completed.");
      return;
    }

    // Continue Interview uses active timer + continue deadline, not scheduled window.
    if (canContinueInterview(iv, appInterviewStatus)) {
      setPopup(null);
      navigate(`/candidate/interview/${app._id}`);
      return;
    }

    if (isStartedButExpired(iv, appInterviewStatus)) {
      showToast("Interview time or continue window has expired.");
      fetchStatus(appId);
      return;
    }

    // First Start Interview uses scheduled start window.
    const ws = windowStates[appId] || getWindowState(app.chosenDate);

    if (ws === "expired") {
      showToast("The interview start window has expired.");
      return;
    }

    if (ws !== "live") {
      showToast(
        `Interview opens ${START_BEFORE_MINUTES} min before: ${fmtDateTime(app.chosenDate)}`,
      );
      return;
    }

    markInterviewStarted(appId);
    setPopup(null);
    navigate(`/candidate/interview/${app._id}`);
  };

  /* ── Loading ── */
  if (loading)
    return (
      <div className="ii-centered-msg">
        <i
          className="fas fa-circle-notch fa-spin"
          style={{ fontSize: 28, color: "#2563eb" }}
        />
        <p>Loading invitations…</p>
      </div>
    );

  /* ── Error ── */
  if (err)
    return (
      <div className="ii-centered-msg">
        <i
          className="fas fa-triangle-exclamation"
          style={{ fontSize: 28, color: "#dc2626", marginBottom: 10 }}
        />
        <p className="ii-error-text">{err}</p>
      </div>
    );

  const now = Date.now();
  const nextSevenDays = now + 7 * 24 * 60 * 60 * 1000;
  const stats = apps.reduce(
    (acc, app) => {
      const appId = String(app._id);
      const iv = ivStatus[appId] || { status: "none" };
      const ws = windowStates[appId] || getWindowState(app.chosenDate);
      const scheduledTime = new Date(app.chosenDate).getTime();

      const appInterviewStatus = app.interviewStatus || "none";

      const isCompleted =
        iv.status === "completed" || appInterviewStatus === "completed";

      const isInProgress =
        iv.status === "in_progress" || appInterviewStatus === "in_progress";

      const startedExpired = isStartedButExpired(iv, appInterviewStatus);

      if (isCompleted) acc.interviewed += 1;

      if (!isCompleted && startedExpired) {
        acc.windowClosed += 1;
      }

      if (!isCompleted && !isInProgress && ws === "expired") {
        acc.windowClosed += 1;
      }

      if (
        !isCompleted &&
        !isInProgress &&
        ws === "upcoming" &&
        Number.isFinite(scheduledTime) &&
        scheduledTime >= now &&
        scheduledTime <= nextSevenDays
      ) {
        acc.upcoming += 1;
      }

      return acc;
    },
    { total: apps.length, upcoming: 0, interviewed: 0, windowClosed: 0 },
  );

  const statCards = [
    {
      icon: "fas fa-calendar-days",
      number: stats.total,
      title: "Confirmed Interviews",
      subtitle: "Total scheduled",
    },
    {
      icon: "fas fa-clock",
      number: stats.upcoming,
      title: "Upcoming",
      subtitle: "Next 7 days",
    },
    {
      icon: "fas fa-circle-check",
      number: stats.interviewed,
      title: "Interviewed",
      subtitle: "Completed",
    },
    {
      icon: "fas fa-hourglass-half",
      number: stats.windowClosed,
      title: "Window Closed",
      subtitle: "Not completed",
    },
  ];

  return (
    <div className="ii-page">
      {/* ── Popup ── */}
      {popup && (
        <div style={popSt.backdrop}>
          <div style={popSt.box}>
            <button style={popSt.closeBtn} onClick={dismissPopup}>
              ✕
            </button>
            <div style={popSt.liveRow}>
              <span style={popSt.dot} />
              <span style={popSt.liveLabel}>Live Now</span>
            </div>
            <h3 style={popSt.title}>Your interview is ready!</h3>
            <div style={popSt.infoBox}>
              <p style={popSt.role}>{popup.jobTitle}</p>
              {popup.company && <p style={popSt.company}>{popup.company}</p>}
              <p style={popSt.time}>
                <i className="fas fa-clock" style={{ marginRight: 5 }} />
                Scheduled: {fmtDateTime(popup.scheduledAt)}
              </p>
            </div>
            <p style={popSt.sub}>
              The start window is open. Start now to avoid missing it.
            </p>
            <div style={popSt.btns}>
              <button style={popSt.laterBtn} onClick={dismissPopup}>
                Later
              </button>
              <button
                style={popSt.startBtn}
                onClick={() => {
                  const app = apps.find((a) => String(a._id) === popup.appId);
                  if (app) goToInterview(app);
                }}
              >
                <i
                  className="fas fa-play"
                  style={{ marginRight: 7, fontSize: 12 }}
                />
                Start Interview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="ii-header-row">
        <div className="ii-title-wrap">
          <div className="ii-title-icon">
            <i className="fas fa-briefcase" />
          </div>
          <div>
            <h2>Interview Invitations</h2>
            <p>
              {apps.length > 0
                ? `You have ${apps.length} confirmed interview${apps.length !== 1 ? "s" : ""}`
                : "No confirmed interviews yet"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/candidate/applied-jobs")}
          className="ii-back-btn"
        >
          <i className="fas fa-arrow-left" />
          Back to Applied Jobs
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="ii-stats-grid">
        {statCards.map((item) => (
          <div className="ii-stat-card" key={item.title}>
            <div className="ii-stat-icon">
              <i className={item.icon} />
            </div>
            <div className="ii-stat-content">
              <strong>{item.number}</strong>
              <span>{item.title}</span>
              <small>{item.subtitle}</small>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="ii-toast">
          <i className="fas fa-clock" />
          {toast}
        </div>
      )}

      {/* ── Empty ── */}
      {apps.length === 0 && (
        <div className="ii-empty-card">
          <i className="fas fa-inbox" />
          <p>No confirmed interview invitations yet.</p>
          <span>
            Once a recruiter invites you and you confirm a date, it will appear
            here.
          </span>
          <button
            type="button"
            onClick={() => navigate("/candidate/applied-jobs")}
          >
            <i className="fas fa-briefcase" />
            View Applied Jobs
          </button>
        </div>
      )}

      {/* ── Cards ── */}
      <div className="ii-card-list">
        {apps.map((app, listIdx) => {
          const appId = String(app._id);
          const ws = windowStates[appId] || getWindowState(app.chosenDate);
          const isStartLive = ws === "live";
          const isStartExpired = ws === "expired";

          const iv = ivStatus[appId] || { status: "none" };
          const appInterviewStatus = app.interviewStatus || "none";

          const isCompleted =
            iv.status === "completed" || appInterviewStatus === "completed";

          const isInProgress =
            iv.status === "in_progress" || appInterviewStatus === "in_progress";

          const canContinue = canContinueInterview(iv, appInterviewStatus);
          const startedExpired = isStartedButExpired(iv, appInterviewStatus);
          const activeRemainingMs = getActiveRemainingMs(iv);

          const canStart = !isInProgress && !isCompleted && isStartLive;

          const jobTitle = app?.job?.title || "Interview";
          const company =
            app?.job?.createdBy?.companyName ||
            app?.job?.companyName ||
            app?.job?.createdBy?.name ||
            "Company";
          const rescheduleStatus = app?.reschedule?.status || "none";

          // ════════════════════════════════════
          // COMPLETED CARD
          // ════════════════════════════════════
          if (isCompleted) {
            const score = iv.overallScore;
            const reason = iv.completionReason || null;

            const isTimedOut =
              reason === "active_time_expired" ||
              reason === "continue_window_expired";

            const completedTitle = isTimedOut ? "Interviewed Yet": "Interviewed";

            const completedSub =
              reason === "active_time_expired"
                ? "Active interview time expired. Saved answers submitted. Awaiting recruiter decision."
                : reason === "continue_window_expired"
                  ? "Continue window expired. Saved answers submitted. Awaiting recruiter decision."
                  : "Awaiting recruiter decision";

            return (
              <div key={appId} className="ii-interview-card interviewed">
                <div className="ii-rank-badge">#{listIdx + 1}</div>
                <div className="ii-card-inner">
                  {/* LEFT */}
                  <div className="ii-card-left">
                    <span className="ii-status-pill interviewed">
                      <i className="fas fa-circle-check" />
                      Interviewed
                    </span>
                    <h3>{jobTitle}</h3>
                    <p className="ii-company-line">
                      <i className="fas fa-building" />
                      {company}
                    </p>
                    <div className="ii-date-block">
                      <i className="fas fa-calendar-check" />
                      <div>
                        <span>Interview Date</span>
                        <strong>{fmtDateTime(app.chosenDate)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* SCORE */}
                  {score != null && (
                    <div className="ii-score-box">
                      <span>Your Score</span>
                      <strong>{Number(score).toFixed(1)}</strong>
                      <small>/10</small>
                    </div>
                  )}

                  {/* RIGHT */}
                  <div className="ii-final-status interviewed">
                    <strong>{completedTitle}</strong>
                    <span>{completedSub}</span>
                  </div>
                </div>
              </div>
            );
          }

          // ════════════════════════════════════
          // NORMAL CARD
          // ════════════════════════════════════
          let rightContent;

          if (startedExpired) {
            rightContent = (
              <div className="ii-final-status window-closed">
                <strong>Timed Out</strong>
                <span>Your interview time or continue window expired.</span>
              </div>
            );
          } else if (!isInProgress && isStartExpired) {
            rightContent = (
              <div className="ii-final-status window-closed">
                <strong>Window Closed</strong>
                <span>Contact recruiter to reschedule.</span>
              </div>
            );
          } else {
            const actionAllowed = canStart || canContinue;

            const btnLabel = canContinue ? (
              <>
                <i className="fas fa-rotate-right" />
                Continue Interview
              </>
            ) : canStart ? (
              <>
                <i className="fas fa-play" />
                Start Interview
              </>
            ) : (
              <>
                <i className="fas fa-lock" />
                Opens Soon
              </>
            );

            rightContent = (
              <div className="ii-action-wrap">
                <button
                  type="button"
                  onClick={() => goToInterview(app)}
                  disabled={!actionAllowed}
                  className={`ii-action-btn ${
                    !actionAllowed ? "locked" : canContinue ? "resume" : "start"
                  }`}
                >
                  {btnLabel}
                </button>

                {(canStart || canContinue) && (
                  <div className="ii-live-tag">
                    <i className="fas fa-circle" />
                    {canContinue ? "In Progress" : "Live Now"}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={appId}
              className={`ii-interview-card ${canStart || canContinue ? "live" : ""}`}
            >
              <div className="ii-rank-badge">#{listIdx + 1}</div>
              <div className="ii-card-inner">
                {/* LEFT */}
                <div className="ii-card-left">
                  <span className="ii-status-pill confirmed">
                    <i className="fas fa-circle-check" />
                    Confirmed
                  </span>
                  <h3>{jobTitle}</h3>
                  <p className="ii-company-line">
                    <i className="fas fa-building" />
                    {company}
                  </p>
                  <div className="ii-date-block">
                    <i className="fas fa-calendar-check" />
                    <div>
                      <span>Interview Scheduled</span>
                      <strong>{fmtDateTime(app.chosenDate)}</strong>
                    </div>
                  </div>

                  {rescheduleStatus === "requested" && (
                    <div className="ii-reschedule-tag requested">
                      <i className="fas fa-hourglass-half" />
                      Reschedule requested:{" "}
                      {fmtDateTime(app?.reschedule?.requestedDate)}
                    </div>
                  )}
                  {rescheduleStatus === "approved" && (
                    <div className="ii-reschedule-tag approved">
                      <i className="fas fa-circle-check" />
                      Reschedule approved
                    </div>
                  )}
                  {rescheduleStatus === "declined" && (
                    <div className="ii-reschedule-tag declined">
                      <i className="fas fa-circle-xmark" />
                      Reschedule declined
                    </div>
                  )}

                  {!isInProgress && !isStartLive && !isStartExpired && (
                    <div className="ii-hint-text">
                      <i className="fas fa-lock" />
                      Button activates {START_BEFORE_MINUTES} min before
                      scheduled time
                    </div>
                  )}

                  {!isInProgress && isStartExpired && (
                    <div className="ii-hint-text closed">
                      <i className="fas fa-clock" />
                      Start window closed {START_AFTER_MINUTES} min after
                      scheduled time
                    </div>
                  )}

                  {canContinue && (
                    <div className="ii-hint-text progress">
                      <i className="fas fa-circle-play" />
                      {iv.answeredCount || 0} of {iv.totalCount || 0} questions
                      answered
                      {activeRemainingMs !== null && (
                        <> · Time left: {formatTime(activeRemainingMs)}</>
                      )}
                    </div>
                  )}

                  {startedExpired && (
                    <div className="ii-hint-text closed">
                      <i className="fas fa-ban" />
                      Interview timed out. Saved answers will be reviewed.
                    </div>
                  )}
                </div>

                {/* RIGHT */}
                <div className="ii-card-right">{rightContent}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Popup styles ─── */
const popSt = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  box: {
    background: "#fff",
    borderRadius: 16,
    padding: "26px 26px 22px",
    width: 360,
    boxShadow: "0 28px 72px rgba(0,0,0,0.22)",
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 12,
    right: 14,
    background: "none",
    border: "none",
    fontSize: 15,
    color: "#94a3b8",
    cursor: "pointer",
    padding: 4,
  },
  liveRow: { display: "flex", alignItems: "center", gap: 7, marginBottom: 12 },
  dot: {
    display: "inline-block",
    width: 11,
    height: 11,
    borderRadius: "50%",
    background: "#16a34a",
  },
  liveLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#16a34a",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
  },
  title: {
    margin: "0 0 12px",
    fontWeight: 800,
    fontSize: 18,
    color: "#0f172a",
  },
  infoBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderLeft: "4px solid #2563eb",
    borderRadius: 10,
    padding: "11px 14px",
    marginBottom: 12,
  },
  role: { margin: 0, fontWeight: 800, fontSize: 15, color: "#0f172a" },
  company: { margin: "3px 0 0", fontSize: 13, color: "#64748b" },
  time: { margin: "7px 0 0", fontSize: 12, fontWeight: 700, color: "#2563eb" },
  sub: { margin: "0 0 16px", fontSize: 13, color: "#64748b", lineHeight: 1.5 },
  btns: { display: "flex", gap: 10 },
  laterBtn: {
    flex: 1,
    padding: "10px",
    borderRadius: 9,
    border: "1.5px solid #e2e8f0",
    background: "#f8fafc",
    color: "#374151",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  startBtn: {
    flex: 2,
    padding: "10px",
    borderRadius: 9,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
  },
};
