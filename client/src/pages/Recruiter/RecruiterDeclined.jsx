// //client/src/pages/Recruiter/RecruiterDeclined.jsx
// import React from 'react';
// import { useNavigate } from 'react-router-dom';

// const RecruiterDeclined = () => {
//   const navigate = useNavigate();
//   const reason = localStorage.getItem('declineReason');

//   return (
//     <div style={{ padding: '20px', textAlign: 'center' }}>
//       <p>Your account has been declined.</p>
// <p><strong>Reason:</strong> {reason}</p>
//       <button onClick={() => navigate('/login')}>Back to Login</button>
//     </div>
//   );
// };

// export default RecruiterDeclined;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/authContext';

const RecruiterDeclined = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const reason = user?.declineReason || 'No reason provided';

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <p>Your account has been declined.</p>
      <p><strong>Reason:</strong> {reason}</p>
      <button onClick={() => navigate('/login')}>Back to Login</button>
    </div>
  );
};

export default RecruiterDeclined;
