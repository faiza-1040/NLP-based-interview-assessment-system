import React, { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import "./LandingPage.css";

const services = [
  {
    icon: "🤖",
    title: "Automated AI Interviews",
    text: "Generates tailored interview questions from each candidate's skills and experience and provides consistent, AI-driven scoring.",
    color: "red",
  },
  {
    icon: "♛",
    title: "Candidate Ranking",
    text: "Scores and ranks candidates based on resume relevance and interview performance so recruiters can quickly identify top talent.",
    color: "purple",
  },
  {
    icon: "🎧",
    title: "Mock Interview Practice",
    text: "Gives candidates a safe environment to rehearse interviews and receive AI feedback to build confidence and communication skills.",
    color: "blue",
  },
  {
    icon: "▧",
    title: "Real-Time Insights",
    text: "Delivers live analytics on pipeline health, bottlenecks, and hiring performance across roles and teams.",
    color: "green",
  },
];

const features = [
  {
    icon: "⌾",
    title: "AI-Powered",
    text: "Smarter decisions with every hire",
  },
  {
    icon: "◎",
    title: "Accurate Rankings",
    text: "Top talent surfaced faster",
  },
  {
    icon: "▣",
    title: "Bias-Reduced",
    text: "Fair and consistent evaluations",
  },
  {
    icon: "ϟ",
    title: "Time-Saving",
    text: "Reduce time-to-hire significantly",
  },
];

const LandingPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const scrollToSection = useCallback((sectionId) => {
    const el = document.getElementById(sectionId);

    if (!el) return;

    const NAV_OFFSET = 78;
    const y = el.getBoundingClientRect().top + window.pageYOffset - NAV_OFFSET;

    window.scrollTo({
      top: y,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    if (location.state?.scrollTo) {
      setTimeout(() => {
        scrollToSection(location.state.scrollTo);
      }, 300);
    }
  }, [location.state, scrollToSection]);

  const handleGetStarted = () => {
    navigate("/login");
  };

  return (
    <div className="landing-page">
      {/* NAVBAR */}
      <header className="landing-navbar">
        <div className="navbar-inner">
          <button
            type="button"
            className="navbar-logo-btn"
            onClick={() => scrollToSection("hero")}
            aria-label="Go to home"
          >
            <img
              src="/logo1.png"
              alt="Talent Hire Logo"
              className="navbar-logo-img"
            />
          </button>

          <nav className="nav-links">
            <button type="button" onClick={() => scrollToSection("about")}>
              About
            </button>

            <button type="button" onClick={() => scrollToSection("services")}>
              Services
            </button>

            <button
              type="button"
              onClick={() => scrollToSection("why-choose-us")}
            >
              Why choose us
            </button>

            <button type="button" onClick={() => scrollToSection("contact")}>
              Contact
            </button>
          </nav>

          <div className="nav-actions">
            <button
              type="button"
              className="nav-btn nav-btn--outline"
              onClick={() => navigate("/login")}
            >
              Login
            </button>

            <button
              type="button"
              className="nav-btn nav-btn--solid"
              onClick={() => navigate("/signup")}
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="landing-hero" id="hero">
        <div className="hero-bg-orb hero-bg-orb--one" />
        <div className="hero-bg-orb hero-bg-orb--two" />
        <div className="hero-grid-pattern" />

        <div className="hero-inner">
          <div className="hero-left">
            <p className="hero-tagline">
              Smart Screening for Smarter Hiring <span>✦</span>
            </p>

            <h1 className="hero-heading">
              <span className="hero-heading-line hero-heading-line--white">
                SMART HIRING
              </span>

              <span className="hero-heading-line hero-heading-line--mixed">
                BY <span>AI</span>
              </span>
            </h1>

            <p className="hero-extra">
              TalentHire turns messy resumes into clear matches helping
              candidates find perfect roles and recruiters move from screening
              to offers in a fraction of the time.
            </p>

            <button className="hero-cta" onClick={handleGetStarted}>
              Get Started <span>→</span>
            </button>

            <div className="hero-social-proof">
              <div className="avatar-stack">
                <span />
                <span />
                <span />
                <span />
              </div>

              <p>
                <strong>10K+</strong> recruiters and hiring teams <br />
                trust TalentHire
              </p>
            </div>
          </div>

          <div className="hero-right">
            <div className="floating-icon floating-icon--brain">☷</div>
            <div className="floating-icon floating-icon--users">♙</div>
            <div className="floating-icon floating-icon--chart">↗</div>

            <div className="hero-orbit hero-orbit--one" />
            <div className="hero-orbit hero-orbit--two" />

            <div className="candidate-panel">
              <div className="candidate-card">
                <div className="candidate-avatar candidate-avatar--blue">T</div>

                <div>
                  <h4>Top Candidate</h4>
                  <p>Full-Stack Engineer</p>
                </div>

                <span className="match-pill match-pill--green">90% Match</span>
              </div>

              <div className="candidate-card">
                <div className="candidate-avatar candidate-avatar--orange">
                  S
                </div>

                <div>
                  <h4>Shortlisted</h4>
                  <p>Backend Developer</p>
                </div>

                <span className="match-pill match-pill--orange">
                  85% Match
                </span>
              </div>

              <div className="summary-card">
                <div className="summary-header">
                  <span>AI Interview Summary</span>
                  <strong>Score 90%</strong>
                </div>

                <p>
                  Candidate shows strong problem-solving, clear communication,
                  and deep understanding of system design.
                </p>
              </div>
            </div>

            <div className="hero-platform" />
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="landing-section services-section" id="services">
        <div className="section-inner">
          <p className="section-label">Services</p>
          <h2 className="section-title">Services we offer</h2>
          <div className="section-underline" />

          <div className="services-grid">
            {services.map((service) => (
              <article className="service-card" key={service.title}>
                <div className={`service-icon service-icon--${service.color}`}>
                  {service.icon}
                </div>

                <h3>{service.title}</h3>
                <span className={`card-line card-line--${service.color}`} />
                <p>{service.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="landing-section about-section" id="about">
        <div className="about-wrapper">
          <div className="about-content">
            <p className="about-label">About Us</p>

            <h2>
              Leading companies <br />
              trust us to hire developers
            </h2>

            <p>
              We strengthen recruitment teams by adding AI intelligence at every
              stage of hiring. From automated resume analysis to smart
              interviews and candidate ranking, TalentHire ensures seamless,
              reliable, and high-quality hiring decisions.
            </p>

            <div className="stats-row">
              <div>
                <span>▣</span>
                <strong>10K+</strong>
                <small>Companies</small>
              </div>

              <div>
                <span>◈</span>
                <strong>500K+</strong>
                <small>Candidates</small>
              </div>

              <div>
                <span>◎</span>
                <strong>98%</strong>
                <small>Satisfaction</small>
              </div>

              <div>
                <span>★</span>
                <strong>4.8/5</strong>
                <small>Rating</small>
              </div>
            </div>
          </div>

          <div className="about-visual">
            <div className="laptop">
              <div className="laptop-topbar" />

              <div className="laptop-content">
                <div className="laptop-sidebar" />

                <div className="laptop-list">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <div className="laptop-chart" />
              </div>
            </div>

            <div className="shield-card">✓</div>

            <div className="trust-badge">
              <span>♟</span>

              <p>
                Trusted by teams <br />
                that build the future
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="landing-section why-section" id="why-choose-us">
        <div className="section-inner why-inner">
          <p className="section-label">Why Choose Us</p>

          <h2 className="why-heading">
            We power <span>your hiring</span>
          </h2>

          <p className="why-text">
            Our AI models are trained on real hiring scenarios, giving you
            explainable scores, structured feedback, and a consistent process
            across every team and location.
          </p>

          <div className="why-features">
            {features.map((feature) => (
              <div className="why-feature" key={feature.title}>
                <div className="why-icon">{feature.icon}</div>

                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SAME FOOTER USED ON OTHER PAGES */}
      <Footer />
    </div>
  );
};

export default LandingPage;