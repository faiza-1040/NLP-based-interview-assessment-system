//server/utils/tokenService.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      name: user.name,
      status: user.status,
      emailVerified: user.emailVerified,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' }
  );
}

function signRefreshToken(payload) {
  return jwt.sign(
    payload,
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshSession(user, meta = {}) {
  const sessionId = crypto.randomBytes(16).toString('hex');

  const refreshToken = signRefreshToken({
    sub: user._id.toString(),
    sid: sessionId,
    typ: 'refresh',
  });

  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  );

  return {
    rawToken: refreshToken,
    session: {
      _id: sessionId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      userAgent: meta.userAgent || null,
      ip: meta.ip || null,
    },
  };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  generateRefreshSession,
};