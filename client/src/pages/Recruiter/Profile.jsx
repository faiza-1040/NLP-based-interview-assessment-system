// client/src/pages/Recruiter/Profile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../utils/api";
import "./RecruiterProfile.css";
import { useAuth } from "../../context/authContext";

const API_BASE = import.meta?.env?.VITE_API_BASE || "http://127.0.0.1:5000";

const resolveFileUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url}`;
};

const EMPTY_PROFILE = {
  // Legacy/personal recruiter details - kept for contact preferences and compatibility
  recruiterName: "",
  recruiterTitle: "",
  recruiterEmail: "",
  recruiterPhone: "",
  recruiterBio: "",
  recruiterPhotoUrl: "",

  // 1) Public Company Profile
  companyName: "",
  companyWebsite: "",
  companyIndustry: "",
  companySize: "",
  companyType: "",
  companyHeadOffice: "",
  aboutCompany: "",
  companyLogoUrl: "",

  // 2) Why Work With Us
  tagline: "",
  whyWorkWithUs: "",
  workCulture: "",
  coreValues: "",
  perksBenefits: "",
  growthOpportunities: "",
  remoteWorkPolicy: "",
  learningOpportunities: "",
  diversityStatement: "",

  // 3) Hiring Process
  hiringProcessSteps: "",
  screeningProcess: "",
  interviewStages: "",
  expectedResponseTime: "",
  candidateInstructions: "",

  // 4) Company Verification Badge
  registrationNumber: "",
  businessEmailDomain: "",
  companyLinkedin: "",
  registrationDocUrl: "",
  verificationBadgeVisible: "Yes",
  verificationNote: "",
  approvalStatus: "Pending",
  reviewedBy: "",
  lastReviewedOn: "",
  rejectionReason: "",

  // 5) Recruiter Contact Preferences
  showRecruiterEmail: "No",
  showRecruiterPhone: "No",
  allowCandidateMessages: "Yes",
  preferredContactMethod: "",
  averageResponseTime: "",
  contactInstructions: "",

  // 6) Team / Hiring Focus
  hiringDepartments: "",
  typicalRoles: "",
  hiringLocations: "",
  seniorityLevels: "",
  teamOverview: "",
  hiringFrequency: "",

  // 7) Job Post Defaults
  defaultJobDescription: "",
  defaultBenefits: "",
  defaultHiringProcess: "",
  defaultWorkArrangement: "",
  defaultApplicationInstructions: "",
};

const RecruiterProfile = () => {
  const navigate = useNavigate();
  const { logoutAuth } = useAuth();

  const [activeSection, setActiveSection] = useState("summary");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingSections, setEditingSections] = useState({
    publicCompany: true,
    whyWork: true,
    hiringProcess: true,
    verificationBadge: true,
    contactPreferences: true,
    teamHiring: true,
    jobDefaults: true,
    settings: true,
  });

  const [saveStatus, setSaveStatus] = useState({
    section: null,
    message: "",
  });

  /* ---------- Load recruiter profile ---------- */

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/recruiter/profile/me");
        const data = res.data || {};
        setProfile({ ...EMPTY_PROFILE, ...data });
      } catch (err) {
        console.error("Load recruiter profile error:", err?.response || err);
        setProfile(EMPTY_PROFILE);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  /* ---------- Completion % ---------- */

  const completion = useMemo(() => {
    let total = 7;
    let done = 0;

    const hasPublicCompany =
      profile.companyName &&
      profile.companyWebsite &&
      profile.companyIndustry &&
      profile.companySize &&
      profile.companyType &&
      profile.companyHeadOffice &&
      profile.aboutCompany;

    const hasWhyWork =
      profile.tagline &&
      profile.whyWorkWithUs &&
      profile.workCulture &&
      profile.perksBenefits &&
      profile.growthOpportunities;

    const hasHiringProcess =
      profile.hiringProcessSteps &&
      profile.screeningProcess &&
      profile.interviewStages &&
      profile.expectedResponseTime;

    const hasVerificationBadge =
      profile.registrationNumber &&
      profile.businessEmailDomain &&
      profile.companyLinkedin;

    const hasContactPreferences =
      profile.recruiterName &&
      profile.recruiterEmail &&
      profile.preferredContactMethod &&
      profile.averageResponseTime;

    const hasTeamHiring =
      profile.hiringDepartments &&
      profile.typicalRoles &&
      profile.hiringLocations &&
      profile.seniorityLevels;

    const hasJobDefaults =
      profile.defaultJobDescription &&
      profile.defaultBenefits &&
      profile.defaultHiringProcess &&
      profile.defaultWorkArrangement;

    if (hasPublicCompany) done++;
    if (hasWhyWork) done++;
    if (hasHiringProcess) done++;
    if (hasVerificationBadge) done++;
    if (hasContactPreferences) done++;
    if (hasTeamHiring) done++;
    if (hasJobDefaults) done++;

    if (!done) return 0;
    return Math.round((done / total) * 100);
  }, [profile]);

  /* ---------- Save helpers ---------- */

  const buildPayload = (override = {}) => {
    const merged = { ...profile, ...override };

    return {
      recruiterName: merged.recruiterName || "",
      recruiterTitle: merged.recruiterTitle || "",
      recruiterEmail: merged.recruiterEmail || "",
      recruiterPhone: merged.recruiterPhone || "",
      recruiterBio: merged.recruiterBio || "",
      recruiterPhotoUrl: merged.recruiterPhotoUrl || "",

      companyName: merged.companyName || "",
      companyWebsite: merged.companyWebsite || "",
      companyIndustry: merged.companyIndustry || "",
      companySize: merged.companySize || "",
      companyType: merged.companyType || "",
      companyHeadOffice: merged.companyHeadOffice || "",
      aboutCompany: merged.aboutCompany || "",
      companyLogoUrl: merged.companyLogoUrl || "",

      tagline: merged.tagline || "",
      whyWorkWithUs: merged.whyWorkWithUs || "",
      workCulture: merged.workCulture || "",
      coreValues: merged.coreValues || "",
      perksBenefits: merged.perksBenefits || "",
      growthOpportunities: merged.growthOpportunities || "",
      remoteWorkPolicy: merged.remoteWorkPolicy || "",
      learningOpportunities: merged.learningOpportunities || "",
      diversityStatement: merged.diversityStatement || "",

      hiringProcessSteps: merged.hiringProcessSteps || "",
      screeningProcess: merged.screeningProcess || "",
      interviewStages: merged.interviewStages || "",
      expectedResponseTime: merged.expectedResponseTime || "",
      candidateInstructions: merged.candidateInstructions || "",

      registrationNumber: merged.registrationNumber || "",
      businessEmailDomain: merged.businessEmailDomain || "",
      companyLinkedin: merged.companyLinkedin || "",
      registrationDocUrl: merged.registrationDocUrl || "",
      verificationBadgeVisible: merged.verificationBadgeVisible || "Yes",
      verificationNote: merged.verificationNote || "",
      approvalStatus: merged.approvalStatus || "Pending",
      reviewedBy: merged.reviewedBy || "",
      lastReviewedOn: merged.lastReviewedOn || "",
      rejectionReason: merged.rejectionReason || "",

      showRecruiterEmail: merged.showRecruiterEmail || "No",
      showRecruiterPhone: merged.showRecruiterPhone || "No",
      allowCandidateMessages: merged.allowCandidateMessages || "Yes",
      preferredContactMethod: merged.preferredContactMethod || "",
      averageResponseTime: merged.averageResponseTime || "",
      contactInstructions: merged.contactInstructions || "",

      hiringDepartments: merged.hiringDepartments || "",
      typicalRoles: merged.typicalRoles || "",
      hiringLocations: merged.hiringLocations || "",
      seniorityLevels: merged.seniorityLevels || "",
      teamOverview: merged.teamOverview || "",
      hiringFrequency: merged.hiringFrequency || "",

      defaultJobDescription: merged.defaultJobDescription || "",
      defaultBenefits: merged.defaultBenefits || "",
      defaultHiringProcess: merged.defaultHiringProcess || "",
      defaultWorkArrangement: merged.defaultWorkArrangement || "",
      defaultApplicationInstructions:
        merged.defaultApplicationInstructions || "",
    };
  };

  const saveProfile = async (override = {}, sectionKey = null) => {
    try {
      setSaving(true);
      const payload = buildPayload(override);

      const res = await api.put("/recruiter/profile/me", payload);

      const data = res.data || {};
      setProfile((prev) => ({ ...prev, ...data }));

      if (sectionKey) {
        setEditingSections((prev) => ({
          ...prev,
          [sectionKey]: false,
        }));
        setSaveStatus({
          section: sectionKey,
          message: "Your changes are saved.",
        });
      }
    } catch (err) {
      console.error("Save recruiter profile error:", err?.response || err);
      alert("Failed to save recruiter profile. Check console for details.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditSection = (sectionKey) => {
    setEditingSections((prev) => ({
      ...prev,
      [sectionKey]: true,
    }));
    setSaveStatus({ section: null, message: "" });
    setActiveSection(sectionKey);
  };

  const handleClearSection = (sectionKey) => {
    let overrides = {};

    switch (sectionKey) {
      case "publicCompany":
        overrides = {
          companyName: "",
          companyWebsite: "",
          companyIndustry: "",
          companySize: "",
          companyType: "",
          companyHeadOffice: "",
          aboutCompany: "",
          companyLogoUrl: "",
        };
        break;
      case "whyWork":
        overrides = {
          tagline: "",
          whyWorkWithUs: "",
          workCulture: "",
          coreValues: "",
          perksBenefits: "",
          growthOpportunities: "",
          remoteWorkPolicy: "",
          learningOpportunities: "",
          diversityStatement: "",
        };
        break;
      case "hiringProcess":
        overrides = {
          hiringProcessSteps: "",
          screeningProcess: "",
          interviewStages: "",
          expectedResponseTime: "",
          candidateInstructions: "",
        };
        break;
      case "verificationBadge":
        overrides = {
          registrationNumber: "",
          businessEmailDomain: "",
          companyLinkedin: "",
          registrationDocUrl: "",
          verificationBadgeVisible: "Yes",
          verificationNote: "",
        };
        break;
      case "contactPreferences":
        overrides = {
          recruiterName: "",
          recruiterTitle: "",
          recruiterEmail: "",
          recruiterPhone: "",
          recruiterBio: "",
          recruiterPhotoUrl: "",
          showRecruiterEmail: "No",
          showRecruiterPhone: "No",
          allowCandidateMessages: "Yes",
          preferredContactMethod: "",
          averageResponseTime: "",
          contactInstructions: "",
        };
        break;
      case "teamHiring":
        overrides = {
          hiringDepartments: "",
          typicalRoles: "",
          hiringLocations: "",
          seniorityLevels: "",
          teamOverview: "",
          hiringFrequency: "",
        };
        break;
      case "jobDefaults":
        overrides = {
          defaultJobDescription: "",
          defaultBenefits: "",
          defaultHiringProcess: "",
          defaultWorkArrangement: "",
          defaultApplicationInstructions: "",
        };
        break;
      default:
        break;
    }

    if (Object.keys(overrides).length) {
      saveProfile(overrides, sectionKey);
    }
  };

  /* ---------- Logout / Delete ---------- */

  const handleLogout = async () => {
    try {
      await logoutAuth();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      navigate("/login");
    }
  };

  const handleDeleteProfile = async () => {
    const sure = window.confirm(
      "This will clear your recruiter profile data but keep your login. Continue?",
    );
    if (!sure) return;

    try {
      await api.delete("/recruiter/profile/me");
      setProfile(EMPTY_PROFILE);
    } catch (err) {
      console.error("Delete recruiter profile error:", err?.response || err);
      alert("Failed to delete recruiter profile.");
    }
  };

  const handleDeleteAccount = async () => {
    const sure = window.confirm(
      "This will permanently delete your recruiter account and all profile data. This action cannot be undone. Continue?",
    );
    if (!sure) return;

    try {
      await api.delete("/account/me");

      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      localStorage.removeItem("userRole");
      navigate("/login");
    } catch (err) {
      console.error("Delete account error:", err?.response || err);
      alert("Failed to delete account. Please try again.");
    }
  };

  /* ---------- Upload handlers ---------- */

  const handleRecruiterPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("photo", file);

    try {
      const res = await api.post("/recruiter/profile/photo", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { recruiterPhotoUrl, photoUrl, profile: updated } = res.data || {};

      setProfile((prev) => ({
        ...prev,
        recruiterPhotoUrl:
          recruiterPhotoUrl || photoUrl || prev.recruiterPhotoUrl,
        ...(updated || {}),
      }));
    } catch (err) {
      console.error("Upload recruiter photo error:", err?.response || err);
      alert("Failed to upload recruiter photo.");
    }
  };

  const handleCompanyLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("logo", file);

    try {
      const res = await api.post("/recruiter/profile/logo", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { companyLogoUrl, logoUrl, profile: updated } = res.data || {};

      setProfile((prev) => ({
        ...prev,
        companyLogoUrl: companyLogoUrl || logoUrl || prev.companyLogoUrl,
        ...(updated || {}),
      }));
    } catch (err) {
      console.error("Upload company logo error:", err?.response || err);
      alert("Failed to upload company logo.");
    }
  };

  const handleRegistrationDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("registrationDoc", file);

    try {
      const res = await api.post("/recruiter/profile/registration-doc", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { registrationDocUrl, docUrl, profile: updated } = res.data || {};

      setProfile((prev) => ({
        ...prev,
        registrationDocUrl:
          registrationDocUrl || docUrl || prev.registrationDocUrl,
        ...(updated || {}),
      }));
    } catch (err) {
      console.error("Upload registration doc error:", err?.response || err);
      alert("Failed to upload registration document.");
    }
  };

  const renderSaveActions = (sectionKey, saveLabel) => (
    <div className="r-actions-row">
      {editingSections[sectionKey] ? (
        <button
          className="btn-primary"
          onClick={() => saveProfile({}, sectionKey)}
          disabled={saving}
        >
          {saving ? "Saving..." : saveLabel}
        </button>
      ) : (
        <>
          <span className="r-save-message">
            {saveStatus.section === sectionKey && saveStatus.message
              ? saveStatus.message
              : "Your changes are saved."}
          </span>
          <div className="r-actions-buttons">
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleEditSection(sectionKey)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn-light-danger"
              onClick={() => handleClearSection(sectionKey)}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );

  const approvalBadgeClass =
    String(profile.approvalStatus || "Pending").toLowerCase() === "approved"
      ? "r-status-badge approved"
      : String(profile.approvalStatus || "Pending").toLowerCase() === "declined"
        ? "r-status-badge declined"
        : "r-status-badge pending";

  /* ---------- Summary renderer ---------- */

  const renderSummaryCard = ({ title, section, children, empty }) => (
    <div className="r-summary-section-card">
      <div className="r-summary-header">
        <h3 className="r-summary-title">{title}</h3>
        <button
          type="button"
          className="r-summary-edit-btn"
          onClick={() => handleEditSection(section)}
          title={`Edit ${title}`}
        >
          <i className="fa-solid fa-pen"></i>
        </button>
      </div>
      {children || <p className="r-summary-empty">{empty}</p>}
    </div>
  );

  const renderSummary = () => {
    const hasPublicCompany =
      profile.companyName ||
      profile.companyWebsite ||
      profile.companyIndustry ||
      profile.companySize ||
      profile.companyType ||
      profile.companyHeadOffice ||
      profile.aboutCompany;

    const hasWhyWork =
      profile.tagline ||
      profile.whyWorkWithUs ||
      profile.workCulture ||
      profile.perksBenefits ||
      profile.growthOpportunities ||
      profile.remoteWorkPolicy;

    const hasHiringProcess =
      profile.hiringProcessSteps ||
      profile.screeningProcess ||
      profile.interviewStages ||
      profile.expectedResponseTime;

    const hasVerificationBadge =
      profile.registrationNumber ||
      profile.businessEmailDomain ||
      profile.companyLinkedin ||
      profile.registrationDocUrl ||
      profile.approvalStatus;

    const hasContactPreferences =
      profile.recruiterName ||
      profile.recruiterEmail ||
      profile.recruiterPhone ||
      profile.preferredContactMethod ||
      profile.averageResponseTime;

    const hasTeamHiring =
      profile.hiringDepartments ||
      profile.typicalRoles ||
      profile.hiringLocations ||
      profile.seniorityLevels;

    const hasJobDefaults =
      profile.defaultJobDescription ||
      profile.defaultBenefits ||
      profile.defaultHiringProcess ||
      profile.defaultWorkArrangement;

    return (
      <div className="r-card">
        <h2 className="r-card-title">Recruiter Profile Summary</h2>
        <p className="r-card-subtitle">
          Quick overview of your public company profile, hiring process,
          verification badge, contact preferences and job post defaults.
        </p>

        <div className="r-summary-grid">
          {renderSummaryCard({
            title: "Public Company Profile",
            section: "publicCompany",
            empty: "No public company profile details added yet.",
            children: hasPublicCompany ? (
              <ul className="r-summary-list">
                {profile.companyName && (
                  <li>
                    <strong>Company:</strong> {profile.companyName}
                  </li>
                )}
                {profile.companyIndustry && (
                  <li>
                    <strong>Industry:</strong> {profile.companyIndustry}
                  </li>
                )}
                {profile.companySize && (
                  <li>
                    <strong>Size:</strong> {profile.companySize}
                  </li>
                )}
                {profile.companyType && (
                  <li>
                    <strong>Type:</strong> {profile.companyType}
                  </li>
                )}
                {profile.companyHeadOffice && (
                  <li>
                    <strong>Location:</strong> {profile.companyHeadOffice}
                  </li>
                )}
              </ul>
            ) : null,
          })}

          {renderSummaryCard({
            title: "Why Work With Us",
            section: "whyWork",
            empty: "No work culture or benefits added yet.",
            children: hasWhyWork ? (
              <ul className="r-summary-list">
                {profile.tagline && (
                  <li>
                    <strong>Tagline:</strong> {profile.tagline}
                  </li>
                )}
                {profile.workCulture && (
                  <li>
                    <strong>Culture:</strong> {profile.workCulture}
                  </li>
                )}
                {profile.perksBenefits && (
                  <li>
                    <strong>Benefits:</strong> {profile.perksBenefits}
                  </li>
                )}
                {profile.growthOpportunities && (
                  <li>
                    <strong>Growth:</strong> {profile.growthOpportunities}
                  </li>
                )}
              </ul>
            ) : null,
          })}

          {renderSummaryCard({
            title: "Hiring Process",
            section: "hiringProcess",
            empty: "No hiring process added yet.",
            children: hasHiringProcess ? (
              <ul className="r-summary-list">
                {profile.hiringProcessSteps && (
                  <li>
                    <strong>Steps:</strong> {profile.hiringProcessSteps}
                  </li>
                )}
                {profile.interviewStages && (
                  <li>
                    <strong>Stages:</strong> {profile.interviewStages}
                  </li>
                )}
                {profile.expectedResponseTime && (
                  <li>
                    <strong>Response Time:</strong>{" "}
                    {profile.expectedResponseTime}
                  </li>
                )}
              </ul>
            ) : null,
          })}

          {renderSummaryCard({
            title: "Company Verification Badge",
            section: "verificationBadge",
            empty: "No verification details added yet.",
            children: hasVerificationBadge ? (
              <ul className="r-summary-list">
                <li>
                  <strong>Status:</strong>{" "}
                  <span className={approvalBadgeClass}>
                    {profile.approvalStatus || "Pending"}
                  </span>
                </li>
                {profile.registrationNumber && (
                  <li>
                    <strong>Reg #:</strong> {profile.registrationNumber}
                  </li>
                )}
                {profile.businessEmailDomain && (
                  <li>
                    <strong>Domain:</strong> {profile.businessEmailDomain}
                  </li>
                )}
                {profile.registrationDocUrl && (
                  <li>
                    <strong>Document:</strong> Uploaded
                  </li>
                )}
              </ul>
            ) : null,
          })}

          {renderSummaryCard({
            title: "Recruiter Contact Preferences",
            section: "contactPreferences",
            empty: "No recruiter contact preferences added yet.",
            children: hasContactPreferences ? (
              <ul className="r-summary-list">
                {profile.recruiterName && (
                  <li>
                    <strong>Name:</strong> {profile.recruiterName}
                  </li>
                )}
                {profile.recruiterEmail && (
                  <li>
                    <strong>Email:</strong> {profile.recruiterEmail}
                  </li>
                )}
                {profile.preferredContactMethod && (
                  <li>
                    <strong>Preferred:</strong> {profile.preferredContactMethod}
                  </li>
                )}
                {profile.averageResponseTime && (
                  <li>
                    <strong>Response:</strong> {profile.averageResponseTime}
                  </li>
                )}
              </ul>
            ) : null,
          })}

          {renderSummaryCard({
            title: "Team / Hiring Focus",
            section: "teamHiring",
            empty: "No team or hiring focus added yet.",
            children: hasTeamHiring ? (
              <ul className="r-summary-list">
                {profile.hiringDepartments && (
                  <li>
                    <strong>Departments:</strong> {profile.hiringDepartments}
                  </li>
                )}
                {profile.typicalRoles && (
                  <li>
                    <strong>Roles:</strong> {profile.typicalRoles}
                  </li>
                )}
                {profile.hiringLocations && (
                  <li>
                    <strong>Locations:</strong> {profile.hiringLocations}
                  </li>
                )}
                {profile.seniorityLevels && (
                  <li>
                    <strong>Seniority:</strong> {profile.seniorityLevels}
                  </li>
                )}
              </ul>
            ) : null,
          })}

          {renderSummaryCard({
            title: "Job Post Defaults",
            section: "jobDefaults",
            empty: "No job post defaults added yet.",
            children: hasJobDefaults ? (
              <ul className="r-summary-list">
                {profile.defaultWorkArrangement && (
                  <li>
                    <strong>Work:</strong> {profile.defaultWorkArrangement}
                  </li>
                )}
                {profile.defaultBenefits && (
                  <li>
                    <strong>Benefits:</strong> {profile.defaultBenefits}
                  </li>
                )}
                {profile.defaultHiringProcess && (
                  <li>
                    <strong>Process:</strong> {profile.defaultHiringProcess}
                  </li>
                )}
              </ul>
            ) : null,
          })}
        </div>
      </div>
    );
  };

  /* ---------- Section renderers ---------- */

  const renderSection = () => {
    switch (activeSection) {
      case "summary":
        return renderSummary();

      case "publicCompany":
        return (
          <div className="r-card">
            <h2 className="r-card-title">Public Company Profile</h2>
            <p className="r-card-subtitle">
              Company identity that can later appear on job cards and company
              public pages.
            </p>

            <div className="r-grid-2">
              <div className="r-photo-block">
                {profile.companyLogoUrl ? (
                  // <img src={`${API_BASE}${profile.companyLogoUrl}`} alt="Company Logo" className="r-photo-img" />
                  <img
                    src={resolveFileUrl(profile.companyLogoUrl)}
                    alt="Company Logo"
                    className="r-photo-img"
                  />
                ) : (
                  <div className="r-photo-placeholder">
                    <span>Upload Logo</span>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCompanyLogoChange}
                  className="r-photo-upload-input"
                  disabled={!editingSections.publicCompany}
                />
              </div>

              <div className="r-form">
                <div className="r-form-row">
                  <label>Company Name</label>
                  <input
                    type="text"
                    value={profile.companyName}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, companyName: e.target.value }))
                    }
                    className="r-input"
                    placeholder="e.g. NexaSoft Pvt. Ltd."
                    disabled={!editingSections.publicCompany}
                  />
                </div>

                <div className="r-form-row">
                  <label>Company Website</label>
                  <input
                    type="url"
                    value={profile.companyWebsite}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        companyWebsite: e.target.value,
                      }))
                    }
                    className="r-input"
                    placeholder="https://www.company.com"
                    disabled={!editingSections.publicCompany}
                  />
                </div>

                <div className="r-form-row">
                  <label>Industry</label>
                  <select
                    value={profile.companyIndustry}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        companyIndustry: e.target.value,
                      }))
                    }
                    className="r-select"
                    disabled={!editingSections.publicCompany}
                  >
                    <option value="">Select industry...</option>
                    <option value="IT / Software">IT / Software</option>
                    <option value="Banking / FinTech">Banking / FinTech</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Education">Education</option>
                    <option value="E-Commerce">E-Commerce</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Government">Government</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="r-form-row">
                  <label>Company Size</label>
                  <select
                    value={profile.companySize}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, companySize: e.target.value }))
                    }
                    className="r-select"
                    disabled={!editingSections.publicCompany}
                  >
                    <option value="">Select size...</option>
                    <option value="1-10">1–10</option>
                    <option value="11-50">11–50</option>
                    <option value="51-200">51–200</option>
                    <option value="201-500">201–500</option>
                    <option value="500+">500+</option>
                  </select>
                </div>

                <div className="r-form-row">
                  <label>Company Type</label>
                  <select
                    value={profile.companyType}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, companyType: e.target.value }))
                    }
                    className="r-select"
                    disabled={!editingSections.publicCompany}
                  >
                    <option value="">Select type...</option>
                    <option value="Startup">Startup</option>
                    <option value="SME">SME</option>
                    <option value="Enterprise">Enterprise</option>
                    <option value="Agency">Agency</option>
                    <option value="NGO / Non-profit">NGO / Non-profit</option>
                    <option value="Government">Government</option>
                  </select>
                </div>

                <div className="r-form-row">
                  <label>Head Office Location</label>
                  <input
                    type="text"
                    value={profile.companyHeadOffice}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        companyHeadOffice: e.target.value,
                      }))
                    }
                    className="r-input"
                    placeholder="e.g. Karachi, Pakistan"
                    disabled={!editingSections.publicCompany}
                  />
                </div>
              </div>
            </div>

            <div className="r-form-row">
              <label>About Company</label>
              <textarea
                rows={4}
                value={profile.aboutCompany}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, aboutCompany: e.target.value }))
                }
                className="r-textarea"
                placeholder="Write a clear company introduction for candidates. This can later appear when candidates click the company name."
                disabled={!editingSections.publicCompany}
              />
            </div>

            {renderSaveActions("publicCompany", "Save Public Company Profile")}
          </div>
        );

      case "whyWork":
        return (
          <div className="r-card">
            <h2 className="r-card-title">Why Work With Us</h2>
            <p className="r-card-subtitle">
              Candidate-facing employer value, culture, benefits, growth and
              learning details.
            </p>

            <div className="r-form">
              <div className="r-form-row">
                <label>Company Tagline</label>
                <input
                  type="text"
                  value={profile.tagline}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, tagline: e.target.value }))
                  }
                  className="r-input"
                  placeholder="e.g. Build your future with a fast-growing tech team."
                  disabled={!editingSections.whyWork}
                />
              </div>

              <div className="r-form-row">
                <label>Why Work With Us</label>
                <textarea
                  rows={3}
                  value={profile.whyWorkWithUs}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, whyWorkWithUs: e.target.value }))
                  }
                  className="r-textarea"
                  placeholder="Explain why candidates should join your company."
                  disabled={!editingSections.whyWork}
                />
              </div>

              <div className="r-form-row">
                <label>Culture</label>
                <textarea
                  rows={3}
                  value={profile.workCulture}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, workCulture: e.target.value }))
                  }
                  className="r-textarea"
                  placeholder="e.g. collaborative, growth-oriented, transparent, supportive."
                  disabled={!editingSections.whyWork}
                />
              </div>

              <div className="r-form-row">
                <label>Core Values</label>
                <input
                  type="text"
                  value={profile.coreValues}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, coreValues: e.target.value }))
                  }
                  className="r-input"
                  placeholder="e.g. Integrity, Ownership, Learning, Inclusion"
                  disabled={!editingSections.whyWork}
                />
              </div>

              <div className="r-form-row">
                <label>Perks & Benefits</label>
                <textarea
                  rows={3}
                  value={profile.perksBenefits}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, perksBenefits: e.target.value }))
                  }
                  className="r-textarea"
                  placeholder="e.g. paid leaves, performance bonuses, health benefits, flexible schedule."
                  disabled={!editingSections.whyWork}
                />
              </div>

              <div className="r-form-row">
                <label>Growth Opportunities</label>
                <textarea
                  rows={3}
                  value={profile.growthOpportunities}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      growthOpportunities: e.target.value,
                    }))
                  }
                  className="r-textarea"
                  placeholder="Mention career growth, promotions, mentorship or leadership opportunities."
                  disabled={!editingSections.whyWork}
                />
              </div>

              <div className="r-form-row">
                <label>Remote / Hybrid Policy</label>
                <input
                  type="text"
                  value={profile.remoteWorkPolicy}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      remoteWorkPolicy: e.target.value,
                    }))
                  }
                  className="r-input"
                  placeholder="e.g. On-site, Hybrid, Remote Fridays, Fully Remote"
                  disabled={!editingSections.whyWork}
                />
              </div>

              <div className="r-form-row">
                <label>Learning Opportunities</label>
                <textarea
                  rows={3}
                  value={profile.learningOpportunities}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      learningOpportunities: e.target.value,
                    }))
                  }
                  className="r-textarea"
                  placeholder="e.g. training, certifications, internal workshops, code reviews."
                  disabled={!editingSections.whyWork}
                />
              </div>

              <div className="r-form-row">
                <label>Diversity Statement</label>
                <textarea
                  rows={3}
                  value={profile.diversityStatement}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      diversityStatement: e.target.value,
                    }))
                  }
                  className="r-textarea"
                  placeholder="Optional equal opportunity or inclusive hiring statement."
                  disabled={!editingSections.whyWork}
                />
              </div>
            </div>

            {renderSaveActions("whyWork", "Save Why Work With Us")}
          </div>
        );

      case "hiringProcess":
        return (
          <div className="r-card">
            <h2 className="r-card-title">Hiring Process</h2>
            <p className="r-card-subtitle">
              Explain your hiring flow so candidates know what happens after
              applying.
            </p>

            <div className="r-form">
              <div className="r-form-row">
                <label>Hiring Process Steps</label>
                <textarea
                  rows={3}
                  value={profile.hiringProcessSteps}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      hiringProcessSteps: e.target.value,
                    }))
                  }
                  className="r-textarea"
                  placeholder="e.g. CV screening → AI interview → recruiter review → final interview → offer"
                  disabled={!editingSections.hiringProcess}
                />
              </div>

              <div className="r-form-row">
                <label>CV Screening Process</label>
                <textarea
                  rows={3}
                  value={profile.screeningProcess}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      screeningProcess: e.target.value,
                    }))
                  }
                  className="r-textarea"
                  placeholder="Explain how CVs are reviewed or shortlisted."
                  disabled={!editingSections.hiringProcess}
                />
              </div>

              <div className="r-form-row">
                <label>Interview Stages</label>
                <textarea
                  rows={3}
                  value={profile.interviewStages}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      interviewStages: e.target.value,
                    }))
                  }
                  className="r-textarea"
                  placeholder="e.g. AI interview, technical interview, HR interview."
                  disabled={!editingSections.hiringProcess}
                />
              </div>

              <div className="r-form-row">
                <label>Expected Response Time</label>
                <input
                  type="text"
                  value={profile.expectedResponseTime}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      expectedResponseTime: e.target.value,
                    }))
                  }
                  className="r-input"
                  placeholder="e.g. 3–5 working days"
                  disabled={!editingSections.hiringProcess}
                />
              </div>

              <div className="r-form-row">
                <label>Candidate Instructions</label>
                <textarea
                  rows={3}
                  value={profile.candidateInstructions}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      candidateInstructions: e.target.value,
                    }))
                  }
                  className="r-textarea"
                  placeholder="Any instructions candidates should follow before interview."
                  disabled={!editingSections.hiringProcess}
                />
              </div>
            </div>

            {renderSaveActions("hiringProcess", "Save Hiring Process")}
          </div>
        );

      case "verificationBadge":
        return (
          <div className="r-card">
            <h2 className="r-card-title">Company Verification Badge</h2>
            <p className="r-card-subtitle">
              Details used to authenticate your company and show a verified
              badge after admin approval.
            </p>

            <div className="r-status-box">
              <span className={approvalBadgeClass}>
                {profile.approvalStatus || "Pending"}
              </span>
              <p>
                Admin approval controls the final verified badge. These details
                help verify your company.
              </p>
            </div>

            <div className="r-grid-2">
              <div className="r-photo-block">
                {profile.companyLogoUrl ? (
                  <img
                    src={resolveFileUrl(profile.companyLogoUrl)}
                    alt="Company Logo"
                    className="r-photo-img"
                  />
                ) : (
                  <div className="r-photo-placeholder">
                    <span>Company Logo</span>
                  </div>
                )}
                <small className="r-hint">
                  Logo is managed in Public Company Profile.
                </small>
              </div>

              <div className="r-form">
                <div className="r-form-row">
                  <label>Official Registration / NTN Number</label>
                  <input
                    type="text"
                    value={profile.registrationNumber}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        registrationNumber: e.target.value,
                      }))
                    }
                    className="r-input"
                    placeholder="e.g. NTN-1234567"
                    disabled={!editingSections.verificationBadge}
                  />
                </div>

                <div className="r-form-row">
                  <label>Business Email Domain</label>
                  <input
                    type="text"
                    value={profile.businessEmailDomain}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        businessEmailDomain: e.target.value,
                      }))
                    }
                    className="r-input"
                    placeholder="e.g. @company.com"
                    disabled={!editingSections.verificationBadge}
                  />
                </div>

                <div className="r-form-row">
                  <label>LinkedIn Company Page</label>
                  <input
                    type="url"
                    value={profile.companyLinkedin}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        companyLinkedin: e.target.value,
                      }))
                    }
                    className="r-input"
                    placeholder="https://www.linkedin.com/company/your-company"
                    disabled={!editingSections.verificationBadge}
                  />
                </div>

                <div className="r-form-row">
                  <label>Show Verification Badge on Public Profile</label>
                  <select
                    value={profile.verificationBadgeVisible}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        verificationBadgeVisible: e.target.value,
                      }))
                    }
                    className="r-select"
                    disabled={!editingSections.verificationBadge}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <div className="r-form-row">
                  <label>Registration Document</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleRegistrationDocUpload}
                    className="r-photo-upload-input"
                    disabled={!editingSections.verificationBadge}
                  />
                  {profile.registrationDocUrl && (
                    <small className="r-hint">
                      Current file:{" "}
                      <a
                        href={resolveFileUrl(profile.registrationDocUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View uploaded document
                      </a>
                    </small>
                  )}
                </div>
              </div>
            </div>

            <div className="r-form-row">
              <label>Verification Note</label>
              <textarea
                rows={3}
                value={profile.verificationNote}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    verificationNote: e.target.value,
                  }))
                }
                className="r-textarea"
                placeholder="Optional note for admin or candidates about company verification."
                disabled={!editingSections.verificationBadge}
              />
            </div>

            {renderSaveActions("verificationBadge", "Save Verification Badge")}
          </div>
        );

      case "contactPreferences":
        return (
          <div className="r-card">
            <h2 className="r-card-title">Recruiter Contact Preferences</h2>
            <p className="r-card-subtitle">
              Decide what recruiter contact details can later appear on job
              posts or company pages.
            </p>

            <div className="r-grid-2">
              <div className="r-photo-block">
                {profile.recruiterPhotoUrl ? (
                  <img
                    src={resolveFileUrl(profile.recruiterPhotoUrl)}
                    alt="Recruiter"
                    className="r-photo-img"
                  />
                ) : (
                  <div className="r-photo-placeholder">
                    <span>Upload Photo</span>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleRecruiterPhotoChange}
                  className="r-photo-upload-input"
                  disabled={!editingSections.contactPreferences}
                />
              </div>

              <div className="r-form">
                <div className="r-form-row">
                  <label>Recruiter / HR Name</label>
                  <input
                    type="text"
                    value={profile.recruiterName}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        recruiterName: e.target.value,
                      }))
                    }
                    className="r-input"
                    placeholder="e.g. Sana Khan"
                    disabled={!editingSections.contactPreferences}
                  />
                </div>

                <div className="r-form-row">
                  <label>Job Title</label>
                  <input
                    type="text"
                    value={profile.recruiterTitle}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        recruiterTitle: e.target.value,
                      }))
                    }
                    className="r-input"
                    placeholder="e.g. HR Manager, Talent Acquisition"
                    disabled={!editingSections.contactPreferences}
                  />
                </div>

                <div className="r-form-row">
                  <label>Work Email</label>
                  <input
                    type="email"
                    value={profile.recruiterEmail}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        recruiterEmail: e.target.value,
                      }))
                    }
                    className="r-input"
                    placeholder="name@company.com"
                    disabled={!editingSections.contactPreferences}
                  />
                </div>

                <div className="r-form-row">
                  <label>Work Phone / WhatsApp</label>
                  <input
                    type="tel"
                    value={profile.recruiterPhone}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        recruiterPhone: e.target.value,
                      }))
                    }
                    className="r-input"
                    placeholder="+92-300-0000000"
                    disabled={!editingSections.contactPreferences}
                  />
                </div>
              </div>
            </div>

            <div className="r-form">
              <div className="r-form-row">
                <label>Short Recruiter Bio</label>
                <textarea
                  rows={3}
                  value={profile.recruiterBio}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, recruiterBio: e.target.value }))
                  }
                  className="r-textarea"
                  placeholder="2–3 lines about your recruitment role."
                  disabled={!editingSections.contactPreferences}
                />
              </div>

              <div className="r-form-row">
                <label>Show Email Publicly</label>
                <select
                  value={profile.showRecruiterEmail}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      showRecruiterEmail: e.target.value,
                    }))
                  }
                  className="r-select"
                  disabled={!editingSections.contactPreferences}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div className="r-form-row">
                <label>Show Phone / WhatsApp Publicly</label>
                <select
                  value={profile.showRecruiterPhone}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      showRecruiterPhone: e.target.value,
                    }))
                  }
                  className="r-select"
                  disabled={!editingSections.contactPreferences}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div className="r-form-row">
                <label>Allow Candidate Messages</label>
                <select
                  value={profile.allowCandidateMessages}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      allowCandidateMessages: e.target.value,
                    }))
                  }
                  className="r-select"
                  disabled={!editingSections.contactPreferences}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div className="r-form-row">
                <label>Preferred Contact Method</label>
                <select
                  value={profile.preferredContactMethod}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      preferredContactMethod: e.target.value,
                    }))
                  }
                  className="r-select"
                  disabled={!editingSections.contactPreferences}
                >
                  <option value="">Select...</option>
                  <option value="Platform Messages">Platform Messages</option>
                  <option value="Email">Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Phone Call">Phone Call</option>
                </select>
              </div>

              <div className="r-form-row">
                <label>Average Response Time</label>
                <input
                  type="text"
                  value={profile.averageResponseTime}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      averageResponseTime: e.target.value,
                    }))
                  }
                  className="r-input"
                  placeholder="e.g. Within 24 hours"
                  disabled={!editingSections.contactPreferences}
                />
              </div>

              <div className="r-form-row">
                <label>Contact Instructions</label>
                <textarea
                  rows={3}
                  value={profile.contactInstructions}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      contactInstructions: e.target.value,
                    }))
                  }
                  className="r-textarea"
                  placeholder="e.g. Please apply through the platform. Shortlisted candidates will be contacted by email."
                  disabled={!editingSections.contactPreferences}
                />
              </div>
            </div>

            {renderSaveActions(
              "contactPreferences",
              "Save Contact Preferences",
            )}
          </div>
        );

      case "teamHiring":
        return (
          <div className="r-card">
            <h2 className="r-card-title">Team / Hiring Focus</h2>
            <p className="r-card-subtitle">
              Useful information about departments, common roles, locations and
              seniority levels you usually hire for.
            </p>

            <div className="r-form">
              <div className="r-form-row">
                <label>Departments Hiring For</label>
                <input
                  type="text"
                  value={profile.hiringDepartments}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      hiringDepartments: e.target.value,
                    }))
                  }
                  className="r-input"
                  placeholder="e.g. Engineering, Sales, Marketing, Finance"
                  disabled={!editingSections.teamHiring}
                />
              </div>

              <div className="r-form-row">
                <label>Common Roles</label>
                <input
                  type="text"
                  value={profile.typicalRoles}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, typicalRoles: e.target.value }))
                  }
                  className="r-input"
                  placeholder="e.g. React Developer, UI/UX Designer, Sales Executive"
                  disabled={!editingSections.teamHiring}
                />
              </div>

              <div className="r-form-row">
                <label>Hiring Locations</label>
                <input
                  type="text"
                  value={profile.hiringLocations}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      hiringLocations: e.target.value,
                    }))
                  }
                  className="r-input"
                  placeholder="e.g. Karachi, Lahore, Islamabad, Remote"
                  disabled={!editingSections.teamHiring}
                />
              </div>

              <div className="r-form-row">
                <label>Seniority Levels</label>
                <input
                  type="text"
                  value={profile.seniorityLevels}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      seniorityLevels: e.target.value,
                    }))
                  }
                  className="r-input"
                  placeholder="e.g. Internship, Entry Level, Mid Level, Senior"
                  disabled={!editingSections.teamHiring}
                />
              </div>

              <div className="r-form-row">
                <label>Team Overview</label>
                <textarea
                  rows={3}
                  value={profile.teamOverview}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, teamOverview: e.target.value }))
                  }
                  className="r-textarea"
                  placeholder="Briefly explain your teams, structure or hiring priorities."
                  disabled={!editingSections.teamHiring}
                />
              </div>

              <div className="r-form-row">
                <label>Hiring Frequency</label>
                <select
                  value={profile.hiringFrequency}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      hiringFrequency: e.target.value,
                    }))
                  }
                  className="r-select"
                  disabled={!editingSections.teamHiring}
                >
                  <option value="">Select...</option>
                  <option value="Occasionally">Occasionally</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Always Hiring">Always Hiring</option>
                </select>
              </div>
            </div>

            {renderSaveActions("teamHiring", "Save Team / Hiring Focus")}
          </div>
        );

      case "jobDefaults":
        return (
          <div className="r-card">
            <h2 className="r-card-title">Job Post Defaults</h2>
            <p className="r-card-subtitle">
              Reusable default content that can later auto-fill your job posting
              form.
            </p>

            <div className="r-form">
              <div className="r-form-row">
                <label>Default Company Description</label>
                <textarea
                  rows={4}
                  value={profile.defaultJobDescription}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      defaultJobDescription: e.target.value,
                    }))
                  }
                  className="r-textarea"
                  placeholder="Default company intro to reuse in new job posts."
                  disabled={!editingSections.jobDefaults}
                />
              </div>

              <div className="r-form-row">
                <label>Default Benefits</label>
                <textarea
                  rows={3}
                  value={profile.defaultBenefits}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      defaultBenefits: e.target.value,
                    }))
                  }
                  className="r-textarea"
                  placeholder="e.g. Paid leaves, learning budget, bonuses, flexible hours."
                  disabled={!editingSections.jobDefaults}
                />
              </div>

              <div className="r-form-row">
                <label>Default Hiring Process</label>
                <textarea
                  rows={3}
                  value={profile.defaultHiringProcess}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      defaultHiringProcess: e.target.value,
                    }))
                  }
                  className="r-textarea"
                  placeholder="e.g. CV screening → AI interview → recruiter review → final interview"
                  disabled={!editingSections.jobDefaults}
                />
              </div>

              <div className="r-form-row">
                <label>Default Work Arrangement</label>
                <select
                  value={profile.defaultWorkArrangement}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      defaultWorkArrangement: e.target.value,
                    }))
                  }
                  className="r-select"
                  disabled={!editingSections.jobDefaults}
                >
                  <option value="">Select...</option>
                  <option value="On-site">On-site</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </div>

              <div className="r-form-row">
                <label>Default Application Instructions</label>
                <textarea
                  rows={3}
                  value={profile.defaultApplicationInstructions}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      defaultApplicationInstructions: e.target.value,
                    }))
                  }
                  className="r-textarea"
                  placeholder="Instructions that should commonly appear on your job posts."
                  disabled={!editingSections.jobDefaults}
                />
              </div>
            </div>

            {renderSaveActions("jobDefaults", "Save Job Post Defaults")}
          </div>
        );

      case "settings":
        return (
          <div className="r-card">
            <h2 className="r-card-title">Security & Access</h2>
            <p className="r-card-subtitle">
              Manage your session and account-level actions.
            </p>

            <div
              className="r-actions-row"
              style={{ justifyContent: "flex-start" }}
            >
              <button className="btn-text" onClick={handleLogout}>
                Logout from this account
              </button>
            </div>

            <hr className="r-section-divider" />

            <div className="r-danger-zone">
              <h3>Danger Zone</h3>
              <p className="r-hint">
                <strong>Delete profile data</strong> will clear your recruiter
                profile and company details. Your login account will remain.
              </p>

              <button className="btn-danger" onClick={handleDeleteProfile}>
                Delete Recruiter Profile Data
              </button>

              <p className="r-hint" style={{ marginTop: "12px" }}>
                <strong>Delete account</strong> will permanently remove your
                recruiter user account and profile from the system. This cannot
                be undone.
              </p>

              <button
                className="btn-danger"
                style={{ marginTop: "4px" }}
                onClick={handleDeleteAccount}
              >
                Delete Account Permanently
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return <div className="recruiter-profile-page">Loading profile…</div>;
  }

  const menuItems = [
    { key: "summary", label: "Profile Summary", icon: "fa-regular fa-id-card" },
    {
      key: "publicCompany",
      label: "Public Company Profile",
      icon: "fa-regular fa-user",
    },
    { key: "whyWork", label: "Why Work With Us", icon: "fa-solid fa-building" },
    {
      key: "hiringProcess",
      label: "Hiring Process",
      icon: "fa-solid fa-shield-halved",
    },
    {
      key: "verificationBadge",
      label: "Company Verification Badge",
      icon: "fa-solid fa-briefcase",
    },
    {
      key: "contactPreferences",
      label: "Recruiter Contact Preferences",
      icon: "fa-solid fa-bullhorn",
    },
    {
      key: "teamHiring",
      label: "Team / Hiring Focus",
      icon: "fa-solid fa-users",
    },
    {
      key: "jobDefaults",
      label: "Job Post Defaults",
      icon: "fa-solid fa-file-lines",
    },
    { key: "settings", label: "Security & Access", icon: "fa-solid fa-lock" },
  ];

  return (
    <div className="recruiter-profile-page">
      {/* Completion bar */}
      {completion < 100 && (
        <div className="recruiter-profile-progress">
          <div className="recruiter-profile-progress-header">
            <span style={{ color: "#151313ff" }}>
              Profile completion: {completion}%
            </span>
          </div>
          <div className="recruiter-profile-progress-bar">
            <div
              className="recruiter-profile-progress-fill"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      )}

      <div className="recruiter-profile-container">
        {/* Sidebar */}
        <aside className="recruiter-profile-sidebar">
          <h2 className="recruiter-profile-sidebar-title">Recruiter Profile</h2>

          <ul className="recruiter-profile-menu">
            {menuItems.map((item) => (
              <li key={item.key}>
                <button
                  className={
                    activeSection === item.key
                      ? "recruiter-profile-menu-item active"
                      : "recruiter-profile-menu-item"
                  }
                  onClick={() => setActiveSection(item.key)}
                >
                  <i className={item.icon}></i>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}

            <li className="recruiter-profile-menu-divider" />

            <li>
              <button
                className="recruiter-profile-menu-item logout"
                onClick={handleLogout}
              >
                <i className="fa-solid fa-right-from-bracket"></i>
                <span>Logout</span>
              </button>
            </li>
          </ul>
        </aside>

        {/* Content */}
        <section className="recruiter-profile-content">
          {renderSection()}
        </section>
      </div>
    </div>
  );
};

export default RecruiterProfile;
