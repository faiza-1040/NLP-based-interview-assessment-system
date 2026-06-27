
// client/src/pages/Recruiter/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../utils/api";
import {
  Line,
  Bar,
  Doughnut,
} from "react-chartjs-2";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

import { jobApi } from "../../utils/jobApi";
import "./RecruiterDashboard.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

const API_BASE = import.meta?.env?.VITE_API_BASE || "http://127.0.0.1:5000";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fmtDateOnly = (d) => {
  try {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return "";
    return x.toLocaleDateString();
  } catch {
    return "";
  }
};

export default function RecruiterDashboard() {
  const [jobs, setJobs] = useState([]);          // full jobs from jobApi.mine()
  const [apps, setApps] = useState([]);          // applications from /recruiter/all
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // 1) Jobs you posted
        const jobsRes = await jobApi.mine();
        const jobList = Array.isArray(jobsRes.data)
          ? jobsRes.data
          : jobsRes.data?.jobs || [];
        setJobs(jobList);

        // 2) All applications for your jobs
        const appsRes = await api.get("/applications/recruiter/all");
        const appsList = appsRes.data.applications || [];
        setApps(appsList);
      } catch (e) {
        console.error(e);
        const status = e?.response?.status;
        const msg =
          e?.response?.data?.message ||
          (status === 401
            ? "Please sign in as recruiter."
            : "Failed to load dashboard data.");
        setErr(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ===========================
     BASIC STATS (real data)
     =========================== */
  const stats = useMemo(() => {
    const totalJobs = jobs.length;
    const openJobs = jobs.filter((j) => !j.isClosed).length;
    const closedJobs = jobs.filter((j) => j.isClosed).length;

    const totalApplications = apps.length;
    const invitedCandidates = apps.filter(
      (a) => a.status === "Invited, not yet confirmed"
    ).length;
    const confirmedInterviews = apps.filter(
      (a) => a.status === "InterviewConfirmed"
    ).length;

    const todayStr = fmtDateOnly(new Date());
    const applicationsToday = apps.filter(
      (a) => fmtDateOnly(a.createdAt) === todayStr
    ).length;

    return {
      totalJobs,
      openJobs,
      closedJobs,
      totalApplications,
      invitedCandidates,
      confirmedInterviews,
      applicationsToday,
    };
  }, [jobs, apps]);

  /* ===========================
     APPLICATIONS OVER LAST 7 DAYS
     =========================== */
  const applicationsOverTimeData = useMemo(() => {
    if (!apps.length) {
      return {
        labels: [],
        datasets: [
          {
            label: "Applications",
            data: [],
            borderColor: "#2563eb",
            backgroundColor: "rgba(37,99,235,0.12)",
          },
        ],
      };
    }

    const today = new Date();
    const labels = [];
    const counts = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - i
      );
      const key = d.toLocaleDateString();
      labels.push(key);

      const c = apps.filter(
        (a) => fmtDateOnly(a.createdAt) === key
      ).length;
      counts.push(c);
    }

    return {
      labels,
      datasets: [
        {
          label: "Applications",
          data: counts,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.12)",
        },
      ],
    };
  }, [apps]);

  const applicationsOverTimeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#e5e7eb",
        bodyColor: "#e5e7eb",
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 11 } },
        grid: { color: "rgba(148,163,184,0.2)" },
      },
    },
  };

  /* ===========================
     APPLICATIONS PER JOB
     =========================== */
  const applicationsPerJobData = useMemo(() => {
    if (!apps.length) {
      return {
        labels: [],
        datasets: [
          {
            label: "Applications per Job",
            data: [],
            backgroundColor: "#1d4ed8",
            borderColor: "#1d4ed8",
          },
        ],
      };
    }

    const countsByJob = {};
    apps.forEach((a) => {
      const jobId = a.job?._id || a.job;
      if (!jobId) return;
      const title = a.job?.title || "Job";
      if (!countsByJob[jobId]) {
        countsByJob[jobId] = { title, count: 0 };
      }
      countsByJob[jobId].count += 1;
    });

    const labels = [];
    const data = [];
    Object.values(countsByJob).forEach((item) => {
      labels.push(item.title);
      data.push(item.count);
    });

    return {
      labels,
      datasets: [
        {
          label: "Applications",
          data,
          borderWidth: 1,
          borderColor: "#1d4ed8",
          backgroundColor: "rgba(37,99,235,0.16)",
        },
      ],
    };
  }, [apps]);

  const applicationsPerJobOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#e5e7eb",
        bodyColor: "#e5e7eb",
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 11 } },
        grid: { color: "rgba(148,163,184,0.2)" },
      },
    },
  };

  /* ===========================
     PIPELINE STATUS DISTRIBUTION
     =========================== */
  const pipelineStatusData = useMemo(() => {
    if (!apps.length) {
      return {
        labels: ["Applied", "Invited", "Interview Confirmed", "Other"],
        datasets: [
          {
            data: [0, 0, 0, 0],
            backgroundColor: [
              "rgba(15,23,42,0.6)",
              "rgba(22,163,74,0.5)",
              "rgba(37,99,235,0.5)",
              "rgba(148,163,184,0.5)",
            ],
            borderColor: [
              "#0f172a",
              "#16a34a",
              "#2563eb",
              "#94a3b8",
            ],
            borderWidth: 1,
          },
        ],
      };
    }

    let applied = 0;
    let invited = 0;
    let confirmed = 0;
    let other = 0;

    apps.forEach((a) => {
      const s = a.status || "Applied";
      if (s === "Applied") applied++;
      else if (s === "Invited, not yet confirmed") invited++;
      else if (s === "InterviewConfirmed") confirmed++;
      else other++;
    });

    return {
      labels: ["Applied", "Invited", "Interview Confirmed", "Other"],
      datasets: [
        {
          data: [applied, invited, confirmed, other],
          backgroundColor: [
            "rgba(15,23,42,0.8)",  // dark slate
            "rgba(22,163,74,0.7)", // green
            "rgba(37,99,235,0.7)", // blue
            "rgba(148,163,184,0.7)", // gray
          ],
          borderColor: ["#020617", "#15803d", "#1d4ed8", "#64748b"],
          borderWidth: 1,
        },
      ],
    };
  }, [apps]);

  const pipelineStatusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          boxWidth: 14,
          font: { size: 11 },
          color: "#111827",
        },
      },
      tooltip: {
        backgroundColor: "#020617",
        titleColor: "#e5e7eb",
        bodyColor: "#e5e7eb",
      },
    },
  };

  /* ===========================
     APPLICATIONS BY SOURCE
     =========================== */
  const appsBySourceData = useMemo(() => {
    if (!apps.length) {
      return {
        labels: [],
        datasets: [
          {
            label: "Applications by Source",
            data: [],
            backgroundColor: "#22c55e",
            borderColor: "#16a34a",
          },
        ],
      };
    }

    const countsBySource = {};
    apps.forEach((a) => {
      const src = a.resumeSource || "default";
      countsBySource[src] = (countsBySource[src] || 0) + 1;
    });

    const labels = Object.keys(countsBySource);
    const data = Object.values(countsBySource);

    return {
      labels,
      datasets: [
        {
          label: "Applications",
          data,
          borderWidth: 1,
          borderColor: "#16a34a",
          backgroundColor: "rgba(22,163,74,0.16)",
        },
      ],
    };
  }, [apps]);

  const appsBySourceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#022c22",
        titleColor: "#e5e7eb",
        bodyColor: "#e5e7eb",
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 11 } },
        grid: { color: "rgba(148,163,184,0.2)" },
      },
    },
  };

  if (loading) return <p style={{ padding: 16 }}>Loading dashboard…</p>;
  if (err) return <p style={{ padding: 16, color: "#dc2626" }}>{err}</p>;

  return (
    <div className="rd-container">
      {/* Header */}
      <div className="rd-header">
        <div>
          <h2 className="rd-title">Recruiter Dashboard</h2>
          <p className="rd-subtitle">
            See how your jobs are performing and how candidates move through the pipeline.
          </p>
        </div>
      </div>

      {/* Top stats (real data) */}
      <div className="rd-stats-grid">
        <div className="rd-stat-card">
          <div className="rd-stat-label">Jobs Posted</div>
          <div className="rd-stat-value">{stats.totalJobs}</div>
          <div className="rd-stat-foot">
            {stats.openJobs} open · {stats.closedJobs} closed
          </div>
        </div>

        <div className="rd-stat-card">
          <div className="rd-stat-label">Total Applications</div>
          <div className="rd-stat-value">{stats.totalApplications}</div>
          <div className="rd-stat-foot">
            {stats.applicationsToday} received today
          </div>
        </div>

        <div className="rd-stat-card">
          <div className="rd-stat-label">Candidates Invited</div>
          <div className="rd-stat-value">{stats.invitedCandidates}</div>
          <div className="rd-stat-foot">
            Waiting to confirm interview
          </div>
        </div>

        <div className="rd-stat-card">
          <div className="rd-stat-label">Interviews Confirmed</div>
          <div className="rd-stat-value">{stats.confirmedInterviews}</div>
          <div className="rd-stat-foot">
            Marked as InterviewConfirmed
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="rd-charts-grid">
        <div className="rd-card rd-chart-card">
          <div className="rd-card-header">
            <div>
              <h3 className="rd-card-title">Applications (last 7 days)</h3>
              <p className="rd-card-subtitle">
                Daily trend of candidates applying to your jobs.
              </p>
            </div>
          </div>
          <div className="rd-chart-wrapper">
            <Line data={applicationsOverTimeData} options={applicationsOverTimeOptions} />
          </div>
        </div>

        <div className="rd-card rd-chart-card">
          <div className="rd-card-header">
            <div>
              <h3 className="rd-card-title">Applications per job</h3>
              <p className="rd-card-subtitle">
                Which roles are attracting the most interest.
              </p>
            </div>
          </div>
          <div className="rd-chart-wrapper">
            <Bar data={applicationsPerJobData} options={applicationsPerJobOptions} />
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="rd-charts-grid rd-bottom-grid">
        <div className="rd-card rd-chart-card">
          <div className="rd-card-header">
            <div>
              <h3 className="rd-card-title">Pipeline status</h3>
              <p className="rd-card-subtitle">
                How candidates are distributed across stages.
              </p>
            </div>
          </div>
          <div className="rd-chart-wrapper rd-chart-wrapper-small">
            <Doughnut data={pipelineStatusData} options={pipelineStatusOptions} />
          </div>
        </div>

        <div className="rd-card rd-chart-card">
          <div className="rd-card-header">
            <div>
              <h3 className="rd-card-title">Applications by source</h3>
              <p className="rd-card-subtitle">
                Based on <code>resumeSource</code> (e.g. default, upload, etc.).
              </p>
            </div>
          </div>
          <div className="rd-chart-wrapper">
            <Bar data={appsBySourceData} options={appsBySourceOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
