/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchCurrentUser, login as apiLogin, register as apiRegister } from '../api/waterwallet';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    const isGuest = localStorage.getItem("is_guest") === "true";
    if (isGuest) {
      setUser({ isGuest: true, email: 'guest@waterwallet.local', name: 'Guest User' });
      setLoading(false);
      return;
    }
    const token = localStorage.getItem("access_token");
    if (token) {
      try {
        const userData = await fetchCurrentUser();
        setUser(userData);
      } catch {
        localStorage.removeItem("access_token");
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Authentication is an external session check whose result initializes state.
    checkAuth();
    
    const handleUnauthorized = () => {
      if (localStorage.getItem("is_guest") !== "true") {
        setUser(null);
      }
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const login = async (email, password) => {
    localStorage.removeItem("is_guest");
    const data = await apiLogin(email, password);
    localStorage.setItem("access_token", data.access_token);
    await checkAuth();
  };

  const register = async (email, password) => {
    localStorage.removeItem("is_guest");
    await apiRegister(email, password);
    await login(email, password);
  };

  const continueAsGuest = () => {
    localStorage.removeItem("access_token");
    localStorage.setItem("is_guest", "true");
    setUser({ isGuest: true, email: 'guest@waterwallet.local', name: 'Guest User' });
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("is_guest");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, continueAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
