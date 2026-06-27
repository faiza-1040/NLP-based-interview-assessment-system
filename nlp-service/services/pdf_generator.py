# nlp-service/services/pdf_generator.py
from io import BytesIO
from typing import Any, Dict, List
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def _safe(x: Any) -> str:
    return str(x).strip() if x is not None else ""

def _hex_to_rgb01(hex_color: str):
    try:
        s = (hex_color or "").lstrip("#")
        if len(s) != 6:
            return (0.07, 0.10, 0.16)
        r = int(s[0:2], 16) / 255.0
        g = int(s[2:4], 16) / 255.0
        b = int(s[4:6], 16) / 255.0
        return (r, g, b)
    except Exception:
        return (0.07, 0.10, 0.16)

def _draw_section_title(c: canvas.Canvas, x: int, y: int, title: str, theme_color_rgb):
    c.setFillColorRGB(*theme_color_rgb)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(x, y, title)
    c.line(x, y - 3, x + 510, y - 3)
    c.setFillColorRGB(0.07, 0.10, 0.16)

def _wrap_text(text: str, max_chars: int = 105):
    text = _safe(text)
    if not text:
        return []

    words = text.split()
    lines = []
    current = ""

    for word in words:
        if len(current + " " + word) <= max_chars:
            current = (current + " " + word).strip()
        else:
            if current:
                lines.append(current)
            current = word

    if current:
        lines.append(current)

    return lines

def generate_resume_pdf_bytes(view_model: Dict[str, Any], theme_color: str = "#111827") -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    width, height = letter

    theme_rgb = _hex_to_rgb01(theme_color)

    x = 50
    y = height - 58

    def new_page_if_needed(current_y: int) -> int:
        if current_y < 80:
            c.showPage()
            return height - 58
        return current_y

    def draw_paragraph(text: str, start_y: int, font="Helvetica", size=9.5, indent=0):
        yy = start_y
        c.setFont(font, size)
        for line in _wrap_text(text, 105):
            yy = new_page_if_needed(yy)
            c.drawString(x + indent, yy, line)
            yy -= 12
        return yy

    header = view_model.get("header") or {}

    # Header name
    c.setFillColorRGB(*theme_rgb)
    c.setFont("Helvetica-Bold", 21)
    c.drawString(x, y, _safe(header.get("name")) or "Resume")
    y -= 18

    # Job title
    job_title = _safe(header.get("jobTitle"))
    if job_title:
        c.setFillColorRGB(0.22, 0.26, 0.32)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x, y, job_title)
        y -= 15

    # Contact
    c.setFillColorRGB(0.07, 0.10, 0.16)
    c.setFont("Helvetica", 9)
    contact_items = [
        _safe(header.get("email")),
        _safe(header.get("phone")),
        _safe(header.get("address")),
    ]
    contact = " | ".join([p for p in contact_items if p])
    if contact:
        c.drawString(x, y, contact[:120])
        y -= 18

    y -= 10

    # Summary
    summary = _safe(view_model.get("summary"))
    if summary:
        y = new_page_if_needed(y)
        _draw_section_title(c, x, y, "Summary", theme_rgb)
        y -= 18
        y = draw_paragraph(summary, y)
        y -= 10

    # Experience
    experience: List[Dict[str, Any]] = view_model.get("experience") or []
    if experience:
        y = new_page_if_needed(y)
        _draw_section_title(c, x, y, "Experience", theme_rgb)
        y -= 18

        for ex in experience:
            y = new_page_if_needed(y)

            title = " • ".join(
                [p for p in [_safe(ex.get("role")), _safe(ex.get("company"))] if p]
            )

            c.setFont("Helvetica-Bold", 10.5)
            c.drawString(x, y, title[:110] or "Role")
            y -= 12

            date_range = _safe(ex.get("dateRange"))
            if date_range:
                c.setFont("Helvetica", 9)
                c.drawString(x, y, date_range[:110])
                y -= 12

            bullets = ex.get("bullets") or []
            if isinstance(bullets, list):
                c.setFont("Helvetica", 9)
                for b in bullets[:6]:
                    for line in _wrap_text("• " + _safe(b), 100):
                        y = new_page_if_needed(y)
                        c.drawString(x + 10, y, line)
                        y -= 11

            y -= 8

        y -= 4

    # Education
    education: List[Dict[str, Any]] = view_model.get("education") or []
    if education:
        y = new_page_if_needed(y)
        _draw_section_title(c, x, y, "Education", theme_rgb)
        y -= 18

        for e in education:
            y = new_page_if_needed(y)
            c.setFont("Helvetica-Bold", 10.5)
            c.drawString(x, y, (_safe(e.get("degree")) or "Degree")[:110])
            y -= 12

            sub = " • ".join(
                [
                    p
                    for p in [
                        _safe(e.get("institution")),
                        _safe(e.get("dateRange")),
                        _safe(e.get("grade")),
                    ]
                    if p
                ]
            )
            if sub:
                c.setFont("Helvetica", 9)
                c.drawString(x, y, sub[:120])
                y -= 12

            y -= 6

        y -= 4

    # Skills
    skills = view_model.get("skills") or []
    skill_items = view_model.get("skillItems") or []

    if skill_items or skills:
        y = new_page_if_needed(y)
        _draw_section_title(c, x, y, "Skills", theme_rgb)
        y -= 18

        if isinstance(skill_items, list) and skill_items:
            skill_text = ", ".join(
                [
                    f"{_safe(s.get('name'))} ({_safe(s.get('level'))})"
                    for s in skill_items
                    if _safe(s.get("name"))
                ]
            )
        else:
            skill_text = ", ".join([_safe(s) for s in skills if _safe(s)])

        y = draw_paragraph(skill_text, y)
        y -= 10

    # Projects
    projects: List[Dict[str, Any]] = view_model.get("projects") or []
    if projects:
        y = new_page_if_needed(y)
        _draw_section_title(c, x, y, "Projects", theme_rgb)
        y -= 18

        for p in projects:
            y = new_page_if_needed(y)
            c.setFont("Helvetica-Bold", 10.5)
            c.drawString(x, y, (_safe(p.get("name")) or "Project")[:110])
            y -= 12

            desc = _safe(p.get("description"))
            if desc:
                y = draw_paragraph(desc, y)

            tech = p.get("tech") or []
            if isinstance(tech, list) and tech:
                y = draw_paragraph("Tech: " + ", ".join([_safe(t) for t in tech if _safe(t)]), y)

            link = _safe(p.get("link"))
            if link:
                y = draw_paragraph(link, y)

            y -= 8

        y -= 4

    # Certifications
    certs: List[Dict[str, Any]] = view_model.get("certifications") or []
    if certs:
        y = new_page_if_needed(y)
        _draw_section_title(c, x, y, "Certifications", theme_rgb)
        y -= 18

        for cc in certs:
            y = new_page_if_needed(y)
            c.setFont("Helvetica-Bold", 10.5)
            c.drawString(x, y, (_safe(cc.get("name")) or "Certification")[:110])
            y -= 12

            sub = " • ".join(
                [p for p in [_safe(cc.get("issuer")), _safe(cc.get("date"))] if p]
            )
            if sub:
                c.setFont("Helvetica", 9)
                c.drawString(x, y, sub[:110])
                y -= 12

            y -= 6

        y -= 4

    # Languages
    langs: List[Dict[str, Any]] = view_model.get("languages") or []
    if langs:
        y = new_page_if_needed(y)
        _draw_section_title(c, x, y, "Languages", theme_rgb)
        y -= 18

        lines = []
        for l in langs:
            line = " — ".join(
                [p for p in [_safe(l.get("name")), _safe(l.get("level"))] if p]
            )
            if line:
                lines.append(line)

        y = draw_paragraph(", ".join(lines), y)
        y -= 10

    # Custom Sections
    custom_sections: List[Dict[str, Any]] = view_model.get("customSections") or []
    if custom_sections:
        for section in custom_sections:
            title = _safe(section.get("title")) or "Additional"
            content = _safe(section.get("content"))
            bullets = section.get("bullets") or []

            if not title and not content and not bullets:
                continue

            y = new_page_if_needed(y)
            _draw_section_title(c, x, y, title, theme_rgb)
            y -= 18

            if isinstance(bullets, list) and bullets:
                c.setFont("Helvetica", 9)
                for b in bullets[:10]:
                    for line in _wrap_text("• " + _safe(b), 100):
                        y = new_page_if_needed(y)
                        c.drawString(x + 10, y, line)
                        y -= 11
            elif content:
                y = draw_paragraph(content, y)

            y -= 10

    c.showPage()
    c.save()

    return buf.getvalue()
