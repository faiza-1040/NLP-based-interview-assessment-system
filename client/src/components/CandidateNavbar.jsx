// client/src/components/CandidateNavbar.jsx
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

const CandidateNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) =>
    location.pathname === path ? "nav-link active" : "nav-link";

  const navItems = [
    {
      path: "/candidate/job-search",
      icon: "fa-solid fa-magnifying-glass",
      label: "Job Search",
    },
    {
      path: "/candidate/resume-builder",
      icon: "fa-regular fa-file-lines",
      label: "Resume Builder",
    },
    {
      path: "/candidate/applied-jobs",
      icon: "fa-regular fa-clipboard",
      label: "Applied Jobs",
    },
    {
      path: "/candidate/manage-cv",
      icon: "fa-solid fa-briefcase",
      label: "Manage CV",
    },
    {
      path: "/candidate/mock-interview",
      icon: "fa-solid fa-microphone",
      label: "Mock Interview",
    },
    {
      path: "/candidate/interview-invitation",
      icon: "fa-regular fa-calendar-check",
      label: "Interview Invitation",
    },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <nav className="candidate-navbar">
        <div className="nav-container">
          {/* Hamburger Button - only visible on mobile through CSS */}
          <button
            className="candidate-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            type="button"
          >
            <i
              className={
                mobileMenuOpen ? "fa-solid fa-xmark" : "fa-solid fa-bars"
              }
            ></i>
          </button>

          {/* Logo Section */}
          <div className="nav-logo">
            <img
              src="/logo.png"
              alt="CareerConnect"
              className="logo-img"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "block";
              }}
            />
            <div className="logo-fallback" style={{ display: "none" }}>
              <span>CareerConnect</span>
            </div>
          </div>

          {/* Navigation Links - Desktop */}
          <div className="nav-links">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} className={isActive(item.path)}>
                <i className={`${item.icon} nav-icon`}></i>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Profile Shortcut */}
          <div className="nav-profile">
            <button
              className="profile-trigger profile-trigger-inline"
              onClick={() => navigate("/candidate/profile")}
              type="button"
            >
              <div className="profile-avatar">
                <i className="fa-regular fa-user"></i>
              </div>
              <i className="fa-solid fa-chevron-right profile-arrow"></i>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Menu */}
      <div
        className={`candidate-overlay ${mobileMenuOpen ? "show" : ""}`}
        onClick={closeMobileMenu}
      ></div>

      <nav className={`candidate-mobile-nav ${mobileMenuOpen ? "show" : ""}`}>
        <div className="mobile-nav-header">
          <span className="mobile-nav-welcome">Welcome Candidate</span>
          <button
            className="mobile-nav-close"
            onClick={closeMobileMenu}
            aria-label="Close menu"
            type="button"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="mobile-nav-items">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`${isActive(item.path)} mobile-nav-item`}
              onClick={closeMobileMenu}
            >
              <span className="active-left-line"></span>
              <i className={`${item.icon} nav-icon`}></i>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}

          <div className="mobile-nav-divider"></div>

          <Link
            to="/candidate/profile"
            className={`${isActive("/candidate/profile")} mobile-nav-item`}
            onClick={closeMobileMenu}
            style={{ marginTop: "auto" }}
          >
            <span className="active-left-line"></span>
            <i className="fa-regular fa-user nav-icon"></i>
            <span className="nav-label">Profile</span>
          </Link>
        </div>
      </nav>
    </>
  );
};

export default CandidateNavbar;