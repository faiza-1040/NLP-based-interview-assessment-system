// server/controllers/authController.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { sendMail } = require("../utils/mailer");
const { OAuth2Client } = require("google-auth-library");

const {
  signAccessToken,
  verifyRefreshToken,
  hashToken,
  generateRefreshSession,
} = require("../utils/tokenService");

const {
  getAccessCookieOptions,
  getRefreshCookieOptions,
} = require("../utils/cookieOptions");

const FRONTEND_URL = (
  process.env.FRONTEND_URL ||
  process.env.CLIENT_URL ||
  "http://localhost:5173"
).replace(/\/+$/, "");

const SERVER_URL = (
  process.env.SERVER_URL ||
  process.env.BACKEND_URL ||
  `http://localhost:${process.env.PORT || 5000}`
).replace(/\/+$/, "");

const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refreshToken";
const ACCESS_COOKIE_NAME = process.env.ACCESS_COOKIE_NAME || "accessToken";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function getRequestMeta(req) {
  return {
    userAgent: req.get("user-agent") || null,
    ip: req.ip || req.connection?.remoteAddress || null,
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeAuthUser(user) {
  return {
    id: user._id.toString(),
    role: user.role,
    name: user.name,
    email: user.email,
    status: user.status || "pending",
    emailVerified: !!user.emailVerified,
    onboardingStep: user.onboardingStep || "choose-role",
    declineReason: user.declineReason || null,
    authProvider: user.authProvider || "local",
    avatarUrl: user.avatarUrl || "",
  };
}

async function createSessionAndRespond(req, res, user, extra = {}) {
  const accessToken = signAccessToken(user);
  const { rawToken, session } = generateRefreshSession(
    user,
    getRequestMeta(req),
  );

  user.authSessions = Array.isArray(user.authSessions) ? user.authSessions : [];
  user.authSessions.push(session);
  await user.save();

  res.cookie(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
  res.cookie(REFRESH_COOKIE_NAME, rawToken, getRefreshCookieOptions());

  return res.json({
    user: sanitizeAuthUser(user),
    ...extra,
  });
}

function clearAccessCookie(res) {
  const { maxAge, ...options } = getAccessCookieOptions();
  res.clearCookie(ACCESS_COOKIE_NAME, options);
}

function clearRefreshCookie(res) {
  const { maxAge, ...options } = getRefreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

async function sendMailAndLog(to, subject, html, context = "email") {
  try {
    const ok = await sendMail(to, subject, html);

    if (ok) {
      console.log(`✅ ${context} sent to ${to}`);
      return true;
    }

    console.warn(`⚠️ ${context} was not sent to ${to}. Check SMTP config.`);
    return false;
  } catch (err) {
    console.error(`❌ ${context} failed for ${to}:`, err?.message || err);
    return false;
  }
}

/* ========== helpers ========== */

function signResetToken(userId) {
  return jwt.sign(
    {
      sub: userId,
      type: "passwordReset",
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

function buildVerificationLink(token) {
  return `${SERVER_URL}/api/auth/verify-email?token=${encodeURIComponent(
    token,
  )}`;
}

function simpleHtmlPage({ title, message, linkText = "Go to Login", link }) {
  const safeLink = link || `${FRONTEND_URL}/login`;

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f8fafc;
            margin: 0;
            padding: 40px 16px;
            color: #0f172a;
          }
          .card {
            max-width: 560px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 28px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
            text-align: center;
          }
          h1 {
            margin: 0 0 12px;
            font-size: 26px;
          }
          p {
            color: #475569;
            line-height: 1.6;
          }
          a {
            display: inline-block;
            margin-top: 18px;
            background: #2563eb;
            color: #ffffff;
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 10px;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>${title}</h1>
          <p>${message}</p>
          <a href="${safeLink}">${linkText}</a>
        </div>
      </body>
    </html>
  `;
}

function resetEmailHTML(name, link) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2>Reset your password</h2>
      <p>Hi ${name || "there"},</p>
      <p>We received a request to reset your password. Click the button below to set a new one.</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#1d4ed8;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">
          Reset your password
        </a>
      </p>
      <p>This link will expire in 15 minutes. If you didn’t request this, you can ignore this email.</p>
    </div>
  `;
}

async function issueVerificationEmail(user, options = {}) {
  const forceNew = !!options.forceNew;
  const now = new Date();

  const hasUsableToken =
    !forceNew &&
    !user.emailVerified &&
    user.verificationToken &&
    user.verificationTokenExpires &&
    new Date(user.verificationTokenExpires).getTime() > now.getTime();

  if (!hasUsableToken) {
    user.verificationToken = crypto.randomBytes(32).toString("hex");
    user.verificationTokenExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );
  }

  user.emailVerified = false;
  await user.save();

  const link = buildVerificationLink(user.verificationToken);

  const roleLabel =
    user.role === "recruiter" ? "recruiter account" : "candidate account";

  const html = `
    <div style="font-family:Arial,sans-serif">
      <h2>Verify your email</h2>
      <p>Hi ${user.name || ""},</p>
      <p>Thanks for signing up. Please verify your email to continue setting up your ${roleLabel}.</p>
      <p>
        <a href="${link}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
          Verify Email
        </a>
      </p>
      <p>Or copy this link into your browser:<br>${link}</p>
      <p>This link expires in 24 hours.</p>
    </div>
  `;

  const sent = await sendMailAndLog(
    user.email,
    "Verify your email",
    html,
    "Verification email",
  );

  if (!sent) {
    throw new Error("Verification email could not be sent. Check SMTP config.");
  }

  return {
    token: user.verificationToken,
    expiresAt: user.verificationTokenExpires,
  };
}

/** ===================== AUTH ===================== */

exports.signup = async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    name = String(name || "").trim();
    email = normalizeEmail(email);
    password = String(password || "").trim();

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || "pending",
      status: "pending",
      onboardingStep: "choose-role",
      emailVerified: false,
    });

    return createSessionAndRespond(req, res, user);
  } catch (error) {
    console.error("❌ Signup Error:", error);

    return res.status(500).json({
      message: "Server error during signup",
    });
  }
};

exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;

    email = normalizeEmail(email);
    password = String(password || "").trim();

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    /*
      Important:
      Candidate verification remains strict.
      Recruiter becomes allowed only after admin approval.
      If recruiter was approved by admin, make sure emailVerified is true.
    */
    if (
      user.role === "recruiter" &&
      user.status === "approved" &&
      !user.emailVerified
    ) {
      user.emailVerified = true;
      user.onboardingStep = "done";
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;
      await user.save();
    }

    if (user.role === "candidate" && !user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email to continue.",
        needsVerification: true,
      });
    }

    if (user.role === "recruiter" && !user.emailVerified) {
      return res.status(403).json({
        message:
          "Please verify your email before your recruiter account can continue to review.",
        needsVerification: true,
      });
    }

    if (user.role === "pending") {
      return res.status(403).json({
        message: "Your account setup is incomplete. Please choose your role.",
        needsRoleSelection: true,
      });
    }

    if (user.role === "recruiter" && user.status === "pending") {
      return res.status(403).json({
        message: "Your recruiter account is pending admin approval.",
        pendingApproval: true,
      });
    }

    if (user.role === "recruiter" && user.status === "declined") {
      return res.status(403).json({
        message: "Your recruiter account was declined.",
        declined: true,
        declineReason: user.declineReason || "No reason provided",
      });
    }

    return createSessionAndRespond(req, res, user);
  } catch (error) {
    console.error("❌ Login Error:", error);

    return res.status(500).json({
      message: "Server error during login",
    });
  }
};

exports.googleAuth = async (req, res) => {
  try {
    const { credential } = req.body || {};

    if (!credential) {
      return res.status(400).json({
        message: "Google credential is required",
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        message: "Google Client ID is missing on server",
      });
    }

    const decodedGoogleToken = jwt.decode(credential);

    console.log("TOKEN AUD:", decodedGoogleToken?.aud);
    console.log("SERVER GOOGLE ID:", process.env.GOOGLE_CLIENT_ID);
    console.log(
      "GOOGLE ID MATCH:",
      decodedGoogleToken?.aud === process.env.GOOGLE_CLIENT_ID,
    );

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const googleId = payload?.sub;
    const email = normalizeEmail(payload?.email);
    const name = payload?.name || "Google User";
    const avatarUrl = payload?.picture || "";
    const emailVerified = !!payload?.email_verified;

    if (!googleId || !email) {
      return res.status(401).json({
        message: "Invalid Google account data",
      });
    }

    if (!emailVerified) {
      return res.status(401).json({
        message: "Google email is not verified",
      });
    }

    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        avatarUrl,
        authProvider: "google",
        emailVerified: true,
        role: "pending",
        status: "pending",
        onboardingStep: "choose-role",
      });
    } else {
      let changed = false;

      if (!user.googleId) {
        user.googleId = googleId;
        changed = true;
      }

      if (!user.avatarUrl && avatarUrl) {
        user.avatarUrl = avatarUrl;
        changed = true;
      }

      if (!user.emailVerified) {
        user.emailVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        changed = true;
      }

      if (changed) {
        await user.save();
      }
    }

    return createSessionAndRespond(req, res, user);
  } catch (error) {
    console.error("❌ Google Auth Error:", error);

    return res.status(500).json({
      message: "Google authentication failed",
    });
  }
};

/** =========== ONBOARDING / ROLE SELECTION =========== */

exports.updateRecruiterInfo = async (req, res) => {
  try {
    const {
      companyName,
      recruiterName,
      officialEmail,
      contactNumber,
      website,
      address,
      description,
    } = req.body;

    const user = await User.findById(req.user.id);

    if (!user || user.role !== "recruiter") {
      return res.status(403).json({
        message: "Unauthorized. Recruiter role required.",
      });
    }

    Object.assign(user, {
      companyName,
      recruiterName,
      officialEmail,
      contactNumber,
      website,
      address,
      description,
      status: "pending",
      onboardingStep: "done",
    });

    await user.save();

    const html = `
      <div style="font-family:Arial,sans-serif">
        <h2>Recruiter application received</h2>
        <p>Hi ${recruiterName || user.name || ""},</p>
        <p>Your recruiter onboarding form has been submitted successfully.</p>
        <p>Your account is now pending admin approval.</p>
        <p>You will receive another email when admin approves your account.</p>
      </div>
    `;

    const primarySent = await sendMailAndLog(
      user.email,
      "Your recruiter application is pending review",
      html,
      "Recruiter onboarding email",
    );

    let officialSent = null;

    if (
      officialEmail &&
      normalizeEmail(officialEmail) !== normalizeEmail(user.email)
    ) {
      officialSent = await sendMailAndLog(
        officialEmail,
        "Your recruiter application is pending review",
        html,
        "Recruiter onboarding email to official email",
      );
    }

    return res.json({
      message: "Recruiter info updated successfully",
      emailSent: {
        primary: primarySent,
        official: officialSent,
      },
      user: sanitizeAuthUser(user),
    });
  } catch (err) {
    console.error("❌ Recruiter Info Error:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

exports.updateUserInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || user.role !== "pending") {
      return res.status(403).json({
        message: "Unauthorized or already onboarded",
      });
    }

    const isGoogleUser = user.authProvider === "google" || !!user.googleId;

    user.role = "candidate";

    if (isGoogleUser) {
      user.status = "approved";
      user.emailVerified = true;
      user.onboardingStep = "done";
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;

      await user.save();

      return res.json({
        message: "Candidate role selected successfully.",
        user: sanitizeAuthUser(user),
      });
    }

    user.status = "pending";
    user.emailVerified = false;
    user.onboardingStep = "candidate-verification";

    await user.save();
    await issueVerificationEmail(user);

    return res.json({
      message: "Candidate role selected. Verification email sent.",
      user: sanitizeAuthUser(user),
    });
  } catch (err) {
    console.error("❌ Candidate Info Error:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

/** ===================== ADMIN ===================== */

exports.declineRecruiter = async (req, res) => {
  const { recruiterId, reason } = req.body;

  await User.findByIdAndUpdate(recruiterId, {
    status: "declined",
    declineReason: reason,
  });

  res.json({
    message: "Recruiter declined with reason",
  });
};

exports.updateRecruiterStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, declineReason } = req.body;

    const user = await User.findById(id);

    if (!user || user.role !== "recruiter") {
      return res.status(404).json({
        message: "Recruiter not found",
      });
    }

    user.status = status;

    if (status === "approved") {
      user.onboardingStep = "done";
      user.declineReason = undefined;

      /*
        Admin approval activates recruiter account.
        It also verifies email so recruiter can login after approval email.
      */
      user.emailVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;
    } else if (status === "declined") {
      user.declineReason = declineReason || "No reason provided";
    } else {
      user.declineReason = undefined;
    }

    await user.save();

    let primaryEmailSent = null;
    let officialEmailSent = null;

    if (status === "approved") {
      const loginLink = `${FRONTEND_URL}/login?approved=recruiter`;

      const html = `
        <div style="font-family:Arial,sans-serif">
          <h2>Your recruiter account is approved</h2>
          <p>Hello ${user.recruiterName || user.name || ""},</p>
          <p>Your account has been approved. You can now log in and start posting jobs.</p>
          <p>
            <a href="${loginLink}" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
              Go to Login
            </a>
          </p>
          <p>Or copy this link into your browser:<br>${loginLink}</p>
        </div>
      `;

      primaryEmailSent = await sendMailAndLog(
        user.email,
        "Recruiter account approved",
        html,
        "Recruiter approval email",
      );

      if (
        user.officialEmail &&
        normalizeEmail(user.officialEmail) !== normalizeEmail(user.email)
      ) {
        officialEmailSent = await sendMailAndLog(
          user.officialEmail,
          "Recruiter account approved",
          html,
          "Recruiter approval email to official email",
        );
      }
    } else if (status === "declined") {
      const html = `
        <div style="font-family:Arial,sans-serif">
          <h2>Recruiter application declined</h2>
          <p>Hello ${user.recruiterName || user.name || ""},</p>
          <p>Unfortunately, your application has been declined.</p>
          <p><strong>Reason:</strong> ${user.declineReason || "Not provided"}</p>
        </div>
      `;

      primaryEmailSent = await sendMailAndLog(
        user.email,
        "Recruiter application declined",
        html,
        "Recruiter decline email",
      );

      if (
        user.officialEmail &&
        normalizeEmail(user.officialEmail) !== normalizeEmail(user.email)
      ) {
        officialEmailSent = await sendMailAndLog(
          user.officialEmail,
          "Recruiter application declined",
          html,
          "Recruiter decline email to official email",
        );
      }
    }

    res.json({
      message: `Recruiter ${status} successfully.`,
      emailSent: {
        primary: primaryEmailSent,
        official: officialEmailSent,
      },
    });
  } catch (err) {
    console.error("❌ Admin Status Update Error:", err);

    res.status(500).json({
      message: "Server error",
    });
  }
};

/** ===================== EMAIL VERIFY ===================== */

exports.verifyEmail = async (req, res) => {
  try {
    const token = String(req.query.token || req.params.token || "").trim();

    if (!token) {
      return res.status(400).send(
        simpleHtmlPage({
          title: "Invalid verification link",
          message: "The verification token is missing from this link.",
          link: `${FRONTEND_URL}/login`,
        }),
      );
    }

    const user = await User.findOne({
      verificationToken: token,
    });

    if (!user) {
      return res.status(400).send(
        simpleHtmlPage({
          title: "Verification link is invalid",
          message:
            "This link is not valid anymore. Please login and click Resend verification email, then use the newest email only.",
          link: `${FRONTEND_URL}/login`,
        }),
      );
    }

    const isExpired =
      !user.verificationTokenExpires ||
      new Date(user.verificationTokenExpires).getTime() <= Date.now();

    if (isExpired) {
      try {
        await issueVerificationEmail(user, { forceNew: true });
      } catch (mailErr) {
        console.error("Could not send new verification email:", mailErr);
      }

      return res.status(400).send(
        simpleHtmlPage({
          title: "Verification link expired",
          message:
            "Your verification link expired. We tried to send you a new verification email. Please check your inbox and use the newest email.",
          link: `${FRONTEND_URL}/login`,
        }),
      );
    }

    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;

    if (user.role === "candidate") {
      user.status = "approved";
      user.onboardingStep = "done";
    } else if (user.role === "recruiter") {
      /*
        Recruiter email verification does not approve account.
        Admin approval is still required.
      */
      if (user.status !== "approved") {
        user.status = "pending";
      }

      if (user.status === "approved") {
        user.onboardingStep = "done";
      } else if (user.onboardingStep !== "done") {
        user.onboardingStep = "recruiter-onboarding";
      }
    } else if (user.role === "pending") {
      user.status = "pending";
      user.onboardingStep = "choose-role";
    }

    await user.save();

    return res.send(
      simpleHtmlPage({
        title: "Email verified successfully",
        message:
          "Your email has been verified. You can now login and continue.",
        linkText: "Go to Login",
        link: `${FRONTEND_URL}/login?verified=success`,
      }),
    );
  } catch (err) {
    console.error("❌ Verify Email Error:", err);

    return res.status(500).send(
      simpleHtmlPage({
        title: "Server error",
        message: "Something went wrong while verifying your email.",
        link: `${FRONTEND_URL}/login`,
      }),
    );
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.json({
        message: "Email is already verified",
      });
    }

    await issueVerificationEmail(user);

    res.json({
      message:
        "Verification email sent. Please use the newest email in your inbox.",
    });
  } catch (err) {
    console.error("❌ Resend Verification Error:", err);

    res.status(500).json({
      message: err.message || "Server error",
    });
  }
};

/** ===================== PASSWORD RESET ===================== */

exports.forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "Email not found",
      });
    }

    const token = signResetToken(user._id.toString());

    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

    await user.save();

    const link = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(
      token,
    )}`;

    await sendMailAndLog(
      user.email,
      "Reset your password",
      resetEmailHTML(user.name, link),
      "Password reset email",
    );

    res.json({
      message: "Password reset link sent",
    });
  } catch (err) {
    console.error("❌ forgotPassword Error:", err);

    res.status(500).json({
      message: "Server error",
    });
  }
};

exports.resendReset = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "Email not found",
      });
    }

    const token = signResetToken(user._id.toString());

    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

    await user.save();

    const link = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(
      token,
    )}`;

    await sendMailAndLog(
      user.email,
      "Reset your password",
      resetEmailHTML(user.name, link),
      "Password reset resend email",
    );

    res.json({
      message: "Password reset link re-sent",
    });
  } catch (err) {
    console.error("❌ resendReset Error:", err);

    res.status(500).json({
      message: "Server error",
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (!token || !password) {
      return res.status(400).json({
        message: "Token and new password are required",
      });
    }

    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({
        message: "Invalid or expired reset link",
      });
    }

    if (payload?.type !== "passwordReset") {
      return res.status(400).json({
        message: "Invalid reset link",
      });
    }

    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(400).json({
        message: "Invalid reset link",
      });
    }

    if (
      user.resetPasswordToken !== token ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < new Date()
    ) {
      return res.status(400).json({
        message: "Reset link expired. Please request a new one.",
      });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.authSessions = [];

    await user.save();

    clearAccessCookie(res);
    clearRefreshCookie(res);

    res.json({
      message: "Password reset successful",
    });
  } catch (err) {
    console.error("❌ resetPassword Error:", err);

    res.status(500).json({
      message: "Server error",
    });
  }
};

exports.refresh = async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        message: "Refresh token missing",
      });
    }

    let payload;

    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      clearAccessCookie(res);
      clearRefreshCookie(res);

      return res.status(401).json({
        message: "Invalid or expired refresh token",
      });
    }

    if (payload?.typ !== "refresh" || !payload?.sub || !payload?.sid) {
      clearAccessCookie(res);
      clearRefreshCookie(res);

      return res.status(401).json({
        message: "Invalid refresh token payload",
      });
    }

    const user = await User.findById(payload.sub);

    if (!user) {
      clearAccessCookie(res);
      clearRefreshCookie(res);

      return res.status(401).json({
        message: "User no longer exists",
      });
    }

    const sessions = Array.isArray(user.authSessions) ? user.authSessions : [];
    const currentHash = hashToken(token);

    const existingSessionIndex = sessions.findIndex(
      (s) =>
        String(s._id) === String(payload.sid) &&
        s.tokenHash === currentHash &&
        new Date(s.expiresAt).getTime() > Date.now(),
    );

    if (existingSessionIndex === -1) {
      user.authSessions = sessions.filter(
        (s) => new Date(s.expiresAt).getTime() > Date.now(),
      );

      await user.save();

      clearAccessCookie(res);
      clearRefreshCookie(res);

      return res.status(401).json({
        message: "Refresh session not found or expired",
      });
    }

    const { rawToken, session: newSession } = generateRefreshSession(
      user,
      getRequestMeta(req),
    );

    user.authSessions.splice(existingSessionIndex, 1, newSession);
    await user.save();

    const newAccessToken = signAccessToken(user);

    res.cookie(ACCESS_COOKIE_NAME, newAccessToken, getAccessCookieOptions());
    res.cookie(REFRESH_COOKIE_NAME, rawToken, getRefreshCookieOptions());

    return res.json({
      user: sanitizeAuthUser(user),
    });
  } catch (error) {
    console.error("❌ Refresh Error:", error);

    return res.status(500).json({
      message: "Server error during refresh",
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!token) {
      clearAccessCookie(res);
      clearRefreshCookie(res);

      return res.json({
        message: "Logged out successfully",
      });
    }

    try {
      const payload = verifyRefreshToken(token);

      if (payload?.sub && payload?.sid) {
        const user = await User.findById(payload.sub);

        if (user) {
          user.authSessions = (user.authSessions || []).filter(
            (s) => String(s._id) !== String(payload.sid),
          );

          await user.save();
        }
      }
    } catch (err) {
      // ignore bad refresh token and still clear cookies
    }

    clearAccessCookie(res);
    clearRefreshCookie(res);

    return res.json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("❌ Logout Error:", error);

    return res.status(500).json({
      message: "Server error during logout",
    });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      user: sanitizeAuthUser(user),
    });
  } catch (error) {
    console.error("❌ Me Error:", error);

    return res.status(500).json({
      message: "Server error fetching current user",
    });
  }
};

exports.selectRecruiterRole = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || user.role !== "pending") {
      return res.status(403).json({
        message: "Unauthorized or role already selected",
      });
    }

    const isGoogleUser = user.authProvider === "google" || !!user.googleId;

    user.role = "recruiter";
    user.status = "pending";
    user.onboardingStep = "recruiter-onboarding";

    if (isGoogleUser) {
      user.emailVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;

      await user.save();

      return res.json({
        message: "Recruiter role selected. Please complete recruiter onboarding.",
        user: sanitizeAuthUser(user),
      });
    }

    user.emailVerified = false;

    await user.save();
    await issueVerificationEmail(user);

    return res.json({
      message: "Recruiter role selected. Verification email sent.",
      user: sanitizeAuthUser(user),
    });
  } catch (err) {
    console.error("❌ selectRecruiterRole Error:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
};