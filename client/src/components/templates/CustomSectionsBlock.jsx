//client/src/components/templates/CustomSectionsBlock.jsx
import React from "react";

const safe = (s) => (s ? String(s).trim() : "");
const hasAny = (arr) => Array.isArray(arr) && arr.length > 0;

const splitBullets = (content) =>
  safe(content)
    .split(/\r?\n/)
    .map((x) => x.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

const hexToRgba = (hex, alpha = 0.12) => {
  const h = safe(hex).replace("#", "");
  if (![3, 6].includes(h.length)) return `rgba(0,0,0,${alpha})`;
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function CustomSectionsBlock({ customSections, themeColor, titleStyle }) {
  const sections = (customSections || []).filter(
    (s) => s && (safe(s.title) || safe(s.content) || hasAny(s.bullets))
  );

  if (!sections.length) return null;

  const accent = safe(themeColor) || "#2563eb"; // fallback: blue-600

  const styles = {
    wrapper: { marginTop: 14 },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    title: {
      ...(titleStyle || {}),
      display: "flex",
      alignItems: "center",
      gap: 10,
    },
    titleDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: accent,
      boxShadow: `0 0 0 4px ${hexToRgba(accent, 0.14)}`,
      flex: "0 0 auto",
    },

    card: {
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      background: "#ffffff",
      overflow: "hidden",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    },

    section: {
      padding: "12px 14px",
      position: "relative",
    },
    sectionDivider: {
      borderTop: "1px solid #f1f5f9",
    },

    accentBar: {
      position: "absolute",
      left: 0,
      top: 10,
      bottom: 10,
      width: 3,
      borderRadius: 999,
      background: accent,
      opacity: 0.9,
    },

    sectionTitle: {
      fontWeight: 800,
      color: "#111827",
      letterSpacing: 0.2,
      fontSize: 13.5,
      lineHeight: 1.25,
      paddingLeft: 10,
    },

    content: {
      marginTop: 8,
      color: "#374151",
      lineHeight: 1.65,
      whiteSpace: "pre-wrap",
      fontSize: 12.5,
      paddingLeft: 10,
    },

    ul: {
      marginTop: 8,
      marginBottom: 0,
      paddingLeft: 28,
      color: "#374151",
      lineHeight: 1.65,
      fontSize: 12.5,
      paddingRight: 2,
    },
    li: {
      margin: "4px 0",
    },

    mutedHint: {
      fontSize: 11,
      color: "#6b7280",
    },
  };

  return (
    <section style={styles.wrapper}>
      {/* Optional header label (uncomment if you want a section label) */}
      {/*
      <div style={styles.header}>
        <div style={styles.title}>
          <span style={styles.titleDot} />
          <span style={titleStyle}>Additional</span>
        </div>
      </div>
      */}

      <div style={styles.card}>
        {sections.map((s, i) => {
          const bullets = hasAny(s.bullets) ? s.bullets.filter(Boolean) : splitBullets(s.content);
          const asBullets = bullets.length > 1;

          return (
            <div
              key={i}
              style={{
                ...styles.section,
                ...(i === 0 ? null : styles.sectionDivider),
              }}
            >
              <span style={styles.accentBar} aria-hidden="true" />
              <div style={styles.sectionTitle}>{safe(s.title) || "Custom Section"}</div>

              {asBullets ? (
                <ul style={styles.ul}>
                  {bullets.slice(0, 8).map((b, idx) => (
                    <li key={idx} style={styles.li}>
                      {b}
                    </li>
                  ))}
                </ul>
              ) : safe(s.content) ? (
                <div style={styles.content}>{s.content}</div>
              ) : (
                <div style={{ ...styles.content, ...styles.mutedHint }}>No details provided.</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
