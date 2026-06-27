// client/src/auth/Signup.jsx
import { useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../utils/api";
import { useAuth } from "../context/authContext";
import GoogleAuthButton from "../components/GoogleAuthButton";
import "./Signup.css";

const SignupSchema = Yup.object().shape({
  name: Yup.string().min(2, "Too Short!").required("Name is required"),
  email: Yup.string().email("Invalid email").required("Email is required"),
  password: Yup.string()
    .min(8, "Minimum 8 characters")
    .matches(/[a-z]/, "Lowercase letter required")
    .matches(/[A-Z]/, "Uppercase letter required")
    .matches(/\d/, "Number required")
    .matches(/[!@#$%^&*]/, "Special character required")
    .required("Password is required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password"), null], "Passwords must match")
    .required("Confirm Password is required"),
  terms: Yup.bool().oneOf([true], "You must accept terms"),
});

export default function Signup() {
  const nav = useNavigate();
  const { loginAuth } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (values, { setSubmitting, setErrors }) => {
    const { name, email, password } = values;

    try {
      const { data } = await api.post("/auth/signup", {
        name,
        email,
        password,
        role: "pending",
      });

      const { user } = data;

      loginAuth({ user });

      alert("✅ Signup successful! Please choose your role.");
      nav("/choose-role");
    } catch (error) {
      setErrors({
        general:
          error.response?.data?.message || "Signup failed. Try again later.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="background-section">
        <div className="auth-container">
          <div className="auth-left">
            <div className="hero-logo-wrapper">
              <img
                src="/logo.png"
                alt="Talent Hire Logo"
                className="hero-logo"
              />
            </div>

            <h1 className="hero-title">
              Smart screening for
              <br /> smarter hiring
            </h1>

            <p className="hero-subtitle">
              The Future of Tech Interviews. Streamline your recruitment process
              with our AI-powered assessment platform.
            </p>

            <div className="hero-image-wrapper">
              <img
                src="/login.png"
                alt="Talent Hire Illustration"
                className="hero-image"
              />
            </div>
          </div>

          <div className="auth-right">
            <div className="auth-card">
              <h2 className="auth-title">Create Account</h2>
              <p className="auth-subtitle">
                Sign up for your Talent Hire account
              </p>

              <div className="auth-tabs">
                <Link to="/login" className="auth-tab">
                  Login
                </Link>

                <button type="button" className="auth-tab active">
                  Sign Up
                </button>
              </div>

              <Formik
                initialValues={{
                  name: "",
                  email: "",
                  password: "",
                  confirmPassword: "",
                  terms: false,
                }}
                validationSchema={SignupSchema}
                onSubmit={handleSubmit}
              >
                {({ isSubmitting, errors }) => (
                  <Form>
                    <label className="field-label">Full Name</label>
                    <Field
                      name="name"
                      placeholder="Full Name"
                      className="text-input"
                    />
                    <ErrorMessage
                      name="name"
                      component="div"
                      className="error"
                    />

                    <label className="field-label">Email Address</label>
                    <Field
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      className="text-input"
                    />
                    <ErrorMessage
                      name="email"
                      component="div"
                      className="error"
                    />

                    <label className="field-label">Password</label>
                    <div className="password-wrapper">
                      <Field
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        className="text-input password-input"
                        autoComplete="new-password"
                      />

                      <button
                        type="button"
                        className="password-eye"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        <i
                          className={
                            showPassword
                              ? "fa-regular fa-eye-slash"
                              : "fa-regular fa-eye"
                          }
                        ></i>
                      </button>
                    </div>

                    <ErrorMessage
                      name="password"
                      component="div"
                      className="error"
                    />

                    <label className="field-label">Confirm Password</label>
                    <div className="password-wrapper">
                      <Field
                        name="confirmPassword"
                        type={showConfirm ? "text" : "password"}
                        placeholder="Confirm your password"
                        className="text-input password-input"
                        autoComplete="new-password"
                      />

                      <button
                        type="button"
                        className="password-eye"
                        onClick={() => setShowConfirm((v) => !v)}
                        aria-label={
                          showConfirm ? "Hide password" : "Show password"
                        }
                      >
                        <i
                          className={
                            showConfirm
                              ? "fa-regular fa-eye-slash"
                              : "fa-regular fa-eye"
                          }
                        ></i>
                      </button>
                    </div>

                    <ErrorMessage
                      name="confirmPassword"
                      component="div"
                      className="error"
                    />

                    <div className="terms-checkbox">
                      <label>
                        <Field type="checkbox" name="terms" />
                        <span>I agree to the Terms &amp; Conditions</span>
                      </label>
                    </div>

                    <ErrorMessage
                      name="terms"
                      component="div"
                      className="error"
                    />

                    {errors.general && (
                      <div className="error">{errors.general}</div>
                    )}

                    <button
                      type="submit"
                      className="primary-btn"
                      disabled={isSubmitting}
                    >
                      Sign Up
                    </button>

                    <div className="auth-divider">
                      <span>or</span>
                    </div>

                    <GoogleAuthButton />
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}