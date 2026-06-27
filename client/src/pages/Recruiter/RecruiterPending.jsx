// // src/pages/Recruiter/RecruiterPending.jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/authContext';

export default function RecruiterPending() {
  const nav = useNavigate();
  const { logoutAuth } = useAuth();

  const handleLogout = async () => {
    await logoutAuth();
    nav('/login');
  };

  return (
    <div
      className="pending-message"
      style={{ textAlign: 'center', marginTop: '50px' }}
    >
      <h2>Your recruiter account is pending approval.</h2>
      <p>
        Please verify your email and wait for admin approval before accessing the recruiter dashboard.
      </p>
      <button onClick={handleLogout} style={{ marginTop: '20px' }}>
        Logout
      </button>
    </div>
  );
}