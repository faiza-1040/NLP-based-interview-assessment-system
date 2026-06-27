// src/layouts/RecruiterLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import RecruiterNavbar from '../components/RecruiterNavbar';
import Footer from '../components/Footer';
import './RecruiterLayout.css';

const RecruiterLayout = () => {
  return (
    <>
      <div className="recruiter-layout">
        <RecruiterNavbar />

        <main className="recruiter-main">
          <div className="recruiter-content">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Full-width footer */}
      <Footer />
    </>
  );
};

export default RecruiterLayout;
