# nlp-service/services/camera_detection.py
"""
Lightweight camera proctoring using MediaPipe FaceMesh.
Detects: face presence, face count, head direction, eye direction.
No heavy AI model — pure landmark geometry.

Install: pip install mediapipe opencv-python-headless --break-system-packages
"""

import base64
import traceback
from typing import Any, Dict

import numpy as np

MEDIAPIPE_AVAILABLE = False
MEDIAPIPE_ERROR = None

try:
    import cv2
    import mediapipe as mp

    _mp_face_detection = mp.solutions.face_detection
    _mp_face_mesh = mp.solutions.face_mesh

    _face_detector = _mp_face_detection.FaceDetection(
        model_selection=0, min_detection_confidence=0.5
    )
    _face_mesh = _mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=3,
        refine_landmarks=True,         # enables iris landmarks 468 & 473
        min_detection_confidence=0.5,
    )
    MEDIAPIPE_AVAILABLE = True
    print("[camera_detection] MediaPipe + OpenCV loaded successfully.")
except Exception as _e:
    MEDIAPIPE_ERROR = str(_e)
    # Print full traceback so you can see exactly what failed
    print(f"[camera_detection] CRITICAL — MediaPipe/OpenCV failed to load:")
    traceback.print_exc()
    print(f"[camera_detection] Fix: pip install mediapipe opencv-python-headless --break-system-packages")


# ── Landmark IDs ────────────────────────────────────────────────────────────
NOSE_TIP      = 1
LEFT_CHEEK    = 234
RIGHT_CHEEK   = 454

LEFT_EYE_L    = 33    # left corner of left eye
LEFT_EYE_R    = 133   # right corner of left eye
LEFT_IRIS     = 468   # iris center left eye (refine_landmarks=True)

RIGHT_EYE_L   = 362
RIGHT_EYE_R   = 263
RIGHT_IRIS    = 473
# ────────────────────────────────────────────────────────────────────────────


def get_status() -> Dict[str, Any]:
    """Return whether MediaPipe is available. Called by health-check route."""
    return {
        "mediapipe_available": MEDIAPIPE_AVAILABLE,
        "error": MEDIAPIPE_ERROR,
    }


def _decode_frame(image_b64: str) -> "np.ndarray | None":
    """Decode base64 image string → BGR numpy array."""
    try:
        # Strip data-URL prefix if present
        if "," in image_b64:
            image_b64 = image_b64.split(",", 1)[1]
        raw = base64.b64decode(image_b64)
        arr = np.frombuffer(raw, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None


def _head_direction(landmarks) -> str:
    """
    Uses nose tip x vs midpoint of cheeks to determine head turn.
    Returns: "left" | "right" | "center"
    """
    nose_x  = landmarks.landmark[NOSE_TIP].x
    left_x  = landmarks.landmark[LEFT_CHEEK].x
    right_x = landmarks.landmark[RIGHT_CHEEK].x
    center  = (left_x + right_x) / 2.0

    if nose_x < center - 0.025:
        return "left"
    if nose_x > center + 0.025:
        return "right"
    return "center"


def _eye_direction(landmarks) -> str:
    """
    Uses iris position inside eye bounding box.
    Returns: "left" | "right" | "center"
    """
    try:
        # Use left eye iris (landmark 468 — requires refine_landmarks)
        l_corner = landmarks.landmark[LEFT_EYE_L].x
        r_corner = landmarks.landmark[LEFT_EYE_R].x
        iris_x   = landmarks.landmark[LEFT_IRIS].x

        eye_width = abs(r_corner - l_corner)
        if eye_width < 0.001:   # degenerate — face too close / occluded
            return "center"

        ratio = (iris_x - l_corner) / eye_width

        if ratio < 0.38:
            return "left"
        if ratio > 0.62:
            return "right"
        return "center"
    except Exception:
        return "center"


def analyze_frame(image_b64: str) -> Dict[str, Any]:
    """
    Main entry point.
    Accepts base64-encoded JPEG/PNG frame.
    Returns:
    {
        "face_detected": bool,
        "face_count": int,
        "head_direction": "left"|"right"|"center",
        "eye_direction": "left"|"right"|"center",
        "violation": bool,
        "violation_reason": str | None,
        "risk_delta": int,
        "mediapipe_available": bool   ← NEW: lets controller know if detection was real
    }
    """
    if not MEDIAPIPE_AVAILABLE:
        # Return a REAL error state — do NOT fake face_detected=True.
        # This way the controller can log it and the recruiter sees "mediapipe unavailable"
        # rather than seeing all-zero counts with no explanation.
        return {
            "face_detected": False,
            "face_count": 0,
            "head_direction": "unknown",
            "eye_direction": "unknown",
            "violation": False,
            "violation_reason": "mediapipe_unavailable",
            "risk_delta": 0,
            "mediapipe_available": False,
            "error": MEDIAPIPE_ERROR or "mediapipe_not_installed",
        }

    if not image_b64:
        return _no_face_result("empty_frame")

    frame = _decode_frame(image_b64)
    if frame is None:
        return _no_face_result("decode_error")

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # ── Step 1: count faces ──────────────────────────────────────────
    det_results = _face_detector.process(rgb)
    face_count   = len(det_results.detections) if det_results.detections else 0
    face_detected = face_count > 0

    # ── Step 2: no face ──────────────────────────────────────────────
    if not face_detected:
        return _no_face_result("no_face")

    # ── Step 3: multiple faces ───────────────────────────────────────
    if face_count > 1:
        return {
            "face_detected": True,
            "face_count": face_count,
            "head_direction": "unknown",
            "eye_direction": "unknown",
            "violation": True,
            "violation_reason": "multiple_faces",
            "risk_delta": 50,
            "mediapipe_available": True,
        }

    # ── Step 4: landmarks for head + eye ────────────────────────────
    mesh_results = _face_mesh.process(rgb)

    if not mesh_results.multi_face_landmarks:
        # Face detected but landmarks failed — treat as non-violation
        return {
            "face_detected": True,
            "face_count": 1,
            "head_direction": "unknown",
            "eye_direction": "unknown",
            "violation": False,
            "violation_reason": None,
            "risk_delta": 0,
            "mediapipe_available": True,
        }

    lm = mesh_results.multi_face_landmarks[0]
    head = _head_direction(lm)
    eye  = _eye_direction(lm)

    violation        = False
    violation_reason = None
    risk_delta       = 0

    if head != "center" and eye != "center":
        violation        = True
        violation_reason = "looking_away"      # ← simplified: controller checks includes("looking_away")
        risk_delta       = 20
    elif head != "center":
        violation        = True
        violation_reason = "head_turned"
        risk_delta       = 10
    elif eye != "center":
        violation        = True
        violation_reason = "eyes_looking_away"
        risk_delta       = 10

    return {
        "face_detected": True,
        "face_count": 1,
        "head_direction": head,
        "eye_direction": eye,
        "violation": violation,
        "violation_reason": violation_reason,
        "risk_delta": risk_delta,
        "mediapipe_available": True,
    }


def _no_face_result(reason: str) -> Dict[str, Any]:
    return {
        "face_detected": False,
        "face_count": 0,
        "head_direction": "unknown",
        "eye_direction": "unknown",
        "violation": True,
        "violation_reason": reason,
        "risk_delta": 30,
        "mediapipe_available": True,
    }