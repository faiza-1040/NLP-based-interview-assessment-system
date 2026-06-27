# #nlp-service/services/sanitizer.py
# import re
# from typing import Tuple, Dict, List

# # Patterns (work WITHOUT labels)
# EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')

# PHONE_RE = re.compile(
#     r'(?<!\w)(?:\+?\d[\d\-\s()]{7,}\d)(?!\w)'
# )

# CNIC_RE = re.compile(r'\b\d{5}-\d{7}-\d\b')

# URL_RE = re.compile(
#     r'(https?://\S+|www\.\S+|linkedin\.com/\S+|github\.com/\S+)',
#     re.IGNORECASE
# )


# def sanitize_resume_text(text: str) -> Tuple[str, Dict[str, List[str]]]:
#     """
#     Removes sensitive info from resume text BEFORE sending to AI APIs.

#     Removes:
#     - emails
#     - phone numbers
#     - CNIC
#     - URLs (LinkedIn, GitHub, etc.)

#     Returns:
#     sanitized_text, pii_found
#     """

#     if not text:
#         return "", {}

#     pii_found = {
#         "emails": [],
#         "phones": [],
#         "cnics": [],
#         "urls": [],
#     }

#     # EMAIL
#     emails = EMAIL_RE.findall(text)
#     if emails:
#         pii_found["emails"].extend(emails)
#         text = EMAIL_RE.sub("[EMAIL]", text)

#     # PHONE
#     phones = PHONE_RE.findall(text)
#     if phones:
#         pii_found["phones"].extend(phones)
#         text = PHONE_RE.sub("[PHONE]", text)

#     # CNIC
#     cnics = CNIC_RE.findall(text)
#     if cnics:
#         pii_found["cnics"].extend(cnics)
#         text = CNIC_RE.sub("[CNIC]", text)

#     # URL (LinkedIn / GitHub / websites)
#     urls = URL_RE.findall(text)
#     if urls:
#         pii_found["urls"].extend(urls)
#         text = URL_RE.sub("[URL]", text)

#     # remove empty keys
#     pii_found = {k: v for k, v in pii_found.items() if v}

#     return text, pii_found

import re
from typing import Tuple, Dict, List

EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
CNIC_RE = re.compile(r'\b\d{5}-\d{7}-\d\b')
URL_RE = re.compile(
    r'(https?://\S+|www\.\S+|linkedin\.com/\S+|github\.com/\S+)',
    re.IGNORECASE
)

# broader candidate finder, validated afterward
PHONE_CANDIDATE_RE = re.compile(
    r'(?<!\w)(\+?\d[\d\s\-\(\)]{8,}\d)(?!\w)'
)


def _is_valid_phone(candidate: str) -> bool:
    """
    Accept only realistic phone-like strings.
    Reject date-like strings such as 2025 - 06.
    """
    if not candidate:
        return False

    cleaned = candidate.strip()

    # Count digits only
    digits_only = re.sub(r'\D', '', cleaned)

    # Most phone numbers should have at least 10 digits
    if len(digits_only) < 10:
        return False

    # Prevent obvious year-month / year-year style date ranges
    if re.fullmatch(r'\d{4}\s*-\s*\d{2}', cleaned):
        return False

    if re.fullmatch(r'\d{4}\s*-\s*\d{4}', cleaned):
        return False

    # Optional: reject month/year style if it somehow appears
    if re.fullmatch(r'\d{2}\s*/\s*\d{4}', cleaned):
        return False

    return True


def _replace_valid_phones(text: str):
    found_phones = []

    def repl(match):
        candidate = match.group(1)
        if _is_valid_phone(candidate):
            found_phones.append(candidate)
            return "[PHONE]"
        return candidate

    new_text = PHONE_CANDIDATE_RE.sub(repl, text)
    return new_text, found_phones


def sanitize_resume_text(text: str) -> Tuple[str, Dict[str, List[str]]]:
    """
    Removes sensitive info from resume text BEFORE sending to AI APIs.

    Removes:
    - emails
    - phone numbers
    - CNIC
    - URLs (LinkedIn, GitHub, etc.)

    Returns:
    sanitized_text, pii_found
    """

    if not text:
        return "", {}

    pii_found = {
        "emails": [],
        "phones": [],
        "cnics": [],
        "urls": [],
    }

    # EMAIL
    emails = EMAIL_RE.findall(text)
    if emails:
        pii_found["emails"].extend(emails)
        text = EMAIL_RE.sub("[EMAIL]", text)

    # PHONE with validation
    text, phones = _replace_valid_phones(text)
    if phones:
        pii_found["phones"].extend(phones)

    # CNIC
    cnics = CNIC_RE.findall(text)
    if cnics:
        pii_found["cnics"].extend(cnics)
        text = CNIC_RE.sub("[CNIC]", text)

    # URL
    urls = URL_RE.findall(text)
    if urls:
        pii_found["urls"].extend(urls)
        text = URL_RE.sub("[URL]", text)

    pii_found = {k: v for k, v in pii_found.items() if v}

    return text, pii_found