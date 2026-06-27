// client/src/pages/Candidate/ResumeBuilder.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchResumeFromDB, saveResumeToDB } from "../../utils/resumeApi";
import html2pdf from "html2pdf.js";
import ModernTemplate from "../../components/templates/ModernTemplate";
import ModernTemplateV2 from "../../components/templates/ModernTemplateV2";
import ModernTemplateV3 from "../../components/templates/ModernTemplateV3";
import ModernTemplateV4 from "../../components/templates/ModernTemplateV4";
import ModernTemplateV5 from "../../components/templates/ModernTemplateV5";
import ModernTemplateV6 from "../../components/templates/ModernTemplateV6";
import ModernTemplateV7 from "../../components/templates/ModernTemplateV7";
import ModernTemplateV8 from "../../components/templates/ModernTemplateV8";
import ModernTemplateV9 from "../../components/templates/ModernTemplateV9";
import ModernTemplateV10 from "../../components/templates/ModernTemplateV10";
import "./ResumeBuilder.css";

const emptyResume = {
  templateId: "modern",
  themeColor: "#2563eb",
  fontFamily: "Inter",
  spacing: "normal",
  sectionOrder: [
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "languages",
    "customSections",
  ],
  personalDetails: {
    fullName: "",
    jobTitle: "",
    email: "",
    phone: "",
    address: "",
    photoUrl: "",
  },
  summary: "",
  experience: [],
  education: [],
  skills: [],
  skillItems: [],
  projects: [],
  certifications: [],
  languages: [],
  customSections: [],
};

const templates = [
  {
    id: "modern",
    name: "Modern Classic",
    description: "Clean ATS-friendly single-column design",
  },
  {
    id: "modern-v2",
    name: "Sidebar Pro",
    description: "Professional layout with right sidebar",
  },
  {
    id: "modern-v3",
    name: "Compact Split",
    description: "Balanced two-column compact resume",
  },
  {
    id: "modern-v4",
    name: "Creative Accent",
    description: "Premium accent header with modern layout",
  },
  {
    id: "modern-v5",
    name: "Minimal Executive",
    description: "Simple FlowCV-style resume with elegant spacing",
  },
  {
    id: "modern-v6",
    name: "Stacked Cards",
    description: "Section-card layout with strong visual separation",
  },
  {
    id: "modern-v7",
    name: "Skills Strip",
    description: "Strong skill badges below the profile header",
  },
  {
    id: "modern-v8",
    name: "Three Column",
    description: "Structured layout for rich professional profiles",
  },
  {
    id: "modern-v9",
    name: "Corporate Band",
    description: "Formal resume with a refined corporate header",
  },
  {
    id: "modern-v10",
    name: "Timeline Rails",
    description: "Timeline-focused resume with side information rails",
  },
];

const colors = [
  "#2563eb", // blue
  "#111827", // charcoal
  "#16a34a", // green
  "#7c3aed", // purple
  "#dc2626", // red
  "#ea580c", // orange
  "#0f766e", // teal

  "#0ea5e9", // sky
  "#0284c7", // deep sky
  "#0891b2", // cyan
  "#059669", // emerald
  "#65a30d", // lime
  "#ca8a04", // amber
  "#c2410c", // burnt orange
  "#be123c", // rose
  "#db2777", // pink
  "#9333ea", // violet
  "#4f46e5", // indigo
  "#334155", // slate
  "#525252", // neutral
];

const fonts = ["Inter", "Arial", "Georgia", "Times New Roman"];

function safe(value) {
  return value ? String(value).trim() : "";
}

function dateRange(fromMonth, fromYear, toMonth, toYear, isCurrent) {
  const from = [safe(fromMonth), safe(fromYear)].filter(Boolean).join(" ");
  const to = isCurrent
    ? "Present"
    : [safe(toMonth), safe(toYear)].filter(Boolean).join(" ");

  if (from && to) return `${from} – ${to}`;
  if (from) return from;
  if (to) return to;
  return "";
}

function splitBullets(text) {
  return safe(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function normalizeResume(serverResume) {
  if (!serverResume) return emptyResume;

  return {
    ...emptyResume,
    ...serverResume,
    personalDetails: {
      ...emptyResume.personalDetails,
      ...(serverResume.personalDetails || {}),
    },
    sectionOrder:
      Array.isArray(serverResume.sectionOrder) &&
      serverResume.sectionOrder.length
        ? serverResume.sectionOrder
        : emptyResume.sectionOrder,
    experience: Array.isArray(serverResume.experience)
      ? serverResume.experience
      : [],
    education: Array.isArray(serverResume.education)
      ? serverResume.education
      : [],
    projects: Array.isArray(serverResume.projects) ? serverResume.projects : [],
    certifications: Array.isArray(serverResume.certifications)
      ? serverResume.certifications
      : [],
    languages: Array.isArray(serverResume.languages)
      ? serverResume.languages
      : [],
    skills: Array.isArray(serverResume.skills) ? serverResume.skills : [],
    skillItems: Array.isArray(serverResume.skillItems)
      ? serverResume.skillItems
      : Array.isArray(serverResume.skills)
        ? serverResume.skills.map((s) => ({ name: s, level: "Good" }))
        : [],
    customSections: Array.isArray(serverResume.customSections)
      ? serverResume.customSections
      : [],
  };
}

function createViewModel(resume) {
  const personal = resume.personalDetails || {};

  return {
    templateId: resume.templateId,
    themeColor: resume.themeColor,
    fontFamily: resume.fontFamily,
    spacing: resume.spacing,
    sectionOrder: resume.sectionOrder,

    header: {
      name: safe(personal.fullName),
      jobTitle: safe(personal.jobTitle),
      email: safe(personal.email),
      phone: safe(personal.phone),
      address: safe(personal.address),
      photoUrl: safe(personal.photoUrl),
    },

    summary: safe(resume.summary),

    experience: (resume.experience || []).map((item) => ({
      role: safe(item.jobTitle),
      company: safe(item.company),
      dateRange: dateRange(
        item.fromMonth,
        item.fromYear,
        item.toMonth,
        item.toYear,
        item.currentlyWorking,
      ),
      bullets: splitBullets(item.description),
    })),

    education: (resume.education || []).map((item) => ({
      degree: [safe(item.level), safe(item.field)].filter(Boolean).join(" - "),
      institution: safe(item.institution),
      dateRange: dateRange(
        "",
        item.fromYear,
        "",
        item.toYear,
        item.currentlyEnrolled,
      ),
      grade: safe(item.grade),
    })),

    skills: (resume.skillItems || [])
      .map((skill) => safe(skill.name))
      .filter(Boolean),

    skillItems: (resume.skillItems || []).filter((skill) => safe(skill.name)),

    projects: (resume.projects || []).map((item) => ({
      name: safe(item.name),
      description: safe(item.description),
      link: safe(item.link),
      tech: Array.isArray(item.technologies) ? item.technologies : [],
    })),

    certifications: (resume.certifications || []).map((item) => ({
      name: safe(item.name),
      issuer: safe(item.issuedBy),
      date: safe(item.date),
    })),

    languages: (resume.languages || []).map((item) => ({
      name: safe(item.language),
      level: safe(item.level),
    })),

    customSections: (resume.customSections || []).map((item) => ({
      title: safe(item.title),
      content: safe(item.content),
      bullets: splitBullets(item.content),
    })),
  };
}

function SectionCard({ title, children, actions }) {
  return (
    <div className="rb-card">
      <div className="rb-card-head">
        <h3>{title}</h3>
        <div>{actions}</div>
      </div>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="rb-field">
      <span>{label}</span>
      <input
        type={type}
        value={value || ""}
        placeholder={placeholder || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <label className="rb-field rb-field-full">
      <span>{label}</span>
      <textarea
        value={value || ""}
        rows={rows}
        placeholder={placeholder || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

const placeholderPreviewData = {
  header: {
    name: "Your Name",
    jobTitle: "Your Professional Title",
    email: "your.email@example.com",
    phone: "+92 300 0000000",
    address: "Your City, Country",
    photoUrl: "",
  },

  summary:
    "Write a short professional summary here. Highlight your skills, experience, achievements, and career goals in 3 to 4 lines.",

  experience: [
    {
      role: "Your Job Title",
      company: "Company Name",
      dateRange: "Start Date – Present",
      bullets: [
        "Describe your main responsibility or achievement here.",
        "Add another strong bullet point showing your skills or impact.",
      ],
    },
    {
      role: "Previous Job Title",
      company: "Previous Company",
      dateRange: "Start Date – End Date",
      bullets: ["Write a short achievement or responsibility here."],
    },
  ],

  education: [
    {
      degree: "Your Degree / Program",
      institution: "Institute / University Name",
      dateRange: "Start Year – End Year",
      grade: "Grade / CGPA",
    },
  ],

  skills: ["Skill One", "Skill Two", "Skill Three", "Skill Four", "Skill Five"],

  skillItems: [
    { name: "Skill One", level: "Expert" },
    { name: "Skill Two", level: "Advanced" },
    { name: "Skill Three", level: "Good" },
    { name: "Skill Four", level: "Good" },
  ],

  projects: [
    {
      name: "Project Name",
      description:
        "Briefly describe your project, the problem it solved, and your contribution.",
      link: "project-link.com",
      tech: ["Technology One", "Technology Two"],
    },
  ],

  certifications: [
    {
      name: "Certification Name",
      issuer: "Issued By",
      date: "Year",
    },
  ],

  languages: [
    {
      name: "Language Name",
      level: "Fluent",
    },
  ],

  customSections: [
    {
      title: "Additional Section",
      content: "Add awards, interests, volunteering, or other details here.",
      bullets: ["Additional point one", "Additional point two"],
    },
  ],

  fontFamily: "Inter",
  spacing: "normal",
  sectionOrder: [
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "languages",
    "customSections",
  ],
};

function ResumePreview({ viewModel, templateId, themeColor, forPdf = false }) {
  const Template =
    templateId === "modern-v2"
      ? ModernTemplateV2
      : templateId === "modern-v3"
        ? ModernTemplateV3
        : templateId === "modern-v4"
          ? ModernTemplateV4
          : templateId === "modern-v5"
            ? ModernTemplateV5
            : templateId === "modern-v6"
              ? ModernTemplateV6
              : templateId === "modern-v7"
                ? ModernTemplateV7
                : templateId === "modern-v8"
                  ? ModernTemplateV8
                  : templateId === "modern-v9"
                    ? ModernTemplateV9
                    : templateId === "modern-v10"
                      ? ModernTemplateV10
                      : ModernTemplate;

  return (
    <div className={forPdf ? "rb-pdf-paper" : "rb-preview-paper"}>
      <Template data={viewModel} themeColor={themeColor} />
    </div>
  );
}

const getPdfFileName = (resume) =>
  `${safe(resume?.personalDetails?.fullName) || "resume"}.pdf`;

const getPdfOptions = (fileName) => ({
  margin: 0,
  filename: fileName,
  image: {
    type: "jpeg",
    quality: 0.98,
  },
  html2canvas: {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    letterRendering: true,
    scrollX: 0,
    scrollY: 0,
    width: 794,
    height: 1123,
    windowWidth: 794,
    windowHeight: 1123,
  },
  jsPDF: {
    unit: "px",
    format: [794, 1123],
    orientation: "portrait",
    hotfixes: ["px_scaling"],
  },
  pagebreak: {
    mode: ["css"],
  },
});

// const blobToBase64 = (blob) =>
//   new Promise((resolve, reject) => {
//     const reader = new FileReader();

//     reader.onloadend = () => {
//       const result = String(reader.result || "");
//       resolve(result.split(",")[1] || "");
//     };

//     reader.onerror = reject;
//     reader.readAsDataURL(blob);
//   });

// const generatePdfBase64FromElement = async (element, fileName) => {
//   if (!element) return null;

//   const options = getPdfOptions(fileName);

//   const pdfBlob = await html2pdf()
//     .set(options)
//     .from(element)
//     .outputPdf("blob");

//   return blobToBase64(pdfBlob);
// };

const generatePdfBlobFromElement = async (element, fileName) => {
  if (!element) return null;

  const options = getPdfOptions(fileName);

  return html2pdf().set(options).from(element).outputPdf("blob");
};

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };

    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function ResumeBuilder() {
  const navigate = useNavigate();

  const pdfRef = useRef(null);

  const [resume, setResume] = useState(emptyResume);
  const [activeStep, setActiveStep] = useState("templates");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [previewScale, setPreviewScale] = useState(0.6);
  const [cvSaved, setCvSaved] = useState(false);

  const viewModel = useMemo(() => createViewModel(resume), [resume]);
  const rightSidePreviewModel = useMemo(() => {
    if (activeStep === "templates") {
      return {
        ...placeholderPreviewData,
        templateId: resume.templateId,
        themeColor: resume.themeColor,
        fontFamily: resume.fontFamily,
        spacing: resume.spacing,
      };
    }

    return viewModel;
  }, [
    activeStep,
    resume.templateId,
    resume.themeColor,
    resume.fontFamily,
    resume.spacing,
    viewModel,
  ]);

  useEffect(() => {
    const loadSavedResume = async () => {
      try {
        const res = await fetchResumeFromDB();
        if (res?.data) {
          setResume(normalizeResume(res.data));
        }
      } catch {
        setResume(emptyResume);
      }
    };

    loadSavedResume();
  }, []);

  const updateResume = (path, value) => {
    setCvSaved(false);

    setResume((prev) => {
      const copy = structuredClone(prev);
      const keys = path.split(".");
      let ref = copy;

      for (let i = 0; i < keys.length - 1; i++) {
        ref = ref[keys[i]];
      }

      ref[keys[keys.length - 1]] = value;
      return copy;
    });
  };

  const addItem = (key, item) => {
    setCvSaved(false);

    setResume((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), item],
    }));
  };

  const updateItem = (key, index, field, value) => {
    setCvSaved(false);

    setResume((prev) => {
      const list = [...(prev[key] || [])];
      list[index] = { ...list[index], [field]: value };

      if (key === "skillItems") {
        return {
          ...prev,
          skillItems: list,
          skills: list.map((x) => x.name).filter(Boolean),
        };
      }

      return { ...prev, [key]: list };
    });
  };

  const removeItem = (key, index) => {
    setCvSaved(false);

    setResume((prev) => {
      const list = [...(prev[key] || [])];
      list.splice(index, 1);

      if (key === "skillItems") {
        return {
          ...prev,
          skillItems: list,
          skills: list.map((x) => x.name).filter(Boolean),
        };
      }

      return { ...prev, [key]: list };
    });
  };

  const moveItem = (key, index, direction) => {
    setCvSaved(false);

    setResume((prev) => {
      const list = [...(prev[key] || [])];
      const target = direction === "up" ? index - 1 : index + 1;

      if (target < 0 || target >= list.length) return prev;

      [list[index], list[target]] = [list[target], list[index]];
      return { ...prev, [key]: list };
    });
  };

  const moveSection = (section, direction) => {
    setCvSaved(false);

    setResume((prev) => {
      const order = [...prev.sectionOrder];
      const index = order.indexOf(section);
      const target = direction === "up" ? index - 1 : index + 1;

      if (index === -1 || target < 0 || target >= order.length) return prev;

      [order[index], order[target]] = [order[target], order[index]];
      return { ...prev, sectionOrder: order };
    });
  };

  const saveCurrentResumePdf = async () => {
    const fileName = getPdfFileName(resume);
    const element = pdfRef.current;

    if (!element) {
      throw new Error("PDF preview not ready.");
    }

    const pdfBlob = await generatePdfBlobFromElement(element, fileName);

    if (!pdfBlob) {
      throw new Error("Could not generate PDF.");
    }

    const pdfBase64 = await blobToBase64(pdfBlob);

    const payload = {
      ...resume,
      skills: (resume.skillItems || []).map((x) => x.name).filter(Boolean),
      viewModel,
      pdfBase64,
      pdfFileName: fileName,
    };

    await saveResumeToDB(payload);

    setCvSaved(true);

    return {
      pdfBlob,
      fileName,
    };
  };

  // const handleSave = async () => {
  //   try {
  //     setSaving(true);
  //     setMessage("");

  //     const fileName = getPdfFileName(resume);
  //     const element = pdfRef.current;

  //     let pdfBase64 = null;

  //     if (element) {
  //       pdfBase64 = await generatePdfBase64FromElement(element, fileName);
  //     }

  //     const payload = {
  //       ...resume,
  //       skills: (resume.skillItems || []).map((x) => x.name).filter(Boolean),
  //       viewModel,
  //       pdfBase64,
  //       pdfFileName: fileName,
  //     };

  //     await saveResumeToDB(payload);
  //     setCvSaved(true);

  //     setMessage("✅ Resume saved successfully. You can now download the PDF.");
  //   } catch (err) {
  //     console.error(err);
  //     setMessage("❌ Failed to save resume.");
  //   } finally {
  //     setSaving(false);
  //   }
  // };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage("");

      await saveCurrentResumePdf();

      setMessage("✅ Resume saved successfully. You can now download the PDF.");
    } catch (err) {
      console.error(err);
      setMessage(err?.message || "❌ Failed to save resume.");
    } finally {
      setSaving(false);
    }
  };

  // const handleDownload = async () => {
  //   if (!cvSaved) {
  //     setMessage("⚠️ Please save your CV first, then download the PDF.");
  //     return;
  //   }

  //   try {
  //     setSaving(true);
  //     setMessage("⏳ Preparing PDF...");

  //     const element = pdfRef.current;

  //     if (!element) {
  //       setMessage("❌ PDF preview not ready.");
  //       return;
  //     }

  //     const fileName = getPdfFileName(resume);

  //     const pdfBase64 = await generatePdfBase64FromElement(element, fileName);

  //     const payload = {
  //       ...resume,
  //       skills: (resume.skillItems || []).map((x) => x.name).filter(Boolean),
  //       viewModel,
  //       pdfBase64,
  //       pdfFileName: fileName,
  //     };

  //     await saveResumeToDB(payload);

  //     await html2pdf().set(getPdfOptions(fileName)).from(element).save();

  //     setMessage("✅ Resume saved and PDF downloaded.");
  //   } catch (err) {
  //     console.error("PDF download failed:", err);
  //     setMessage("❌ Failed to download PDF.");
  //   } finally {
  //     setSaving(false);
  //   }
  // };


  const handleDownload = async () => {
  try {
    setSaving(true);
    setMessage("⏳ Preparing PDF...");

    const { pdfBlob, fileName } = await saveCurrentResumePdf();

    downloadBlob(pdfBlob, fileName);

    setMessage("✅ Resume saved and PDF downloaded.");
  } catch (err) {
    console.error("PDF download failed:", err);
    setMessage(err?.message || "❌ Failed to download PDF.");
  } finally {
    setSaving(false);
  }
};

  const steps = [
    ["templates", "Choose Template"],
    ["personal", "Personal Info"],
    ["summary", "Summary"],
    ["experience", "Experience"],
    ["education", "Education"],
    ["skills", "Skills"],
    ["additional", "Additional"],
    ["customize", "Customize"],
    ["review", "Review"],
  ];

  const currentStepIndex = steps.findIndex(([id]) => id === activeStep);
  const isLastStep = currentStepIndex === steps.length - 1;

  const goNextStep = () => {
    if (isLastStep) return;
    setActiveStep(steps[currentStepIndex + 1][0]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goPreviousStep = () => {
    if (currentStepIndex <= 0) return;
    setActiveStep(steps[currentStepIndex - 1][0]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // const canDownloadPdf = cvSaved && !saving;
  const canDownloadPdf = !saving;

  return (
    <div className="rb-page">
      <div className="rb-topbar">
        <div>
          <p className="rb-eyebrow">Resume Builder</p>
          <h1>Build your professional CV</h1>
          <p className="rb-subtitle">
            Create, preview, customize, save, and download your CV in one place.
          </p>
        </div>

        <div className="rb-top-actions">
          <button
            className="rb-secondary-btn"
            type="button"
            onClick={() => navigate("/candidate/manage-cv")}
          >
            Manage CVs
          </button>
          <button
            className="rb-secondary-btn"
            type="button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            className="rb-primary-btn"
            type="button"
            onClick={handleDownload}
            disabled={!canDownloadPdf}
            aria-disabled={!canDownloadPdf}
            title={!cvSaved ? "Please save your CV first" : "Download PDF"}
          >
            Download PDF
          </button>
        </div>
      </div>

      {message && <div className="rb-alert">{message}</div>}

      <div className="rb-layout">
        <aside className="rb-sidebar">
          {steps.map(([id, label], index) => (
            <button
              key={id}
              className={`rb-step ${activeStep === id ? "active" : ""}`}
              onClick={() => setActiveStep(id)}
              type="button"
            >
              <span>{index + 1}</span>
              {label}
            </button>
          ))}
        </aside>

        <main className="rb-editor">
          {activeStep === "templates" && (
            <SectionCard title="Choose Template">
              <div className="rb-template-grid">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className={`rb-template-card ${
                      resume.templateId === tpl.id ? "selected" : ""
                    }`}
                    onClick={() => updateResume("templateId", tpl.id)}
                  >
                    <div className="rb-template-real-preview">
                      <div className="rb-template-real-scale">
                        <ResumePreview
                          viewModel={{
                            ...placeholderPreviewData,
                            templateId: tpl.id,
                            themeColor: resume.themeColor,
                            fontFamily: resume.fontFamily,
                            spacing: resume.spacing,
                          }}
                          templateId={tpl.id}
                          themeColor={resume.themeColor}
                          forPdf={true}
                        />
                      </div>
                    </div>

                    <div className="rb-template-info">
                      <strong>{tpl.name}</strong>
                      <small>{tpl.description}</small>
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {activeStep === "personal" && (
            <SectionCard title="Personal Information">
              <div className="rb-grid">
                <TextInput
                  label="Full Name"
                  value={resume.personalDetails.fullName}
                  onChange={(v) => updateResume("personalDetails.fullName", v)}
                  placeholder="Hamza Iqbal"
                />
                <TextInput
                  label="Job Title"
                  value={resume.personalDetails.jobTitle}
                  onChange={(v) => updateResume("personalDetails.jobTitle", v)}
                  placeholder="Full Stack Developer"
                />
                <TextInput
                  label="Email"
                  value={resume.personalDetails.email}
                  onChange={(v) => updateResume("personalDetails.email", v)}
                  placeholder="email@example.com"
                />
                <TextInput
                  label="Phone"
                  value={resume.personalDetails.phone}
                  onChange={(v) => updateResume("personalDetails.phone", v)}
                  placeholder="+92 300 0000000"
                />
                <TextInput
                  label="Location"
                  value={resume.personalDetails.address}
                  onChange={(v) => updateResume("personalDetails.address", v)}
                  placeholder="Lahore, Pakistan"
                />
                <TextInput
                  label="Profile Photo URL optional"
                  value={resume.personalDetails.photoUrl}
                  onChange={(v) => updateResume("personalDetails.photoUrl", v)}
                  placeholder="https://..."
                />
              </div>
            </SectionCard>
          )}

          {activeStep === "summary" && (
            <SectionCard title="Professional Summary">
              <TextArea
                label="Summary"
                value={resume.summary}
                onChange={(v) => updateResume("summary", v)}
                rows={7}
                placeholder="Write a short profile focused on your skills, experience, achievements, and career goals."
              />
            </SectionCard>
          )}

          {activeStep === "experience" && (
            <SectionCard
              title="Work Experience"
              actions={
                <button
                  className="rb-mini-btn"
                  type="button"
                  onClick={() =>
                    addItem("experience", {
                      jobTitle: "",
                      company: "",
                      fromMonth: "",
                      fromYear: "",
                      toMonth: "",
                      toYear: "",
                      currentlyWorking: false,
                      description: "",
                    })
                  }
                >
                  + Add Experience
                </button>
              }
            >
              {(resume.experience || []).map((item, index) => (
                <div className="rb-repeat-card" key={index}>
                  <div className="rb-repeat-actions">
                    <button onClick={() => moveItem("experience", index, "up")}>
                      ↑
                    </button>
                    <button
                      onClick={() => moveItem("experience", index, "down")}
                    >
                      ↓
                    </button>
                    <button onClick={() => removeItem("experience", index)}>
                      Delete
                    </button>
                  </div>

                  <div className="rb-grid">
                    <TextInput
                      label="Job Title"
                      value={item.jobTitle}
                      onChange={(v) =>
                        updateItem("experience", index, "jobTitle", v)
                      }
                    />
                    <TextInput
                      label="Company"
                      value={item.company}
                      onChange={(v) =>
                        updateItem("experience", index, "company", v)
                      }
                    />
                    <TextInput
                      label="From Month"
                      value={item.fromMonth}
                      onChange={(v) =>
                        updateItem("experience", index, "fromMonth", v)
                      }
                      placeholder="Jan"
                    />
                    <TextInput
                      label="From Year"
                      value={item.fromYear}
                      onChange={(v) =>
                        updateItem("experience", index, "fromYear", v)
                      }
                      placeholder="2022"
                    />
                    <TextInput
                      label="To Month"
                      value={item.toMonth}
                      onChange={(v) =>
                        updateItem("experience", index, "toMonth", v)
                      }
                      placeholder="Dec"
                    />
                    <TextInput
                      label="To Year"
                      value={item.toYear}
                      onChange={(v) =>
                        updateItem("experience", index, "toYear", v)
                      }
                      placeholder="2024"
                    />
                  </div>

                  <label className="rb-check">
                    <input
                      type="checkbox"
                      checked={!!item.currentlyWorking}
                      onChange={(e) =>
                        updateItem(
                          "experience",
                          index,
                          "currentlyWorking",
                          e.target.checked,
                        )
                      }
                    />
                    I currently work here
                  </label>

                  <TextArea
                    label="Description / Bullet Points"
                    value={item.description}
                    onChange={(v) =>
                      updateItem("experience", index, "description", v)
                    }
                    placeholder={`Built responsive React interfaces\nDeveloped REST APIs\nImproved dashboard performance`}
                    rows={6}
                  />
                </div>
              ))}

              {!resume.experience.length && (
                <p className="rb-empty">No experience added yet.</p>
              )}
            </SectionCard>
          )}

          {activeStep === "education" && (
            <SectionCard
              title="Education"
              actions={
                <button
                  className="rb-mini-btn"
                  type="button"
                  onClick={() =>
                    addItem("education", {
                      level: "",
                      field: "",
                      institution: "",
                      fromYear: "",
                      toYear: "",
                      currentlyEnrolled: false,
                      grade: "",
                    })
                  }
                >
                  + Add Education
                </button>
              }
            >
              {(resume.education || []).map((item, index) => (
                <div className="rb-repeat-card" key={index}>
                  <div className="rb-repeat-actions">
                    <button onClick={() => moveItem("education", index, "up")}>
                      ↑
                    </button>
                    <button
                      onClick={() => moveItem("education", index, "down")}
                    >
                      ↓
                    </button>
                    <button onClick={() => removeItem("education", index)}>
                      Delete
                    </button>
                  </div>

                  <div className="rb-grid">
                    <TextInput
                      label="Degree / Level"
                      value={item.level}
                      onChange={(v) =>
                        updateItem("education", index, "level", v)
                      }
                      placeholder="BS"
                    />
                    <TextInput
                      label="Field"
                      value={item.field}
                      onChange={(v) =>
                        updateItem("education", index, "field", v)
                      }
                      placeholder="Computer Science"
                    />
                    <TextInput
                      label="Institution"
                      value={item.institution}
                      onChange={(v) =>
                        updateItem("education", index, "institution", v)
                      }
                    />
                    <TextInput
                      label="From Year"
                      value={item.fromYear}
                      onChange={(v) =>
                        updateItem("education", index, "fromYear", v)
                      }
                    />
                    <TextInput
                      label="To Year"
                      value={item.toYear}
                      onChange={(v) =>
                        updateItem("education", index, "toYear", v)
                      }
                    />
                    <TextInput
                      label="Grade optional"
                      value={item.grade}
                      onChange={(v) =>
                        updateItem("education", index, "grade", v)
                      }
                    />
                  </div>

                  <label className="rb-check">
                    <input
                      type="checkbox"
                      checked={!!item.currentlyEnrolled}
                      onChange={(e) =>
                        updateItem(
                          "education",
                          index,
                          "currentlyEnrolled",
                          e.target.checked,
                        )
                      }
                    />
                    I am currently enrolled
                  </label>
                </div>
              ))}

              {!resume.education.length && (
                <p className="rb-empty">No education added yet.</p>
              )}
            </SectionCard>
          )}

          {activeStep === "skills" && (
            <SectionCard
              title="Skills"
              actions={
                <button
                  className="rb-mini-btn"
                  type="button"
                  onClick={() =>
                    addItem("skillItems", {
                      name: "",
                      level: "Good",
                    })
                  }
                >
                  + Add Skill
                </button>
              }
            >
              {(resume.skillItems || []).map((item, index) => (
                <div className="rb-skill-row" key={index}>
                  <input
                    value={item.name || ""}
                    placeholder="React.js"
                    onChange={(e) =>
                      updateItem("skillItems", index, "name", e.target.value)
                    }
                  />
                  <select
                    value={item.level || "Good"}
                    onChange={(e) =>
                      updateItem("skillItems", index, "level", e.target.value)
                    }
                  >
                    <option>Beginner</option>
                    <option>Good</option>
                    <option>Advanced</option>
                    <option>Expert</option>
                  </select>
                  <button onClick={() => removeItem("skillItems", index)}>
                    Delete
                  </button>
                </div>
              ))}

              {!resume.skillItems.length && (
                <p className="rb-empty">No skills added yet.</p>
              )}
            </SectionCard>
          )}

          {activeStep === "additional" && (
            <>
              <SectionCard
                title="Projects"
                actions={
                  <button
                    className="rb-mini-btn"
                    type="button"
                    onClick={() =>
                      addItem("projects", {
                        name: "",
                        description: "",
                        link: "",
                        technologies: [],
                      })
                    }
                  >
                    + Add Project
                  </button>
                }
              >
                {(resume.projects || []).map((item, index) => (
                  <div className="rb-repeat-card" key={index}>
                    <div className="rb-repeat-actions">
                      <button onClick={() => removeItem("projects", index)}>
                        Delete
                      </button>
                    </div>

                    <div className="rb-grid">
                      <TextInput
                        label="Project Name"
                        value={item.name}
                        onChange={(v) =>
                          updateItem("projects", index, "name", v)
                        }
                      />
                      <TextInput
                        label="Project Link"
                        value={item.link}
                        onChange={(v) =>
                          updateItem("projects", index, "link", v)
                        }
                      />
                    </div>

                    <TextArea
                      label="Description"
                      value={item.description}
                      onChange={(v) =>
                        updateItem("projects", index, "description", v)
                      }
                    />

                    <TextInput
                      label="Technologies comma separated"
                      value={(item.technologies || []).join(", ")}
                      onChange={(v) =>
                        updateItem(
                          "projects",
                          index,
                          "technologies",
                          v
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean),
                        )
                      }
                    />
                  </div>
                ))}
              </SectionCard>

              <SectionCard
                title="Certifications"
                actions={
                  <button
                    className="rb-mini-btn"
                    type="button"
                    onClick={() =>
                      addItem("certifications", {
                        name: "",
                        issuedBy: "",
                        date: "",
                      })
                    }
                  >
                    + Add Certification
                  </button>
                }
              >
                {(resume.certifications || []).map((item, index) => (
                  <div className="rb-skill-row" key={index}>
                    <input
                      value={item.name || ""}
                      placeholder="Certification name"
                      onChange={(e) =>
                        updateItem(
                          "certifications",
                          index,
                          "name",
                          e.target.value,
                        )
                      }
                    />
                    <input
                      value={item.issuedBy || ""}
                      placeholder="Issued by"
                      onChange={(e) =>
                        updateItem(
                          "certifications",
                          index,
                          "issuedBy",
                          e.target.value,
                        )
                      }
                    />
                    <input
                      value={item.date || ""}
                      placeholder="2024"
                      onChange={(e) =>
                        updateItem(
                          "certifications",
                          index,
                          "date",
                          e.target.value,
                        )
                      }
                    />
                    <button onClick={() => removeItem("certifications", index)}>
                      Delete
                    </button>
                  </div>
                ))}
              </SectionCard>

              <SectionCard
                title="Languages"
                actions={
                  <button
                    className="rb-mini-btn"
                    type="button"
                    onClick={() =>
                      addItem("languages", {
                        language: "",
                        level: "",
                      })
                    }
                  >
                    + Add Language
                  </button>
                }
              >
                {(resume.languages || []).map((item, index) => (
                  <div className="rb-skill-row" key={index}>
                    <input
                      value={item.language || ""}
                      placeholder="English"
                      onChange={(e) =>
                        updateItem(
                          "languages",
                          index,
                          "language",
                          e.target.value,
                        )
                      }
                    />
                    <select
                      value={item.level || ""}
                      onChange={(e) =>
                        updateItem("languages", index, "level", e.target.value)
                      }
                    >
                      <option value="">Select Level</option>
                      <option>Basic</option>
                      <option>Intermediate</option>
                      <option>Fluent</option>
                      <option>Native</option>
                    </select>
                    <button onClick={() => removeItem("languages", index)}>
                      Delete
                    </button>
                  </div>
                ))}
              </SectionCard>

              <SectionCard
                title="Custom Sections"
                actions={
                  <button
                    className="rb-mini-btn"
                    type="button"
                    onClick={() =>
                      addItem("customSections", {
                        title: "",
                        content: "",
                      })
                    }
                  >
                    + Add Section
                  </button>
                }
              >
                {(resume.customSections || []).map((item, index) => (
                  <div className="rb-repeat-card" key={index}>
                    <div className="rb-repeat-actions">
                      <button
                        onClick={() => removeItem("customSections", index)}
                      >
                        Delete
                      </button>
                    </div>

                    <TextInput
                      label="Section Title"
                      value={item.title}
                      onChange={(v) =>
                        updateItem("customSections", index, "title", v)
                      }
                      placeholder="Awards / Interests / References"
                    />

                    <TextArea
                      label="Content"
                      value={item.content}
                      onChange={(v) =>
                        updateItem("customSections", index, "content", v)
                      }
                      rows={5}
                    />
                  </div>
                ))}
              </SectionCard>
            </>
          )}

          {activeStep === "customize" && (
            <>
              <SectionCard title="Customize Design">
                <div className="rb-customize-panel">
                  <div className="rb-customize-group rb-customize-group-wide">
                    <div className="rb-customize-group-head">
                      <div>
                        <h4>Theme Color</h4>
                        <p>
                          Choose an accent color for headings, bars, and
                          highlights.
                        </p>
                      </div>

                      <span
                        className="rb-current-color-pill"
                        style={{ borderColor: resume.themeColor }}
                      >
                        <span style={{ background: resume.themeColor }} />
                        {resume.themeColor}
                      </span>
                    </div>

                    <div className="rb-color-grid">
                      {colors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`rb-color-card ${
                            resume.themeColor === color ? "selected" : ""
                          }`}
                          onClick={() => updateResume("themeColor", color)}
                          aria-label={`Select color ${color}`}
                        >
                          <span style={{ background: color }} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rb-customize-group">
                    <div className="rb-customize-group-head">
                      <div>
                        <h4>Typography</h4>
                        <p>Select the font style for your resume.</p>
                      </div>
                    </div>

                    <label className="rb-field rb-custom-select">
                      <span>Font Family</span>
                      <select
                        value={resume.fontFamily}
                        onChange={(e) =>
                          updateResume("fontFamily", e.target.value)
                        }
                      >
                        {fonts.map((font) => (
                          <option key={font}>{font}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="rb-customize-group">
                    <div className="rb-customize-group-head">
                      <div>
                        <h4>Layout Density</h4>
                        <p>Adjust the spacing between resume sections.</p>
                      </div>
                    </div>

                    <div className="rb-spacing-options">
                      {[
                        {
                          id: "compact",
                          label: "Compact",
                          text: "Fit more content",
                        },
                        {
                          id: "normal",
                          label: "Normal",
                          text: "Balanced layout",
                        },
                        {
                          id: "comfortable",
                          label: "Comfortable",
                          text: "More breathing room",
                        },
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`rb-spacing-card ${
                            resume.spacing === option.id ? "selected" : ""
                          }`}
                          onClick={() => updateResume("spacing", option.id)}
                        >
                          <strong>{option.label}</strong>
                          <span>{option.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Section Order">
                <p className="rb-section-order-hint">
                  Reorder sections to control how your resume appears in the
                  preview and PDF.
                </p>

                <div className="rb-order-list rb-order-list-pro">
                  {resume.sectionOrder.map((section, index) => (
                    <div
                      className="rb-order-item rb-order-item-pro"
                      key={section}
                    >
                      <div className="rb-order-left">
                        <span className="rb-order-number">{index + 1}</span>
                        <span className="rb-order-name">{section}</span>
                      </div>

                      <div className="rb-order-actions">
                        <button
                          type="button"
                          onClick={() => moveSection(section, "up")}
                          disabled={index === 0}
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(section, "down")}
                          disabled={index === resume.sectionOrder.length - 1}
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}

          {activeStep === "review" && (
            <SectionCard title="Review & Optimize">
              <div className="rb-review-list">
                <div
                  className={
                    safe(resume.personalDetails.fullName)
                      ? "rb-check-item ok"
                      : "rb-check-item warn"
                  }
                >
                  {safe(resume.personalDetails.fullName)
                    ? "✅ Full name added"
                    : "⚠️ Add your full name"}
                </div>

                <div
                  className={
                    safe(resume.personalDetails.email)
                      ? "rb-check-item ok"
                      : "rb-check-item warn"
                  }
                >
                  {safe(resume.personalDetails.email)
                    ? "✅ Email added"
                    : "⚠️ Add your email"}
                </div>

                <div
                  className={
                    safe(resume.summary)
                      ? "rb-check-item ok"
                      : "rb-check-item warn"
                  }
                >
                  {safe(resume.summary)
                    ? "✅ Summary added"
                    : "⚠️ Add a professional summary"}
                </div>

                <div
                  className={
                    resume.experience.length || resume.education.length
                      ? "rb-check-item ok"
                      : "rb-check-item warn"
                  }
                >
                  {resume.experience.length || resume.education.length
                    ? "✅ Main CV sections added"
                    : "⚠️ Add education or work experience"}
                </div>

                <div
                  className={
                    resume.skillItems.length
                      ? "rb-check-item ok"
                      : "rb-check-item warn"
                  }
                >
                  {resume.skillItems.length
                    ? "✅ Skills added"
                    : "⚠️ Add relevant skills"}
                </div>
              </div>

              <div className="rb-review-actions">
                <button
                  type="button"
                  className="rb-secondary-btn"
                  onClick={goPreviousStep}
                  disabled={saving}
                >
                  Previous
                </button>

                <button
                  type="button"
                  className="rb-secondary-btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save CV"}
                </button>

                <button
                  className="rb-primary-btn"
                  type="button"
                  onClick={handleDownload}
                  disabled={!canDownloadPdf}
                  aria-disabled={!canDownloadPdf}
                  title={
                    !cvSaved ? "Please save your CV first" : "Download PDF"
                  }
                >
                  Download PDF
                </button>
              </div>
            </SectionCard>
          )}
          {activeStep !== "review" && (
            <div className="rb-step-footer">
              {currentStepIndex > 0 ? (
                <button
                  type="button"
                  className="rb-secondary-btn"
                  onClick={goPreviousStep}
                >
                  Previous
                </button>
              ) : (
                <span />
              )}

              {!isLastStep ? (
                <button
                  type="button"
                  className="rb-primary-btn"
                  onClick={goNextStep}
                >
                  Next
                </button>
              ) : (
                <button
                  className="rb-primary-btn"
                  type="button"
                  onClick={handleDownload}
                  disabled={!canDownloadPdf}
                  aria-disabled={!canDownloadPdf}
                  title={
                    !cvSaved ? "Please save your CV first" : "Download PDF"
                  }
                >
                  Download PDF
                </button>
              )}
            </div>
          )}
        </main>

        <div className="rb-pdf-export-area">
          <div ref={pdfRef} className="rb-pdf-page">
            <ResumePreview
              viewModel={viewModel}
              templateId={resume.templateId}
              themeColor={resume.themeColor}
              forPdf={true}
            />
          </div>
        </div>

        <aside className="rb-preview-panel">
          <div className="rb-preview-toolbar">
            <strong>Real-Time Preview</strong>
            <select
              value={previewScale}
              onChange={(e) => setPreviewScale(Number(e.target.value))}
            >
              <option value={0.6}>60%</option>
              <option value={0.72}>72%</option>
              <option value={0.85}>85%</option>
              <option value={1}>100%</option>
            </select>
          </div>

          <div className="rb-preview-scroll">
            <div
              className="rb-preview-scale"
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: "top center",
              }}
            >
              <ResumePreview
                viewModel={rightSidePreviewModel}
                templateId={resume.templateId}
                themeColor={resume.themeColor}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
