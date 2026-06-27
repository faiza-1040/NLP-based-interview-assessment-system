// src/components/AdminNavbar.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Briefcase,
  BarChart3,
  Settings,
  UserCircle,
  LogOut,
} from "lucide-react";
import { api } from "../utils/api";

const AdminNavbar = ({ onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }

    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      localStorage.clear();
      navigate("/login", { replace: true });
    }
  };

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  const navItems = [
    {
      label: "Dashboard",
      path: "/admin",
      icon: LayoutDashboard,
    },
    {
      label: "Verify Recruiters",
      path: "/admin/verify-recruiters",
      icon: ShieldCheck,
    },
    {
      label: "Manage Users",
      path: "/admin/manage-users",
      icon: Users,
    },
    {
      label: "Manage Jobs",
      path: "/admin/manage-jobs",
      icon: Briefcase,
    },
    {
      label: "Reports",
      path: "/admin/reports",
      icon: BarChart3,
    },
    {
      label: "Site Settings",
      path: "/admin/site-settings",
      icon: Settings,
    },
    {
      label: "Profile",
      path: "/admin/profile",
      icon: UserCircle,
    },
  ];

  return (
    <>
      {/* Mobile Nav Header (Visible only on mobile) */}
      <div className="mobile-nav-header">
        <span className="mobile-nav-welcome">Welcome Admin</span>
        <button className="mobile-nav-close" onClick={handleLinkClick} aria-label="Close menu">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* Desktop Brand Section (Hidden on mobile) */}
      <div className="admin-sidebar-brand">
        <img
          src="/logo.png"
          alt="CareerConnect Admin"
          className="admin-sidebar-logo"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />

        <div>
          <h2>Talent Hire</h2>
          <p>Admin Panel</p>
        </div>
      </div>

      <nav className="admin-sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`admin-sidebar-link ${
                isActive(item.path) ? "admin-sidebar-link-active" : ""
              }`}
              onClick={handleLinkClick}
            >
              <span className="active-left-line"></span>
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mobile-nav-divider"></div>

      <button
        type="button"
        className="admin-sidebar-logout"
        onClick={handleLogout}
      >
        <span className="active-left-line"></span>
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </>
  );
};

export default AdminNavbar;
