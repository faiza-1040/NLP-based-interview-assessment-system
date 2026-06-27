// client/src/pages/Candidate/ManageCV.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  fetchResumeFromDB,
  uploadResumeFile,
  deleteUploadedFile,
  deleteDefaultResume,
} from "../../utils/resumeApi";
import { applicationApi } from "../../utils/applicationApi";
import "./ManageCV.css";
import { api } from "../../utils/api";

function useJobFromQuery() {
  const { search } = useLocation();
  const sp = new URLSearchParams(search);

  const jobId = sp.get("jobId");
  const title = sp.get("title");

  const screeningAnswersRaw = sp.get("answers");
  let screeningAnswers = null;

  try {
    if (screeningAnswersRaw) {
      screeningAnswers = JSON.parse(decodeURIComponent(screeningAnswersRaw));
    }
  } catch (e) {
    console.error("Error parsing screening answers from URL:", e);
  }

  return { jobId, title, screeningAnswers };
}

const formatDate = (iso) => {
  if (!iso) return "—";

  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";

    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
};

const getExtension = (filename = "") => {
  const parts = filename.split(".");
  if (parts.length < 2) return "—";
  return "." + parts.pop().toLowerCase();
};

const getApiErrorMessage = (err, fallback = "Something went wrong.") => {
  return (
    err?.response?.data?.details ||
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
};

const ManageCV = () => {
  const navigate = useNavigate();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadMessage, setUploadMessage] = useState("");
  const [hasDefaultResume, setHasDefaultResume] = useState(false);
  const [error, setError] = useState("");
  const [applyMsg, setApplyMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { jobId, title: jobTitle, screeningAnswers } = useJobFromQuery();
  const hasJobContext = !!(jobTitle || jobId);

  const [resumePreview, setResumePreview] = useState({
    open: false,
    url: null,
    title: "",
  });

  useEffect(() => {
    loadResumes();
    checkDefaultPdf();
  }, []);

  const closeResumePreview = () => {
    if (resumePreview.url && resumePreview.url.startsWith("blob:")) {
      URL.revokeObjectURL(resumePreview.url);
    }

    setResumePreview({ open: false, url: null, title: "" });
  };

  const loadResumes = async () => {
    try {
      const res = await fetchResumeFromDB();

      if (res.data) {
        setUploadedFiles(
          (res.data.uploadedFiles || []).filter((f) => !f.isDeleted),
        );
      }
    } catch (err) {
      if (err?.response?.status === 404) {
        setUploadedFiles([]);
        setHasDefaultResume(false);
        return;
      }

      console.error("❌ Error loading resumes", err);
      setError(getApiErrorMessage(err, "Failed to load your resumes."));
    }
  };

  const handlePreviewDefault = async () => {
    try {
      const resumeRes = await api.get("/resume/me");
      const savedTemplateId = resumeRes?.data?.templateId || "modern";

      const fileRes = await api.get(
        `/resume/me/pdf?templateId=${encodeURIComponent(savedTemplateId)}`,
        { responseType: "blob" },
      );

      const url = URL.createObjectURL(fileRes.data);

      setResumePreview({
        open: true,
        url,
        title: "Resume (Built in Builder)",
      });
    } catch (err) {
      console.error(err);
      setApplyMsg("❌ Failed to preview built resume.");
    }
  };

  const handlePreviewUploaded = (file) => {
    const previewUrl = file?.fileUrl || file?.filePath;

    if (!previewUrl) {
      setApplyMsg("❌ File preview not available.");
      return;
    }

    setResumePreview({
      open: true,
      url: previewUrl,
      title: file.originalName || "Uploaded Resume",
    });
  };

  const checkDefaultPdf = async () => {
    try {
      const res = await api.get("/resume/me");

      const builderPdf = res?.data?.builderPdf;

      const hasPdf = Boolean(
        builderPdf?.fileUrl || builderPdf?.filePath || res?.data?.templateId,
      );

      setHasDefaultResume(hasPdf);
    } catch (err) {
      if (err?.response?.status === 404) {
        setHasDefaultResume(false);
        return;
      }

      console.error("Failed to check default resume:", err);
      setHasDefaultResume(false);
    }
  };

  const pollUploadedResumeStatus = async (fileId) => {
    const maxAttempts = 60;
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts += 1;

      try {
        const res = await api.get(
          `/resume/me/upload/${fileId}/processing-status`,
        );

        const status = res.data?.status;

        if (status === "completed") {
          clearInterval(interval);
          setUploadMessage("✅ Resume uploaded and processed successfully.");
          await loadResumes();
          return;
        }

        if (status === "failed") {
          clearInterval(interval);
          setUploadMessage(
            `❌ Resume uploaded, but processing failed: ${
              res.data?.error || "Unknown error"
            }`,
          );
          await loadResumes();
          return;
        }

        setUploadMessage("⏳ Resume uploaded. Processing your resume...");

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setUploadMessage(
            "✅ Resume uploaded. Processing is taking longer than usual. Please refresh after a moment.",
          );
          await loadResumes();
        }
      } catch (err) {
        console.error("Polling uploaded resume status failed:", err);
        clearInterval(interval);
        setUploadMessage(
          "✅ Resume uploaded. Could not check processing status right now.",
        );
        await loadResumes();
      }
    }, 3000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("resume", file);

    try {
      setIsUploading(true);
      setError("");
      setApplyMsg("");
      setUploadMessage("⏳ Uploading your resume...");

      const { data } = await uploadResumeFile(formData);

      if (data?.file) {
        setUploadedFiles((prev) => {
          const exists = prev.some((f) => f._id === data.file._id);
          return exists ? prev : [...prev, data.file];
        });
      }

      await loadResumes();

      if (data?.processing?.status === "failed") {
        setUploadMessage(
          `❌ Resume uploaded, but processing failed: ${
            data.processing.error || "Queue/worker error"
          }`,
        );
        return;
      }

      if (data?.file?._id) {
        setUploadMessage("✅ Resume uploaded. Processing started...");
        pollUploadedResumeStatus(data.file._id);
      } else {
        setUploadMessage(`✅ ${data.message || "Resume uploaded."}`);
      }
    } catch (err) {
      console.error("❌ Upload failed:", err);

      const msg = getApiErrorMessage(
        err,
        "Failed to upload and process resume.",
      );

      setUploadMessage(`❌ ${msg}`);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleFileDelete = async (fileId) => {
    if (!fileId) return;

    try {
      await deleteUploadedFile(fileId);

      setUploadedFiles((prev) => prev.filter((f) => f._id !== fileId));
      await loadResumes();
    } catch (err) {
      console.error("❌ Failed to delete resume", err);
      alert("❌ Failed to delete resume.");
    }
  };

  const handleDefaultEdit = () => {
    navigate("/candidate/resume-builder");
  };

  const handleDefaultDelete = async () => {
    const ok = window.confirm(
      "Are you sure you want to delete your built-in resume? This cannot be undone.",
    );

    if (!ok) return;

    try {
      await deleteDefaultResume();
      setHasDefaultResume(false);
      setApplyMsg("✅ Default resume deleted.");
    } catch (e) {
      console.error("❌ Failed to delete default resume", e);
      setApplyMsg("❌ Failed to delete default resume.");
    }
  };

  const pollApplicationMatching = async (appId) => {
    const maxAttempts = 60;
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts += 1;

      try {
        const res = await api.get(`/applications/${appId}/matching-status`);
        const status = res.data?.matchingStatus;

        if (status === "completed") {
          clearInterval(interval);
          setApplyMsg("✅ Application submitted and match analysis completed.");
        } else if (status === "failed") {
          clearInterval(interval);
          setApplyMsg("✅ Application submitted, but match analysis failed.");
        } else {
          setApplyMsg("⏳ Application submitted. Match analysis is running...");
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Matching poll failed:", err);
        clearInterval(interval);
      }
    }, 3000);
  };

  const handleChoose = async (source) => {
    if (!jobId) {
      setApplyMsg("❌ No job selected.");
      return;
    }

    try {
      setApplyMsg("⏳ Submitting your application...");

      const payload = {
        jobId,
        screeningAnswers: Array.isArray(screeningAnswers)
          ? screeningAnswers
          : [],
      };

      if (source?.type === "default") {
        payload.resumeSource = "default";
        payload.resumeName = "Resume (Built in Builder)";
      } else if (source?.type === "upload" && source.file) {
        payload.resumeSource = "upload";
        payload.resumeFileId = source.file._id;
        payload.resumeName = source.file.originalName;
      }

      const res = await applicationApi.create(payload);

      setApplyMsg(
        "⏳ Your application has been sent. Match analysis is running...",
      );

      if (res?.data?._id) {
        pollApplicationMatching(res.data._id);
      }

      setTimeout(() => {
        navigate("/candidate/applied-jobs");
      }, 1500);
    } catch (e) {
      if (e?.message === "NO_TOKEN") {
        setApplyMsg("❌ Please sign in to apply.");
        return;
      }

      if (e?.message === "NO_APPLY_ENDPOINT") {
        console.error("Apply endpoint not found. Tried:", e.details);
        setApplyMsg(
          "❌ Apply endpoint not found on the server. Check application routes.",
        );
        return;
      }

      const status = e?.response?.status;
      const msg =
        e?.response?.data?.errors?.join(", ") ||
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.response?.data?.details;

      setApplyMsg(
        `❌ ${
          msg || `Failed to apply${status ? ` (HTTP ${status})` : ""}.`
        }`,
      );
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const defaultRowMatchesSearch =
    !normalizedSearch || "resume (built in builder)".includes(normalizedSearch);

  const filteredUploadedFiles = uploadedFiles.filter((file) => {
    if (!normalizedSearch) return true;
    return file.originalName?.toLowerCase().includes(normalizedSearch);
  });

  const rows = [];

  if (hasDefaultResume && defaultRowMatchesSearch) {
    rows.push({ kind: "default" });
  }

  filteredUploadedFiles.forEach((file) => {
    rows.push({ kind: "upload", file });
  });

  const hasAnyRows = rows.length > 0;

  return (
    <div className="manage-cv-page">
      <h1 className="manage-cv-title">Manage Your CVs</h1>

      {hasJobContext && (
        <div className="manage-cv-job-context">
          <div className="job-context-text">
            You are applying to: <strong>{jobTitle || jobId}</strong>
          </div>
          <button
            className="job-context-change-btn"
            onClick={() => navigate("/candidate/job-search")}
          >
            Change job
          </button>
        </div>
      )}

      {applyMsg && (
        <div
          className={
            "manage-cv-alert " +
            (applyMsg.startsWith("✅")
              ? "manage-cv-alert-success"
              : "manage-cv-alert-error")
          }
        >
          {applyMsg}
        </div>
      )}

      {error && (
        <div className="manage-cv-alert manage-cv-alert-error">{error}</div>
      )}

      <div className="manage-cv-search-row">
        <div className="manage-cv-search-input-wrapper">
          <i className="fa-solid fa-magnifying-glass manage-cv-search-icon"></i>
          <input
            type="text"
            placeholder="Search by CV name..."
            className="manage-cv-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="manage-cv-table-card">
        <table className="manage-cv-table">
          <thead>
            <tr>
              <th className="col-index">#</th>
              <th>CV Title</th>
              <th>Type</th>
              <th>Last Modified</th>
              <th>Origin</th>
              <th>Actions</th>
              {hasJobContext && <th>Apply With</th>}
            </tr>
          </thead>

          <tbody>
            {hasAnyRows ? (
              rows.map((row, index) => {
                if (row.kind === "default") {
                  return (
                    <tr key="default">
                      <td className="col-index">{index + 1}</td>
                      <td className="cv-title-cell">
                        Resume (Built in Builder)
                      </td>
                      <td className="cv-type-cell">.pdf</td>
                      <td className="cv-date-cell">—</td>
                      <td>Default</td>
                      <td className="manage-cv-actions-cell">
                        <button
                          className="icon-btn"
                          title="Edit default resume"
                          onClick={handleDefaultEdit}
                        >
                          <i className="fa-regular fa-pen-to-square"></i>
                        </button>

                        <button
                          className="icon-btn"
                          title="Delete default resume"
                          onClick={handleDefaultDelete}
                        >
                          <i className="fa-regular fa-trash-can"></i>
                        </button>

                        <button
                          className="icon-btn"
                          title="Preview default resume"
                          onClick={handlePreviewDefault}
                        >
                          <i className="fa-regular fa-eye"></i>
                        </button>
                      </td>

                      {hasJobContext && (
                        <td>
                          <button
                            className="manage-cv-choose-btn"
                            onClick={() => handleChoose({ type: "default" })}
                          >
                            Choose
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                }

                const file = row.file;

                return (
                  <tr key={file._id}>
                    <td className="col-index">{index + 1}</td>
                    <td className="cv-title-cell">{file.originalName}</td>
                    <td className="cv-type-cell">
                      {getExtension(file.originalName)}
                    </td>
                    <td className="cv-date-cell">
                      {formatDate(
                        file.updatedAt || file.createdAt || file.uploadedAt,
                      )}
                    </td>
                    <td>Uploaded</td>

                    <td className="manage-cv-actions-cell">
                      <button
                        className="icon-btn"
                        title="Delete uploaded resume"
                        onClick={() => handleFileDelete(file._id)}
                      >
                        <i className="fa-regular fa-trash-can"></i>
                      </button>

                      <button
                        className="icon-btn"
                        title="Preview uploaded resume"
                        onClick={() => handlePreviewUploaded(file)}
                      >
                        <i className="fa-regular fa-eye"></i>
                      </button>
                    </td>

                    {hasJobContext && (
                      <td>
                        <button
                          className="manage-cv-choose-btn"
                          onClick={() => handleChoose({ type: "upload", file })}
                        >
                          Choose
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={hasJobContext ? 7 : 6}
                  className="manage-cv-empty-cell"
                >
                  No resumes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="manage-cv-upload-card">
        <div className="manage-cv-upload-inner">
          <div className="manage-cv-upload-icon-wrapper">
            <i className="fa-solid fa-cloud-arrow-up"></i>
          </div>

          <h3 className="manage-cv-upload-title">Upload a New CV</h3>

          <p className="manage-cv-upload-text">
            Drag and drop or choose a file from your computer.
          </p>

          {isUploading && (
            <div className="manage-cv-loader-wrap">
              <div className="manage-cv-loader"></div>
              <p className="manage-cv-loader-text">Uploading your resume...</p>
            </div>
          )}

          <label
            className={`manage-cv-upload-btn ${
              isUploading ? "disabled-upload-btn" : ""
            }`}
          >
            {isUploading ? "Uploading..." : "Choose File"}
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileUpload}
              hidden
              disabled={isUploading}
            />
          </label>

          {uploadMessage && (
            <p className="manage-cv-upload-message">{uploadMessage}</p>
          )}
        </div>
      </div>

      {resumePreview.open && (
        <div className="aj-modal-overlay" onClick={closeResumePreview}>
          <div
            className="aj-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "80%", height: "80%" }}
          >
            <button
              className="aj-modal-close"
              onClick={closeResumePreview}
              type="button"
            >
              ×
            </button>

            <div style={{ marginBottom: 10, fontWeight: 700 }}>
              {resumePreview.title}
            </div>

            <iframe
              src={resumePreview.url}
              title={resumePreview.title}
              width="100%"
              height="100%"
              style={{ border: "none", borderRadius: 8 }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageCV;