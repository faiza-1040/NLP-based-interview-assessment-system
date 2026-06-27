
// //server/middleware/authMiddleware
// const User = require('../models/User');
// const { verifyAccessToken } = require('../utils/tokenService');

// exports.protect = async (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return res.status(401).json({ message: 'Authentication required' });
//     }

//     const token = authHeader.split(' ')[1];
//     const decoded = verifyAccessToken(token);

//     const user = await User.findById(decoded.sub).select('-password');
//     if (!user) {
//       return res.status(401).json({ message: 'User no longer exists' });
//     }

//     if (
//       user.passwordChangedAt &&
//       decoded.iat * 1000 < new Date(user.passwordChangedAt).getTime()
//     ) {
//       return res.status(401).json({ message: 'Session expired. Please log in again.' });
//     }

//     req.user = {
//       id: user._id.toString(),
//       role: user.role,
//       name: user.name,
//       email: user.email,
//       status: user.status,
//       emailVerified: user.emailVerified,
//     };

//     next();
//   } catch (err) {
//     return res.status(401).json({ message: 'Invalid or expired access token' });
//   }
// };

// exports.authorize = (...roles) => {
//   return (req, res, next) => {
//     if (!req.user) {
//       return res.status(401).json({ message: 'Authentication required' });
//     }

//     if (!roles.includes(req.user.role)) {
//       return res.status(403).json({ message: 'Forbidden' });
//     }

//     next();
//   };
// };

// server/middleware/authMiddleware.js
const User = require("../models/User");
const { verifyAccessToken } = require("../utils/tokenService");

const ACCESS_COOKIE_NAME = process.env.ACCESS_COOKIE_NAME || "accessToken";

exports.protect = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;

    // 1. Support Bearer token during migration
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 2. Prefer cookie-based auth if no bearer token
    if (!token && req.cookies?.[ACCESS_COOKIE_NAME]) {
      token = req.cookies[ACCESS_COOKIE_NAME];
    }

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.sub).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    if (
      user.passwordChangedAt &&
      decoded.iat * 1000 < new Date(user.passwordChangedAt).getTime()
    ) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      name: user.name,
      email: user.email,
      status: user.status,
      emailVerified: user.emailVerified,
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};