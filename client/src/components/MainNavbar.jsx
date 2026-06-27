// client/src/components/MainNavbar.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./MainNavbar.css";

const MainNavbar = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navLinks = [
    { href: "#about", label: "About" },
    { href: "#services", label: "Services" },
  ];

  return (
    <>
      <nav className="main-navbar">
        <div className="nav-inner">
          {/* Hamburger Button - only visible on mobile through CSS */}
          <button
            className="main-hamburger"
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

          {/* LOGO IMAGE */}
          <img
            src="/logo.png"
            alt="TalentHire Logo"
            className="nav-logo-img"
            onClick={() => navigate("/")}
          />

          {/* Desktop Navigation */}
          <div className="nav-links">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="nav-link">
                {link.label}
              </a>
            ))}

            <button
              className="nav-login-btn"
              onClick={() => navigate("/login")}
              type="button"
            >
              Login
            </button>

            <button
              className="nav-signup-btn"
              onClick={() => navigate("/signup")}
              type="button"
            >
              Sign Up
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div
        className={`main-overlay ${mobileMenuOpen ? "show" : ""}`}
        onClick={closeMobileMenu}
      ></div>

      <nav className={`main-mobile-nav ${mobileMenuOpen ? "show" : ""}`}>
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="nav-link"
            onClick={closeMobileMenu}
          >
            {link.label}
          </a>
        ))}

        <button
          className="nav-link mobile-auth-btn"
          onClick={() => {
            navigate("/login");
            closeMobileMenu();
          }}
          type="button"
        >
          Login
        </button>

        <button
          className="nav-link mobile-auth-btn"
          onClick={() => {
            navigate("/signup");
            closeMobileMenu();
          }}
          type="button"
        >
          Sign Up
        </button>
      </nav>
    </>
  );
};

export default MainNavbar;