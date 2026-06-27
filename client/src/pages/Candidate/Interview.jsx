// client/src/pages/Candidate/Interview.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { api } from "../../utils/api";
import { useParams, useNavigate } from "react-router-dom";
import CodeEditor from "../../components/interview/CodeEditor";

// ── Inject keyframes once ────────────────────────────────────────────────────
if (
  typeof document !== "undefined" &&
  !document.getElementById("iv-keyframes")
) {
  const style = document.createElement("style");
  style.id = "iv-keyframes";
  style.textContent = `
    @keyframes spin        { to { transform: rotate(360deg); } }
    @keyframes pulse-dot   { 0%,100%{ opacity:1; transform:scale(1); } 50%{ opacity:0.5; transform:scale(1.3); } }
    @keyframes fade-in     { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
    @keyframes cam-blink   { 0%,100%{ opacity:1; } 50%{ opacity:0.3; } }
    @keyframes violation-flash { 0%,100%{ background:#fef2f2; } 50%{ background:#fee2e2; } }
    @media (max-width: 600px) { body { overflow-x: hidden; } }
  `;
  document.head.appendChild(style);
}

// ── Speech helpers ────────────────────────────────────────────────────────────
function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.95;
  utt.pitch = 1;
  utt.lang = "en-US";
  window.speechSynthesis.speak(utt);
}
function stopSpeaking() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

const hasSpeechSynthesis =
  typeof window !== "undefined" && !!window.speechSynthesis;
const hasSpeechRecognition =
  typeof window !== "undefined" &&
  !!(window.SpeechRecognition || window.webkitSpeechRecognition);

// ── Camera helpers ────────────────────────────────────────────────────────────
const FRAME_INTERVAL_MS = 3000; // send frame for analysis every 3s
const SNAPSHOT_INTERVAL_MS = 25000; // save snapshot every 25s

function captureFrameBase64(videoEl, quality = 0.5) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth || 320;
    canvas.height = videoEl.videoHeight || 240;
    canvas
      .getContext("2d")
      .drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch (_) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function formatTime(ms) {
  const safe = Math.max(0, Number(ms || 0));
  const totalSeconds = Math.floor(safe / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Interview() {
  const { appId } = useParams();
  const navigate = useNavigate();

  // ── Core interview state ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [interviewId, setInterviewId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answeredIds, setAnsweredIds] = useState(new Set());
  const [answerText, setAnswerText] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [finalResult, setFinalResult] = useState(null);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [focusLost, setFocusLost] = useState(false);
  const [fsRefused, setFsRefused] = useState(false);

  const [evaluatingAnswer, setEvaluatingAnswer] = useState(false);
  const [pendingQuestionId, setPendingQuestionId] = useState(null);

  const [activeTimeRemainingMs, setActiveTimeRemainingMs] = useState(null);
  const [continueAllowedUntil, setContinueAllowedUntil] = useState(null);

  // ── Code editor state ───────────────────────────────────────────────────────
  const [codeText, setCodeText] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("javascript");

  // ── Voice state ────────────────────────────────────────────────────────────
  const [voiceMode, setVoiceMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [questionSpeaking, setQuestionSpeaking] = useState(false);

  // ── Camera state ───────────────────────────────────────────────────────────
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraPermission, setCameraPermission] = useState("pending"); // "pending"|"granted"|"denied"
  const [cameraViolation, setCameraViolation] = useState(null); // { reason, level }
  const [warningCount, setWarningCount] = useState(0);
  const [cameraMinimized, setCameraMinimized] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const startAtRef = useRef(Date.now());
  const tabSwitchRef = useRef(0);
  const pasteRef = useRef(0);
  const hiddenMsRef = useRef(0);
  const hiddenAtRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const transcriptWordCountRef = useRef(0);
  const audioDurationRef = useRef(0);
  const recordingStartRef = useRef(null);
  const speechRecogRef = useRef(null);
  const liveTranscriptRef = useRef("");
  const generationPollRef = useRef(null);
  const answerPollRef = useRef(null);

  const heartbeatRef = useRef(null);
  const timerRef = useRef(null);

  // Camera refs
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const snapshotIntervalRef = useRef(null);
  const interviewIdRef = useRef(null); // always current interviewId for callbacks

  // Keep interviewIdRef in sync
  useEffect(() => {
    interviewIdRef.current = interviewId;
  }, [interviewId]);

  const currentQuestion = useMemo(() => questions[idx], [questions, idx]);
  //added this for code editor
  const isCodingQuestion = currentQuestion?.answerFormat === "code";

  const shouldRunProctoring = questions.length > 0 && !finalResult;

  const applyTiming = useCallback((data = {}) => {
    if (
      data.activeTimeRemainingMs !== undefined &&
      data.activeTimeRemainingMs !== null
    ) {
      setActiveTimeRemainingMs(Number(data.activeTimeRemainingMs));
    }

    if (data.continueAllowedUntil) {
      setContinueAllowedUntil(data.continueAllowedUntil);
    }
  }, []);

  // ── Reset per-question signals ─────────────────────────────────────────────
  const resetSignals = () => {
    startAtRef.current = Date.now();
    tabSwitchRef.current = 0;
    pasteRef.current = 0;
    hiddenMsRef.current = 0;
    hiddenAtRef.current = null;
    transcriptWordCountRef.current = 0;
    audioDurationRef.current = 0;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  CAMERA SETUP
  // ═══════════════════════════════════════════════════════════════════════════

  const stopCamera = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const sendCameraOff = useCallback(async () => {
    const iid = interviewIdRef.current;
    if (!iid) return;
    try {
      await api.post(`/interview/${iid}/camera/off`, {});
    } catch (_) {}
  }, []);

  // Send a frame to NLP for analysis
  const sendFrame = useCallback(async () => {
    const iid = interviewIdRef.current;
    if (!iid || !videoRef.current || !cameraStreamRef.current) return;
    const b64 = captureFrameBase64(videoRef.current, 0.4);
    if (!b64) return;
    try {
      const res = await api.post(`/interview/${iid}/camera/frame`, {
        imageBase64: b64,
      });
      const data = res.data || {};
      if (data.violation) {
        setCameraViolation({
          reason: data.violation_reason,
          level: data.warningLevel,
        });
        setWarningCount(data.warningCount || 0);
      } else {
        setCameraViolation(null);
      }
    } catch (_) {}
  }, []);

  // Send a snapshot to server for recruiter
  const sendSnapshot = useCallback(
    async (flagged = false, violationReason = null) => {
      const iid = interviewIdRef.current;
      if (!iid || !videoRef.current || !cameraStreamRef.current) return;
      const b64 = captureFrameBase64(videoRef.current, 0.7);
      if (!b64) return;
      try {
        await api.post(`/interview/${iid}/camera/snapshot`, {
          imageBase64: b64,
          flagged,
          violationReason,
        });
      } catch (_) {}
    },
    [],
  );

  const startCamera = useCallback(async () => {
    setCameraError("");
    setCameraPermission("pending");

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
      setCameraPermission("granted");
      setCameraReady(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Start frame analysis loop
      frameIntervalRef.current = setInterval(sendFrame, FRAME_INTERVAL_MS);

      // Start snapshot loop
      snapshotIntervalRef.current = setInterval(() => {
        sendSnapshot(false, null);
      }, SNAPSHOT_INTERVAL_MS);

      // Handle stream ending unexpectedly (user revokes permission)
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        setCameraReady(false);
        setCameraPermission("denied");
        setCameraViolation({ reason: "camera_off", level: "high" });
        sendCameraOff();
      });
    } catch (err) {
      setCameraPermission("denied");
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera access to continue the interview."
          : "Camera not available. Please check your device settings.",
      );
    }
  }, [sendFrame, sendSnapshot, sendCameraOff]);

  // Start camera only after interview questions are ready
  useEffect(() => {
    if (!interviewId || questions.length === 0 || finalResult) return;
    startCamera();
    return () => {
      stopCamera();
    };
  }, [interviewId, questions.length, finalResult]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!interviewId || questions.length === 0 || finalResult) return;

    const sendHeartbeat = async () => {
      try {
        const res = await api.post(`/interview/${interviewId}/heartbeat`, {});
        const data = res.data || {};

        applyTiming(data);

        if (data.status === "completed") {
          setFinalResult({
            ...data,
            overallScore: data.overallScore ?? 0,
            finalCheatingRisk: data.finalCheatingRisk ?? 0,
            message:
              data.completionReason === "active_time_expired"
                ? "Interview time expired."
                : data.completionReason === "continue_window_expired"
                  ? "Continue window expired."
                  : "Interview completed.",
          });

          stopCamera();
        }
      } catch (err) {
        console.error("heartbeat failed:", err);
      }
    };

    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 10_000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [interviewId, questions.length, finalResult, applyTiming, stopCamera]);

  const hasActiveTimer =
    activeTimeRemainingMs !== null && activeTimeRemainingMs !== undefined;

  useEffect(() => {
    if (!hasActiveTimer || finalResult) return;

    timerRef.current = setInterval(() => {
      setActiveTimeRemainingMs((prev) => {
        if (prev === null || prev === undefined) return prev;
        return Math.max(0, Number(prev) - 1000);
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [hasActiveTimer, finalResult]);

  useEffect(() => {
    if (activeTimeRemainingMs !== 0 || !interviewId || finalResult) return;

    let cancelled = false;

    const finalizeByTimer = async () => {
      try {
        const res = await api.post(`/interview/${interviewId}/heartbeat`, {});
        const data = res.data || {};

        applyTiming(data);

        if (!cancelled && data.status === "completed") {
          setFinalResult({
            ...data,
            overallScore: data.overallScore ?? 0,
            finalCheatingRisk: data.finalCheatingRisk ?? 0,
            cameraRiskScore: data.cameraRiskScore ?? 0,
            completionReason: data.completionReason || "active_time_expired",
            message: "Interview time expired.",
          });

          stopCamera();
        }
      } catch (err) {
        console.error("timer finalization failed:", err);
      }
    };

    finalizeByTimer();

    return () => {
      cancelled = true;
    };
  }, [
    activeTimeRemainingMs,
    interviewId,
    finalResult,
    applyTiming,
    stopCamera,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  INTERVIEW POLLING
  // ═══════════════════════════════════════════════════════════════════════════

  const pollInterviewGeneration = (appId) => {
    if (generationPollRef.current) return;
    const maxAttempts = 60;
    let attempts = 0;

    generationPollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const res = await api.get(`/interview/${appId}/status?t=${Date.now()}`);
        const data = res.data || {};
        applyTiming(data);

        if (
          data.generationStatus === "completed" &&
          Array.isArray(data.questions) &&
          data.questions.length > 0
        ) {
          clearInterval(generationPollRef.current);
          generationPollRef.current = null;
          const doneIds = new Set(
            (data.answers || []).map((a) => Number(a.questionId)),
          );
          setInterviewId(data.interviewId);
          setAnsweredIds(doneIds);
          setQuestions(data.questions);
          const first = data.questions.findIndex(
            (q) => !doneIds.has(Number(q.questionId)),
          );
          setIdx(first === -1 ? 0 : first);
          setAnswerText("");
          setFeedback(null);
          setFinalResult(null);
          resetSignals();
          setLoading(false);
          return;
        }
        if (data.generationStatus === "failed") {
          clearInterval(generationPollRef.current);
          generationPollRef.current = null;
          setLoading(false);
          alert("Interview question generation failed.");
          return;
        }
        if (attempts >= maxAttempts) {
          clearInterval(generationPollRef.current);
          generationPollRef.current = null;
          setLoading(false);
          alert("Interview generation is taking too long. Please refresh.");
        }
      } catch (err) {
        console.error("generation poll failed:", err);
        clearInterval(generationPollRef.current);
        generationPollRef.current = null;
        setLoading(false);
        alert("Failed to check interview generation status.");
      }
    }, 3000);
  };

  const pollAnswerEvaluation = (interviewId, questionId) => {
    const maxAttempts = 60;
    let attempts = 0;
    if (answerPollRef.current) {
      clearInterval(answerPollRef.current);
      answerPollRef.current = null;
    }

    answerPollRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const res = await api.get(
          `/interview/${interviewId}/answer-status/${questionId}?t=${Date.now()}`,
        );
        const status = res.data?.status;

        if (status === "completed") {
          clearInterval(answerPollRef.current);
          answerPollRef.current = null;

          setFeedback({
            score: res.data.score,
          });

          setAnsweredIds((prev) => new Set([...prev, Number(questionId)]));
          setEvaluatingAnswer(false);
          setPendingQuestionId(null);

          return;
        }
        if (status === "failed") {
          clearInterval(answerPollRef.current);
          answerPollRef.current = null;

          setEvaluatingAnswer(false);
          setPendingQuestionId(null);

          alert(res.data?.error || "Answer evaluation failed.");
          return;
        }
        if (attempts >= maxAttempts) {
          clearInterval(answerPollRef.current);
          answerPollRef.current = null;

          setEvaluatingAnswer(false);
          setPendingQuestionId(null);

          alert("Answer evaluation is taking too long.");
        }
      } catch (err) {
        console.error("answer poll failed:", err);
        clearInterval(answerPollRef.current);
        answerPollRef.current = null;

        setEvaluatingAnswer(false);
        setPendingQuestionId(null);

        alert("Failed to check answer evaluation status.");
      }
    }, 2500);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  VOICE EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!voiceMode || !currentQuestion?.question || !hasSpeechSynthesis) return;
    const t = setTimeout(() => {
      setQuestionSpeaking(true);
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(currentQuestion.question);
      utt.rate = 0.95;
      utt.pitch = 1;
      utt.lang = "en-US";
      utt.onend = () => setQuestionSpeaking(false);
      utt.onerror = () => setQuestionSpeaking(false);
      window.speechSynthesis.speak(utt);
    }, 400);
    return () => {
      clearTimeout(t);
      stopSpeaking();
      setQuestionSpeaking(false);
    };
  }, [voiceMode, idx, currentQuestion]);

  useEffect(() => {
    if (!voiceMode) {
      stopSpeaking();
      setQuestionSpeaking(false);
    }
  }, [voiceMode]);

  // ═══════════════════════════════════════════════════════════════════════════
  //  PROCTORING EVENTS (fullscreen, tab switch, etc.)
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!shouldRunProctoring) return;
    const requestFs = async () => {
      try {
        if (!document.fullscreenElement)
          await document.documentElement.requestFullscreen();
      } catch (_) {
        setFsRefused(true);
      }
    };
    requestFs();
    const onFsChange = () => {
      if (!document.fullscreenElement) requestFs();
    };
    const noContext = (e) => e.preventDefault();
    const noKeys = (e) => {
      const k = e.key?.toLowerCase();
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "v", "x", "a", "u", "s", "p", "tab"].includes(k)
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.altKey && k === "tab") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (k === "f11" || k === "escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const noSelect = (e) => e.preventDefault();
    const onVis = () => {
      if (document.hidden) {
        tabSwitchRef.current += 1;
        hiddenAtRef.current = Date.now();
        setFocusLost(true);
      } else if (hiddenAtRef.current) {
        hiddenMsRef.current += Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
      }
    };
    const onBlur = () => {
      tabSwitchRef.current += 1;
      hiddenAtRef.current = Date.now();
      setFocusLost(true);
    };
    const onFocus = () => {
      if (hiddenAtRef.current) {
        hiddenMsRef.current += Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
      }
      setFocusLost(false);
    };
    const noResize = () => {
      if (
        window.outerWidth < window.screen.availWidth * 0.85 ||
        window.outerHeight < window.screen.availHeight * 0.85
      ) {
        try {
          window.resizeTo(window.screen.availWidth, window.screen.availHeight);
        } catch (_) {}
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("contextmenu", noContext);
    document.addEventListener("keydown", noKeys, true);
    document.addEventListener("selectstart", noSelect);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("resize", noResize);
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("contextmenu", noContext);
      document.removeEventListener("keydown", noKeys, true);
      document.removeEventListener("selectstart", noSelect);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("resize", noResize);
    };
  }, [shouldRunProctoring]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (generationPollRef.current) {
        clearInterval(generationPollRef.current);
        generationPollRef.current = null;
      }
      if (answerPollRef.current) {
        clearInterval(answerPollRef.current);
        answerPollRef.current = null;
      }
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  //  LOAD INTERVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    let cancelled = false;
    const loadInterview = async () => {
      try {
        setLoading(true);
        const res = await api.post(`/interview/${appId}/start`, {});
        if (cancelled) return;
        const data = res.data || {};
        setInterviewId(data.interviewId || null);
        applyTiming(data);

        if (data.status === "completed") {
          setFinalResult({
            ...data,
            alreadyCompleted: true,
            overallScore: data.overallScore ?? null,
            finalCheatingRisk: data.finalCheatingRisk ?? null,
            cameraRiskScore: data.cameraRiskScore ?? 0,
            completionReason: data.completionReason || null,
            message:
              data.completionReason === "active_time_expired"
                ? "Interview time expired."
                : data.completionReason === "continue_window_expired"
                  ? "Continue window expired."
                  : "This interview has already been completed.",
          });

          setQuestions([]);
          setLoading(false);
          stopCamera();
          return;
        }

        if (
          data.generationStatus === "pending" ||
          data.generationStatus === "not_started" ||
          (data.generationStatus === "completed" &&
            (!Array.isArray(data.questions) || data.questions.length === 0))
        ) {
          setQuestions([]);
          pollInterviewGeneration(appId);
          return;
        }

        const allQ = Array.isArray(data.questions) ? data.questions : [];
        const allA = Array.isArray(data.answers) ? data.answers : [];
        if (allQ.length === 0) {
          pollInterviewGeneration(appId);
          return;
        }

        const doneIds = new Set(allA.map((a) => Number(a.questionId)));
        setAnsweredIds(doneIds);
        setQuestions(allQ);
        const first = allQ.findIndex((q) => !doneIds.has(Number(q.questionId)));
        setIdx(first === -1 ? 0 : first);
        setAnswerText("");
        setFeedback(null);
        setFinalResult(null);
        resetSignals();
        setLoading(false);
      } catch (e) {
        console.error("start interview error:", e);
        if (!cancelled) {
          alert(e?.response?.data?.message || "Failed to start interview.");
          navigate("/candidate/interview-invitation");
          setLoading(false);
        }
      }
    };
    loadInterview();
    return () => {
      cancelled = true;
    };
  }, [appId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset per-question state on question change
  useEffect(() => {
    setAnswerText("");
    setFeedback(null);
    setVoiceError("");
    setLiveTranscript("");
    liveTranscriptRef.current = "";

    setCodeText(currentQuestion?.starterCode || "");
    setCodeLanguage(currentQuestion?.language || "javascript");

    stopRecordingCleanup();
    resetSignals();
  }, [idx, currentQuestion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      stopRecordingCleanup();
      stopCamera();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════════
  //  VOICE RECORDING
  // ═══════════════════════════════════════════════════════════════════════════

  const stopRecordingCleanup = () => {
    if (speechRecogRef.current) {
      try {
        speechRecogRef.current.stop();
      } catch (_) {}
      speechRecogRef.current = null;
    }
    liveTranscriptRef.current = "";
    setLiveTranscript("");
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    if (mediaRecorderRef.current) {
      try {
        const s = mediaRecorderRef.current.stream;
        if (s) s.getTracks().forEach((t) => t.stop());
      } catch (_) {}
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setRecording(false);
    setTranscribing(false);
  };

  const startLiveTranscript = () => {
    if (!hasSpeechRecognition) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";
    recog.onresult = (e) => {
      let interim = "",
        finalPart = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalPart += t + " ";
        else interim += t;
      }
      if (finalPart) liveTranscriptRef.current += finalPart;
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
    setVoiceError("");
    setLiveTranscript("");
    liveTranscriptRef.current = "";
    audioChunksRef.current = [];
    stopSpeaking();
    setQuestionSpeaking(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : "";
      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      recordingStartRef.current = Date.now();
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        audioDurationRef.current =
          (Date.now() - recordingStartRef.current) / 1000;
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
    )
      mediaRecorderRef.current.stop();
    setRecording(false);
  };

  const handleTranscribe = async () => {
    if (!audioChunksRef.current || audioChunksRef.current.length === 0) {
      setVoiceError("No audio was captured. Please try recording again.");
      return;
    }
    setTranscribing(true);
    setVoiceError("");
    try {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      audioChunksRef.current = [];
      const formData = new FormData();
      formData.append("audio", blob, "answer.webm");
      const res = await api.post("/transcribe", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
      });
      const transcript = res.data.transcript || "";
      const wordCount = res.data.word_count || 0;
      const serverDur = res.data.duration_sec;
      transcriptWordCountRef.current = wordCount;
      if (serverDur) audioDurationRef.current = serverDur;
      setLiveTranscript("");
      setAnswerText(transcript);
      if (!transcript.trim())
        setVoiceError(
          "No speech detected. Please speak clearly and try again.",
        );
    } catch (err) {
      console.error("Transcription failed:", err?.response?.data || err);
      setVoiceError(
        err?.response?.data?.message ||
          "Transcription failed. Please try again.",
      );
    } finally {
      setTranscribing(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  ANSWER SUBMIT / FINISH
  // ═══════════════════════════════════════════════════════════════════════════

  const isAnswered = currentQuestion
    ? answeredIds.has(Number(currentQuestion.questionId))
    : false;

  const submit = async () => {
    if (!interviewId || !currentQuestion) return;

    if (activeTimeRemainingMs === 0) {
      return alert("Interview time has expired.");
    }

    if (submitting || evaluatingAnswer) return;

    if (recording) {
      return alert("Please stop recording before submitting your answer.");
    }

    if (transcribing) {
      return alert("Please wait while your voice answer is being transcribed.");
    }

    const selectedAnswerMode = isCodingQuestion
      ? "code"
      : voiceMode
        ? "voice"
        : "text";
    const finalAnswerText = isCodingQuestion ? codeText : answerText.trim();

    if (!finalAnswerText.trim()) {
      return alert(
        isCodingQuestion
          ? "Please write your code."
          : "Please write an answer.",
      );
    }

    if (isAnswered) return;

    setSubmitting(true);

    setEvaluatingAnswer(true);
    setPendingQuestionId(currentQuestion.questionId);
    setFeedback(null);

    const timeTakenSec = Math.max(
      0,
      Math.round((Date.now() - startAtRef.current) / 1000),
    );
    const finalWordCount = finalAnswerText
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    const editRatio =
      transcriptWordCountRef.current > 0
        ? Math.round((finalWordCount / transcriptWordCountRef.current) * 100) /
          100
        : null;

    const wordsPerSec =
      audioDurationRef.current > 0
        ? Math.round(
            (transcriptWordCountRef.current / audioDurationRef.current) * 100,
          ) / 100
        : null;

    const payload = {
      questionId: currentQuestion.questionId,

      // For code, preserve exactly as written.
      // For text/voice, trimmed answer is okay.
      answerText: selectedAnswerMode === "code" ? codeText : finalAnswerText,

      timeTakenSec,
      tabSwitchCount: tabSwitchRef.current,
      pasteCount: pasteRef.current,
      hiddenTimeMs: hiddenMsRef.current,

      answerMode: selectedAnswerMode,

      voiceEditRatio: selectedAnswerMode === "voice" ? editRatio : null,
      voiceWordsPerSec: selectedAnswerMode === "voice" ? wordsPerSec : null,

      codeLanguage: selectedAnswerMode === "code" ? codeLanguage : null,
    };

    try {
      const res = await api.post(`/interview/${interviewId}/answer`, payload);

      if (res.data?.evaluationStatus === "pending") {
        pollAnswerEvaluation(interviewId, currentQuestion.questionId);
      }
    } catch (e) {
      setEvaluatingAnswer(false);
      setPendingQuestionId(null);
      alert(e?.response?.data?.message || "Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (idx < questions.length - 1) setIdx((v) => v + 1);
  };

  const finish = async () => {
    // Take a final snapshot before finishing
    await sendSnapshot(false, "interview_end");
    try {
      const res = await api.post(`/interview/${interviewId}/complete`, {});
      setFinalResult(res.data);
      stopCamera();
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to complete interview.");
    }
  };

  const allAnswered =
    questions.length > 0 && answeredIds.size >= questions.length;

  const submitDisabled =
    submitting ||
    evaluatingAnswer ||
    recording ||
    transcribing ||
    isAnswered ||
    activeTimeRemainingMs === 0 ||
    (isCodingQuestion ? !codeText.trim() : !answerText.trim());

  const progress =
    questions.length > 0 ? (answeredIds.size / questions.length) * 100 : 0;

  const diffColor = { easy: "#16a34a", medium: "#d97706", hard: "#dc2626" };
  const typeColor = {
    technical: "#2563eb",
    behavioral: "#7c3aed",
    situational: "#0891b2",
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER — LOADING
  // ═══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div style={s.loadingWrap}>
        <div style={s.spinner} />
        <p style={s.loadingText}>Preparing your interview…</p>
      </div>
    );
  }

  // ── Camera permission gate ────────────────────────────────────────────────
  // Candidate must allow camera before starting
  if (cameraPermission === "denied" && !cameraReady && questions.length > 0) {
    return (
      <div style={s.page}>
        <div style={s.cameraGateCard}>
          <div style={s.cameraGateIcon}>📷</div>
          <h2 style={s.cameraGateTitle}>Camera Required</h2>
          <p style={s.cameraGateSub}>
            This interview requires your camera to be active throughout the
            session for integrity monitoring. Snapshots are periodically
            captured and shared with the recruiter.
          </p>
          {cameraError && <p style={s.cameraErrorText}>{cameraError}</p>}
          <button style={s.cameraGateBtn} onClick={startCamera}>
            Allow Camera & Continue
          </button>
          <p style={s.cameraGateNote}>
            Note: We do not record video. Only periodic snapshots are taken.
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER — COMPLETED
  // ═══════════════════════════════════════════════════════════════════════════

  if (finalResult) {
    const score = finalResult.overallScore ?? 0;
    const scoreColor =
      score >= 7 ? "#16a34a" : score >= 4 ? "#d97706" : "#dc2626";

    return (
      <div style={s.page}>
        <div style={s.completedCard}>
          <div
            style={{
              ...s.completedIcon,
              background: scoreColor + "18",
              color: scoreColor,
            }}
          >
            ✓
          </div>
          <h2 style={s.completedTitle}>Interview Completed</h2>
          <p style={s.completedSub}>
            {finalResult.completionReason === "active_time_expired"
              ? "Interview time expired. Your saved answers have been submitted. Awaiting recruiter decision."
              : finalResult.completionReason === "continue_window_expired"
                ? "The continue window expired. Your saved answers have been submitted. Awaiting recruiter decision."
                : "Your responses have been recorded and sent for review. Awaiting recruiter decision."}
          </p>
          <div style={s.scoreRow}>
            <div style={s.scoreBox}>
              <span style={{ ...s.scoreBig, color: scoreColor }}>
                {score.toFixed(1)}
              </span>
              <span style={s.scoreLabel}>Overall Score</span>
            </div>
          </div>
          <div style={s.waitingNote}>
            <span style={s.waitingIcon}>⏳</span>
            <div>
              <p style={s.waitingTitle}>Awaiting recruiter review</p>
              <p style={s.waitingSub}>
                You'll be contacted if selected for the next stage.
              </p>
            </div>
          </div>
          <button
            style={s.dashBtn}
            onClick={() => navigate("/candidate/dashboard")}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div style={s.loadingWrap}>
        <div style={s.spinner} />
        <p style={s.loadingText}>Still preparing questions…</p>
      </div>
    );
  }

  const diff = (currentQuestion.difficulty || "").toLowerCase();
  const type = (currentQuestion.type || "").toLowerCase();

  // Violation banner text
  const violationText = cameraViolation
    ? {
        no_face: "⚠ Face not visible — please stay in front of camera",
        multiple_faces:
          "🚨 Multiple people detected — only you should be visible",
        camera_off: "🚫 Camera is off — please re-enable camera",
        looking_away_head_and_eye: "👁 Please look at the screen",
        head_turned: "👁 Please face the camera",
        eyes_looking_away: "👁 Please keep eyes on screen",
      }[cameraViolation.reason] || "⚠ Camera violation detected"
    : null;

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER — MAIN INTERVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={s.page}>
      {/* ── WEBCAM PREVIEW BOX (always visible, top-right) ──────────────────── */}
      <div
        style={{
          ...s.camBox,
          ...(cameraMinimized ? s.camBoxMinimized : {}),
          borderColor: cameraViolation
            ? cameraViolation.level === "high"
              ? "#dc2626"
              : "#f59e0b"
            : cameraReady
              ? "#22c55e"
              : "#e2e8f0",
          boxShadow: cameraViolation
            ? `0 0 0 2px ${cameraViolation.level === "high" ? "#dc2626" : "#f59e0b"}40`
            : "0 4px 16px rgba(0,0,0,0.15)",
        }}
      >
        {/* Video element */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            ...s.camVideo,
            display: cameraMinimized ? "none" : "block",
          }}
        />

        {/* Camera off / pending overlay */}
        {!cameraReady && !cameraMinimized && (
          <div style={s.camOffOverlay}>
            {cameraPermission === "pending" ? (
              <>
                <div style={s.spinnerSmall} />
                <span style={s.camOffText}>Starting camera…</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 22 }}>📷</span>
                <span style={s.camOffText}>Camera off</span>
              </>
            )}
          </div>
        )}

        {/* Status bar */}
        {!cameraMinimized && (
          <div
            style={{
              ...s.camStatus,
              background: cameraViolation
                ? cameraViolation.level === "high"
                  ? "#dc2626"
                  : "#f59e0b"
                : cameraReady
                  ? "#22c55e"
                  : "#94a3b8",
            }}
          >
            <span style={s.camStatusDot} />
            <span style={s.camStatusText}>
              {cameraReady ? "Camera Active" : "Camera Off"}
              {warningCount > 0 &&
                ` · ${warningCount} warning${warningCount > 1 ? "s" : ""}`}
            </span>
          </div>
        )}

        {/* Minimize/restore button */}
        <button
          style={s.camMinBtn}
          title={cameraMinimized ? "Show camera" : "Minimize camera"}
          onClick={() => setCameraMinimized((v) => !v)}
        >
          {cameraMinimized ? "📷" : "—"}
        </button>
      </div>

      {/* ── VIOLATION BANNER ──────────────────────────────────────────────── */}
      {cameraViolation && violationText && (
        <div
          style={{
            ...s.violationBanner,
            background:
              cameraViolation.level === "high" ? "#fef2f2" : "#fffbeb",
            borderColor:
              cameraViolation.level === "high" ? "#fca5a5" : "#fcd34d",
            color: cameraViolation.level === "high" ? "#991b1b" : "#92400e",
            animation:
              cameraViolation.level === "high"
                ? "violation-flash 1.5s ease infinite"
                : "none",
          }}
        >
          {violationText}
          {cameraViolation.level === "high" && (
            <span style={s.violationRisk}> — High integrity risk recorded</span>
          )}
        </div>
      )}

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}
      {fsRefused && (
        <div style={s.modalBackdrop}>
          <div style={s.modal}>
            <p style={s.modalTitle}>Fullscreen Required</p>
            <p style={s.modalSub}>
              This interview must run in fullscreen mode.
            </p>
            <div style={s.modalBtns}>
              <button
                style={{ ...s.modalExit, background: "#2563eb" }}
                onClick={async () => {
                  try {
                    await document.documentElement.requestFullscreen();
                    setFsRefused(false);
                  } catch (_) {}
                }}
              >
                Enter Fullscreen
              </button>
            </div>
          </div>
        </div>
      )}

      {focusLost && (
        <div style={s.focusLostOverlay}>
          <div style={s.focusLostBox}>
            <div style={s.focusLostIcon}>⚠</div>
            <p style={s.focusLostTitle}>Interview Paused</p>
            <p style={s.focusLostSub}>
              You left the interview window. This has been recorded.
              <br />
              Click below to return.
            </p>
            <button
              style={s.focusReturnBtn}
              onClick={() => {
                setFocusLost(false);
                if (!document.fullscreenElement)
                  document.documentElement.requestFullscreen().catch(() => {});
              }}
            >
              Return to Interview
            </button>
          </div>
        </div>
      )}

      {exitConfirm && (
        <div style={s.modalBackdrop}>
          <div style={s.modal}>
            <p style={s.modalTitle}>Exit interview?</p>
            <p style={s.modalSub}>
              Your progress is saved. You can resume later if the time window is
              still open.
            </p>
            <div style={s.modalBtns}>
              <button
                style={s.modalCancel}
                onClick={() => setExitConfirm(false)}
              >
                Stay
              </button>
              <button
                style={s.modalExit}
                onClick={() => {
                  stopCamera();
                  navigate("/candidate/interview-invitation");
                }}
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerTitle}>Interview</span>
          <span style={s.headerSep}>·</span>
          <span style={s.headerSub}>
            Question {idx + 1} of {questions.length}
          </span>

          {hasActiveTimer && (
            <div style={s.timerBadge}>
              <i className="fas fa-clock" style={{ marginRight: 6 }} />
              Time Left: {formatTime(activeTimeRemainingMs)}
            </div>
          )}
        </div>
        <div style={s.headerRight}>
          {!isCodingQuestion && (
            <div style={s.modeToggle}>
              <button
                style={{
                  ...s.modeBtn,
                  background: !voiceMode ? "#2563eb" : "#f1f5f9",
                  color: !voiceMode ? "#fff" : "#64748b",
                }}
                onClick={() => {
                  setVoiceMode(false);
                  stopRecordingCleanup();
                  setVoiceError("");
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: 5, verticalAlign: "middle" }}
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Text
              </button>

              <button
                style={{
                  ...s.modeBtn,
                  background: voiceMode ? "#2563eb" : "#f1f5f9",
                  color: voiceMode ? "#fff" : "#64748b",
                }}
                onClick={() => {
                  setVoiceMode(true);
                  setVoiceError("");
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: 5, verticalAlign: "middle" }}
                >
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
                Voice
              </button>
            </div>
          )}
          <button style={s.exitBtn} onClick={() => setExitConfirm(true)}>
            Exit
          </button>
        </div>
      </div>

      {/* ── PROGRESS ────────────────────────────────────────────────────────── */}
      <div style={s.progressTrack}>
        <div style={{ ...s.progressFill, width: `${progress}%` }} />
      </div>
      <div style={s.progressDots}>
        {questions.map((q, i) => {
          const done = answeredIds.has(Number(q.questionId));
          const active = i === idx;
          return (
            <div
              key={i}
              title={`Q${i + 1}`}
              style={{
                ...s.dot,
                background: done ? "#2563eb" : active ? "#93c5fd" : "#e2e8f0",
                transform: active ? "scale(1.3)" : "scale(1)",
              }}
            />
          );
        })}
      </div>

      {/* ── QUESTION CARD ───────────────────────────────────────────────────── */}
      <div style={s.questionCard}>
        <div style={s.questionMeta}>
          <span
            style={{
              ...s.metaPill,
              background: (typeColor[type] || "#64748b") + "18",
              color: typeColor[type] || "#64748b",
            }}
          >
            {currentQuestion.type || "General"}
          </span>
          <span
            style={{
              ...s.metaPill,
              background: (diffColor[diff] || "#64748b") + "18",
              color: diffColor[diff] || "#64748b",
            }}
          >
            {currentQuestion.difficulty || "—"}
          </span>
          {currentQuestion.skill && (
            <span style={s.skillPill}>{currentQuestion.skill}</span>
          )}
        </div>
        <div style={s.questionTopRow}>
          <p style={s.questionText}>{currentQuestion.question}</p>
          {voiceMode && hasSpeechSynthesis && !isAnswered && (
            <button
              style={s.speakBtn}
              title={questionSpeaking ? "Stop reading" : "Read question aloud"}
              onClick={() => {
                if (questionSpeaking) {
                  stopSpeaking();
                  setQuestionSpeaking(false);
                } else {
                  setQuestionSpeaking(true);
                  const utt = new SpeechSynthesisUtterance(
                    currentQuestion.question,
                  );
                  utt.rate = 0.95;
                  utt.lang = "en-US";
                  utt.onend = () => setQuestionSpeaking(false);
                  utt.onerror = () => setQuestionSpeaking(false);
                  window.speechSynthesis.speak(utt);
                }
              }}
            >
              {questionSpeaking ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>
          )}
        </div>
        {voiceMode && questionSpeaking && (
          <div style={s.speakingBar}>
            <div style={s.speakingDot} />
            <span style={s.speakingText}>Reading question aloud…</span>
          </div>
        )}
      </div>

      {/* ── ANSWER / CODE EDITOR ─────────────────────────────────────────────── */}
      <div style={s.answerWrap}>
        {isCodingQuestion ? (
          <>
            <div style={s.codeHeader}>
              <span style={s.codeTitle}>Code Answer</span>

              <select
                value={codeLanguage}
                onChange={(e) => setCodeLanguage(e.target.value)}
                disabled={isAnswered}
                style={s.codeSelect}
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>

            <div style={s.codeEditorWrap}>
              <CodeEditor
                value={codeText}
                language={codeLanguage === "cpp" ? "cpp" : codeLanguage}
                onChange={setCodeText}
                readOnly={isAnswered || transcribing}
              />
            </div>

            <div style={s.charCount}>
              {codeText.length} characters · No code execution · Evaluated after
              submit
            </div>
          </>
        ) : (
          <>
            <textarea
              rows={7}
              value={recording ? liveTranscript : answerText}
              onPaste={(e) => {
                pasteRef.current += 1;
                e.preventDefault();
              }}
              onChange={(e) => {
                if (!recording) setAnswerText(e.target.value);
              }}
              disabled={isAnswered || transcribing}
              style={{
                ...s.textarea,
                opacity: isAnswered || transcribing ? 0.6 : 1,
                borderColor: recording ? "#93c5fd" : "#e2e8f0",
              }}
              placeholder={
                isAnswered
                  ? "Answer already submitted."
                  : transcribing
                    ? "Transcribing your voice answer…"
                    : recording
                      ? "Listening… your words will appear here."
                      : voiceMode
                        ? "Your transcribed answer will appear here. You can edit before submitting."
                        : "Write your answer here…"
              }
            />

            <div style={s.charCount}>
              {recording
                ? `${liveTranscript.length} characters (live)`
                : `${answerText.length} characters`}
            </div>
          </>
        )}
      </div>
      {/* ── VOICE BAR ───────────────────────────────────────────────────────── */}
      {voiceMode && !isCodingQuestion && !isAnswered && (
        <div style={s.voiceBar}>
          <div style={s.voiceControls}>
            {!recording && !transcribing && (
              <button style={s.micStartBtn} onClick={startRecording}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
                Start Recording
              </button>
            )}
            {recording && (
              <button style={s.micStopBtn} onClick={stopRecording}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                <span style={s.micRecordingDot} />
                Stop Recording
              </button>
            )}
            {transcribing && (
              <div style={s.transcribingRow}>
                <div style={s.spinnerSmall} />
                <span style={s.transcribingText}>
                  Transcribing your answer…
                </span>
              </div>
            )}
          </div>
          {voiceError && <p style={s.voiceError}>{voiceError}</p>}
          <p style={s.voiceHint}>
            {recording
              ? "Speak clearly — your words appear above in real time."
              : transcribing
                ? "Please wait while we finalize your transcript."
                : "Record your answer, review the transcript, edit if needed, then submit."}
          </p>
        </div>
      )}

      {/* ── ACTIONS ─────────────────────────────────────────────────────────── */}
      <div style={s.actions}>
        <div style={s.actionsLeft}>
          {!isAnswered && (
            <button
              style={{
                ...s.submitBtn,
                opacity: submitDisabled ? 0.7 : 1,
                cursor: submitDisabled ? "not-allowed" : "pointer",
              }}
              onClick={submit}
              disabled={submitDisabled}
            >
              {evaluatingAnswer
                ? "Evaluating answer..."
                : submitting
                  ? "Submitting..."
                  : "Submit Answer"}
            </button>
          )}

          {(feedback || isAnswered) && idx < questions.length - 1 && (
            <button
              style={{
                ...s.nextBtn,
                opacity: evaluatingAnswer ? 0.7 : 1,
                cursor: evaluatingAnswer ? "not-allowed" : "pointer",
              }}
              onClick={next}
              disabled={evaluatingAnswer}
            >
              {evaluatingAnswer ? "Please wait..." : "Next Question →"}
            </button>
          )}

          {(feedback || isAnswered || allAnswered) &&
            idx === questions.length - 1 && (
              <button
                style={{
                  ...s.finishBtn,
                  opacity: evaluatingAnswer ? 0.7 : 1,
                  cursor: evaluatingAnswer ? "not-allowed" : "pointer",
                }}
                onClick={finish}
                disabled={evaluatingAnswer}
              >
                {evaluatingAnswer ? "Please wait..." : "Finish Interview ✓"}
              </button>
            )}
        </div>
      </div>

      {/* ── FEEDBACK CARD: candidate sees score only ───────────────────────── */}
      {feedback && (
        <div style={s.feedbackCard}>
          <div style={s.feedbackRow}>
            <div style={s.feedbackItem}>
              <span style={s.feedbackLabel}>Score</span>
              <span
                style={{
                  ...s.feedbackVal,
                  color:
                    feedback.score >= 7
                      ? "#16a34a"
                      : feedback.score >= 4
                        ? "#d97706"
                        : "#dc2626",
                }}
              >
                {feedback.score} / 10
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════
// ── Responsive inline styles ────────────────────────────────────────────────
// These styles use flexible widths, wrapping, clamp(), and CSS functions so the
// interview screen fits mobile without changing interview logic.
const s = {
  page: {
    width: "100%",
    maxWidth: 780,
    margin: "0 auto",
    padding: "clamp(12px, 4vw, 28px) clamp(10px, 4vw, 20px) 96px",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    userSelect: "none",
    WebkitUserSelect: "none",
    position: "relative",
    boxSizing: "border-box",
    overflowX: "hidden",
  },
  loadingWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
    gap: 16,
    padding: "0 16px",
    textAlign: "center",
    boxSizing: "border-box",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #2563eb",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  spinnerSmall: {
    width: 18,
    height: 18,
    border: "2px solid #e2e8f0",
    borderTop: "2px solid #2563eb",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    flexShrink: 0,
  },
  loadingText: { color: "#64748b", fontWeight: 600, margin: 0 },

  // ── Camera box ────────────────────────────────────────────────────────────
  camBox: {
    position: "fixed",
    bottom: "clamp(10px, 3vw, 24px)",
    right: "clamp(10px, 3vw, 24px)",
    width: "clamp(96px, 28vw, 200px)",
    borderRadius: 12,
    border: "2px solid #22c55e",
    overflow: "hidden",
    background: "#0f172a",
    zIndex: 9000,
    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
    transition: "border-color 0.3s, box-shadow 0.3s",
  },
  camBoxMinimized: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    overflow: "hidden",
  },
  camVideo: {
    width: "100%",
    display: "block",
    minHeight: "clamp(70px, 18vw, 120px)",
    objectFit: "cover",
    transform: "scaleX(-1)" /* mirror */,
  },
  camOffOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(15,23,42,0.85)",
    gap: 8,
  },
  camOffText: { fontSize: 11, color: "#94a3b8", fontWeight: 600 },
  camStatus: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 8px",
    background: "#22c55e",
  },
  camStatusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#fff",
    animation: "cam-blink 2s ease infinite",
  },
  camStatusText: {
    fontSize: "clamp(8px, 2.2vw, 10px)",
    color: "#fff",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  camMinBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "none",
    background: "rgba(15,23,42,0.7)",
    color: "#fff",
    fontSize: 11,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },

  // ── Camera gate (permission required) ────────────────────────────────────
  cameraGateCard: {
    width: "100%",
    maxWidth: 460,
    margin: "clamp(28px, 12vw, 80px) auto",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: "clamp(22px, 6vw, 40px) clamp(16px, 5vw, 32px)",
    textAlign: "center",
    boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
    boxSizing: "border-box",
  },
  cameraGateIcon: { fontSize: 48, marginBottom: 16 },
  cameraGateTitle: {
    fontSize: "clamp(18px, 5vw, 22px)",
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 12px",
  },
  cameraGateSub: {
    fontSize: "clamp(12px, 3.4vw, 14px)",
    color: "#475569",
    lineHeight: 1.6,
    margin: "0 0 20px",
  },
  cameraErrorText: {
    fontSize: 13,
    color: "#dc2626",
    fontWeight: 600,
    margin: "0 0 16px",
  },
  cameraGateBtn: {
    width: "100%",
    maxWidth: 320,
    padding: "12px 18px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 800,
    fontSize: "clamp(12px, 3.5vw, 14px)",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
    marginBottom: 12,
  },
  cameraGateNote: { fontSize: 11, color: "#94a3b8", margin: 0 },

  // ── Violation banner ──────────────────────────────────────────────────────
  violationBanner: {
    marginBottom: 12,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid",
    fontSize: "clamp(11px, 3vw, 13px)",
    fontWeight: 700,
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    flexWrap: "wrap",
    lineHeight: 1.4,
  },
  violationRisk: { fontWeight: 600, opacity: 0.8 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
    flexWrap: "wrap",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    minWidth: 0,
    flex: "1 1 260px",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    flex: "1 1 220px",
  },

  timerBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#fff7ed",
    color: "#c2410c",
    fontWeight: 800,
    fontSize: "clamp(11px, 3vw, 13px)",
    border: "1px solid #fed7aa",
    whiteSpace: "nowrap",
  },

  headerTitle: {
    fontSize: "clamp(18px, 5vw, 22px)",
    fontWeight: 800,
    color: "#0f172a",
  },
  headerSep: { color: "#cbd5e1", fontSize: 18 },
  headerSub: {
    color: "#64748b",
    fontSize: "clamp(12px, 3.4vw, 14px)",
    fontWeight: 600,
  },
  exitBtn: {
    padding: "7px 14px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#64748b",
    fontWeight: 700,
    fontSize: "clamp(12px, 3.2vw, 13px)",
    cursor: "pointer",
    flex: "0 0 auto",
  },

  // ── Progress ──────────────────────────────────────────────────────────────
  progressTrack: {
    height: 4,
    background: "#e2e8f0",
    borderRadius: 4,
    marginBottom: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #2563eb, #3b82f6)",
    borderRadius: 4,
    transition: "width 0.4s ease",
  },
  progressDots: {
    display: "flex",
    gap: 6,
    marginBottom: 22,
    flexWrap: "wrap",
    overflowX: "auto",
    paddingBottom: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    transition: "all 0.2s ease",
  },

  // ── Question card ─────────────────────────────────────────────────────────
  questionCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderLeft: "4px solid #2563eb",
    borderRadius: 12,
    padding: "clamp(13px, 4vw, 20px) clamp(12px, 4vw, 22px)",
    marginBottom: 16,
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    boxSizing: "border-box",
  },
  questionMeta: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  questionTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  metaPill: {
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "capitalize",
    letterSpacing: "0.3px",
  },
  skillPill: {
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    background: "#f1f5f9",
    color: "#475569",
  },
  questionText: {
    fontSize: "clamp(14px, 4vw, 16px)",
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
    lineHeight: 1.55,
    flex: "1 1 240px",
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  speakBtn: {
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#f1f5f9",
    color: "#2563eb",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  speakingBar: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    background: "#eff6ff",
    borderRadius: 6,
  },
  speakingDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#2563eb",
    animation: "pulse-dot 1s ease-in-out infinite",
    flexShrink: 0,
  },
  speakingText: { fontSize: 11, color: "#2563eb", fontWeight: 600 },

  // ── Answer ────────────────────────────────────────────────────────────────
  answerWrap: { position: "relative", marginBottom: 4 },
  textarea: {
    width: "100%",
    minHeight: 150,
    padding: "12px 13px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    fontSize: "clamp(13px, 3.5vw, 14px)",
    lineHeight: 1.6,
    color: "#1e293b",
    background: "#fafafa",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    userSelect: "text",
    WebkitUserSelect: "text",
  },
  charCount: {
    textAlign: "right",
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
  },

  codeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
    flexWrap: "wrap",
  },

  codeTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
  },

  codeSelect: {
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#334155",
    fontWeight: 700,
    fontSize: "clamp(11px, 3vw, 12px)",
    outline: "none",
    maxWidth: "100%",
  },
  codeEditorWrap: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    borderRadius: 10,
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  actions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    gap: 10,
    flexWrap: "wrap",
  },
  actionsLeft: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    flex: "1 1 260px",
  },
  submitBtn: {
    flex: "1 1 150px",
    padding: "10px 16px",
    borderRadius: 9,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 800,
    fontSize: "clamp(12px, 3.4vw, 14px)",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
    transition: "opacity 0.2s",
  },
  nextBtn: {
    flex: "1 1 120px",
    padding: "10px 16px",
    borderRadius: 9,
    border: "1.5px solid #2563eb",
    background: "#eff6ff",
    color: "#2563eb",
    fontWeight: 800,
    fontSize: "clamp(12px, 3.4vw, 14px)",
    cursor: "pointer",
  },
  finishBtn: {
    flex: "1 1 150px",
    padding: "10px 16px",
    borderRadius: 9,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontWeight: 800,
    fontSize: "clamp(12px, 3.4vw, 14px)",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(22,163,74,0.2)",
  },

  // ── Feedback ──────────────────────────────────────────────────────────────
  feedbackCard: {
    marginTop: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "clamp(12px, 4vw, 16px) clamp(12px, 4vw, 20px)",
    boxSizing: "border-box",
  },
  feedbackRow: {
    display: "flex",
    gap: 18,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  feedbackItem: { display: "flex", flexDirection: "column", gap: 2 },
  feedbackLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  feedbackVal: { fontSize: 18, fontWeight: 800, color: "#0f172a" },
  feedbackText: {
    margin: 0,
    fontSize: "clamp(12px, 3.3vw, 13px)",
    color: "#475569",
    lineHeight: 1.6,
    borderTop: "1px solid #e2e8f0",
    paddingTop: 10,
  },
  gradingBox: {
    marginTop: 14,
    borderTop: "1px solid #e2e8f0",
    paddingTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  gradingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  gradingSection: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "10px 12px",
  },
  gradingTitle: {
    margin: "0 0 6px",
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  gradingValue: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    textTransform: "capitalize",
  },
  gradingList: {
    margin: 0,
    paddingLeft: 18,
    color: "#475569",
    fontSize: "clamp(12px, 3.3vw, 13px)",
    lineHeight: 1.6,
  },

  // ── Completed ─────────────────────────────────────────────────────────────
  completedCard: {
    width: "100%",
    maxWidth: 500,
    margin: "clamp(24px, 10vw, 60px) auto",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: "clamp(22px, 6vw, 40px) clamp(16px, 5vw, 32px)",
    textAlign: "center",
    boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
    boxSizing: "border-box",
  },
  completedIcon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    fontWeight: 800,
    margin: "0 auto 20px",
  },
  completedTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 8px",
  },
  completedSub: { color: "#64748b", fontSize: 14, margin: "0 0 24px" },
  scoreRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "stretch",
    background: "#f8fafc",
    borderRadius: 12,
    padding: "14px 12px",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 10,
  },
  scoreBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
  },
  scoreBig: { fontSize: "clamp(24px, 8vw, 32px)", fontWeight: 900 },
  scoreLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginTop: 4,
  },
  scoreDivider: {
    width: 1,
    height: 48,
    background: "#e2e8f0",
    margin: "0 16px",
  },
  waitingNote: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "14px 16px",
    textAlign: "left",
    marginBottom: 24,
  },
  waitingIcon: { fontSize: 20, flexShrink: 0 },
  waitingTitle: { margin: 0, fontWeight: 700, fontSize: 14, color: "#1e40af" },
  waitingSub: { margin: "4px 0 0", fontSize: 12, color: "#3b82f6" },
  dashBtn: {
    width: "100%",
    maxWidth: 260,
    padding: "12px 22px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },

  // ── Focus lost overlay ────────────────────────────────────────────────────
  focusLostOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.97)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    padding: 14,
    boxSizing: "border-box",
  },
  focusLostBox: {
    width: "100%",
    background: "#1e293b",
    border: "2px solid #ef4444",
    borderRadius: 16,
    padding: "clamp(24px, 7vw, 40px) clamp(18px, 6vw, 36px)",
    textAlign: "center",
    maxWidth: 400,
    boxShadow: "0 0 60px rgba(239,68,68,0.3)",
    boxSizing: "border-box",
  },
  focusLostIcon: { fontSize: 48, marginBottom: 16, color: "#ef4444" },
  focusLostTitle: {
    margin: "0 0 10px",
    fontWeight: 800,
    fontSize: 22,
    color: "#f8fafc",
  },
  focusLostSub: {
    margin: "0 0 24px",
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 1.6,
  },
  focusReturnBtn: {
    padding: "12px 28px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  },

  // ── Modals ────────────────────────────────────────────────────────────────
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 14,
    boxSizing: "border-box",
  },
  modal: {
    width: "100%",
    maxWidth: 340,
    background: "#fff",
    borderRadius: 14,
    padding: "clamp(18px, 5vw, 28px) clamp(16px, 5vw, 28px) 22px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
    boxSizing: "border-box",
  },
  modalTitle: {
    margin: "0 0 8px",
    fontWeight: 800,
    fontSize: 18,
    color: "#0f172a",
  },
  modalSub: {
    margin: "0 0 22px",
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.5,
  },
  modalBtns: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  modalCancel: {
    padding: "9px 20px",
    borderRadius: 8,
    border: "1.5px solid #e2e8f0",
    background: "#f8fafc",
    color: "#374151",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  modalExit: {
    padding: "9px 20px",
    borderRadius: 8,
    border: "none",
    background: "#dc2626",
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },

  // ── Mode toggle ───────────────────────────────────────────────────────────
  modeToggle: {
    display: "flex",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    flex: "1 1 auto",
  },
  modeBtn: {
    padding: "7px 12px",
    border: "none",
    fontWeight: 700,
    fontSize: "clamp(11px, 3vw, 12px)",
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },

  // ── Voice bar ─────────────────────────────────────────────────────────────
  voiceBar: {
    marginBottom: 12,
    padding: "14px 16px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  voiceControls: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  micStartBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "9px 16px",
    borderRadius: 9,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 800,
    fontSize: "clamp(12px, 3.4vw, 13px)",
    cursor: "pointer",
    flex: "1 1 180px",
  },
  micStopBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "9px 16px",
    borderRadius: 9,
    border: "none",
    background: "#dc2626",
    color: "#fff",
    fontWeight: 800,
    fontSize: "clamp(12px, 3.4vw, 13px)",
    cursor: "pointer",
    flex: "1 1 180px",
  },
  micRecordingDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#fff",
    display: "inline-block",
    animation: "pulse-dot 1s ease-in-out infinite",
  },
  transcribingRow: { display: "flex", alignItems: "center", gap: 10 },
  transcribingText: { fontSize: 13, color: "#64748b", fontWeight: 600 },
  voiceError: { margin: 0, fontSize: 12, color: "#dc2626", fontWeight: 600 },
  voiceHint: {
    margin: 0,
    fontSize: 11,
    color: "#94a3b8",
    fontStyle: "italic",
    lineHeight: 1.5,
  },
};