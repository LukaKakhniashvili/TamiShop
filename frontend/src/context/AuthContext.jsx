import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth-profile');
      setUser(data);
    } catch (err) {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMe();
  }, []);

  const loginWithGoogle = async (credential) => {
    const { data } = await api.post('/auth-google-login', { credential });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth-login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (userData) => {
    const { data } = await api.post('/auth-register', userData);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  const updateProfile = async (payload) => {
    const { data } = await api.put('/auth-profile-update', payload);
    setUser(data);
    return data;
  };

  // გასვლა (დესკტოპი და მობილური) — ტოკენი, მომხმარებლის მდგომარეობა და მომხმარებელზე მიბმული დროებითი მონაცემები
  const logout = () => {
    localStorage.removeItem('token');
    try {
      ['register:pendingEmail', 'recovery:pendingEmail'].forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* storage მიუწვდომელია — არაფერია გასასუფთავებელი */
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, login, register, logout, updateProfile, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
