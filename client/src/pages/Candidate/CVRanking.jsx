// src/pages/Candidate/CVRanking.jsx
import React from 'react';

const CVRanking = () => {
  // Sample data for ranking
  const ranking = {
    jobTitle: "Software Engineer",
    rank: 2,
    totalApplicants: 120,
  };

  return (
    <div className="cv-ranking-container">
      <h2>Your CV Ranking</h2>
      <p>
        Job Title: <strong>{ranking.jobTitle}</strong>
      </p>
      <p>
        You are ranked <strong>{ranking.rank}</strong> out of{" "}
        <strong>{ranking.totalApplicants}</strong> applicants.
      </p>
      <button className="primary-btn">View Feedback</button>
    </div>
  );
};

export default CVRanking;
