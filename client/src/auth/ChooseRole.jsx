// client/src/auth/ChooseRole.jsx
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { useAuth } from "../context/authContext";
import "./Login.css";

export default function ChooseRole() {
  const nav = useNavigate();
  const { updateUserAuth } = useAuth();

  const choose = async (role) => {
    try {
      if (role === "candidate") {
        const { data } = await api.put("/auth/user-info");

        const user = data.user;
        if (user) {
          updateUserAuth(user);
        }

        if (user?.emailVerified && user?.status === "approved") {
          alert("✅ Candidate role selected successfully.");
          nav("/candidate", { replace: true });
          return;
        }

        alert(
          "✅ Verification email sent. Please check your inbox and verify your email before logging in.",
        );
        nav("/login");
      } else {
        const { data } = await api.put("/auth/select-recruiter-role");

        const user = data.user;
        if (user) {
          updateUserAuth(user);
        }

        alert(
          "✅ Recruiter role selected. Please complete recruiter onboarding.",
        );
        nav("/recruiter/onboarding", { replace: true });
      }
    } catch (error) {
      alert(
        error?.response?.data?.message ||
          "❌ Failed to update role. Please try again.",
      );
    }
  };

  return (
    <div className="login-page">
      <div className="background-section">
        <div className="auth-container">
          <div className="auth-left">
            <div className="hero-logo-wrapper">
              <img
                src="/logo.png"
                alt="Talent Hire Logo"
                className="hero-logo"
              />
            </div>

            <h1 className="hero-title">
              Smart screening for
              <br /> smarter hiring
            </h1>

            <p className="hero-subtitle">
              The Future of Tech Interviews. Streamline your recruitment process
              with our AI-powered assessment platform.
            </p>

            <div className="hero-image-wrapper">
              <img
                src="/login.png"
                alt="Talent Hire Illustration"
                className="hero-image"
              />
            </div>
          </div>

          <div className="auth-right">
            <div className="auth-card">
              <h2 className="auth-title">Continue As</h2>
              <p className="auth-subtitle">
                Choose how you want to use Talent Hire.
              </p>

              <div className="role-buttons">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => choose("candidate")}
                >
                  I’m a Candidate
                </button>

                <button
                  type="button"
                  className="primary-btn secondary-btn"
                  onClick={() => choose("recruiter")}
                >
                  I’m a Recruiter
                </button>
              </div>

              <p
                style={{ marginTop: 14, fontSize: "0.85rem", color: "#6b7280" }}
              >
                You can only choose one role per account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
