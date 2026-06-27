// src/layouts/AdminLayout.jsx
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import AdminNavbar from "../components/AdminNavbar";
import "./AdminLayout.css";

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="admin-layout">
      {/* Hamburger Button - visible only on mobile through CSS */}
      <button
        className="admin-hamburger"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
        type="button"
      >
        <i
          className={
            sidebarOpen ? "fa-solid fa-xmark" : "fa-solid fa-bars"
          }
        ></i>
      </button>

      {/* Overlay */}
      <div
        className={`admin-overlay ${sidebarOpen ? "show" : ""}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Sidebar */}
      <div className={`admin-sidebar ${sidebarOpen ? "mobile-open" : ""}`}>
        <AdminNavbar onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;