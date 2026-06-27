
//src/context/authContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../utils/api";

const AuthContext = createContext(null);

const normalizeUser = (userData) => {
  if (!userData) return null;

  return {
    id: userData.id || userData._id || "",
    role: userData.role || "",
    name: userData.name || "",
    email: userData.email || "",
    status: userData.status || "pending",
    emailVerified: !!userData.emailVerified,
    onboardingStep: userData.onboardingStep || "choose-role",
    declineReason: userData.declineReason || null,
  };
};

const syncUserToLocalStorage = (userData) => {
  localStorage.setItem("role", userData.role || "");
  localStorage.setItem("name", userData.name || "");
  localStorage.setItem("userId", userData.id || "");
  localStorage.setItem("status", userData.status || "");
  localStorage.setItem("emailVerified", String(!!userData.emailVerified));
  localStorage.setItem("onboardingStep", userData.onboardingStep || "choose-role");
  localStorage.setItem("declineReason", userData.declineReason || "");
};

const clearAuthStorage = () => {
  localStorage.removeItem("role");
  localStorage.removeItem("name");
  localStorage.removeItem("userId");
  localStorage.removeItem("status");
  localStorage.removeItem("emailVerified");
  localStorage.removeItem("onboardingStep");
  localStorage.removeItem("declineReason");
};

export const AuthProvider = ({ children }) => {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  const fetchMe = async () => {
    try {
      const { data } = await api.get("/auth/me");
      const freshUser = normalizeUser(data.user);

      setUser(freshUser);
      syncUserToLocalStorage(freshUser);
    } catch (error) {
      clearAuthStorage();
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const loginAuth = ({ user }) => {
    const normalizedUser = normalizeUser(user);
    if (normalizedUser) {
      syncUserToLocalStorage(normalizedUser);
      setUser(normalizedUser);
    }
  };

  const updateUserAuth = (userData) => {
    const normalizedUser = normalizeUser(userData);
    if (!normalizedUser) return;
    syncUserToLocalStorage(normalizedUser);
    setUser(normalizedUser);
  };

  const logoutAuth = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
    } finally {
      clearAuthStorage();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        authLoading,
        fetchMe,
        loginAuth,
        updateUserAuth,
        logoutAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);