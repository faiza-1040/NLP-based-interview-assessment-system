// src/layouts/CandidateLayout.jsx
import React, { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import CandidateNavbar from "../components/CandidateNavbar";
import Footer from "../components/Footer";
// import axios from "axios";
import "./CandidateLayout.css";

import { api } from "../utils/api";

// const API_BASE = import.meta?.env?.VITE_API_BASE || "http://127.0.0.1:5000";

// Inject keyframes once
if (typeof document !== "undefined" && !document.getElementById("cl-kf")) {
  const s = document.createElement("style");
  s.id = "cl-kf";
  s.textContent = `
    @keyframes clDotPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.55); }
      60%      { box-shadow: 0 0 0 9px rgba(22,163,74,0); }
    }
    @keyframes clSlideDown {
      from { opacity:0; transform:translateY(-18px) scale(0.96); }
      to   { opacity:1; transform:translateY(0)    scale(1);    }
    }
  `;
  document.head.appendChild(s);
}

// function authHeaders() {
//   const token = localStorage.getItem("token");
//   return token ? { Authorization: `Bearer ${token}` } : {};
// }

// sessionStorage helpers — popup never re-fires for same appId once dismissed
function getNotified() {
  try { return new Set(JSON.parse(sessionStorage.getItem("cl_notified") || "[]")); }
  catch { return new Set(); }
}
function markNotified(appId) {
  try {
    const s = getNotified(); s.add(String(appId));
    sessionStorage.setItem("cl_notified", JSON.stringify([...s]));
  } catch {}
}

function windowState(chosenDate) {
  if (!chosenDate) return "unknown";
  const diff = Date.now() - new Date(chosenDate).getTime();
  if (diff < -10 * 60 * 1000) return "upcoming";
  if (diff <=  15 * 60 * 1000) return "live";
  return "expired";
}

const fmt = (d) => {
  try { return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
};

export default function CandidateLayout() {
  const navigate = useNavigate();
  const [popup, setPopup] = useState(null);
  const notifiedRef = useRef(getNotified());
  const timerRef = useRef(null);

  const poll = async () => {
    try {
      // const res  = await axios.get(`${API_BASE}/api/applications/mine`, { headers: authHeaders() });
      const res = await api.get("/applications/mine");
      const data = res.data;
      const list = Array.isArray(data) ? data : data?.applications || [];

      for (const app of list) {
        if (app.status !== "InterviewConfirmed" || !app.chosenDate) continue;
        if (app.interviewStatus === "completed") continue;

        const state = windowState(app.chosenDate);
        const id    = String(app._id);

        if (state === "live" && !notifiedRef.current.has(id)) {
          notifiedRef.current.add(id);
          markNotified(id);

          const jobTitle = app?.job?.title || "Interview";
          const company  =
            app?.job?.createdBy?.companyName ||
            app?.job?.companyName ||
            app?.job?.createdBy?.name || "";

          setPopup({ appId: id, jobTitle, company, scheduledAt: app.chosenDate });
          break; // show one at a time
        }
      }
    } catch (_) {
      // silently ignore — don't break the layout
    }
  };

  useEffect(() => {
    poll();                                         // check immediately on mount
    timerRef.current = setInterval(poll, 30_000);  // then every 30 s
    return () => clearInterval(timerRef.current);
  }, []);

  const dismiss = () => {
    if (popup) markNotified(popup.appId);
    setPopup(null);
  };

  const startNow = () => {
    if (!popup) return;
    const id = popup.appId;
    dismiss();
    navigate(`/candidate/interview/${id}`);
  };

  return (
    <>
      {/* ── Global interview-ready popup ── */}
      {popup && (
        <div style={p.overlay}>
          <div style={p.card}>

            <button style={p.close} onClick={dismiss} title="Dismiss">✕</button>

            {/* Live indicator */}
            <div style={p.liveRow}>
              <span style={p.dot} />
              <span style={p.liveText}>Live Now</span>
            </div>

            <h3 style={p.title}>Your interview is ready!</h3>

            {/* Info box */}
            <div style={p.infoBox}>
              <p style={p.role}>{popup.jobTitle}</p>
              {popup.company && <p style={p.company}>{popup.company}</p>}
              <p style={p.time}>
                <i className="fas fa-clock" style={{ marginRight: 5 }} />
                Scheduled: {fmt(popup.scheduledAt)}
              </p>
            </div>

            <p style={p.sub}>
              The 15-minute window is open. Start now to avoid missing it.
            </p>

            <div style={p.btnRow}>
              <button style={p.laterBtn} onClick={dismiss}>Later</button>
              <button style={p.startBtn} onClick={startNow}>
                <i className="fas fa-play" style={{ marginRight: 7, fontSize: 12 }} />
                Start Interview
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Normal layout ── */}
      <div className="candidate-layout">
        <CandidateNavbar />
        <main className="candidate-main">
          <div className="candidate-content">
            <Outlet />
          </div>
        </main>
      </div>

      <Footer />
    </>
  );
}

/* ── Popup styles ── */
const p = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(15,23,42,0.52)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 99999,
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "26px 26px 22px",
    width: 360,
    boxShadow: "0 30px 80px rgba(0,0,0,0.25)",
    position: "relative",
    animation: "clSlideDown 0.22s ease",
  },
  close: {
    position: "absolute", top: 12, right: 14,
    background: "none", border: "none",
    fontSize: 15, color: "#94a3b8",
    cursor: "pointer", padding: 4, lineHeight: 1,
  },
  liveRow: { display: "flex", alignItems: "center", gap: 7, marginBottom: 12 },
  dot: {
    display: "inline-block",
    width: 11, height: 11, borderRadius: "50%",
    background: "#16a34a",
    animation: "clDotPulse 1.5s ease-in-out infinite",
  },
  liveText: {
    fontSize: 11, fontWeight: 800, color: "#16a34a",
    textTransform: "uppercase", letterSpacing: "0.7px",
  },
  title: { margin: "0 0 12px", fontWeight: 800, fontSize: 18, color: "#0f172a" },
  infoBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderLeft: "4px solid #2563eb",
    borderRadius: 10,
    padding: "11px 14px",
    marginBottom: 12,
  },
  role:    { margin: 0, fontWeight: 800, fontSize: 15, color: "#0f172a" },
  company: { margin: "3px 0 0", fontSize: 13, color: "#64748b" },
  time:    { margin: "7px 0 0", fontSize: 12, fontWeight: 700, color: "#2563eb" },
  sub: { margin: "0 0 18px", fontSize: 13, color: "#64748b", lineHeight: 1.5 },
  btnRow: { display: "flex", gap: 10 },
  laterBtn: {
    flex: 1, padding: "10px",
    borderRadius: 9, border: "1.5px solid #e2e8f0",
    background: "#f8fafc", color: "#374151",
    fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  startBtn: {
    flex: 2, padding: "10px",
    borderRadius: 9, border: "none",
    background: "#2563eb", color: "#fff",
    fontWeight: 800, fontSize: 13, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 14px rgba(37,99,235,0.32)",
  },
};