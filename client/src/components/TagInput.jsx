import React, { useRef, useState } from "react";
import { useFormikContext, getIn } from "formik";

// normalize for de-duping
const norm = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();

export default function TagInput({
  name,                    // Formik array path, e.g. "skills"
  suggestions = [],        // optional list of strings to suggest
  placeholder = "Type a skill and press Enter",
  maxTags = 50,
}) {
  const { values, setFieldValue } = useFormikContext();
  const tags = getIn(values, name) || [];
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  const addTag = (raw) => {
    const val = (raw || "").trim();
    if (!val) return;
    if (tags.length >= maxTags) return;
    const exists = tags.some((t) => norm(t) === norm(val));
    if (exists) return;
    setFieldValue(name, [...tags, val]);
    setInput("");
  };

  const removeTag = (idx) => {
    const next = tags.filter((_, i) => i !== idx);
    setFieldValue(name, next);
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (["Enter", ","].includes(e.key)) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length) {
      // quick delete last tag
      removeTag(tags.length - 1);
    }
  };

  const pickSuggestion = (s) => addTag(s);

  const filteredSugs = suggestions
    .filter((s) => !tags.some((t) => norm(t) === norm(s)))
    .filter((s) => norm(s).includes(norm(input)))
    .slice(0, 8);

  return (
    <div>
      {/* chips */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: 6,
          border: "1px solid #ccc",
          borderRadius: 8,
          minHeight: 44,
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((t, i) => (
          <span
            key={`${t}-${i}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 16,
              background: "#eef5ff",
              border: "1px solid #cfe0ff",
              fontSize: 14,
            }}
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(i)}
              aria-label={`Remove ${t}`}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        ))}

        {/* text input */}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addTag(input)}     // add leftover text on blur
          placeholder={tags.length ? "" : placeholder}
          style={{
            flex: 1,
            minWidth: 160,
            border: "none",
            outline: "none",
            fontSize: 14,
            padding: 6,
          }}
        />
      </div>

      {/* quick suggestions */}
      {filteredSugs.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {filteredSugs.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => pickSuggestion(s)}
              style={{
                border: "1px solid #ddd",
                background: "#f8f8f8",
                padding: "4px 10px",
                borderRadius: 14,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
