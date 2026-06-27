# # nlp-service/services/llm_client.py
# import os
# import json
# import re
# from typing import Any, Dict, List, Optional

# try:
#     from groq import Groq
# except Exception:
#     Groq = None

# import requests


# def _extract_first_json_object(text: str) -> Dict[str, Any]:
#     """
#     If model returns extra text, extract the first {...} JSON object.
#     """
#     if not text:
#         return {}
#     text = text.strip()

#     # Direct parse
#     try:
#         return json.loads(text)
#     except Exception:
#         pass

#     # Extract first {...}
#     m = re.search(r"\{.*\}", text, flags=re.DOTALL)
#     if m:
#         try:
#             return json.loads(m.group(0))
#         except Exception:
#             return {}
#     return {}


# def groq_chat_json(
#     messages: List[Dict[str, str]],
#     model: Optional[str] = None,
#     temperature: float = 0.2,
#     max_tokens: int = 1200,
# ) -> Dict[str, Any]:
#     """
#     Returns a python dict parsed from the model output.
#     Uses Groq OpenAI-compatible chat completion endpoint.
#     """
#     api_key = os.getenv("GROQ_API_KEY")
#     if not api_key:
#         raise RuntimeError("GROQ_API_KEY is missing in nlp-service/.env")

#     base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
#     model = model or os.getenv("GROQ_TEXT_MODEL", "llama-3.3-70b-versatile")

#     # Prefer official SDK if installed
#     if Groq is not None:
#         client = Groq(api_key=api_key)

#         # Groq supports OpenAI-compatible request style.
#         resp = client.chat.completions.create(
#             model=model,
#             messages=messages,
#             temperature=temperature,
#             max_tokens=max_tokens,
#             # JSON mode: forces valid JSON object output
#             response_format={"type": "json_object"},
#         )

#         content = resp.choices[0].message.content if resp.choices else ""
#         return _extract_first_json_object(content)

#     # Fallback: HTTP requests
#     url = f"{base_url}/chat/completions"
#     headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
#     payload = {
#         "model": model,
#         "messages": messages,
#         "temperature": temperature,
#         "max_tokens": max_tokens,
#         "response_format": {"type": "json_object"},
#     }
#     r = requests.post(url, headers=headers, json=payload, timeout=120)
#     r.raise_for_status()
#     data = r.json()
#     content = data["choices"][0]["message"]["content"]
#     return _extract_first_json_object(content)# nlp-service/services/llm_client.py

# nlp-service/services/llm_client.py
import os, json, re
from typing import Any, Dict, List, Optional
import requests


def _extract_json(text: str) -> Dict[str, Any]:
    if not text:
        return {}
    text = text.strip()

    # direct parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # extract first {...}
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return {}

    return {}


def groq_chat_json(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 1200,
) -> Dict[str, Any]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GROQ_API_KEY in nlp-service/.env")

    base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
    model = model or os.getenv("GROQ_TEXT_MODEL", "llama-3.3-70b-versatile")

    url = f"{base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    # --- try JSON mode first ---
    payload_json_mode = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }

    r = requests.post(url, headers=headers, json=payload_json_mode, timeout=120)

    # If JSON mode rejected, retry without response_format
    if r.status_code in (400, 422):
        payload_plain = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        r = requests.post(url, headers=headers, json=payload_plain, timeout=120)

    r.raise_for_status()
    data = r.json()

    content = ""
    try:
        content = data["choices"][0]["message"]["content"]
    except Exception:
        content = ""

    return _extract_json(content)