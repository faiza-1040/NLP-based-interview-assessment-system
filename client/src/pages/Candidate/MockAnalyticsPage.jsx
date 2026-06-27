// client/src/pages/Candidate/MockAnalyticsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./mockPages.css";
import { mockInterviewAnalytics } from "../../utils/mockInterviewApi";

function scoreVariant(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "neutral";
  if (n >= 8) return "good";
  if (n >= 6) return "warn";
  return "bad";
}
function formatScore10(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "N/A";
  return Number.isInteger(n) ? n : n.toFixed(1);
}

function safeJsonParse(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeSession(s, fallbackStart, fallbackCompleted) {
  const role = s?.role ?? fallbackCompleted?.role ?? fallbackStart?.role ?? "Unknown Role";
  const level = s?.level ?? fallbackCompleted?.level ?? fallbackStart?.level ?? "Unknown Level";
  const interviewType =
    s?.interviewType ?? fallbackCompleted?.interviewType ?? fallbackStart?.interviewType ?? "Interview";

  const skillBreakdown =
    s?.skillBreakdown && Object.keys(s.skillBreakdown).length
      ? s.skillBreakdown
      : fallbackCompleted?.skillBreakdown || {};

  return {
    ...s,
    role,
    level,
    interviewType,
    skillBreakdown,
    overallScore: s?.overallScore ?? fallbackCompleted?.overallScore ?? null,
    communicationScore:
      typeof s?.communicationScore === "number"
        ? s.communicationScore
        : fallbackCompleted?.communicationScore ?? null,
    technicalScore:
      typeof s?.technicalScore === "number"
        ? s.technicalScore
        : fallbackCompleted?.technicalScore ?? null,
  };
}

export default function MockAnalyticsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fallbackStart = useMemo(() => safeJsonParse("mockLastStartPayload"), []);
  const fallbackCompleted = useMemo(
    () => safeJsonParse("mockLastCompletedSession"),
    []
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await mockInterviewAnalytics();
        setData(res.data);
      } catch (e) {
        console.error(e);
        alert("Failed to load analytics.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sessions = useMemo(() => {
    const raw = data?.sessions || [];

    if (!raw.length) {
      const seed = fallbackCompleted || fallbackStart;
      if (!seed) return [];
      return [
        normalizeSession(
          {
            _id: "local-preview",
            role: seed.role,
            level: seed.level,
            interviewType: seed.interviewType,
            overallScore: seed.overallScore,
            skillBreakdown: seed.skillBreakdown,
            communicationScore: seed.communicationScore,
            technicalScore: seed.technicalScore,
          },
          fallbackStart,
          fallbackCompleted
        ),
      ];
    }

    return raw.map((s) => normalizeSession(s, fallbackStart, fallbackCompleted));
  }, [data, fallbackStart, fallbackCompleted]);

  if (loading) {
    return (
      <div className="mock-page">
        <div className="mock-container">
          <div className="mock-card mock-loadingCard">Loading analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mock-page">
      <div className="mock-container">
        <div className="mock-hero">
          <div>
            <p className="mock-kicker">Analytics</p>
            <h1 className="mock-title">Mock Interview Performance</h1>
            <p className="mock-subtitle">
              Review your completed sessions, compare your scores, and identify
              your weaker areas so you can improve your interview performance.
            </p>
          </div>
        </div>

        <div className="mock-footerActions" style={{ marginTop: 0, marginBottom: 20 }}>
          <button
            type="button"
            className="mock-btnPrimary"
            onClick={() => navigate("/candidate/mock-interview")}
          >
            Start New Mock Interview
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="mock-card">
            <div className="mock-cardBody">
              <div className="mock-emptyState">
                Complete a mock interview session to see your performance analytics.
              </div>
            </div>
          </div>
        ) : (
          <div className="mock-analyticsGrid">
            {sessions.map((s) => {
              const overallVar = scoreVariant(s.overallScore);
              const entries = Object.entries(s.skillBreakdown || {});
              const weakSkills = entries
                .filter(([, v]) => Number(v) < 60)
                .map(([k]) => k);

              return (
                <div key={s._id} className="mock-card">
                  <div className="mock-cardBody">
                    <div className="mock-analyticsTop">
                      <div>
                        <h3 className="mock-sectionTitle">{s.role}</h3>
                        <p className="mock-subtitleSmall">
                          {s.level} · {s.interviewType}
                        </p>
                      </div>

                      <div className={`mock-scoreBadge ${overallVar}`}>
  {formatScore10(s.overallScore)}/10
</div>
                    </div>

                    {(typeof s.communicationScore === "number" ||
                      typeof s.technicalScore === "number") && (
                      <div className="mock-analyticsBlock">
                        <div className="mock-tagWrap">
                          {typeof s.communicationScore === "number" && (
                            <span className="mock-tagBlue">
                              Communication: {s.communicationScore}%
                            </span>
                          )}
                          {typeof s.technicalScore === "number" && (
                            <span className="mock-tagBlue">
                              Technical: {s.technicalScore}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mock-analyticsBlock">
                      <p className="mock-feedbackText">
                        <strong>Skill Breakdown</strong>
                      </p>

                      {entries.length === 0 ? (
                        <p className="mock-muted">No skill breakdown available.</p>
                      ) : (
                        <div className="mock-tagWrap">
                          {entries.map(([k, v]) => (
                            <span key={k} className="mock-tagBlue">
                              {k}: {v}%
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mock-analyticsBlock">
                      <p className="mock-feedbackText">
                        <strong>Weak skills:</strong>{" "}
                        {weakSkills.length ? weakSkills.join(", ") : "None detected"}
                      </p>
                    </div>

                    <div className="mock-footerActions" style={{ marginTop: 16 }}>
  <button
    type="button"
    className="mock-btnSecondary"
    onClick={() =>
      navigate(`/candidate/mock-interview/analytics/${s._id}/feedback`)
    }
    disabled={s._id === "local-preview"}
  >
    View Detailed Feedback
  </button>
</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
