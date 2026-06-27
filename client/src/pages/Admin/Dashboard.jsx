// src/pages/Admin/Dashboard.jsx
import React, { useEffect, useState } from "react";
import "./dashboard.css";
import { api } from "../../utils/api";
import {
  Users,
  UserCheck,
  Briefcase,
  FileText,
  Video,
  Activity,
  ShieldCheck,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

const chartColors = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
];

const AdminDashboard = () => {
  const [dashboardStats, setDashboardStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setStatsLoading(true);
      setStatsError("");

      const res = await api.get("/admin/dashboard-stats");
      setDashboardStats(res.data);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setStatsError("Unable to load dashboard analytics.");
    } finally {
      setStatsLoading(false);
    }
  };

  if (statsLoading) {
    return (
      <div className="admin-dashboard">
        <div className="analytics-loading">
          Loading dashboard analytics...
        </div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="admin-dashboard">
        <div className="analytics-error">{statsError}</div>
      </div>
    );
  }

  if (!dashboardStats) {
    return (
      <div className="admin-dashboard">
        <div className="analytics-error">No dashboard data found.</div>
      </div>
    );
  }

  const {
    usersByRole = [],
    recruitersByStatus = [],
    applicationsByStatus = [],
    interviewsByStatus = [],
    jobsByWorkArrangement = [],
    monthlyUsers = [],
    monthlyApplications = [],
  } = dashboardStats.charts || {};

  const statCards = [
    {
      title: "Total Users",
      value: dashboardStats.cards?.totalUsers || 0,
      hint: "Candidates, recruiters and admins",
      icon: Users,
      className: "card-blue",
    },
    {
      title: "Candidates",
      value: dashboardStats.cards?.totalCandidates || 0,
      hint: "Registered candidate accounts",
      icon: UserCheck,
      className: "card-green",
    },
    {
      title: "Recruiters",
      value: dashboardStats.cards?.totalRecruiters || 0,
      hint: `${dashboardStats.cards?.pendingRecruiters || 0} pending approval`,
      icon: ShieldCheck,
      className: "card-orange",
    },
    {
      title: "Total Jobs",
      value: dashboardStats.cards?.totalJobs || 0,
      hint: `${dashboardStats.cards?.openJobs || 0} open jobs`,
      icon: Briefcase,
      className: "card-purple",
    },
    {
      title: "Applications",
      value: dashboardStats.cards?.totalApplications || 0,
      hint: "Candidate job applications",
      icon: FileText,
      className: "card-cyan",
    },
    {
      title: "Interviews",
      value: dashboardStats.cards?.totalInterviews || 0,
      hint: `${dashboardStats.cards?.completedInterviews || 0} completed`,
      icon: Video,
      className: "card-red",
    },
    {
      title: "Avg Match Score",
      value: `${dashboardStats.cards?.avgMatchScore || 0}%`,
      hint: "AI resume-job matching",
      icon: Activity,
      className: "card-blue",
    },
    {
      title: "Profiles Created",
      value:
        (dashboardStats.cards?.candidateProfiles || 0) +
        (dashboardStats.cards?.recruiterProfiles || 0),
      hint: "Candidate + recruiter profiles",
      icon: Clock,
      className: "card-green",
    },
  ];

  return (
    <div className="admin-dashboard">
      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Admin Overview</p>
          <h1>Admin Dashboard</h1>
          <p>
            Monitor users, job posts, applications, interviews, recruiter
            approvals, and AI matching activity from one professional dashboard.
          </p>
        </div>

        <button
          type="button"
          className="refresh-btn"
          onClick={fetchDashboardStats}
        >
          Refresh Data
        </button>
      </section>

      <section className="stats-grid">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <article className={`stat-card ${card.className}`} key={card.title}>
              <div className="stat-icon">
                <Icon size={22} />
              </div>

              <div>
                <p>{card.title}</p>
                <h3>{card.value}</h3>
                <span>{card.hint}</span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="charts-grid">
        <div className="chart-card large-chart">
          <div className="chart-header">
            <h3>Monthly User Growth</h3>
            <span>New users grouped by month</span>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyUsers}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="users"
                stroke="#2563eb"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>Users by Role</h3>
            <span>Candidate, recruiter, admin distribution</span>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={usersByRole}
                dataKey="value"
                nameKey="name"
                outerRadius={95}
                label
              >
                {usersByRole.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={chartColors[index % chartColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>Recruiter Status</h3>
            <span>Pending, approved, rejected recruiters</span>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={recruitersByStatus}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>Applications by Status</h3>
            <span>Hiring pipeline overview</span>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={applicationsByStatus}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#16a34a" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>Interview Status</h3>
            <span>Generated, active and completed interviews</span>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={interviewsByStatus}
                dataKey="value"
                nameKey="name"
                outerRadius={95}
                label
              >
                {interviewsByStatus.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={chartColors[index % chartColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <h3>Jobs by Work Type</h3>
            <span>Remote, hybrid and on-site jobs</span>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={jobsByWorkArrangement}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#f97316" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card large-chart">
          <div className="chart-header">
            <h3>Monthly Applications</h3>
            <span>Candidate application activity</span>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyApplications}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="applications"
                stroke="#16a34a"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="recent-grid">
        <div className="recent-card">
          <h3>Recent Users</h3>

          {dashboardStats.recent?.users?.length > 0 ? (
            dashboardStats.recent.users.map((user) => (
              <div className="recent-item" key={user._id}>
                <div>
                  <strong>{user.name || "Unnamed User"}</strong>
                  <span>{user.email}</span>
                </div>
                <em>{user.role}</em>
              </div>
            ))
          ) : (
            <p className="empty-mini">No recent users found.</p>
          )}
        </div>

        <div className="recent-card">
          <h3>Recent Jobs</h3>

          {dashboardStats.recent?.jobs?.length > 0 ? (
            dashboardStats.recent.jobs.map((job) => (
              <div className="recent-item" key={job._id}>
                <div>
                  <strong>{job.title}</strong>
                  <span>
                    {job.createdBy?.companyName ||
                      job.createdBy?.name ||
                      "Unknown recruiter"}
                  </span>
                </div>
                <em>{job.workArrangement || "N/A"}</em>
              </div>
            ))
          ) : (
            <p className="empty-mini">No recent jobs found.</p>
          )}
        </div>

        <div className="recent-card">
          <h3>Recent Applications</h3>

          {dashboardStats.recent?.applications?.length > 0 ? (
            dashboardStats.recent.applications.map((app) => (
              <div className="recent-item" key={app._id}>
                <div>
                  <strong>{app.candidate?.name || "Candidate"}</strong>
                  <span>{app.job?.title || "Job removed"}</span>
                </div>
                <em>{app.status}</em>
              </div>
            ))
          ) : (
            <p className="empty-mini">No recent applications found.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
