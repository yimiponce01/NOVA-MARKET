import { createContext, useContext, useState } from 'react';

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
  return <AuthContext.Provider value={{ session, saveSession }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
