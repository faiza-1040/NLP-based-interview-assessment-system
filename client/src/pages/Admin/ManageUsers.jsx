// client/src/pages/Admin/ManageUsers.jsx
import React, { useEffect, useState } from "react";
import { api } from "../../utils/api";
import "./dashboard.css";

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/users");
      setUsers(res.data);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const search = query.toLowerCase();

    const matchesSearch =
      user.name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.role?.toLowerCase().includes(search);

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="admin-dashboard">
      <section className="admin-page-hero">
        <div>
          <p className="admin-eyebrow">User Management</p>
          <h1>Manage Users</h1>
          <p>
            View all registered candidates, recruiters, admins, account status,
            verification state, and onboarding progress.
          </p>
        </div>
      </section>

      <div className="admin-filter-row">
        <input
          className="admin-simple-input"
          placeholder="Search users by name, email, or role"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <select
          className="admin-simple-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          <option value="candidate">Candidates</option>
          <option value="recruiter">Recruiters</option>
          <option value="admin">Admins</option>
          <option value="pending">Pending Role</option>
        </select>
      </div>

      <section className="admin-section">
        <div className="table-card">
          <div className="admin-section-header">
            <h3 className="admin-section-title">Platform Users</h3>
            <span className="admin-section-count">
              {filteredUsers.length} users
            </span>
          </div>

          <div className="table-wrapper">
            <table className="recruiters-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Email Verified</th>
                  <th>Onboarding</th>
                  <th>Joined</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="7" className="empty-row">
                      Loading users...
                    </td>
                  </tr>
                )}

                {!loading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-row">
                      No users found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredUsers.map((user) => (
                    <tr key={user._id}>
                      <td className="company-name-cell">
                        {user.name || "-"}
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className="status-pill status-approved">
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill status-${user.status}`}>
                          {user.status}
                        </span>
                      </td>
                      <td>{user.emailVerified ? "Yes" : "No"}</td>
                      <td>{user.onboardingStep || "-"}</td>
                      <td>
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString()
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

export default ManageUsers;
