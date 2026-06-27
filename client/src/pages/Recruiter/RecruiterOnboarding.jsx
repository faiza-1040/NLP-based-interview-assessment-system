// src/pages/Recruiter/RecruiterOnboarding.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { useAuth } from '../../context/authContext';
import './RecruiterOnboarding.css';

export default function RecruiterOnboarding() {
  const [form, setForm] = useState({
    companyName: '',
    recruiterName: '',
    officialEmail: '',
    contactNumber: '',
    website: '',
    address: '',
    description: '',
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nav = useNavigate();
  const { updateUserAuth } = useAuth();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const { data } = await api.put('/auth/recruiter-info', form);

      if (data?.user) {
        updateUserAuth(data.user);
      }

      alert('✅ Recruiter onboarding submitted successfully. Please wait for email verification and admin approval.');
      nav('/recruiter/pending');
    } catch (err) {
      console.error('❌ Error submitting recruiter info:', err);

      const msgFromServer =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Something went wrong while submitting your info.';

      setErrorMsg(msgFromServer);
    } finally {
      setSubmitting(false);
    }
  };

  const totalFields = Object.keys(form).length;
  const filledFields = Object.values(form).filter(
    (v) => String(v).trim() !== ''
  ).length;
  const progressPercent =
    totalFields === 0 ? 0 : Math.min(100, (filledFields / totalFields) * 100);

  return (
    <div className="recruiter-onboarding-page">
      <h1 className="onboarding-main-title">
        Welcome! Let’s set up your profile.
      </h1>
      <p className="onboarding-subtitle">
        Complete the information below to start connecting with top talent.
      </p>

      <div className="recruiter-onboarding-card">
        <div className="card-header">
          <h2 className="card-title">Recruiter Information</h2>
          <div className="card-progress-track">
            <div
              className="card-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              marginBottom: 12,
              padding: '8px 10px',
              borderRadius: 8,
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              color: '#991b1b',
              fontSize: '0.85rem',
            }}
          >
            {errorMsg}
          </div>
        )}

        <form className="recruiter-onboarding-form" onSubmit={handleSubmit}>
          <div className="form-row two-cols">
            <div className="form-field">
              <label htmlFor="companyName">Company Name</label>
              <input
                id="companyName"
                name="companyName"
                type="text"
                placeholder="Enter your company name"
                value={form.companyName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="recruiterName">Recruiter Name</label>
              <input
                id="recruiterName"
                name="recruiterName"
                type="text"
                placeholder="Enter your full name"
                value={form.recruiterName}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row two-cols">
            <div className="form-field">
              <label htmlFor="officialEmail">Official Email</label>
              <input
                id="officialEmail"
                name="officialEmail"
                type="email"
                placeholder="j.doe@acmecorp.com"
                value={form.officialEmail}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="contactNumber">Contact Number</label>
              <input
                id="contactNumber"
                name="contactNumber"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={form.contactNumber}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="url"
                placeholder="https://www.example.com"
                value={form.website}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="address">Address</label>
              <input
                id="address"
                name="address"
                type="text"
                placeholder="123 Main Street"
                value={form.address}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="description">
                Brief description about your company
              </label>
              <textarea
                id="description"
                name="description"
                placeholder="Describe your company’s mission, values, and culture..."
                rows={4}
                value={form.description}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="card-footer">
            <div className="footer-divider" />
            <button type="submit" className="continue-btn" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}