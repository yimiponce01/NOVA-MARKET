import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/apiClient.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('nova-session') || 'null'); }
    catch { return null; }
  });
  function saveSession(value) {
    setSession(value);
    if (value) sessionStorage.setItem('nova-session', JSON.stringify(value));
    else sessionStorage.removeItem('nova-session');
  }
  const [checking, setChecking] = useState(Boolean(session));
  useEffect(() => {
    if (!session?.token) { setChecking(false); return; }
    api.me(session.token)
      .then((user) => saveSession({ ...session, user }))
      .catch(() => saveSession(null))
      .finally(() => setChecking(false));
  }, []);
  const value = useMemo(() => ({
    session,
    checking,
    login: async (login, password) => {
      const result = await api.login(login, password);
      saveSession(result);
      return result;
    },
    logout: () => saveSession(null),
  }), [session, checking]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
