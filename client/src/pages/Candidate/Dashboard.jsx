
//src/pages/candidate/Dashboard.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';


const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to job search when candidate logs in
    navigate('/candidate/job-search');
  }, [navigate]);

  return (
    <div className="dashboard-redirect">
      <div className="loading-spinner"></div>
      <p>Redirecting to Job Search...</p>
    </div>
  );
};

export default Dashboard;