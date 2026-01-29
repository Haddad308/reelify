'use client';

import { useState, useEffect, useCallback } from 'react';

export type Platform = 'youtube' | 'facebook';

interface AuthStatus {
  youtube: boolean;
  facebook: boolean;
}

interface UseAuthStatusReturn {
  authStatus: AuthStatus;
  isLoading: boolean;
  checkAuth: (platform: Platform) => Promise<boolean>;
  authenticate: (platform: Platform) => void;
  logout: (platform: Platform) => Promise<void>;
  refreshAuthStatus: () => Promise<void>;
}

export function useAuthStatus(): UseAuthStatusReturn {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    youtube: false,
    facebook: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Check authentication status for a specific platform
   */
  const checkAuth = useCallback(async (platform: Platform): Promise<boolean> => {
    try {
      const response = await fetch(`/api/auth/${platform}`, {
        method: 'POST',
        credentials: 'include',
      });
      
      const data = await response.json();
      const isAuthenticated = data.authenticated === true;
      
      setAuthStatus(prev => ({
        ...prev,
        [platform]: isAuthenticated,
      }));
      
      return isAuthenticated;
    } catch (error) {
      console.error(`Error checking ${platform} auth:`, error);
      setAuthStatus(prev => ({
        ...prev,
        [platform]: false,
      }));
      return false;
    }
  }, []);

  /**
   * Refresh authentication status for all platforms
   */
  const refreshAuthStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        checkAuth('youtube'),
        checkAuth('facebook'),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [checkAuth]);

  /**
   * Initiate OAuth flow for a platform
   */
  const authenticate = useCallback((platform: Platform) => {
    // Store current URL to return to after auth
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('auth_return_url', window.location.href);
    }
    
    // Redirect to OAuth endpoint
    window.location.href = `/api/auth/${platform}`;
  }, []);

  /**
   * Logout from a platform
   */
  const logout = useCallback(async (platform: Platform) => {
    try {
      await fetch(`/api/auth/${platform}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      setAuthStatus(prev => ({
        ...prev,
        [platform]: false,
      }));
    } catch (error) {
      console.error(`Error logging out from ${platform}:`, error);
    }
  }, []);

  // Check auth status on mount
  useEffect(() => {
    refreshAuthStatus();
  }, [refreshAuthStatus]);

  // Check for auth success/error in URL params (after OAuth callback)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const authSuccess = urlParams.get('auth_success');
    const authError = urlParams.get('auth_error');

    if (authSuccess) {
      // Refresh auth status after successful auth
      checkAuth(authSuccess as Platform);
      
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('auth_success');
      window.history.replaceState({}, '', newUrl.toString());
    }

    if (authError) {
      console.error('Authentication error:', authError);
      
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('auth_error');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [checkAuth]);

  return {
    authStatus,
    isLoading,
    checkAuth,
    authenticate,
    logout,
    refreshAuthStatus,
  };
}
