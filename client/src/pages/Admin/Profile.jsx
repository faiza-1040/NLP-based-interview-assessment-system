// client/src/pages/Admin/Profile.jsx
import React, { useEffect, useState } from "react";
import { api } from "../../utils/api";
import "./dashboard.css";

const AdminProfile = () => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdmin();
  }, []);

  const fetchAdmin = async () => {
    try {
      setLoading(true);
      const res = await api.get("/auth/me");
      setAdmin(res.data.user);
    } catch (error) {
      console.error("Failed to load admin profile:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-dashboard">
      <section className="admin-page-hero">
        <div>
          <p className="admin-eyebrow">Admin Account</p>
          <h1>Profile</h1>
          <p>View your admin account details and current authentication state.</p>
        </div>
      </section>

      {loading && <div className="analytics-loading">Loading profile...</div>}

      {!loading && (
        <section className="profile-card enhanced-profile-card">
          <div className="profile-avatar enhanced-profile-avatar">
            {admin?.name?.charAt(0)?.toUpperCase() || "A"}
          </div>

          <div className="profile-info enhanced-profile-info">
            <h2>{admin?.name || "Admin User"}</h2>
            <p>{admin?.email || "Loading..."}</p>

            <div className="profile-meta">
              <span className="status-pill status-approved">
                {admin?.role || "admin"}
              </span>

              <span className="status-pill status-approved">
                Active Account
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminProfile;
