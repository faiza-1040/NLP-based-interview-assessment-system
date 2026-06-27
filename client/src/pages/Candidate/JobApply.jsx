//client/src/pages/Candidate/JobApply.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../utils/api";
import "./CandidatePages.css";

const API_BASE = import.meta?.env?.VITE_API_BASE || "http://127.0.0.1:5000";

const money = (n) => (typeof n === "number" ? n.toLocaleString() : "—");

const showLocation = (j) => {
  if (j.jobLocation && j.jobLocation.trim()) return j.jobLocation;
  if (j.location && j.location.trim()) return j.location;
  if (j.remote?.mustReside && j.remote?.location) {
    return `Remote (within ${j.remote.location})`;
  }
  return j.workArrangement === "Remote" ? "Remote" : "—";
};

const valueOrDash = (value) => {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
};

const absoluteUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url}`;
};

const CompanyDetailItem = ({ label, value, children }) => {
  const displayValue = children || valueOrDash(value);

  if (!children && displayValue === "—") return null;

  return (
    <div className="company-detail-item">
      <span className="company-detail-label">{label}</span>
      <span className="company-detail-value">{displayValue}</span>
    </div>
  );
};

export default function JobApply() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [existingApp, setExistingApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [screeningAnswers, setScreeningAnswers] = useState([]);
  const [resumeSource, setResumeSource] = useState("default");
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const [jobRes, appRes] = await Promise.all([
          api.get(`/jobs/public/${jobId}`),
          api.get(`/applications/job/${jobId}/mine`),
        ]);

        if (cancelled) return;

        const jobData = jobRes.data;
        const appData = appRes.data;

        setJob(jobData);
        setExistingApp(appData || null);

        if (
          jobData?.customQuestions &&
          Array.isArray(jobData?.screeningQuestions) &&
          jobData.screeningQuestions.length > 0
        ) {
          setScreeningAnswers(
            new Array(jobData.screeningQuestions.length).fill(""),
          );
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setErr(
            e?.response?.data?.message ||
              e?.response?.data?.error ||
              "Failed to load application page.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const isClosed = useMemo(() => {
    if (!job) return false;
    if (job.isClosed === true) return true;
    if (!job.applicationDeadline) return false;
    return new Date(job.applicationDeadline) < new Date();
  }, [job]);

  const companyProfile = useMemo(() => {
    return job?.companyProfile || {};
  }, [job]);

  const companyName = useMemo(() => {
    return (
      companyProfile.companyName ||
      job?.createdBy?.companyName ||
      job?.companyName ||
      job?.createdBy?.name ||
      "Recruiter"
    );
  }, [companyProfile.companyName, job]);

  const handleAnswerChange = (index, value) => {
    setScreeningAnswers((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const validateAnswers = () => {
    if (
      job?.customQuestions &&
      Array.isArray(job?.screeningQuestions) &&
      job.screeningQuestions.length > 0
    ) {
      const valid =
        Array.isArray(screeningAnswers) &&
        screeningAnswers.length === job.screeningQuestions.length &&
        screeningAnswers.every(
          (a) => typeof a === "string" && a.trim().length > 0,
        );

      if (!valid) {
        setErr("Please answer all screening questions.");
        return false;
      }
    }
    return true;
  };

  const handleUseManageCV = () => {
    navigate(
      `/candidate/manage-cv?jobId=${encodeURIComponent(
        job._id,
      )}&title=${encodeURIComponent(job.title)}&answers=${encodeURIComponent(
        JSON.stringify(screeningAnswers),
      )}`,
    );
  };

  const handleUseResumeBuilder = () => {
    navigate(
      `/candidate/resume-builder?jobId=${encodeURIComponent(
        job._id,
      )}&title=${encodeURIComponent(job.title)}&answers=${encodeURIComponent(
        JSON.stringify(screeningAnswers),
      )}`,
    );
  };

  // const handleSubmitWithBuiltResume = async () => {
  //   if (!validateAnswers()) return;

  //   try {
  //     setSubmitting(true);
  //     setErr('');
  //     setSuccessMsg('');

  //     await api.post('/applications', {
  //       jobId: job._id,
  //       resumeSource: 'default',
  //       screeningAnswers,
  //     });

  //     setSuccessMsg('Application submitted successfully.');
  //     setTimeout(() => {
  //       navigate('/candidate/applied-jobs');
  //     }, 1000);
  //   } catch (e) {
  //     console.error(e);
  //     setErr(
  //       e?.response?.data?.message ||
  //         e?.response?.data?.error ||
  //         'Failed to submit application.'
  //     );
  //   } finally {
  //     setSubmitting(false);
  //   }
  // };

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
          setSuccessMsg("Application submitted and match analysis completed.");
        } else if (status === "failed") {
          clearInterval(interval);
          setSuccessMsg("Application submitted, but match analysis failed.");
        } else {
          setSuccessMsg("Application submitted. Match analysis is running...");
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

  const handleSubmitWithBuiltResume = async () => {
    if (!validateAnswers()) return;

    try {
      setSubmitting(true);
      setErr("");
      setSuccessMsg("");

      const res = await api.post("/applications", {
        jobId: job._id,
        resumeSource: "default",
        screeningAnswers,
      });

      setSuccessMsg("Application submitted. Match analysis is running...");
      if (res.data?._id) {
        pollApplicationMatching(res.data._id);
      }

      setTimeout(() => {
        navigate("/candidate/applied-jobs");
      }, 1500);
    } catch (e) {
      console.error(e);
      setErr(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Failed to submit application.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleMainApplyAction = () => {
    if (resumeSource === "default") {
      handleSubmitWithBuiltResume();
      return;
    }

    handleUseManageCV();
  };

  const renderCompanyModal = () => {
    if (!showCompanyModal) return null;

    const logoUrl = absoluteUrl(companyProfile.companyLogoUrl);
    const websiteUrl = companyProfile.companyWebsite;
    const linkedinUrl = companyProfile.companyLinkedin;

    return (
      <div className="company-modal-overlay" role="presentation">
        <div className="company-modal-card" role="dialog" aria-modal="true">
          <button
            type="button"
            className="company-modal-close"
            onClick={() => setShowCompanyModal(false)}
            aria-label="Close company details"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="company-modal-header">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${companyName} logo`}
                className="company-modal-logo"
              />
            ) : (
              <div className="company-modal-logo-placeholder">
                <i className="fa-solid fa-building"></i>
              </div>
            )}

            <div className="company-modal-title-block">
              <div className="company-modal-title-row">
                <h2>{companyName}</h2>
                {companyProfile.isVerified && (
                  <span className="company-verified-badge">
                    <i className="fa-solid fa-circle-check"></i> Verified Company
                  </span>
                )}
              </div>

              {companyProfile.tagline && (
                <p className="company-modal-tagline">{companyProfile.tagline}</p>
              )}
            </div>
          </div>

          <div className="company-modal-body">
            <div className="company-info-grid">
              <CompanyDetailItem label="Industry" value={companyProfile.companyIndustry} />
              <CompanyDetailItem label="Company Type" value={companyProfile.companyType} />
              <CompanyDetailItem label="Company Size" value={companyProfile.companySize} />
              <CompanyDetailItem
                label="Head Office / Location"
                value={companyProfile.companyHeadOffice}
              />

              <CompanyDetailItem label="Website">
                {websiteUrl ? (
                  <a href={websiteUrl} target="_blank" rel="noreferrer">
                    <i className="fa-solid fa-globe"></i> {websiteUrl}
                  </a>
                ) : (
                  "—"
                )}
              </CompanyDetailItem>

              <CompanyDetailItem label="LinkedIn Company Page">
                {linkedinUrl ? (
                  <a href={linkedinUrl} target="_blank" rel="noreferrer">
                    <i className="fa-brands fa-linkedin"></i> {linkedinUrl}
                  </a>
                ) : (
                  "—"
                )}
              </CompanyDetailItem>
            </div>

            <div className="company-modal-section">
              <h3>
                <i className="fa-solid fa-building"></i> About Company
              </h3>
              <p>{valueOrDash(companyProfile.aboutCompany)}</p>
            </div>

            <div className="company-modal-section">
              <h3>
                <i className="fa-solid fa-handshake-angle"></i> Why Work With Us
              </h3>
              <p>{valueOrDash(companyProfile.whyWorkWithUs)}</p>
            </div>

            <div className="company-modal-two-col">
              <div className="company-modal-section compact">
                <h3>Culture / Values</h3>
                <p>{valueOrDash(companyProfile.coreValues || companyProfile.workCulture)}</p>
              </div>

              <div className="company-modal-section compact">
                <h3>Benefits / Perks</h3>
                <p>{valueOrDash(companyProfile.perksBenefits)}</p>
              </div>
            </div>

            <div className="company-modal-section">
              <h3>
                <i className="fa-solid fa-briefcase"></i> Hiring Process
              </h3>
              <p>
                {valueOrDash(
                  companyProfile.hiringProcessSteps ||
                    companyProfile.interviewStages ||
                    companyProfile.defaultHiringProcess,
                )}
              </p>
            </div>

            <div className="company-info-grid bottom-grid">
              <CompanyDetailItem
                label="Departments Hiring For"
                value={companyProfile.hiringDepartments}
              />
              <CompanyDetailItem label="Typical Roles" value={companyProfile.typicalRoles} />
              <CompanyDetailItem
                label="Hiring Locations"
                value={companyProfile.hiringLocations}
              />
              <CompanyDetailItem
                label="Recruiter Contact Preference"
                value={companyProfile.recruiterContactPreference}
              />
            </div>

            {companyProfile.allowCandidateMessages === "Yes" && (
              <div className="company-contact-note">
                <i className="fa-solid fa-users"></i> Candidate messages are allowed.
                {companyProfile.averageResponseTime
                  ? ` Average response time: ${companyProfile.averageResponseTime}.`
                  : ""}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div style={{ padding: 24 }}>Loading application page...</div>;
  }

  if (err && !job) {
    return <div style={{ padding: 24, color: "#dc2626" }}>{err}</div>;
  }

  if (!job) {
    return <div style={{ padding: 24 }}>Job not found.</div>;
  }

  if (existingApp) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ marginBottom: 8 }}>You already applied to this job</h2>
        <p style={{ color: "#6b7280", marginBottom: 16 }}>
          Your latest application status is: {" "}
          <strong>{existingApp.status}</strong>
        </p>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => navigate("/candidate/applied-jobs")}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            View Application
          </button>

          <button
            onClick={() => navigate("/candidate/job-search")}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#111827",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="job-apply-page" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>Apply for Job</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Review job details, answer required questions, and choose your resume
        source.
      </p>

      {err && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fecaca",
          }}
        >
          {err}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#ecfdf5",
            color: "#065f46",
            border: "1px solid #a7f3d0",
          }}
        >
          {successMsg}
        </div>
      )}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          background: "#fff",
          marginBottom: 20,
        }}
      >
        <h2 style={{ marginBottom: 6 }}>{job.title}</h2>
        <p style={{ color: "#4b5563", marginBottom: 12 }}>{companyName}</p>

        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <span>Location: {showLocation(job)}</span>
          {job.workArrangement && <span>Work type: {job.workArrangement}</span>}
          {job.salaryVisible === "Yes" && (
            <span>
              Salary: {money(job.salaryMin)} - {money(job.salaryMax)} /month
            </span>
          )}
          {job.applicationDeadline && (
            <span>
              Deadline: {new Date(job.applicationDeadline).toLocaleDateString()}
            </span>
          )}
        </div>

        {isClosed && (
          <div style={{ color: "#b91c1c", fontWeight: 700 }}>
            This job is closed. You cannot apply now.
          </div>
        )}

        {!isClosed && (
          <div
            dangerouslySetInnerHTML={{ __html: job.description }}
            style={{
              marginTop: 12,
              padding: 14,
              background: "#f9fafb",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          />
        )}

        <div className="about-company-row">
          <button
            type="button"
            className="about-company-btn"
            onClick={() => setShowCompanyModal(true)}
          >
            <i className="fa-solid fa-building"></i> About the Company
          </button>
        </div>
      </div>

      {!isClosed &&
        job.customQuestions &&
        Array.isArray(job.screeningQuestions) &&
        job.screeningQuestions.length > 0 && (
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
              background: "#fff",
              marginBottom: 20,
            }}
          >
            <h3 style={{ marginBottom: 14 }}>Screening Questions</h3>

            <div style={{ display: "grid", gap: 14 }}>
              {job.screeningQuestions.map((question, index) => (
                <div key={index}>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      marginBottom: 6,
                    }}
                  >
                    {index + 1}. {question}
                  </label>
                  <textarea
                    rows="4"
                    value={screeningAnswers[index] || ""}
                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

      {!isClosed && (
        <div className="resume-source-card">
          <div className="resume-source-header">
            <h3>Choose Resume Source</h3>
            <p>Select which resume you want to use for this job application.</p>
          </div>

          <div className="resume-option-list">
            <button
              type="button"
              className={`resume-option-box ${resumeSource === "default" ? "selected" : ""}`}
              onClick={() => setResumeSource("default")}
            >
              <input
                type="radio"
                name="resumeSource"
                value="default"
                checked={resumeSource === "default"}
                onChange={() => setResumeSource("default")}
              />
              <span className="resume-icon-circle">
                <i className="fa-regular fa-file-lines"></i>
              </span>
              <span className="resume-option-text">
                <strong>Use built-in resume from Resume Builder</strong>
                <small>Apply using the resume created in your profile resume builder.</small>
              </span>
              {resumeSource === "default" && (
                <span className="resume-check-circle">
                  <i className="fa-solid fa-check"></i>
                </span>
              )}
            </button>

            <button
              type="button"
              className={`resume-option-box ${resumeSource === "upload" ? "selected" : ""}`}
              onClick={() => setResumeSource("upload")}
            >
              <input
                type="radio"
                name="resumeSource"
                value="upload"
                checked={resumeSource === "upload"}
                onChange={() => setResumeSource("upload")}
              />
              <span className="resume-icon-circle">
                <i className="fa-solid fa-cloud-arrow-up"></i>
              </span>
              <span className="resume-option-text">
                <strong>Use uploaded/selectable CV from Manage CV</strong>
                <small>Choose a CV file you have already uploaded in Manage CV.</small>
              </span>
              {resumeSource === "upload" && (
                <span className="resume-check-circle">
                  <i className="fa-solid fa-check"></i>
                </span>
              )}
            </button>
          </div>

          <div className="resume-action-row">
            <button
              onClick={handleUseResumeBuilder}
              type="button"
              className="resume-action-btn secondary"
            >
              <i className="fa-regular fa-file-lines"></i> Open Resume Builder
            </button>

            <button
              onClick={handleMainApplyAction}
              type="button"
              disabled={submitting && resumeSource === "default"}
              className="resume-action-btn primary"
            >
              <i className="fa-solid fa-paper-plane"></i>
              {submitting && resumeSource === "default"
                ? "Submitting..."
                : resumeSource === "default"
                ? "Apply with Built Resume"
                : "Apply with Uploaded CV"}
            </button>

            <button
              onClick={() => navigate("/candidate/job-search")}
              type="button"
              className="resume-action-btn secondary"
            >
              <i className="fa-solid fa-xmark"></i> Cancel
            </button>
          </div>
        </div>
      )}

      {renderCompanyModal()}
    </div>
  );
}
