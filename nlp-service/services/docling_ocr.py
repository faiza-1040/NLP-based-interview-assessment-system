# nlp-service/services/docling_ocr.py
import tempfile
import os
import re
import requests
import fitz  # PyMuPDF
# from docling.document_converter import DocumentConverter
from rapidocr_onnxruntime import RapidOCR

# create global singletons (faster than recreating on every request)
# _converter = DocumentConverter()
_ocr_engine = RapidOCR()


def download_pdf_to_temp(url: str) -> str:
    """
    Download a PDF from a URL to a temp file and return its path.
    """
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(resp.content)
    tmp.flush()
    tmp.close()
    return tmp.name


def extract_docling_text(pdf_path: str) -> str:
    # result = _converter.convert(pdf_path)
    # doc = result.document

    # docling_text = ""
    # if hasattr(doc, "export_to_markdown"):
    #     try:
    #         docling_text = doc.export_to_markdown(sort_by_position=True)
    #     except TypeError:
    #         docling_text = doc.export_to_markdown()
    # elif hasattr(doc, "export_to_text"):
    #     docling_text = doc.export_to_text()

    # return docling_text or ""
    return ""


def forced_ocr_pdf(pdf_path: str, dpi: int = 300) -> str:
    """
    Forced OCR extraction (your Colab Cell 5).
    """
    pdf = fitz.open(pdf_path)
    all_ocr_text = []

    for page in pdf:
        pix = page.get_pixmap(dpi=dpi)
        img_bytes = pix.pil_tobytes(format="PNG")

        ocr_result, _ = _ocr_engine(img_bytes)
        if ocr_result:
            page_text = "\n".join([x[1] for x in ocr_result])
            all_ocr_text.append(page_text)

    pdf.close()
    return "\n".join(all_ocr_text)


def merge_and_clean(docling_text: str, ocr_text: str) -> str:
    """
    Merge docling + ocr and deduplicate lines (Cell 6).
    """
    merged = (docling_text + "\n" + ocr_text).strip()
    lines = [ln.strip() for ln in merged.splitlines() if ln.strip()]

    deduped = []
    seen = set()
    for l in lines:
        if l not in seen:
            deduped.append(l)
            seen.add(l)

    return "\n".join(deduped)


def normalize_text(t: str) -> str:
    """
    Normalize whitespace (Cell 7).
    """
    t = re.sub(r"\n{3,}", "\n\n", t)
    t = re.sub(r"[ \t]{2,}", " ", t)
    return t.strip()


def extract_clean_text_from_url(file_url: str) -> str:
    """
    Full pipeline: download → Docling → OCR → merge → normalize.
    """
    pdf_path = download_pdf_to_temp(file_url)
    try:
        docling_text = extract_docling_text(pdf_path)
        ocr_text = forced_ocr_pdf(pdf_path)
        full_clean = merge_and_clean(docling_text, ocr_text)
        return normalize_text(full_clean)
    finally:
        # clean temp file
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
