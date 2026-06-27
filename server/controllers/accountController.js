// server/controllers/accountController.js
const User = require("../models/User");
const {
  getAccessCookieOptions,
  getRefreshCookieOptions,
} = require("../utils/cookieOptions");

const ACCESS_COOKIE_NAME = process.env.ACCESS_COOKIE_NAME || "accessToken";
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refreshToken";

function clearAccessCookie(res) {
  const { maxAge, ...options } = getAccessCookieOptions();
  res.clearCookie(ACCESS_COOKIE_NAME, options);
}

function clearRefreshCookie(res) {
  const { maxAge, ...options } = getRefreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body || {};

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    if (String(newPassword).trim().length < 8) {
      return res.status(400).json({
        message: "New password must be at least 8 characters long",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;

    // Invalidate all refresh sessions after password change
    user.authSessions = [];

    await user.save();

    // Clear auth cookies so current browser must login again
    clearAccessCookie(res);
    clearRefreshCookie(res);

    return res.json({
      message: "Password changed successfully. Please log in again.",
    });
  } catch (error) {
    console.error("changePassword error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};