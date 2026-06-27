// client/src/pages/Candidate/MockStartPage.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./mockPages.css";
import { mockInterviewStart } from "../../utils/mockInterviewApi";

const ROLE_SKILLS = {
  "Frontend Developer": [
    "HTML",
    "CSS",
    "JavaScript",
    "React",
    "Performance Optimization",
  ],
  "Backend Developer": [
    "Node.js",
    "Express",
    "REST API",
    "Databases",
    "Authentication",
  ],
  "Full Stack Developer": [
    "JavaScript",
    "React",
    "Node.js",
    "REST API",
    "Databases",
  ],
  "Mobile App Developer": [
    "React Native",
    "Android",
    "iOS",
    "APIs",
    "State Management",
  ],
  "Data Analyst": ["SQL", "Python", "Power BI", "Statistics", "Excel"],
};

const LEVELS = [
  "Junior (0–2 years)",
  "Mid-Level (2–5 years)",
  "Senior (5+ years)",
];

const TYPES = ["Technical", "HR / Behavioral", "Mixed", "System Design"];
const DIFFICULTIES = ["Easy", "Medium", "Hard", "Adaptive"];

function Panel({ title, children, className = "" }) {
  return (
    <section className={`mock-card ${className}`}>
      <div className="mock-cardBody">
        <h3 className="mock-sectionTitle">{title}</h3>
        {children}
      </div>
    </section>
  );
}

function RadioRow({ name, value, selected, onChange, label }) {
  return (
    <label className={`mock-optionRow ${selected ? "is-active" : ""}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
      />
      <span className="mock-optionMark" />
      <span>{label}</span>
    </label>
  );
}

function CheckRow({ checked, onChange, label }) {
  return (
    <label className={`mock-optionRow ${checked ? "is-active" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="mock-optionMark" />
      <span>{label}</span>
    </label>
  );
}

export default function MockStartPage() {
  const navigate = useNavigate();

  const [role, setRole] = useState("Frontend Developer");
  const [customRole, setCustomRole] = useState("");
  const [level, setLevel] = useState("Junior (0–2 years)");
  const [interviewType, setInterviewType] = useState("Technical");
  const [difficulty, setDifficulty] = useState("Medium");
  const [mode, setMode] = useState("text");
  const [skills, setSkills] = useState([]);
  const [starting, setStarting] = useState(false);

  const suggestedSkills = useMemo(() => {
    return role === "Custom" ? [] : ROLE_SKILLS[role] || [];
  }, [role]);

  const effectiveRole = role === "Custom" ? customRole.trim() : role;

  const toggleSkill = (skill) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((x) => x !== skill) : [...prev, skill]
    );
  };

  const selectAll = () => setSkills(suggestedSkills);
  const clearAll = () => setSkills([]);

  const canStart =
    !!effectiveRole &&
    !!level &&
    !!interviewType &&
    !!difficulty &&
    !!mode &&
    !starting;

  const onStart = async () => {
    if (!canStart) return;

    try {
      setStarting(true);

      const payload = {
        role: effectiveRole,
        level,
        interviewType,
        skills,
        difficulty,
        mode,
      };

      localStorage.setItem("mockLastStartPayload", JSON.stringify(payload));

      const res = await mockInterviewStart(payload);
      const sessionId = res.data?.sessionId;

      if (!sessionId) {
        alert("Failed to start mock interview session.");
        return;
      }

      navigate(`/candidate/mock-interview/session/${sessionId}`);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to start mock interview.");
    } finally {
      setStarting(false);
    }
  };

  const onViewAnalytics = () => {
    navigate("/candidate/mock-interview/analytics");
  };

  return (
    <div className="mock-page">
      <div className="mock-container">
        <div className="mock-hero">
          <div>
            <p className="mock-kicker">Mock Interview</p>
            <h1 className="mock-title">Practice with confidence</h1>
            <p className="mock-subtitle">
              Build a personalized mock interview based on your target role,
              experience level, interview type, and skills. Answer by text or
              voice and receive professional feedback for every response.
            </p>
          </div>
        </div>

        <div className="mock-grid">
          <Panel title="Target Job Role">
            <div className="mock-field">
              <label className="mock-label">Select Role</label>
              <select
                className="mock-input"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setSkills([]);
                }}
              >
                <option>Frontend Developer</option>
                <option>Backend Developer</option>
                <option>Full Stack Developer</option>
                <option>Mobile App Developer</option>
                <option>Data Analyst</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            {role === "Custom" && (
              <div className="mock-field">
                <label className="mock-label">Custom Role</label>
                <input
                  className="mock-input"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="e.g. QA Engineer"
                />
              </div>
            )}
          </Panel>

          <Panel title="Experience Level">
            <div className="mock-stack">
              {LEVELS.map((item) => (
                <RadioRow
                  key={item}
                  name="level"
                  value={item}
                  label={item}
                  selected={level === item}
                  onChange={setLevel}
                />
              ))}
            </div>
          </Panel>

          <Panel title="Interview Type">
            <div className="mock-stack">
              {TYPES.map((item) => (
                <RadioRow
                  key={item}
                  name="type"
                  value={item}
                  label={item}
                  selected={interviewType === item}
                  onChange={setInterviewType}
                />
              ))}
            </div>
          </Panel>

          <Panel title="Difficulty Level">
            <div className="mock-stack">
              {DIFFICULTIES.map((item) => (
                <RadioRow
                  key={item}
                  name="difficulty"
                  value={item}
                  label={item}
                  selected={difficulty === item}
                  onChange={setDifficulty}
                />
              ))}
            </div>
          </Panel>

          <Panel title="Skills Focus" className="mock-span-2">
            {suggestedSkills.length === 0 ? (
              <p className="mock-muted">
                Skill suggestions will appear automatically for predefined roles.
              </p>
            ) : (
              <>
                <div className="mock-toolbar">
                  <button
                    type="button"
                    className="mock-btnSecondary"
                    onClick={selectAll}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="mock-btnGhost"
                    onClick={clearAll}
                  >
                    Clear
                  </button>
                </div>

                <div className="mock-skillGrid">
                  {suggestedSkills.map((skill) => (
                    <CheckRow
                      key={skill}
                      label={skill}
                      checked={skills.includes(skill)}
                      onChange={() => toggleSkill(skill)}
                    />
                  ))}
                </div>
              </>
            )}
          </Panel>

          <Panel title="Interview Mode">
            <div className="mock-stack">
              <RadioRow
                name="mode"
                value="text"
                label="Text-Based"
                selected={mode === "text"}
                onChange={setMode}
              />
              <RadioRow
                name="mode"
                value="voice"
                label="Voice-Based"
                selected={mode === "voice"}
                onChange={setMode}
              />
              <RadioRow
  name="mode"
  value="video"
  label="Video-Based"
  selected={mode === "video"}
  onChange={setMode}
/>
            </div>
          </Panel>
        </div>

        <div className="mock-footerActions">
          <button
            type="button"
            className="mock-btnPrimary"
            disabled={!canStart}
            onClick={onStart}
          >
            {starting ? "Starting..." : "Start Mock Interview"}
          </button>

          <button
            type="button"
            className="mock-btnGhost"
            onClick={onViewAnalytics}
          >
            View Previous Session Analytics
          </button>
        </div>
      </div>
    </div>
  );
}
