// client/src/auth/ResetPassword.jsx
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import './Login.css';

/**
 * Layout wrapper for all reset-password content.
 * Defined OUTSIDE the main component so it does NOT remount on every keystroke.
 */
function ResetCardLayout({ children }) {
  return (
    <div className="login-page">
      <div className="background-section">
        <div className="auth-container">
          {/* LEFT HERO */}
          <div className="auth-left">
            <div className="hero-logo-wrapper">
              {/* use public/ assets with leading slash */}
              <img src="/logo.png" alt="Talent Hire Logo" className="hero-logo" />
            </div>

            <h1 className="hero-title">
              Smart screening for<br /> smarter hiring
            </h1>

            <p className="hero-subtitle">
              The Future of Tech Interviews. Streamline your recruitment process
              with our AI-powered assessment platform.
            </p>

            <div className="hero-image-wrapper">
              <img src="/login.png" alt="Talent Hire Illustration" className="hero-image" />
            </div>
          </div>

          {/* RIGHT CARD CONTENT */}
          <div className="auth-right">
            <div className="auth-card">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const token = sp.get('token') || '';

  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [showP1, setShowP1] = useState(false); // 👁 toggle new password
  const [showP2, setShowP2] = useState(false); // 👁 toggle confirm password

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const valid = useMemo(() => p1.length >= 8 && p1 === p2, [p1, p2]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!valid) {
      return setError('Passwords must match and be at least 8 characters.');
    }
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password: p1 });
      alert('Password reset successful. Please log in.');
      nav('/login');
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  // If token is missing/invalid, show simple card
  if (!token) {
    return (
      <ResetCardLayout>
        <h2 className="auth-title">Invalid reset link</h2>
        <p className="auth-subtitle">
          The reset link is missing or invalid. Please request a new one.
        </p>
        <Link to="/forgot-password">
          <button className="primary-btn">Go to Forgot Password</button>
        </Link>
      </ResetCardLayout>
    );
  }

  return (
    <ResetCardLayout>
      <h2 className="auth-title">Reset your password</h2>
      <p className="auth-subtitle">
        Your password must be at least eight characters long and cannot contain spaces.
      </p>

      <form onSubmit={submit}>
        {/* NEW PASSWORD with eye toggle */}
        <label className="field-label">New Password</label>
        <div className="password-wrapper">
          <input
            type={showP1 ? 'text' : 'password'}
            placeholder="Enter new password"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            className="text-input password-input"
          />
          <button
            type="button"
            className="password-eye"
            onClick={() => setShowP1((v) => !v)}
            aria-label={showP1 ? 'Hide password' : 'Show password'}
          >
            <i className={showP1 ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} />
          </button>
        </div>

        {/* CONFIRM PASSWORD with eye toggle */}
        <label className="field-label">Confirm Password</label>
        <div className="password-wrapper">
          <input
            type={showP2 ? 'text' : 'password'}
            placeholder="Confirm password"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            className="text-input password-input"
          />
          <button
            type="button"
            className="password-eye"
            onClick={() => setShowP2((v) => !v)}
            aria-label={showP2 ? 'Hide password' : 'Show password'}
          >
            <i className={showP2 ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} />
          </button>
        </div>

        <div
          style={{
            background: '#eef6ff',
            padding: '10px',
            borderRadius: 6,
            fontSize: 14,
            marginBottom: 10,
          }}
        >
          <span>ℹ️ Changing your password will log you out of all active sessions.</span>
        </div>

        {error && <div className="error">{error}</div>}

        <button
          type="submit"
          disabled={submitting || !valid}
          className="primary-btn"
        >
          {submitting ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    </ResetCardLayout>
  );
}
