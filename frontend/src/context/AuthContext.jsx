import React, { createContext, useState, useContext, useCallback } from 'react';
import { apiFetch } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/admin/login', {
        method: 'POST',
        body: { username, password }
      });
      setAdmin({ id: data.id, username: data.username });
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/admin/logout', { method: 'POST' });
    } catch (error) {
      // ignore
    }
    setAdmin(null);
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const data = await apiFetch('/api/admin/me');
      setAdmin(data);
      return true;
    } catch (error) {
      setAdmin(null);
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}