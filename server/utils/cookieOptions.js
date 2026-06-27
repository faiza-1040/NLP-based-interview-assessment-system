// server/utils/cookieOptions.js
function getBaseCookieSecurity() {
  const isProd = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProd ? true : process.env.COOKIE_SECURE === "true",
    sameSite: isProd ? "none" : (process.env.COOKIE_SAME_SITE || "lax"),
  };
}

function getAccessCookieOptions() {
  return {
    ...getBaseCookieSecurity(),
    path: "/",
    maxAge: 15 * 60 * 1000, // 15 minutes
  };
}

function getRefreshCookieOptions() {
  return {
    ...getBaseCookieSecurity(),
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

module.exports = {
  getAccessCookieOptions,
  getRefreshCookieOptions,
};