import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./mockPages.css";
import { mockInterviewDetailedFeedback } from "../../utils/mockInterviewApi";

function scoreClass(score) {
  const n = Number(score);
  if (n >= 8) return "good";
  if (n >= 5) return "mid";
  return "bad";
}

function formatScore10(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "N/A";
  return Number.isInteger(n) ? n : n.toFixed(1);
}

export default function MockDetailedFeedbackPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await mockInterviewDetailedFeedback(sessionId);
        setSession(res.data);
      } catch (err) {
        console.error(err);
        alert("Failed to load detailed feedback.");
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const evaluatedQuestions = useMemo(() => {
    return (session?.questions || []).filter(
      (q) => q.evaluation && typeof q.evaluation.score === "number"
    );
  }, [session]);

  if (loading) {
    return (
      <div className="mock-page">
        <div className="mock-container">
          <div className="mock-card mock-loadingCard">
            Loading detailed feedback...
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mock-page">
        <div className="mock-container">
          <div className="mock-card mock-loadingCard">
            Detailed feedback not found.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mock-page">
      <div className="mock-container">
        <div className="mock-sessionHeader">
          <div>
            <p className="mock-kicker">Detailed Feedback</p>
            <h1 className="mock-titleSmall">{session.role}</h1>
            <p className="mock-subtitleSmall">
              {session.level} · {session.interviewType}
            </p>
          </div>

          <button
            className="mock-btnGhost"
            onClick={() => navigate("/candidate/mock-interview/analytics")}
          >
            Back to Analytics
          </button>
        </div>

        <div className="mock-pillBar">
          <span className="mock-pill">
            Overall Score: {formatScore10(session.overallScore)}/10
          </span>
          <span className="mock-pill">
            Mode:{" "}
            {session.mode === "video"
              ? "Video"
              : session.mode === "voice"
                ? "Voice"
                : "Text"}
          </span>
          <span className="mock-pill">
            Answered: {evaluatedQuestions.length}/{session.questions?.length || 0}
          </span>
        </div>

        {evaluatedQuestions.length === 0 ? (
          <div className="mock-card">
            <div className="mock-cardBody">
              <div className="mock-emptyState">
                No detailed feedback is available for this session.
              </div>
            </div>
          </div>
        ) : (
          <div className="mock-detailFeedbackStack">
            {evaluatedQuestions.map((q) => (
              <div key={q.index} className="mock-card">
                <div className="mock-cardBody">
                  <div className="mock-feedbackTop">
                    <span className="mock-miniPill">Q{q.index + 1}</span>
                    <span className="mock-miniPill">
                      {q.skillTag || "General"}
                    </span>
                    <span
                      className={`mock-miniPill score-${scoreClass(
                        q.evaluation.score
                      )}`}
                    >
                      {q.evaluation.score}/10
                    </span>
                  </div>

                  <p className="mock-feedbackQuestion">{q.question}</p>

                  <p className="mock-feedbackText">
                    <strong>Your answer</strong>
                  </p>
                  <div className="mock-yourAnswerBox">
                    {q.answer?.trim() || "No answer recorded."}
                  </div>

                  {q.evaluation.feedback && (
                    <p className="mock-feedbackText">
                      <strong>Overall feedback:</strong>{" "}
                      {q.evaluation.feedback}
                    </p>
                  )}

                  {Array.isArray(q.evaluation.strengths) &&
                    q.evaluation.strengths.length > 0 && (
                      <>
                        <p className="mock-feedbackText">
                          <strong>Strengths</strong>
                        </p>
                        <ul className="mock-list">
                          {q.evaluation.strengths.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </>
                    )}

                  {Array.isArray(q.evaluation.weaknesses) &&
                    q.evaluation.weaknesses.length > 0 && (
                      <>
                        <p className="mock-feedbackText">
                          <strong>Improvements needed</strong>
                        </p>
                        <ul className="mock-list">
                          {q.evaluation.weaknesses.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </>
                    )}

                  {Array.isArray(q.evaluation.missingKeywords) &&
                    q.evaluation.missingKeywords.length > 0 && (
                      <>
                        <p className="mock-feedbackText">
                          <strong>Missing keywords</strong>
                        </p>
                        <ul className="mock-list">
                          {q.evaluation.missingKeywords.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </>
                    )}

                  {q.evaluation.suggestion && (
                    <p className="mock-feedbackText">
                      <strong>Suggestion:</strong> {q.evaluation.suggestion}
                    </p>
                  )}

                  {q.evaluation.idealAnswer && (
                    <p className="mock-feedbackText">
                      <strong>Ideal answer direction:</strong>{" "}
                      {q.evaluation.idealAnswer}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
