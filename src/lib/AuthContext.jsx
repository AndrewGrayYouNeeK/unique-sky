import React, { createContext, useState, useContext, useEffect } from 'react';
import { getPlayerName, setPlayerName } from '@/lib/hunts';

const USER_KEY = 'youneek_user';

const AuthContext = createContext();

function loadStoredUser() {
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const stored = loadStoredUser();
    if (stored) {
      setUser(stored);
      setIsAuthenticated(true);
      if (stored.full_name) setPlayerName(stored.full_name);
    }
    setIsLoadingAuth(false);
  }, []);

  const login = ({ email, full_name }) => {
    const profile = {
      id: email || full_name,
      email: email || '',
      full_name: full_name || getPlayerName(),
    };
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    setPlayerName(profile.full_name);
    setUser(profile);
    setIsAuthenticated(true);
    return profile;
  };

  const logout = () => {
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateProfile = (updates) => {
    const next = { ...user, ...updates };
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    if (next.full_name) setPlayerName(next.full_name);
    setUser(next);
    setIsAuthenticated(true);
    return next;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      login,
      logout,
      updateProfile,
      navigateToLogin: () => {},
      checkAppState: () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
