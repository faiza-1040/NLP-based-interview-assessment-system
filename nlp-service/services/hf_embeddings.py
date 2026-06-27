# #nlp-service/services/hf-embeddings.py
# import os
# import requests
# import numpy as np

# HF_API_TOKEN = os.environ.get("HF_API_TOKEN")
# if not HF_API_TOKEN:
#     raise RuntimeError("HF_API_TOKEN not set in environment")

# MODEL_ID = os.environ.get("HF_MODEL_ID", "sentence-transformers/all-MiniLM-L6-v2")

# # IMPORTANT: use the new router endpoint, NOT api-inference
# HF_API_URL = (
#     f"https://router.huggingface.co/hf-inference/models/"
#     f"{MODEL_ID}/pipeline/feature-extraction"
# )

# HEADERS = {"Authorization": f"Bearer {HF_API_TOKEN}", "Content-Type": "application/json"}


# def embed_text(text: str) -> np.ndarray:
#     """
#     Call Hugging Face router Inference API to get SBERT embedding.
#     Returns a normalized numpy vector.
#     """
#     if not text:
#         text = ""

#     # router feature-extraction endpoint expects a list of inputs
#     payload = {
#         "inputs": [text],
#         "options": {
#             "wait_for_model": True  # ensure model loads if sleeping
#         },
#     }

#     resp = requests.post(HF_API_URL, headers=HEADERS, json=payload, timeout=90)
#     resp.raise_for_status()
#     data = resp.json()

#     # Expect shape: [[e1, e2, ...]] (batch of 1)
#     if not isinstance(data, list) or len(data) == 0:
#         raise RuntimeError(f"Unexpected HF response format: {data}")

#     first = data[0]
#     if isinstance(first, list):
#         vec = np.array(first, dtype=float)
#     else:
#         vec = np.array(data, dtype=float)

#     # L2-normalize
#     norm = np.linalg.norm(vec)
#     if norm > 0:
#         vec = vec / norm
#     return vec


# def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
#     if a is None or b is None:
#         return 0.0
#     denom = (np.linalg.norm(a) * np.linalg.norm(b))
#     if denom == 0:
#         return 0.0
#     return float(np.dot(a, b) / denom)


#nlp-service/services/hf-embeddings.py
import os
import requests
import numpy as np

HF_API_TOKEN = os.environ.get("HF_API_TOKEN")
if not HF_API_TOKEN:
    raise RuntimeError("HF_API_TOKEN not set in environment")

MODEL_ID = os.environ.get("HF_MODEL_ID", "sentence-transformers/all-MiniLM-L6-v2")

# IMPORTANT: use the new router endpoint, NOT api-inference
HF_API_URL = (
    f"https://router.huggingface.co/hf-inference/models/"
    f"{MODEL_ID}/pipeline/feature-extraction"
)

HEADERS = {"Authorization": f"Bearer {HF_API_TOKEN}", "Content-Type": "application/json"}


def embed_text(text: str) -> np.ndarray:
    """
    Call Hugging Face router Inference API to get SBERT embedding.
    Returns a normalized numpy vector.
    """
    if not text:
        text = ""

    # router feature-extraction endpoint expects a list of inputs
    payload = {
        "inputs": [text],
        "options": {
            "wait_for_model": True  # ensure model loads if sleeping
        },
    }

    resp = requests.post(HF_API_URL, headers=HEADERS, json=payload, timeout=90)
    resp.raise_for_status()
    data = resp.json()

    # Expect shape: [[e1, e2, ...]] (batch of 1)
    if not isinstance(data, list) or len(data) == 0:
        raise RuntimeError(f"Unexpected HF response format: {data}")

    first = data[0]
    if isinstance(first, list):
        vec = np.array(first, dtype=float)
    else:
        vec = np.array(data, dtype=float)

    # L2-normalize
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    if a is None or b is None:
        return 0.0
    denom = (np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)

