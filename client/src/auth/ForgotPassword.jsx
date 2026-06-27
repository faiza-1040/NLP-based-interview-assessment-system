// client/src/auth/ForgotPassword.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import './Login.css';

export default function ForgotPassword() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      nav('/forgot/sent', { state: { email } });
    } catch (err) {
      setError(err?.response?.data?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="background-section">
        <div className="auth-container">
          {/* LEFT HERO (same as login) */}
          <div className="auth-left">
            <div className="hero-logo-wrapper">
              <img src="logo.png" alt="Talent Hire Logo" className="hero-logo" />
            </div>

            <h1 className="hero-title">
              Smart screening for<br /> smarter hiring
            </h1>

            <p className="hero-subtitle">
              The Future of Tech Interviews. Streamline your recruitment process
              with our AI-powered assessment platform.
            </p>

            <div className="hero-image-wrapper">
              <img src="login.png" alt="Talent Hire Illustration" className="hero-image" />
            </div>
          </div>

          {/* RIGHT CARD */}
          <div className="auth-right">
            <div className="auth-card">
              <h2 className="auth-title">Reset your password</h2>
              <p className="auth-subtitle">
                Enter your email address below and we will send you a reset password link.
              </p>

              <form onSubmit={submit}>
                <label className="field-label">Email Address</label>
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-input"
                />
                {error && <div className="error">{error}</div>}

                <button type="submit" disabled={submitting} className="primary-btn">
                  {submitting ? 'Sending...' : 'Send link'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
