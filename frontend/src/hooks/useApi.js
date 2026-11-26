import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { request } from '../services/apiClient.js';

export function useApi() {
  const { session, logout } = useAuth();
  return useCallback(async (path, options = {}) => {
    try {
      return await request(path, { ...options, token: session?.token });
    } catch (error) {
      if (error.status === 401) logout();
      throw error;
    }
  }, [session?.token, logout]);
}

export function useQuery(path, dependencies = []) {
  const api = useApi();
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const load = useCallback(async () => {
    setState((value) => ({ ...value, loading: true, error: '' }));
    try {
      const data = await api(path);
      setState({ data, loading: false, error: '' });
    } catch (error) {
      setState({ data: null, loading: false, error: error.message });
    }
  }, [api, path]);
  useEffect(() => { load(); }, [load, ...dependencies]);
  return { ...state, reload: load };
}
