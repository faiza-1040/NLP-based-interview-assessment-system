// client/src/components/templates/FlowCVTemplateBase.jsx
import React from "react";

const safe = (value) => (value ? String(value).trim() : "");
const hasAny = (arr) => Array.isArray(arr) && arr.some(Boolean);

const hexToRgba = (hex, alpha = 0.12) => {
  const h = safe(hex).replace("#", "");
  if (![3, 6].includes(h.length)) return `rgba(17,24,39,${alpha})`;

  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const int = parseInt(full, 16);

  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  return `rgba(${r},${g},${b},${alpha})`;
};

const getSpacing = (spacing) => {
  if (spacing === "compact") {
    return {
      sectionGap: 12,
      rowGap: 7,
      paragraphLineHeight: 1.45,
      bodyFont: 11.6,
      titleFont: 12.2,
      headerName: 26,
      pagePadding: 32,
    };
  }

  if (spacing === "comfortable") {
    return {
      sectionGap: 20,
      rowGap: 12,
      paragraphLineHeight: 1.72,
      bodyFont: 12.6,
      titleFont: 13.2,
      headerName: 31,
      pagePadding: 42,
    };
  }

  return {
    sectionGap: 16,
    rowGap: 9,
    paragraphLineHeight: 1.58,
    bodyFont: 12,
    titleFont: 12.7,
    headerName: 29,
    pagePadding: 38,
  };
};

const skillPercent = (level) => {
  const normalized = safe(level).toLowerCase();

  if (normalized === "beginner") return 35;
  if (normalized === "good") return 60;
  if (normalized === "advanced") return 80;
  if (normalized === "expert") return 96;

  return 70;
};

function SectionTitle({ children, accent, variant = "line" }) {
  if (variant === "pill") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 10px",
          borderRadius: 999,
          background: hexToRgba(accent, 0.1),
          color: accent,
          fontSize: 11,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 0.9,
          marginBottom: 9,
        }}
      >
        {children}
      </div>
    );
  }

  if (variant === "leftbar") {
    return (
      <div
        style={{
          borderLeft: `4px solid ${accent}`,
          paddingLeft: 9,
          fontSize: 11.5,
          fontWeight: 950,
          color: "#111827",
          textTransform: "uppercase",
          letterSpacing: 0.85,
          marginBottom: 9,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 9,
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 950,
          color: "#111827",
          textTransform: "uppercase",
          letterSpacing: 0.85,
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </div>
      <div
        style={{
          height: 1.5,
          flex: 1,
          background: `linear-gradient(90deg, ${accent}, ${hexToRgba(
            accent,
            0.08
          )})`,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

function BulletList({ bullets, fontSize, lineHeight }) {
  const list = Array.isArray(bullets) ? bullets.filter(Boolean) : [];
  if (!list.length) return null;

  return (
    <ul
      style={{
        margin: "5px 0 0",
        paddingLeft: 17,
        color: "#374151",
        fontSize,
        lineHeight,
      }}
    >
      {list.slice(0, 7).map((bullet, index) => (
        <li key={index} style={{ marginBottom: 3 }}>
          {bullet}
        </li>
      ))}
    </ul>
  );
}

function ContactLine({ header }) {
  const contact = [
    safe(header.email),
    safe(header.phone),
    safe(header.address),
  ].filter(Boolean);

  if (!contact.length) {
    return (
      <div style={{ color: "#6b7280", fontSize: 11.5 }}>
        email@example.com · 000-000-0000 · City, Country
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "5px 9px",
        color: "#4b5563",
        fontSize: 11.5,
        lineHeight: 1.4,
      }}
    >
      {contact.map((item, index) => (
        <React.Fragment key={index}>
          <span>{item}</span>
          {index < contact.length - 1 && <span style={{ color: "#cbd5e1" }}>•</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function HeaderClassic({ header, accent, scale, showPhoto }) {
  const photo = safe(header.photoUrl);

  return (
    <header
      style={{
        display: "grid",
        gridTemplateColumns: showPhoto && photo ? "1fr 76px" : "1fr",
        gap: 18,
        alignItems: "center",
        paddingBottom: 16,
        borderBottom: `2px solid ${hexToRgba(accent, 0.25)}`,
        marginBottom: 18,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: scale.headerName,
            lineHeight: 1.05,
            fontWeight: 950,
            color: "#111827",
            letterSpacing: -0.8,
          }}
        >
          {safe(header.name) || "Your Name"}
        </h1>

        {safe(header.jobTitle) && (
          <div
            style={{
              marginTop: 6,
              color: accent,
              fontWeight: 850,
              fontSize: 13,
            }}
          >
            {header.jobTitle}
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <ContactLine header={header} />
        </div>
      </div>

      {showPhoto && photo && (
        <img
          src={photo}
          alt=""
          style={{
            width: 76,
            height: 76,
            borderRadius: 16,
            objectFit: "cover",
            border: `3px solid ${hexToRgba(accent, 0.24)}`,
          }}
        />
      )}
    </header>
  );
}

function HeaderAccent({ header, accent, scale, showPhoto }) {
  const photo = safe(header.photoUrl);

  return (
    <header
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 18,
        padding: 18,
        marginBottom: 18,
        background: `linear-gradient(135deg, ${accent}, #111827)`,
        color: "#ffffff",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -55,
          top: -65,
          width: 190,
          height: 190,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: showPhoto && photo ? "1fr 76px" : "1fr",
          gap: 18,
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: scale.headerName,
              lineHeight: 1.05,
              fontWeight: 950,
              letterSpacing: -0.7,
            }}
          >
            {safe(header.name) || "Your Name"}
          </h1>

          {safe(header.jobTitle) && (
            <div
              style={{
                marginTop: 6,
                color: "rgba(255,255,255,0.9)",
                fontWeight: 850,
                fontSize: 13,
              }}
            >
              {header.jobTitle}
            </div>
          )}

          <div style={{ marginTop: 8, color: "rgba(255,255,255,0.84)" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "5px 9px",
                fontSize: 11.5,
                lineHeight: 1.4,
              }}
            >
              {[safe(header.email), safe(header.phone), safe(header.address)]
                .filter(Boolean)
                .map((item, index, arr) => (
                  <React.Fragment key={index}>
                    <span>{item}</span>
                    {index < arr.length - 1 && <span>•</span>}
                  </React.Fragment>
                ))}
            </div>
          </div>
        </div>

        {showPhoto && photo && (
          <img
            src={photo}
            alt=""
            style={{
              width: 76,
              height: 76,
              borderRadius: 16,
              objectFit: "cover",
              border: "3px solid rgba(255,255,255,0.55)",
            }}
          />
        )}
      </div>
    </header>
  );
}

function SummarySection({ data, accent, scale, titleVariant }) {
  if (!safe(data.summary)) return null;

  return (
    <section style={{ marginBottom: scale.sectionGap }}>
      <SectionTitle accent={accent} variant={titleVariant}>
        Profile
      </SectionTitle>
      <p
        style={{
          margin: 0,
          color: "#374151",
          fontSize: scale.bodyFont,
          lineHeight: scale.paragraphLineHeight,
        }}
      >
        {data.summary}
      </p>
    </section>
  );
}

function ExperienceSection({ data, accent, scale, titleVariant, timeline = false }) {
  if (!hasAny(data.experience)) return null;

  return (
    <section style={{ marginBottom: scale.sectionGap }}>
      <SectionTitle accent={accent} variant={titleVariant}>
        Work Experience
      </SectionTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: scale.rowGap + 5 }}>
        {data.experience.map((item, index) => (
          <div
            key={index}
            style={
              timeline
                ? {
                    display: "grid",
                    gridTemplateColumns: "16px 1fr",
                    gap: 9,
                  }
                : {
                    paddingBottom: index === data.experience.length - 1 ? 0 : scale.rowGap,
                    borderBottom:
                      index === data.experience.length - 1
                        ? "none"
                        : "1px solid #eef2f7",
                  }
            }
          >
            {timeline && (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    bottom: -18,
                    width: 1.5,
                    background: "#e5e7eb",
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    width: 9,
                    height: 9,
                    marginTop: 3,
                    borderRadius: "50%",
                    background: accent,
                    boxShadow: `0 0 0 3px ${hexToRgba(accent, 0.15)}`,
                  }}
                />
              </div>
            )}

            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "baseline",
                }}
              >
                <div
                  style={{
                    color: "#111827",
                    fontWeight: 900,
                    fontSize: scale.titleFont,
                  }}
                >
                  {safe(item.role) || "Role"}
                  {safe(item.company) && (
                    <span style={{ color: "#6b7280", fontWeight: 700 }}>
                      {" "}
                      · {item.company}
                    </span>
                  )}
                </div>

                {safe(item.dateRange) && (
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: 10.8,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.dateRange}
                  </div>
                )}
              </div>

              <BulletList
                bullets={item.bullets}
                fontSize={scale.bodyFont}
                lineHeight={scale.paragraphLineHeight}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EducationSection({ data, accent, scale, titleVariant, compact = false }) {
  if (!hasAny(data.education)) return null;

  return (
    <section style={{ marginBottom: scale.sectionGap }}>
      <SectionTitle accent={accent} variant={titleVariant}>
        Education
      </SectionTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 11 }}>
        {data.education.map((item, index) => (
          <div key={index}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                alignItems: "baseline",
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  color: "#111827",
                  fontSize: scale.titleFont,
                }}
              >
                {safe(item.degree) || "Degree"}
              </div>
              {safe(item.dateRange) && (
                <div
                  style={{
                    color: "#6b7280",
                    fontSize: 10.8,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.dateRange}
                </div>
              )}
            </div>

            <div
              style={{
                color: "#4b5563",
                fontSize: scale.bodyFont,
                marginTop: 2,
                lineHeight: 1.45,
              }}
            >
              {[safe(item.institution), safe(item.grade)].filter(Boolean).join(" · ")}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SkillsSection({ data, accent, scale, titleVariant, bars = true }) {
  const skillItems = Array.isArray(data.skillItems) ? data.skillItems : [];

  const skills =
    skillItems.length > 0
      ? skillItems.filter((skill) => safe(skill.name))
      : (data.skills || []).filter(Boolean).map((skill) => ({
          name: skill,
          level: "Good",
        }));

  if (!skills.length) return null;

  return (
    <section style={{ marginBottom: scale.sectionGap }}>
      <SectionTitle accent={accent} variant={titleVariant}>
        Skills
      </SectionTitle>

      {bars ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {skills.slice(0, 18).map((skill, index) => (
            <div key={index}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  fontSize: 11.5,
                  color: "#111827",
                  fontWeight: 800,
                }}
              >
                <span>{safe(skill.name)}</span>
                {safe(skill.level) && (
                  <span style={{ color: "#6b7280", fontWeight: 700 }}>
                    {skill.level}
                  </span>
                )}
              </div>

              <div
                style={{
                  marginTop: 4,
                  height: 5,
                  background: "#e5e7eb",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${skillPercent(skill.level)}%`,
                    height: "100%",
                    background: accent,
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {skills.slice(0, 22).map((skill, index) => (
            <span
              key={index}
              style={{
                padding: "5px 9px",
                borderRadius: 999,
                background: hexToRgba(accent, 0.08),
                border: `1px solid ${hexToRgba(accent, 0.2)}`,
                color: "#111827",
                fontSize: 11.3,
                fontWeight: 750,
              }}
            >
              {safe(skill.name)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectsSection({ data, accent, scale, titleVariant }) {
  if (!hasAny(data.projects)) return null;

  return (
    <section style={{ marginBottom: scale.sectionGap }}>
      <SectionTitle accent={accent} variant={titleVariant}>
        Projects
      </SectionTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {data.projects.map((item, index) => (
          <div key={index}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "baseline",
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  color: "#111827",
                  fontSize: scale.titleFont,
                }}
              >
                {safe(item.name) || "Project"}
              </div>

              {safe(item.link) && (
                <span
                  style={{
                    fontSize: 10.8,
                    color: accent,
                    fontWeight: 800,
                  }}
                >
                  Link
                </span>
              )}
            </div>

            {safe(item.description) && (
              <p
                style={{
                  margin: "4px 0 0",
                  color: "#374151",
                  fontSize: scale.bodyFont,
                  lineHeight: scale.paragraphLineHeight,
                }}
              >
                {item.description}
              </p>
            )}

            {hasAny(item.tech) && (
              <div
                style={{
                  marginTop: 5,
                  color: "#6b7280",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {item.tech.filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function CertificationsSection({ data, accent, scale, titleVariant }) {
  if (!hasAny(data.certifications)) return null;

  return (
    <section style={{ marginBottom: scale.sectionGap }}>
      <SectionTitle accent={accent} variant={titleVariant}>
        Certifications
      </SectionTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.certifications.map((item, index) => (
          <div key={index}>
            <div
              style={{
                fontWeight: 900,
                color: "#111827",
                fontSize: scale.titleFont,
              }}
            >
              {safe(item.name) || "Certification"}
            </div>
            <div
              style={{
                color: "#6b7280",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              {[safe(item.issuer), safe(item.date)].filter(Boolean).join(" · ")}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LanguagesSection({ data, accent, scale, titleVariant }) {
  if (!hasAny(data.languages)) return null;

  return (
    <section style={{ marginBottom: scale.sectionGap }}>
      <SectionTitle accent={accent} variant={titleVariant}>
        Languages
      </SectionTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {data.languages.map((item, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              fontSize: scale.bodyFont,
              color: "#111827",
            }}
          >
            <strong>{safe(item.name) || "Language"}</strong>
            {safe(item.level) && <span style={{ color: "#6b7280" }}>{item.level}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function CustomSections({ data, accent, scale, titleVariant }) {
  const sections = Array.isArray(data.customSections)
    ? data.customSections.filter((section) => safe(section.title) || safe(section.content))
    : [];

  if (!sections.length) return null;

  return (
    <>
      {sections.map((section, index) => (
        <section key={index} style={{ marginBottom: scale.sectionGap }}>
          <SectionTitle accent={accent} variant={titleVariant}>
            {safe(section.title) || "Additional"}
          </SectionTitle>

          {hasAny(section.bullets) ? (
            <BulletList
              bullets={section.bullets}
              fontSize={scale.bodyFont}
              lineHeight={scale.paragraphLineHeight}
            />
          ) : (
            <p
              style={{
                margin: 0,
                color: "#374151",
                fontSize: scale.bodyFont,
                lineHeight: scale.paragraphLineHeight,
                whiteSpace: "pre-wrap",
              }}
            >
              {section.content}
            </p>
          )}
        </section>
      ))}
    </>
  );
}

function renderSection(section, props) {
  const { variant } = props;

  const titleVariant =
    variant === "creative"
      ? "pill"
      : variant === "sidebar"
        ? "leftbar"
        : "line";

  const common = { ...props, titleVariant };

  switch (section) {
    case "summary":
      return <SummarySection {...common} />;
    case "experience":
      return <ExperienceSection {...common} timeline={variant === "timeline"} />;
    case "education":
      return <EducationSection {...common} compact={variant === "compact"} />;
    case "skills":
      return <SkillsSection {...common} bars={variant !== "compact"} />;
    case "projects":
      return <ProjectsSection {...common} />;
    case "certifications":
      return <CertificationsSection {...common} />;
    case "languages":
      return <LanguagesSection {...common} />;
    case "customSections":
      return <CustomSections {...common} />;
    default:
      return null;
  }
}

export default function FlowCVTemplateBase({
  data = {},
  themeColor = "#2563eb",
  variant = "classic",
}) {
  const accent = safe(themeColor || data.themeColor) || "#2563eb";
  const scale = getSpacing(data.spacing || "normal");
  const header = data.header || {};
  const fontFamily = data.fontFamily || "Inter, Arial, sans-serif";

  const order =
    Array.isArray(data.sectionOrder) && data.sectionOrder.length
      ? data.sectionOrder
      : [
          "summary",
          "experience",
          "education",
          "skills",
          "projects",
          "certifications",
          "languages",
          "customSections",
        ];

  const sidebarSections = ["skills", "education", "certifications", "languages"];
  const mainSections = order.filter((section) => !sidebarSections.includes(section));

  const showPhoto = Boolean(safe(header.photoUrl));

  const pageStyle = {
    width: "100%",
    boxSizing: "border-box",
    background: "#ffffff",
    color: "#111827",
    fontFamily,
    padding: scale.pagePadding,
    minHeight: "100%",
    overflow: "hidden",
  };

  if (variant === "skills-strip") {
  const topSkills =
    Array.isArray(data.skillItems) && data.skillItems.length
      ? data.skillItems.map((skill) => safe(skill.name)).filter(Boolean)
      : (data.skills || []).filter(Boolean);

  return (
    <div style={pageStyle}>
      <header
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          overflow: "hidden",
          marginBottom: 16,
          background: "#ffffff",
        }}
      >
        <div style={{ height: 9, background: accent }} />

        <div
          style={{
            position: "relative",
            padding: 18,
            background: `linear-gradient(90deg, ${hexToRgba(
              accent,
              0.1
            )}, rgba(255,255,255,0))`,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                showPhoto && safe(header.photoUrl) ? "1fr 74px" : "1fr",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: scale.headerName + 2,
                  lineHeight: 1.05,
                  fontWeight: 950,
                  color: "#111827",
                  letterSpacing: -0.9,
                }}
              >
                {safe(header.name) || "Your Name"}
              </h1>

              {safe(header.jobTitle) && (
                <div
                  style={{
                    marginTop: 6,
                    color: accent,
                    fontWeight: 850,
                    fontSize: 13,
                  }}
                >
                  {header.jobTitle}
                </div>
              )}

              <div style={{ marginTop: 8 }}>
                <ContactLine header={header} />
              </div>

              {topSkills.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 7,
                  }}
                >
                  {topSkills.slice(0, 10).map((skill, index) => (
                    <span
                      key={index}
                      style={{
                        padding: "5px 9px",
                        borderRadius: 999,
                        background: "#ffffff",
                        border: `1px solid ${hexToRgba(accent, 0.25)}`,
                        color: "#111827",
                        fontSize: 11.2,
                        fontWeight: 800,
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {showPhoto && safe(header.photoUrl) && (
              <img
                src={header.photoUrl}
                alt=""
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: 16,
                  objectFit: "cover",
                  border: `3px solid ${hexToRgba(accent, 0.2)}`,
                }}
              />
            )}
          </div>
        </div>
      </header>

      {["summary", "experience"].map((section) => (
        <React.Fragment key={section}>
          {renderSection(section, {
            data,
            accent,
            scale,
            variant,
            titleVariant: "line",
          })}
        </React.Fragment>
      ))}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        <main>
          {["projects", "education", "customSections"].map((section) => (
            <React.Fragment key={section}>
              {renderSection(section, {
                data,
                accent,
                scale,
                variant,
                titleVariant: "line",
              })}
            </React.Fragment>
          ))}
        </main>

        <aside
          style={{
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 16,
          }}
        >
          {["skills", "certifications", "languages"].map((section) => (
            <React.Fragment key={section}>
              {renderSection(section, {
                data,
                accent,
                scale,
                variant,
                titleVariant: "leftbar",
              })}
            </React.Fragment>
          ))}
        </aside>
      </div>
    </div>
  );
}

if (variant === "three-column") {
  return (
    <div style={pageStyle}>
      <HeaderClassic
        header={header}
        accent={accent}
        scale={scale}
        showPhoto={showPhoto}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "205px 1fr 205px",
          gap: 18,
          alignItems: "start",
        }}
      >
        <aside
          style={{
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 15,
          }}
        >
          {["languages", "certifications"].map((section) => (
            <React.Fragment key={section}>
              {renderSection(section, {
                data,
                accent,
                scale,
                variant,
                titleVariant: "leftbar",
              })}
            </React.Fragment>
          ))}
        </aside>

        <main>
          {["summary", "experience", "projects", "customSections"].map(
            (section) => (
              <React.Fragment key={section}>
                {renderSection(section, {
                  data,
                  accent,
                  scale,
                  variant,
                  titleVariant: "line",
                })}
              </React.Fragment>
            )
          )}
        </main>

        <aside
          style={{
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 15,
          }}
        >
          {["skills", "education"].map((section) => (
            <React.Fragment key={section}>
              {renderSection(section, {
                data,
                accent,
                scale,
                variant,
                titleVariant: "leftbar",
              })}
            </React.Fragment>
          ))}
        </aside>
      </div>
    </div>
  );
}

if (variant === "corporate-band") {
  return (
    <div style={pageStyle}>
      <header
        style={{
          borderRadius: 18,
          overflow: "hidden",
          marginBottom: 18,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            padding: 20,
            background: `linear-gradient(90deg, ${hexToRgba(
              accent,
              0.16
            )}, #f8fafc 75%)`,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                showPhoto && safe(header.photoUrl) ? "1fr 74px" : "1fr auto",
              gap: 18,
              alignItems: "center",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: scale.headerName + 2,
                  lineHeight: 1.05,
                  fontWeight: 950,
                  color: "#0f172a",
                  letterSpacing: -0.9,
                }}
              >
                {safe(header.name) || "Your Name"}
              </h1>

              {safe(header.jobTitle) && (
                <div
                  style={{
                    marginTop: 7,
                    color: accent,
                    fontWeight: 850,
                    fontSize: 13,
                  }}
                >
                  {header.jobTitle}
                </div>
              )}

              <div style={{ marginTop: 9 }}>
                <ContactLine header={header} />
              </div>
            </div>

            {showPhoto && safe(header.photoUrl) ? (
              <img
                src={header.photoUrl}
                alt=""
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: 999,
                  objectFit: "cover",
                  border: `3px solid ${hexToRgba(accent, 0.2)}`,
                }}
              />
            ) : (
              <div
                style={{
                  width: 14,
                  height: 58,
                  borderRadius: 999,
                  background: accent,
                }}
              />
            )}
          </div>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 285px",
          gap: 20,
          alignItems: "start",
        }}
      >
        <main>
          {["summary", "experience", "projects", "customSections"].map(
            (section) => (
              <React.Fragment key={section}>
                {renderSection(section, {
                  data,
                  accent,
                  scale,
                  variant,
                  titleVariant: "line",
                })}
              </React.Fragment>
            )
          )}
        </main>

        <aside
          style={{
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 16,
          }}
        >
          {["skills", "education", "certifications", "languages"].map(
            (section) => (
              <React.Fragment key={section}>
                {renderSection(section, {
                  data,
                  accent,
                  scale,
                  variant,
                  titleVariant: "leftbar",
                })}
              </React.Fragment>
            )
          )}
        </aside>
      </div>
    </div>
  );
}

if (variant === "timeline-rails") {
  return (
    <div style={pageStyle}>
      <HeaderClassic
        header={header}
        accent={accent}
        scale={scale}
        showPhoto={showPhoto}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "215px 1fr 215px",
          gap: 18,
          alignItems: "start",
        }}
      >
        <aside
          style={{
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 15,
          }}
        >
          {["skills", "languages"].map((section) => (
            <React.Fragment key={section}>
              {renderSection(section, {
                data,
                accent,
                scale,
                variant,
                titleVariant: "leftbar",
              })}
            </React.Fragment>
          ))}
        </aside>

        <main>
          {["summary"].map((section) => (
            <React.Fragment key={section}>
              {renderSection(section, {
                data,
                accent,
                scale,
                variant,
                titleVariant: "line",
              })}
            </React.Fragment>
          ))}

          {renderSection("experience", {
            data,
            accent,
            scale,
            variant: "timeline",
            titleVariant: "line",
          })}

          {renderSection("projects", {
            data,
            accent,
            scale,
            variant: "timeline",
            titleVariant: "line",
          })}

          {renderSection("customSections", {
            data,
            accent,
            scale,
            variant,
            titleVariant: "line",
          })}
        </main>

        <aside
          style={{
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 15,
          }}
        >
          {["education", "certifications"].map((section) => (
            <React.Fragment key={section}>
              {renderSection(section, {
                data,
                accent,
                scale,
                variant,
                titleVariant: "leftbar",
              })}
            </React.Fragment>
          ))}
        </aside>
      </div>
    </div>
  );
}

  if (variant === "minimal") {
  return (
    <div style={pageStyle}>
      <header
        style={{
          display: "grid",
          gridTemplateColumns: showPhoto && safe(header.photoUrl) ? "1fr 72px" : "1fr",
          gap: 18,
          alignItems: "center",
          paddingBottom: 18,
          marginBottom: 20,
          borderBottom: `2px solid ${hexToRgba(accent, 0.22)}`,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: scale.headerName + 1,
              lineHeight: 1.05,
              fontWeight: 950,
              color: "#111827",
              letterSpacing: -0.9,
            }}
          >
            {safe(header.name) || "Your Name"}
          </h1>

          {safe(header.jobTitle) && (
            <div
              style={{
                marginTop: 6,
                color: accent,
                fontWeight: 850,
                fontSize: 13,
              }}
            >
              {header.jobTitle}
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <ContactLine header={header} />
          </div>
        </div>

        {showPhoto && safe(header.photoUrl) && (
          <img
            src={header.photoUrl}
            alt=""
            style={{
              width: 72,
              height: 72,
              objectFit: "cover",
              borderRadius: 999,
              border: `3px solid ${hexToRgba(accent, 0.18)}`,
            }}
          />
        )}
      </header>

      <main>
        {order.map((section) => (
          <React.Fragment key={section}>
            {renderSection(section, {
              data,
              accent,
              scale,
              variant,
              titleVariant: "line",
            })}
          </React.Fragment>
        ))}
      </main>
    </div>
  );
}

if (variant === "stacked") {
  return (
    <div style={pageStyle}>
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "16px 1fr",
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid #e5e7eb",
          marginBottom: 18,
          background: "#ffffff",
        }}
      >
        <div style={{ background: accent }} />

        <div
          style={{
            position: "relative",
            padding: 18,
            background: `linear-gradient(90deg, ${hexToRgba(
              accent,
              0.1
            )}, rgba(255,255,255,0))`,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                showPhoto && safe(header.photoUrl) ? "1fr 72px" : "1fr",
              gap: 18,
              alignItems: "center",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: scale.headerName,
                  lineHeight: 1.06,
                  fontWeight: 950,
                  color: "#111827",
                  letterSpacing: -0.8,
                }}
              >
                {safe(header.name) || "Your Name"}
              </h1>

              {safe(header.jobTitle) && (
                <div
                  style={{
                    marginTop: 6,
                    color: accent,
                    fontWeight: 850,
                    fontSize: 13,
                  }}
                >
                  {header.jobTitle}
                </div>
              )}

              <div style={{ marginTop: 8 }}>
                <ContactLine header={header} />
              </div>
            </div>

            {showPhoto && safe(header.photoUrl) && (
              <img
                src={header.photoUrl}
                alt=""
                style={{
                  width: 72,
                  height: 72,
                  objectFit: "cover",
                  borderRadius: 16,
                  border: `3px solid ${hexToRgba(accent, 0.2)}`,
                }}
              />
            )}
          </div>
        </div>
      </header>

      <main
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 13,
        }}
      >
        {order.map((section) => {
          const content = renderSection(section, {
            data,
            accent,
            scale,
            variant,
            titleVariant: "leftbar",
          });

          if (!content) return null;

          return (
            <div
              key={section}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: section === "skills" ? "#f8fafc" : "#ffffff",
                padding: 16,
              }}
            >
              {content}
            </div>
          );
        })}
      </main>
    </div>
  );
}
  if (variant === "sidebar") {
    return (
      <div style={pageStyle}>
        <HeaderClassic header={header} accent={accent} scale={scale} showPhoto={showPhoto} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 245px",
            gap: 26,
            alignItems: "start",
          }}
        >
          <main>
            {mainSections.map((section) => (
              <React.Fragment key={section}>
                {renderSection(section, { data, accent, scale, variant })}
              </React.Fragment>
            ))}
          </main>

          <aside
            style={{
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 16,
            }}
          >
            {sidebarSections.map((section) => (
              <React.Fragment key={section}>
                {renderSection(section, { data, accent, scale, variant })}
              </React.Fragment>
            ))}
          </aside>
        </div>
      </div>
    );
  }


  if (variant === "creative") {
    return (
      <div style={pageStyle}>
        <HeaderAccent header={header} accent={accent} scale={scale} showPhoto={showPhoto} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "250px 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <aside>
            {["skills", "languages", "certifications"].map((section) => (
              <React.Fragment key={section}>
                {renderSection(section, { data, accent, scale, variant })}
              </React.Fragment>
            ))}
          </aside>

          <main>
            {order
              .filter((section) => !["skills", "languages", "certifications"].includes(section))
              .map((section) => (
                <React.Fragment key={section}>
                  {renderSection(section, { data, accent, scale, variant })}
                </React.Fragment>
              ))}
          </main>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div style={pageStyle}>
        <HeaderClassic header={header} accent={accent} scale={scale} showPhoto={false} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <main>
            {["summary", "experience", "projects", "customSections"].map((section) => (
              <React.Fragment key={section}>
                {renderSection(section, { data, accent, scale, variant })}
              </React.Fragment>
            ))}
          </main>

          <aside>
            {["skills", "education", "certifications", "languages"].map((section) => (
              <React.Fragment key={section}>
                {renderSection(section, { data, accent, scale, variant })}
              </React.Fragment>
            ))}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <HeaderClassic header={header} accent={accent} scale={scale} showPhoto={showPhoto} />

      {order.map((section) => (
        <React.Fragment key={section}>
          {renderSection(section, { data, accent, scale, variant })}
        </React.Fragment>
      ))}
    </div>
  );
}
