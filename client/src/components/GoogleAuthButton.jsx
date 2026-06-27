import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/authContext';

export default function GoogleAuthButton() {
  const nav = useNavigate();
  const { loginAuth } = useAuth();

  const redirectByUserState = (user) => {
    if (!user) {
      alert('Google login response is invalid.');
      return;
    }

    loginAuth({ user });

    const { role, status, emailVerified, onboardingStep, declineReason } = user;

    if (role === 'admin') {
      nav('/admin', { replace: true });
      return;
    }

    if (role === 'pending' || onboardingStep === 'choose-role') {
      alert('✅ Google account connected. Please choose your role.');
      nav('/choose-role', { replace: true });
      return;
    }

    if (role === 'candidate') {
      if (!emailVerified) {
        alert('Please verify your email first.');
        nav('/login', { replace: true });
        return;
      }

      nav('/candidate', { replace: true });
      return;
    }

    if (role === 'recruiter') {
      if (!emailVerified) {
        alert('Please verify your email first.');
        nav('/login', { replace: true });
        return;
      }

      if (onboardingStep === 'recruiter-onboarding' && status === 'pending') {
        nav('/recruiter/onboarding', { replace: true });
        return;
      }

      if (status === 'pending') {
        nav('/recruiter/pending', { replace: true });
        return;
      }

      if (status === 'declined' || status === 'rejected') {
        alert(
          `❌ Your account was declined. Reason: ${
            declineReason || 'No reason provided'
          }`
        );
        nav('/recruiter/declined', { replace: true });
        return;
      }

      nav('/recruiter', { replace: true });
      return;
    }

    nav('/login', { replace: true });
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const credential = credentialResponse?.credential;

      if (!credential) {
        alert('Google credential missing. Please try again.');
        return;
      }

      const { data } = await api.post('/auth/google', { credential });

      redirectByUserState(data.user);
    } catch (error) {
      console.error('Google auth error:', error);
      alert(
        error.response?.data?.message ||
          'Google login failed. Please try again.'
      );
    }
  };

  return (
    <div className="google-auth-box">
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() => {
          alert('Google login failed. Please try again.');
        }}
        useOneTap={false}
      />
    </div>
  );
}