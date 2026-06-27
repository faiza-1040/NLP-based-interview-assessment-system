

import React from "react";

/* ===== tiny helpers ===== */
const prettyYear = (y) => (y ? String(y).trim() : "");
const prettyDate = (d) => (d ? String(d).split("T")[0] : "");
const hasData = (v) => {
  if (!v) return false;
  if (Array.isArray(v)) {
    return v.some((row) =>
      row && Object.values(row).some(val => {
        if (Array.isArray(val)) return val.some(Boolean); // must have real items
        if (typeof val === "string") return val.trim().length > 0; // must have text
        return Boolean(val);
      })
    );
  }
  if (typeof v === "object") {
    return Object.values(v).some(val => {
      if (Array.isArray(val)) return val.some(Boolean);
      if (typeof val === "string") return val.trim().length > 0;
      return Boolean(val);
    });
  }
  if (typeof v === "string") return v.trim().length > 0;
  return false;
};

const bullets = (text) =>
  (text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

/* ===== tiny primitives ===== */
const Section = ({ title, accent, children }) => {
  const { headingStyle, dividerStyle } = makeHeadingStyles(accent);

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        background: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <div style={headingStyle}>{title}</div>
      <div style={dividerStyle} />
      <div>{children}</div>
    </section>
  );
};

const makeHeadingStyles = (accent) => {
  const headingStyle = {
    color: accent,
    fontWeight: 800,
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 0,
    marginBottom: 8,
  };

  const dividerStyle = {
    height: 2,
    background: accent,
    opacity: 0.25,
    marginBottom: 10,
  };

  return { headingStyle, dividerStyle };
};

const Chip = ({ children, accent }) => (
  <span
    style={{
      display: "inline-block",
      border: `1px solid ${accent}33`,
      background: `${accent}14`,
      color: accent,
      fontSize: 12,
      padding: "4px 10px",
      borderRadius: 999,
      marginRight: 8,
      marginBottom: 8,
      fontWeight: 600,
    }}
  >
    {children}
  </span>
);


/* ===== main component ===== */
const ResumePreview = ({ values, userId, apiBase, templateId, themeColor = "#111827" }) => {
  const accent = themeColor; // ✅ your selected color

  if (!values) return <p>No resume data yet.</p>;

  const personal = values.personalDetails || {};
  const education = values.education || [];
  const experience = values.experience || [];
  const certifications = values.certifications || [];
  const projects = values.projects || [];
  const languages = values.languages || [];
  const skills = (values.skills || []).filter(Boolean);
  const customSections = (values.customSections || []).filter(
  (s) => s && (String(s.title || "").trim() || String(s.content || "").trim())
);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", color: "#111827" }}>
      {/* Header */}
      {/* Header */}
<header style={{ borderBottom: `4px solid ${accent}`, paddingBottom: 12, marginBottom: 16 }}>
  <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: accent }}>
    {personal.fullName || "Your Name"}
  </h1>

  <div style={{ marginTop: 6, color: "#374151" }}>
    {(personal.email || "email@example.com")} • {(personal.phone || "000-000-0000")}
  </div>

  <div style={{ color: "#6b7280" }}>
    {personal.address || "City, Country"}
  </div>
</header>


      {/* Summary */}
      {hasData(values.summary) && (
        <Section title="Summary" accent={accent}>

          <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{values.summary}</p>
        </Section>
      )}

      {/* Education (required) */}
      {education.length > 0 && (
        <Section title="Education" accent={accent}>
          {education.map((e, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>
                {e.level}{e.field ? ` in ${e.field}` : ""}
              </div>
              <div>
                {e.institution}{" "}
                {(e.fromYear || e.toYear || e.currentlyEnrolled) && (
                  <span style={{ color: "#6b7280" }}>
                    • {prettyYear(e.fromYear)} – {e.currentlyEnrolled ? "Present" : prettyYear(e.toYear)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Experience */}
      {hasData(experience) && (
        <Section title="Experience" accent={accent}>
          {experience.map((x, i) => {
            const items = bullets(x.description);
            return (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700 }}>
                  {x.jobTitle || "Role"} {x.company ? `• ${x.company}` : ""}
                </div>
                {(x.fromYear || x.toYear || x.currentlyWorking) && (
                  <div style={{ color: "#6b7280" }}>
                    {prettyYear(x.fromYear)} – {x.currentlyWorking ? "Present" : prettyYear(x.toYear)}
                </div>
                )}
                {items.length > 0 && (
                  <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
                    {items.map((b, idx) => <li key={idx} style={{ lineHeight: 1.5 }}>{b}</li>)}
                  </ul>
                )}
              </div>
            );
          })}
        </Section>
      )}


      {hasData(projects) && (
        <Section title="Projects" accent={accent}>
          {projects
          .filter(p => p && Object.values(p).some(val => {
        if (Array.isArray(val)) return val.some(Boolean);
        if (typeof val === "string") return val.trim().length > 0;
        return Boolean(val);
      }))
          .map((p, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{p.name || "Project"}</div>
                {p.link && (
  <a
    href={p.link}
    target="_blank"
    rel="noreferrer"
    style={{ fontSize: 12, color: "#1d4ed8", textDecoration: "none" }}
  >
    Download PDF ↗
  </a>
)}

              </div>
              {p.description && <div style={{ marginTop: 4, lineHeight: 1.6 }}>{p.description}</div>}
              {(p.technologies || []).filter(Boolean).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {(p.technologies || []).filter(Boolean).map((t, ti) => (
                    <Chip key={ti} accent={accent}>{t}</Chip>

                  ))}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Certifications */}
      {hasData(certifications) && (
        <Section title="Certifications" accent={accent}>
          {certifications.map((c, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <strong>{c.name || "Certification"}</strong>{" "}
              <span style={{ color: "#6b7280" }}>
                {c.issuedBy ? `• ${c.issuedBy}` : ""}{c.date ? ` • ${prettyDate(c.date)}` : ""}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Languages */}
      {hasData(languages) && (
        <Section title="Languages" accent={accent}>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {languages.map((l, i) => (
              <Chip key={i} accent={accent}>{l.language}{l.level ? ` — ${l.level}` : ""}</Chip>
            ))}
          </div>
        </Section>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <Section title="Skills" accent={accent}>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {skills.map((s, i) => <Chip key={i} accent={accent}>{s}</Chip>)}
          </div>
        </Section>
      )}
      {/* ✅ Custom Sections */}
{customSections.length > 0 && (
  <Section title="Additional" accent={accent}>
    {customSections.map((cs, i) => (
      <div key={i} style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700 }}>{cs.title || "Custom Section"}</div>
        {String(cs.content || "").trim() && (
          <div style={{ marginTop: 6 }}>
            {bullets(cs.content).length > 1 ? (
              <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
                {bullets(cs.content).map((b, idx) => (
                  <li key={idx} style={{ lineHeight: 1.5 }}>{b}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {cs.content}
              </p>
            )}
          </div>
        )}
      </div>
    ))}
  </Section>
)}

      {/* Download */}
      {userId && (
        <div style={{ marginTop: 10 }}>
          <a
            href={`${apiBase}/api/resume/pdf/${userId}?templateId=${encodeURIComponent(
              templateId || "classic"
            )}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              background: "#1e40af",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Download PDF
          </a>
        </div>
      )}
    </div>
  );
};

export default ResumePreview;
