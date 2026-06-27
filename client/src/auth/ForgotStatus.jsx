// client/src/auth/ForgotStatus.jsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import './Login.css';

const COOLDOWN_SEC = 120; // 2 minutes

export default function ForgotStatus() {
  const { state } = useLocation();
  const email = state?.email || '';
  const [left, setLeft] = useState(COOLDOWN_SEC);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setMsg('');
    setLeft(COOLDOWN_SEC);
  }, [email]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [left]);

  const formatted = useMemo(() => {
    const m = String(Math.floor(left / 60)).padStart(2, '0');
    const s = String(left % 60).padStart(2, '0');
    return `${m}:${s}`;
  }, [left]);

  const resend = async () => {
    setSending(true);
    setMsg('');
    try {
      await api.post('/auth/forgot-password/resend', { email });
      setMsg('We re-sent the password reset email.');
      setLeft(COOLDOWN_SEC);
    } catch (e) {
      setMsg('Could not resend right now, please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="login-page">
      <div className="background-section">
        <div className="auth-container">
          {/* LEFT HERO */}
          <div className="auth-left">
            <div className="hero-logo-wrapper">
              {/* note the leading / */}
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
              {/* note the leading / */}
              <img src="/login.png" alt="Talent Hire Illustration" className="hero-image" />
            </div>
          </div>

          {/* RIGHT CARD */}
          <div className="auth-right">
            <div className="auth-card">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 56, lineHeight: '56px' }}>✉️</div>
                <h2 className="auth-title">A link is sent to your email</h2>
                <p className="auth-subtitle">
                  Instructions for resetting your password have been sent to your email
                  {email ? ` ${email}` : ''}.
                </p>
                <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                  Didn’t receive it? Try resend again after <b>{formatted}</b>.
                </p>
                {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
                <button
                  type="button"
                  disabled={left > 0 || sending}
                  onClick={resend}
                  className="primary-btn"
                  style={{ marginTop: 16, opacity: left > 0 ? 0.6 : 1 }}
                >
                  {sending ? 'Resending…' : 'Resend link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
