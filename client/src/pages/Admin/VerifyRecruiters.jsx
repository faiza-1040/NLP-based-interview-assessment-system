// client/src/pages/Admin/VerifyRecruiters.jsx
import React, { useEffect, useState } from "react";
import { api } from "../../utils/api";
import "./dashboard.css";

const VerifyRecruiters = () => {
  const [recruiters, setRecruiters] = useState([]);
  const [comments, setComments] = useState({});
  const [disabledStatus, setDisabledStatus] = useState({});
  const [declinedIds, setDeclinedIds] = useState(new Set());
  const [showSubmit, setShowSubmit] = useState({});
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchRecruiters();
  }, []);

  const fetchRecruiters = async () => {
    try {
      const response = await api.get("/admin/recruiters");
      const data = response.data;

      setRecruiters(data);

      const initialStatus = {};
      const declined = new Set();
      const submitFlags = {};

      data.forEach((r) => {
        const isDeclined = r.status === "declined" || r.status === "rejected";
        initialStatus[r._id] = isDeclined;
        submitFlags[r._id] = false;

        if (isDeclined) declined.add(r._id);
      });

      setDisabledStatus(initialStatus);
      setDeclinedIds(declined);
      setShowSubmit(submitFlags);
    } catch (error) {
      console.error("Error fetching recruiters:", error);
    }
  };

  const handleApprove = async (id, name) => {
    try {
      await api.put(`/admin/recruiters/${id}/status`, {
        status: "approved",
      });

      alert(`Recruiter ${name || ""} has been approved.`);
      fetchRecruiters();
    } catch (error) {
      console.error("Error approving recruiter:", error);
    }
  };

  const handleDecline = (id) => {
    setDisabledStatus((prev) => ({ ...prev, [id]: false }));
    setShowSubmit((prev) => ({ ...prev, [id]: true }));
  };

  const handleSubmitDecline = async (id) => {
    const reason = comments[id]?.trim();

    if (!reason) {
      alert("Please provide a reason before submitting.");
      return;
    }

    try {
      await api.put(`/admin/recruiters/${id}/status`, {
        status: "declined",
        declineReason: reason,
      });

      setDisabledStatus((prev) => ({ ...prev, [id]: true }));

      setDeclinedIds((prev) => {
        const clone = new Set(prev);
        clone.add(id);
        return clone;
      });

      setShowSubmit((prev) => ({ ...prev, [id]: false }));
      fetchRecruiters();
    } catch (error) {
      console.error("Error submitting decline:", error);
    }
  };

  const handleCommentChange = (id, value) => {
    setComments((prev) => ({ ...prev, [id]: value }));
  };

  const pendingCount = recruiters.filter((r) => r.status === "pending").length;

  const approvedCount = recruiters.filter(
    (r) => r.status === "approved"
  ).length;

  const rejectedCount = recruiters.filter(
    (r) => r.status === "declined" || r.status === "rejected"
  ).length;

  const getFilteredRecruiters = () => {
    let list = recruiters;

    if (activeTab === "pending") {
      list = list.filter((r) => r.status === "pending");
    } else if (activeTab === "approved") {
      list = list.filter((r) => r.status === "approved");
    } else if (activeTab === "rejected") {
      list = list.filter(
        (r) => r.status === "declined" || r.status === "rejected"
      );
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase();

    return list.filter((r) => {
      const email = (r.email || "").toLowerCase();
      const officialEmail = (r.officialEmail || "").toLowerCase();
      const companyName = (r.companyName || "").toLowerCase();
      const recruiterName = (r.recruiterName || "").toLowerCase();

      return (
        email.includes(q) ||
        officialEmail.includes(q) ||
        companyName.includes(q) ||
        recruiterName.includes(q)
      );
    });
  };

  const getCurrentTitle = () => {
    if (activeTab === "pending") return "Pending Recruiter Applications";
    if (activeTab === "approved") return "Approved Recruiters";
    return "Rejected / Declined Recruiters";
  };

  const sectionRecruiters = getFilteredRecruiters();

  return (
    <div className="admin-dashboard">
      <section className="admin-page-hero">
        <div>
          <p className="admin-eyebrow">Recruiter Verification</p>
          <h1>Verify Recruiters</h1>
          <p>
            Review recruiter onboarding requests, approve verified companies,
            or decline applications with a clear reason.
          </p>
        </div>
      </section>

      <div className="admin-search-bar-row">
        <div className="admin-search-wrapper">
          <div className="admin-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
              <path
                d="M10.5 4a6.5 6.5 0 0 1 5.148 10.516l3.918 3.918a1 1 0 0 1-1.414 1.414l-3.918-3.918A6.5 6.5 0 1 1 10.5 4zm0 2a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9z"
                fill="currentColor"
              />
            </svg>
          </div>

          <input
            type="text"
            className="admin-search-input"
            placeholder="Search by recruiter name, email, official email, or company"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="tabs-container">
        <button
          type="button"
          className={`tab-button ${
            activeTab === "pending" ? "tab-button-active" : ""
          }`}
          onClick={() => setActiveTab("pending")}
        >
          <span>Pending</span>
          <span
            className={`tab-badge ${
              activeTab === "pending"
                ? "tab-badge-active"
                : "tab-badge-inactive"
            }`}
          >
            {pendingCount}
          </span>
        </button>

        <button
          type="button"
          className={`tab-button ${
            activeTab === "approved" ? "tab-button-active" : ""
          }`}
          onClick={() => setActiveTab("approved")}
        >
          <span>Approved</span>
          <span
            className={`tab-badge ${
              activeTab === "approved"
                ? "tab-badge-active"
                : "tab-badge-inactive"
            }`}
          >
            {approvedCount}
          </span>
        </button>

        <button
          type="button"
          className={`tab-button ${
            activeTab === "rejected" ? "tab-button-active" : ""
          }`}
          onClick={() => setActiveTab("rejected")}
        >
          <span>Rejected</span>
          <span
            className={`tab-badge ${
              activeTab === "rejected"
                ? "tab-badge-active"
                : "tab-badge-inactive"
            }`}
          >
            {rejectedCount}
          </span>
        </button>
      </div>

      <section className="admin-section">
        <div className="table-card">
          <div className="admin-section-header">
            <h3 className="admin-section-title">{getCurrentTitle()}</h3>

            <span className="admin-section-count">
              {sectionRecruiters.length} recruiter
              {sectionRecruiters.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="table-wrapper">
            <table className="recruiters-table">
              <thead>
                <tr>
                  <th>Recruiter</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Official Email</th>
                  <th>Phone</th>
                  <th>Website</th>
                  <th>Address</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                  <th>Decline Reason</th>
                </tr>
              </thead>

              <tbody>
                {sectionRecruiters.length === 0 && (
                  <tr>
                    <td colSpan={11} className="empty-row">
                      No recruiters found in this section.
                    </td>
                  </tr>
                )}

                {sectionRecruiters.map((r) => {
                  const isDeclined = declinedIds.has(r._id);
                  const showSubmitButton = showSubmit[r._id];

                  const websiteLabel = r.website
                    ? r.website.replace(/^https?:\/\//, "")
                    : "-";

                  const websiteHref = r.website
                    ? r.website.startsWith("http")
                      ? r.website
                      : `http://${r.website}`
                    : "#";

                  return (
                    <tr
                      key={r._id}
                      className={`recruiter-row ${
                        isDeclined ? "recruiter-row-declined" : ""
                      }`}
                    >
                      <td className="company-name-cell">
                        {r.recruiterName || r.name || "-"}
                      </td>

                      <td className="cell-text">{r.email || "-"}</td>

                      <td className="company-name-cell">
                        {r.companyName || "-"}
                      </td>

                      <td className="cell-text">{r.officialEmail || "-"}</td>

                      <td className="cell-text">{r.contactNumber || "-"}</td>

                      <td className="cell-text">
                        {r.website ? (
                          <a
                            href={websiteHref}
                            target="_blank"
                            rel="noreferrer"
                            className="website-link"
                          >
                            {websiteLabel}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="address-cell">{r.address || "-"}</td>

                      <td className="description-cell">
                        {r.description || "-"}
                      </td>

                      <td>
                        <span className={`status-pill status-${r.status}`}>
                          {r.status}
                        </span>
                      </td>

                      <td className="actions-cell">
                        {r.status === "pending" && (
                          <>
                            <button
                              type="button"
                              className="btn btn-approve"
                              onClick={() =>
                                handleApprove(r._id, r.companyName)
                              }
                            >
                              Approve
                            </button>

                            <button
                              type="button"
                              className="btn btn-decline"
                              onClick={() => handleDecline(r._id)}
                            >
                              Decline
                            </button>

                            {showSubmitButton && (
                              <button
                                type="button"
                                className="btn btn-submit"
                                onClick={() => handleSubmitDecline(r._id)}
                              >
                                Submit
                              </button>
                            )}
                          </>
                        )}

                        {r.status === "approved" && (
                          <>
                            <button
                              type="button"
                              className="btn btn-decline"
                              onClick={() => handleDecline(r._id)}
                            >
                              Decline
                            </button>

                            {showSubmitButton && (
                              <button
                                type="button"
                                className="btn btn-submit"
                                onClick={() => handleSubmitDecline(r._id)}
                              >
                                Submit
                              </button>
                            )}
                          </>
                        )}

                        {(r.status === "declined" ||
                          r.status === "rejected") && (
                          <button
                            type="button"
                            className="btn btn-approve"
                            onClick={() => handleApprove(r._id, r.companyName)}
                          >
                            Approve
                          </button>
                        )}
                      </td>

                      <td className="comment-cell">
                        <textarea
                          placeholder="Enter reason for decline"
                          rows="2"
                          disabled={disabledStatus[r._id]}
                          value={comments[r._id] || r.declineReason || ""}
                          onChange={(e) =>
                            handleCommentChange(r._id, e.target.value)
                          }
                          className={`comment-textarea ${
                            isDeclined ? "comment-textarea-disabled" : ""
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default VerifyRecruiters;
