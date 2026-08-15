/**
 * FlashStore — AuthContext LOCAL
 * Autenticação via JWT com servidor Express local.
 * Usa JWT em localStorage + GET /api/auth/me.
 */
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api } from '@/api/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                   = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // true apenas durante a verificação inicial — NUNCA fica preso em true
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Props mantidas por compatibilidade com componentes existentes
  const isLoadingPublicSettings = false;
  const appPublicSettings       = { id: 'local', public_settings: {} };

  const checkAppState = useCallback(async () => {
    // Não há token → não vale a pena chamar a API
    const token = localStorage.getItem('flashstore_token');
    if (!token) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      return;
    }

    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (err) {
      if (api.auth.isNetworkError(err)) {
        // Servidor inacessível — usar perfil em cache para manter sessão offline
        const cached = api.auth.getCachedUser();
        if (cached) {
          setUser(cached);
          setIsAuthenticated(true);
          setIsLoadingAuth(false);
          return;
        }
      }
      // Token inválido, expirado (401) ou sem cache offline
      localStorage.removeItem('flashstore_token');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAppState();
  }, [checkAppState]);

  const loginOffline = useCallback((cachedUser) => {
    setUser(cachedUser);
    setIsAuthenticated(true);
    setIsLoadingAuth(false);
  }, []);

  const logout = () => {
    localStorage.removeItem('flashstore_token');
    // Não apagamos flashstore_user — permite re-login offline com o mesmo email
    setUser(null);
    setIsAuthenticated(false);
    // Não usamos window.location.href aqui para não forçar reload
    // O componente que chama logout deve navegar via react-router
  };

  const navigateToLogin = () => {
    // Usado por código legado — mantido por compatibilidade
    window.location.href = '/login';
  };

  // authError calculado a partir do estado — sem state extra para evitar re-renders
  const authError = !isLoadingAuth && !isAuthenticated
    ? { type: 'auth_required', message: 'Autenticação necessária' }
    : null;

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
      loginOffline,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
