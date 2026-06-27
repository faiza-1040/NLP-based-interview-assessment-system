// src/layouts/AuthLayout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import Footer from "../components/Footer";
import "./AuthLayout.css";

const AuthLayout = () => {
  return (
    <>
      <div className="auth-layout">
        <main className="auth-main">
          <Outlet />
        </main>
      </div>

      {/* Full-width footer */}
      <Footer />
    </>
  );
};

export default AuthLayout;
