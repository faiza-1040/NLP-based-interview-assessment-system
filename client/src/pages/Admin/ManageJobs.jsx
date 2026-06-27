// client/src/pages/Admin/ManageJobs.jsx
import React, { useEffect, useState } from "react";
import { api } from "../../utils/api";
import "./dashboard.css";

const ManageJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [query, setQuery] = useState("");
  const [workType, setWorkType] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/jobs");
      setJobs(res.data);
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const search = query.toLowerCase();

    const matchesSearch =
      job.title?.toLowerCase().includes(search) ||
      job.createdBy?.companyName?.toLowerCase().includes(search) ||
      job.createdBy?.email?.toLowerCase().includes(search);

    const matchesWorkType =
      workType === "all" || job.workArrangement === workType;

    return matchesSearch && matchesWorkType;
  });

  const isExpired = (job) => {
    if (job.isClosed) return true;
    if (!job.applicationDeadline) return false;
    return new Date(job.applicationDeadline) < new Date();
  };

  return (
    <div className="admin-dashboard">
      <section className="admin-page-hero">
        <div>
          <p className="admin-eyebrow">Job Monitoring</p>
          <h1>Manage Jobs</h1>
          <p>
            Review all jobs posted by recruiters, including work type, salary
            range, deadline, recruiter company, and job status.
          </p>
        </div>
      </section>

      <div className="admin-filter-row">
        <input
          className="admin-simple-input"
          placeholder="Search by job title, company, or recruiter email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <select
          className="admin-simple-select"
          value={workType}
          onChange={(e) => setWorkType(e.target.value)}
        >
          <option value="all">All Work Types</option>
          <option value="Remote">Remote</option>
          <option value="Hybrid">Hybrid</option>
          <option value="On-site">On-site</option>
        </select>
      </div>

      <section className="admin-section">
        <div className="table-card">
          <div className="admin-section-header">
            <h3 className="admin-section-title">All Job Posts</h3>
            <span className="admin-section-count">
              {filteredJobs.length} jobs
            </span>
          </div>

          <div className="table-wrapper">
            <table className="recruiters-table">
              <thead>
                <tr>
                  <th>Job Title</th>
                  <th>Company / Recruiter</th>
                  <th>Work Type</th>
                  <th>Location</th>
                  <th>Salary</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>Posted On</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="8" className="empty-row">
                      Loading jobs...
                    </td>
                  </tr>
                )}

                {!loading && filteredJobs.length === 0 && (
                  <tr>
                    <td colSpan="8" className="empty-row">
                      No jobs found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredJobs.map((job) => (
                    <tr key={job._id}>
                      <td className="company-name-cell">{job.title}</td>

                      <td>
                        {job.createdBy?.companyName ||
                          job.createdBy?.name ||
                          "Unknown"}
                        <br />
                        <small>{job.createdBy?.email || "-"}</small>
                      </td>

                      <td>{job.workArrangement}</td>

                      <td>{job.jobLocation || job.location || "-"}</td>

                      <td>
                        {job.salaryVisible === "No"
                          ? "Hidden"
                          : `${job.salaryMin || 0} - ${job.salaryMax || 0}`}
                      </td>

                      <td>
                        {job.applicationDeadline
                          ? new Date(
                              job.applicationDeadline
                            ).toLocaleDateString()
                          : "-"}
                      </td>

                      <td>
                        <span
                          className={`status-pill ${
                            isExpired(job)
                              ? "status-declined"
                              : "status-approved"
                          }`}
                        >
                          {isExpired(job) ? "Closed" : "Open"}
                        </span>
                      </td>

                      <td>
                        {job.createdAt
                          ? new Date(job.createdAt).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ManageJobs;
