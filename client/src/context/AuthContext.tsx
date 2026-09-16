import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setAccessToken } from '../api/client.js';
import { User } from '../types/index.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, role: string, username?: string, headline?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; username?: string | null; headline?: string | null; avatarUrl?: string | null }) => Promise<{ success: boolean; error?: string }>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check auth session on startup using the HttpOnly refresh token cookie
  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await api.post('/auth/refresh');
        if (res.data.success) {
          const newToken = res.data.data.accessToken;
          const userData = res.data.data.user;
          setToken(newToken);
          setAccessToken(newToken);
          setUser(userData);
        }
      } catch {
        setToken(null);
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const handleExpired = () => {
      setToken(null);
      setAccessToken(null);
      setUser(null);
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        const { accessToken, user: userData } = res.data.data;
        setToken(accessToken);
        setAccessToken(accessToken);
        setUser(userData);
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Login failed. Please check credentials.';
      return { success: false, error: message };
    }
  };

  const register = async (name: string, email: string, password: string, role: string, username?: string, headline?: string) => {
    try {
      const res = await api.post('/auth/register', { name, email, password, role, username, headline });
      if (res.data.success) {
        const { accessToken, user: userData } = res.data.data;
        setToken(accessToken);
        setAccessToken(accessToken);
        setUser(userData);
        return { success: true };
      }
      return { success: false, error: 'Registration failed' };
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Registration failed. Please check details.';
      return { success: false, error: message };
    }
  };

  const updateProfile = async (data: { name?: string; username?: string | null; headline?: string | null; avatarUrl?: string | null }) => {
    try {
      const res = await api.patch('/users/profile', data);
      if (res.data.success) {
        const updatedUser = res.data.data.user;
        setUser(updatedUser);
        return { success: true };
      }
      return { success: false, error: 'Failed to update profile' };
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Failed to update profile';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.warn('Logout API notification failed, clearing local session', err);
    } finally {
      setToken(null);
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, updateProfile, setUser }}>
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
