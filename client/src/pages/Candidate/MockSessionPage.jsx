// client/src/pages/Candidate/MockSessionPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../utils/api";
import { useParams, useNavigate } from "react-router-dom";
import "./mockPages.css";
import {
  mockInterviewGetSession,
  mockInterviewSubmitAnswer,
  mockInterviewFinish,
} from "../../utils/mockInterviewApi";


function scoreClass(score) {
  const n = Number(score);
  if (n >= 8) return "good";
  if (n >= 5) return "mid";
  return "bad";
}

export default function MockSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");

  const [speakingQuestion, setSpeakingQuestion] = useState(false);
const [questionSpeechError, setQuestionSpeechError] = useState("");
const [autoSpeakQuestion, setAutoSpeakQuestion] = useState(true);
const questionUtteranceRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const snapshotIntervalRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const speechRecogRef = useRef(null);
  const liveTranscriptRef = useRef("");
  const startAtRef = useRef(Date.now());

  const hasSpeechRecognition =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

    const hasQuestionSpeech =
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  "SpeechSynthesisUtterance" in window;

  const current = useMemo(() => {
    if (!session) return null;
    return (
      session.questions?.find((q) => q.index === session.currentIndex) ||
      session.questions?.[0] ||
      null
    );
  }, [session]);

  const isVoiceMode = session?.mode === "voice";
  const isVideoMode = session?.mode === "video";
  const usesVoiceAnswer = isVoiceMode || isVideoMode;
  const total = session?.questions?.length || 0;
  const answeredCount = (session?.questions || []).filter(
    (q) => q.answer && q.answer.trim(),
  ).length;
  const isCompleted = session?.status === "completed";
  const formatScore10 = (score) => {
  const n = Number(score);
  if (!Number.isFinite(n)) return "N/A";
  return Number.isInteger(n) ? n : n.toFixed(1);
};

const feedbackQuestion = useMemo(() => {
  const questions = session?.questions || [];
  if (!questions.length) return null;

  const currentQuestion = questions.find(
    (q) => q.index === session.currentIndex
  );

  // This handles the last question case, because after last answer
  // currentIndex usually remains on the last question.
  if (
    currentQuestion?.evaluation &&
    typeof currentQuestion.evaluation.score === "number"
  ) {
    return currentQuestion;
  }

  // Normal flow:
  // Candidate answers Q1 -> frontend moves to Q2 -> right side shows Q1 feedback.
  const previousQuestion = questions.find(
    (q) => q.index === session.currentIndex - 1
  );

  if (
    previousQuestion?.evaluation &&
    typeof previousQuestion.evaluation.score === "number"
  ) {
    return previousQuestion;
  }

  return null;
}, [session]);

const renderFeedbackCard = (q) => {
  if (!q?.evaluation) return null;

  return (
    <div className="mock-feedbackCard">
      <div className="mock-feedbackTop">
        <span className="mock-miniPill">Q{q.index + 1}</span>
        <span className="mock-miniPill">{q.skillTag || "General"}</span>
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
          <strong>Overall feedback:</strong> {q.evaluation.feedback}
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
          <strong>Ideal answer direction:</strong> {q.evaluation.idealAnswer}
        </p>
      )}
    </div>
  );
};

  const stopQuestionSpeech = () => {
  if (!hasQuestionSpeech) return;

  try {
    window.speechSynthesis.cancel();
  } catch (_) {}

  questionUtteranceRef.current = null;
  setSpeakingQuestion(false);
};

const getQuestionSpeechText = (question) => {
  const questionText = String(question || "").trim();

  if (!questionText) return "";

  return `Question ${(current?.index ?? 0) + 1}. ${questionText}`;
};

const speakQuestion = (questionText = current?.question) => {
  if (!usesVoiceAnswer) return;

  setQuestionSpeechError("");

  if (!hasQuestionSpeech) {
    setQuestionSpeechError(
      "Question voice is not supported in this browser. Please use Chrome or Edge."
    );
    return;
  }

  const textToSpeak = getQuestionSpeechText(questionText);

  if (!textToSpeak.trim()) return;

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setSpeakingQuestion(true);
      setQuestionSpeechError("");
    };

    utterance.onend = () => {
      setSpeakingQuestion(false);
      questionUtteranceRef.current = null;
    };

    utterance.onerror = () => {
      setSpeakingQuestion(false);
      questionUtteranceRef.current = null;
      setQuestionSpeechError("Could not play the question voice.");
    };

    questionUtteranceRef.current = utterance;

    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 150);
  } catch (err) {
    console.error("Question speech failed:", err);
    setSpeakingQuestion(false);
    setQuestionSpeechError("Could not play the question voice.");
  }
};

  const load = async () => {
    setLoading(true);
    try {
      const res = await mockInterviewGetSession(sessionId);
      setSession(res.data);
    } catch (e) {
      console.error(e);
      alert("Failed to load mock interview session.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [sessionId]);

  useEffect(() => {
  startAtRef.current = Date.now();
  setAnswer("");
  setVoiceError("");
  setLiveTranscript("");
  setQuestionSpeechError("");
  liveTranscriptRef.current = "";

  stopRecordingCleanup();
  stopQuestionSpeech();

  if (
    autoSpeakQuestion &&
    usesVoiceAnswer &&
    current?.question &&
    !isCompleted
  ) {
    const timer = setTimeout(() => {
      speakQuestion(current.question);
    }, 500);

    return () => clearTimeout(timer);
  }
}, [session?.currentIndex, current?.question, autoSpeakQuestion, usesVoiceAnswer, isCompleted]);

  useEffect(() => {
  return () => {
    stopRecordingCleanup();
    stopQuestionSpeech();
  };
}, []);

  useEffect(() => {
    if (!session || isCompleted) return;

    if (session.mode === "video") {
      startCamera();
    }

    return () => {
      if (session?.mode === "video") {
        stopCamera(false);
      }
    };
  }, [session?._id, session?.mode, isCompleted]);

  const stopRecordingCleanup = () => {
    if (speechRecogRef.current) {
      try {
        speechRecogRef.current.stop();
      } catch (_) {}
      speechRecogRef.current = null;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }

    if (mediaRecorderRef.current) {
      try {
        const stream = mediaRecorderRef.current.stream;
        if (stream) stream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
    }

    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setRecording(false);
    setTranscribing(false);
    setLiveTranscript("");
    liveTranscriptRef.current = "";
  };

  const startLiveTranscript = () => {
    if (!hasSpeechRecognition) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();

    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";

    recog.onresult = (e) => {
      let interim = "";
      let finalPart = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalPart += t + " ";
        } else {
          interim += t;
        }
      }

      if (finalPart) {
        liveTranscriptRef.current += finalPart;
      }

      setLiveTranscript(liveTranscriptRef.current + interim);
    };

    recog.onerror = () => {};

    recog.onend = () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        try {
          recog.start();
        } catch (_) {}
      }
    };

    try {
      recog.start();
      speechRecogRef.current = recog;
    } catch (_) {}
  };

  const startRecording = async () => {
  stopQuestionSpeech();

  setVoiceError("");
    setLiveTranscript("");
    liveTranscriptRef.current = "";
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());

        if (speechRecogRef.current) {
          try {
            speechRecogRef.current.stop();
          } catch (_) {}
          speechRecogRef.current = null;
        }

        await handleTranscribe();
      };

      mr.start(200);
      setRecording(true);
      startLiveTranscript();
    } catch (err) {
      setVoiceError(
        err?.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone access and try again."
          : "Could not access microphone. Please check your device settings.",
      );
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const handleTranscribe = async () => {
    if (!audioChunksRef.current.length) {
      setVoiceError("No audio was captured. Please try again.");
      return;
    }

    setTranscribing(true);
    setVoiceError("");

    try {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      audioChunksRef.current = [];

      const formData = new FormData();
      formData.append("audio", blob, "mock-answer.webm");

      //       const res = await axios.post(`${API_BASE}/api/transcribe`, formData, {
      //   headers: {
      //     ...authHeaders(),
      //     "Content-Type": "multipart/form-data",
      //   },
      //   timeout: 30000,
      // });
      const res = await api.post("/transcribe", formData, {
        timeout: 30000,
      });

      const transcript = res.data.transcript || "";
      setLiveTranscript("");
      setAnswer(transcript);

      if (!transcript.trim()) {
        setVoiceError(
          "No speech detected. Please speak clearly and try again.",
        );
      }
    } catch (err) {
      console.error(err);
      setVoiceError(
        err?.response?.data?.message ||
          "Transcription failed. Please try again.",
      );
    } finally {
      setTranscribing(false);
    }
  };

  function captureFrameBase64(videoEl, quality = 0.7) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth || 320;
      canvas.height = videoEl.videoHeight || 240;
      canvas
        .getContext("2d")
        .drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", quality);
    } catch {
      return null;
    }
  }

  const saveMockSnapshot = async (flagged = false, violationReason = "") => {
    if (!videoRef.current || !cameraStreamRef.current) return;

    const imageBase64 = captureFrameBase64(videoRef.current);
    if (!imageBase64) return;

    try {
      // await axios.post(
      //   `${API_BASE}/api/mock/session/${sessionId}/camera/snapshot`,
      //   { imageBase64, flagged, violationReason },
      //   { headers: authHeaders() },
      // );
      await api.post(`/mock/session/${sessionId}/camera/snapshot`, {
        imageBase64,
        flagged,
        violationReason,
      });
    } catch (err) {
      console.warn("Mock snapshot failed:", err?.response?.data || err.message);
    }
  };

  const stopCamera = async (recordOff = true) => {
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }

    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }

    setCameraReady(false);

    if (!recordOff) return;

    try {
      // await axios.post(
      //   `${API_BASE}/api/mock/session/${sessionId}/camera/off`,
      //   {},
      //   { headers: authHeaders() },
      // );

      await api.post(`/mock/session/${sessionId}/camera/off`, {});
    } catch {}
  };

  const startCamera = async () => {
    setCameraError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: "user",
        },
        audio: false,
      });

      cameraStreamRef.current = stream;
      setCameraReady(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      snapshotIntervalRef.current = setInterval(() => {
        saveMockSnapshot(false, "");
      }, 25000);

      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopCamera();
      });
    } catch (err) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access for video mock interview."
          : "Camera not available. Please check your device.",
      );
    }
  };
  const onSubmit = async () => {
  stopQuestionSpeech();

  if (!session || !current) return;

    const trimmed = answer.trim();
    if (!trimmed) return;

    setSubmitting(true);

    try {
      const res = await mockInterviewSubmitAnswer({
        sessionId,
        index: current.index,
        answer: trimmed,
        answerMode: usesVoiceAnswer ? "voice" : "text",
        timeTakenSec: Math.max(
          0,
          Math.round((Date.now() - startAtRef.current) / 1000),
        ),
        tabSwitchCount: 0,
        pasteCount: 0,
        hiddenTimeMs: 0,
        voiceEditRatio: null,
        voiceWordsPerSec: null,
      });

      setSession(res.data?.session);
      setAnswer("");
      setLiveTranscript("");
      setVoiceError("");
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "Failed to evaluate answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const onFinish = async () => {
  stopQuestionSpeech();

  if (isVideoMode) {
      await saveMockSnapshot(false, "mock_session_end");
      await stopCamera(false);
    }
    try {
      const res = await mockInterviewFinish(sessionId);
      setSession(res.data?.session);
      localStorage.setItem(
        "mockLastCompletedSession",
        JSON.stringify(res.data?.session),
      );
    } catch (e) {
      console.error(e);
      alert("Failed to finish session.");
    }
  };

  if (loading) {
    return (
      <div className="mock-page">
        <div className="mock-container">
          <div className="mock-card mock-loadingCard">Loading session...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mock-page">
        <div className="mock-container">
          <div className="mock-card mock-loadingCard">Session not found.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mock-page">
      <div className="mock-container">
        <div className="mock-sessionHeader">
          <div>
            <p className="mock-kicker">Mock Interview Session</p>
            <h1 className="mock-titleSmall">{session.role}</h1>
            <p className="mock-subtitleSmall">
              {session.level} · {session.interviewType}
            </p>
          </div>

          <button
            className="mock-btnGhost"
            onClick={() => navigate("/candidate/mock-interview/analytics")}
          >
            View Analytics
          </button>
        </div>

        <div className="mock-pillBar">
          <span className="mock-pill">
            Progress: {answeredCount}/{total}
          </span>
          <span className="mock-pill">
            Skill: {current?.skillTag || "General"}
          </span>
          <span className="mock-pill">
            Difficulty: {current?.difficulty || session.difficulty}
          </span>
          <span className="mock-pill">
            Mode: {isVideoMode ? "Video" : isVoiceMode ? "Voice" : "Text"}
          </span>
          {isCompleted && (
            <span className="mock-pill">
              Overall Score: {formatScore10(session.overallScore)}/10
            </span>
          )}
        </div>

        {!isCompleted ? (
          <div className="mock-sessionGrid">
            <div className="mock-card">
              <div className="mock-cardBody">
                <h3 className="mock-sectionTitle">
  Question {(current?.index ?? 0) + 1}
</h3>

<p className="mock-questionText">{current?.question}</p>

{usesVoiceAnswer && (
  <div className="mock-questionVoiceBox">
    <div className="mock-questionVoiceInfo">
      <span className="mock-voiceIcon">
        <i className="fa-solid fa-volume-high"></i>
      </span>
      <div>
        <strong>Voice Question</strong>
        <p>
          {speakingQuestion
            ? "Question is being spoken..."
            : "Question is displayed above and can also be played as voice."}
        </p>
      </div>
    </div>



    <div className="mock-questionVoiceActions">
      <button
        type="button"
        className="mock-btnSecondary"
        onClick={() => speakQuestion(current?.question)}
        disabled={speakingQuestion || recording || transcribing}
      >
        {speakingQuestion ? "Speaking..." : "Replay Question"}
      </button>

      {speakingQuestion && (
        <button
          type="button"
          className="mock-btnGhost"
          onClick={stopQuestionSpeech}
        >
          Stop Voice
        </button>
      )}

      <label className="mock-autoSpeakToggle">
        <input
          type="checkbox"
          checked={autoSpeakQuestion}
          onChange={(e) => setAutoSpeakQuestion(e.target.checked)}
        />
        Auto speak next question
      </label>
    </div>

    {questionSpeechError && (
      <p className="mock-errorText" style={{ marginTop: 10 }}>
        {questionSpeechError}
      </p>
    )}
  </div>
)}

                <div className="mock-field" style={{ marginTop: 20 }}>
                  <label className="mock-label">
                    {usesVoiceAnswer ? "Your Voice Answer" : "Your Answer"}
                  </label>

                  <textarea
                    className="mock-answerArea"
                    value={recording ? liveTranscript : answer}
                    onChange={(e) => {
                      if (!recording) setAnswer(e.target.value);
                    }}
                    disabled={transcribing}
                    placeholder={
                      usesVoiceAnswer
                        ? transcribing
                          ? "Transcribing your answer..."
                          : recording
                            ? "Listening... your words are appearing here."
                            : "Record your answer, review the transcript, then submit."
                        : "Type your answer here..."
                    }
                  />
{isVideoMode && (
      <div className="mock-floatingCamera">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="mock-floatingCameraVideo"
        />

        <div className="mock-floatingCameraStatus">
          {cameraReady ? "Camera active" : "Starting camera..."}
        </div>

        {cameraError && (
          <div className="mock-floatingCameraError">
            {cameraError}
          </div>
        )}
      </div>
    )}
                </div>

                {usesVoiceAnswer && (
                  <div className="mock-voiceRow">
                    {!recording && !transcribing && (
                      <button
                        className="mock-btnSecondary"
                        onClick={startRecording}
                      >
                        Start Recording
                      </button>
                    )}

                    {recording && (
                      <button
                        className="mock-btnSecondary"
                        onClick={stopRecording}
                      >
                        Stop Recording
                      </button>
                    )}

                    {transcribing && (
                      <div className="mock-statusText">
                        Transcribing your answer...
                      </div>
                    )}

                    {voiceError && (
                      <div className="mock-errorText">{voiceError}</div>
                    )}
                  </div>
                )}

                <div
                  className="mock-footerActions"
                  style={{ justifyContent: "flex-start", marginTop: 20 }}
                >
                  <button
                    className="mock-btnPrimary"
                    onClick={onSubmit}
                    disabled={
                      submitting || transcribing || recording || !answer.trim()
                    }
                  >
                    {submitting ? "Evaluating..." : "Submit Answer"}
                  </button>

                  <button
                    className="mock-btnGhost"
                    onClick={onFinish}
                    disabled={answeredCount === 0}
                  >
                    Finish Session
                  </button>
                </div>
              </div>
            </div>

            <div className="mock-card">
  <div className="mock-cardBody">
    <h3 className="mock-sectionTitle">Feedback</h3>

    {feedbackQuestion ? (
      renderFeedbackCard(feedbackQuestion)
    ) : (
      <div className="mock-emptyState">
        Kindly answer the given question to get your feedback.
      </div>
    )}
  </div>
</div>          </div>
        ) : (
          <div className="mock-card">
            <div className="mock-cardBody">
              <div className="mock-completeBox">
                <h3 className="mock-sectionTitle">Session Completed</h3>
                <p className="mock-resultBig">
  {formatScore10(session.overallScore)}/10
</p>
                <p className="mock-muted">
                  Your mock interview session has been completed successfully.
                </p>

                <div className="mock-footerActions">
                  <button
                    className="mock-btnPrimary"
                    onClick={() =>
                      navigate("/candidate/mock-interview/analytics")
                    }
                  >
                    View Analytics
                  </button>
                  <button
                    className="mock-btnGhost"
                    onClick={() => navigate("/candidate/mock-interview")}
                  >
                    Start New Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
