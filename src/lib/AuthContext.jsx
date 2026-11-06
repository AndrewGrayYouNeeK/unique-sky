import { createContext, useState, useContext, useEffect } from 'react';
import { api } from '@/api/apiClient';
import { setPlayerName } from '@/lib/hunts';

// A browser profile, not an email/password account. The HttpOnly session cookie
// identifies records; names and email addresses are never credentials.
const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  useEffect(() => {
    api.profile.get().then(profile => {
      setUser({ full_name: profile.name });
      setPlayerName(profile.name);
    }).catch(() => {}).finally(() => setIsLoadingAuth(false));
  }, []);
  const updateProfile = async ({ full_name }) => {
    const profile = await api.profile.update(full_name);
    setPlayerName(profile.name);
    const next = { full_name: profile.name };
    setUser(next);
    return next;
  };
  return <AuthContext.Provider value={{ user, updateProfile, isLoadingAuth }}>{children}</AuthContext.Provider>;
};
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
