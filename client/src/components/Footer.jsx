// client/src/components/Footer.jsx
import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./Footer.css";

const AUTH_TOKEN_KEY = "token";
const LOGIN_ROUTE = "/login";

const isLoggedIn = () => !!localStorage.getItem(AUTH_TOKEN_KEY);

const Footer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const authPaths = [
    "/",
    "/login",
    "/signup",
    "/choose-role",
    "/forgot-password",
    "/forgot/sent",
    "/reset-password",
    "/recruiter/onboarding",
    "/recruiter/pending",
    "/recruiter/declined",
  ];

  const isAuthPage = authPaths.includes(location.pathname);

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleProtectedClick = (event, path) => {
    event.preventDefault();

    if (isAuthPage && !isLoggedIn()) {
      scrollToTop();
      return;
    }

    if (isLoggedIn()) {
      navigate(path);
      scrollToTop();
      return;
    }

    navigate(LOGIN_ROUTE);
    scrollToTop();
  };

  const handleLandingLinkClick = (sectionId) => {
    navigate("/", { state: { scrollTo: sectionId } });
  };

  const ProtectedFooterLink = ({ label, path }) => (
    <Link
      to={path}
      className="th-footer-link"
      onClick={(e) => handleProtectedClick(e, path)}
    >
      {label}
    </Link>
  );

  return (
    <footer className="th-footer" id="contact">
      <div className="th-footer-container">
        <div className="th-footer-grid">
          <div className="th-footer-column">
            <h4 className="th-footer-title">FOR CANDIDATES</h4>

            <ProtectedFooterLink
              label="Create CV"
              path="/candidate/resume-builder"
            />
            <ProtectedFooterLink
              label="Applied Jobs"
              path="/candidate/applied-jobs"
            />
            <ProtectedFooterLink
              label="Mock Interview"
              path="/candidate/mock-interview"
            />
            <ProtectedFooterLink
              label="Job Apply"
              path="/candidate/job-search"
            />
          </div>

          <div className="th-footer-column">
            <h4 className="th-footer-title">FOR RECRUITERS</h4>

            <ProtectedFooterLink
              label="Post a Job"
              path="/recruiter/post-job"
            />
            <ProtectedFooterLink
              label="View Candidate"
              path="/recruiter/search-candidates"
            />
            <ProtectedFooterLink
              label="CV Ranking"
              path="/recruiter/my-jobs"
            />
            <ProtectedFooterLink label="Dashboard" path="/recruiter" />
          </div>

          <div className="th-footer-column">
            <h4 className="th-footer-title">COMPANY</h4>

            <button
              type="button"
              className="th-footer-link th-footer-button"
              onClick={() => handleLandingLinkClick("about")}
            >
              About us
            </button>

            <button
              type="button"
              className="th-footer-link th-footer-button"
              onClick={() => handleLandingLinkClick("services")}
            >
              Services
            </button>

            <button
              type="button"
              className="th-footer-link th-footer-button"
              onClick={() => handleLandingLinkClick("why-choose-us")}
            >
              Why choose us
            </button>

            <button
              type="button"
              className="th-footer-link th-footer-button"
              onClick={() => handleLandingLinkClick("contact")}
            >
              Contact us
            </button>
          </div>

          <div className="th-footer-column">
            <h4 className="th-footer-title">LEGAL</h4>

            <Link to="/terms" className="th-footer-link" onClick={scrollToTop}>
              Terms &amp; Conditions
            </Link>

            <Link to="/privacy" className="th-footer-link" onClick={scrollToTop}>
              Privacy
            </Link>
          </div>

          <div className="th-footer-column">
            <h4 className="th-footer-title">FOLLOW US</h4>

            <div className="th-footer-social">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Twitter"
              >
                <i className="fab fa-twitter" />
                <span>𝕏</span>
              </a>

              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
              >
                <i className="fab fa-linkedin-in" />
                <span>in</span>
              </a>

              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
              >
                <i className="fab fa-facebook-f" />
                <span>f</span>
              </a>
            </div>
          </div>
        </div>

        <div className="th-footer-divider" />

        <div className="th-footer-bottom">
          <p>© 2024 JobPlatform. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
