import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = checking, true/false = known
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const apiBaseUrl = process.env.NODE_ENV === 'production' 
        ? window.location.origin
        : (process.env.REACT_APP_API_URL || 'https://queue-health-monitor.vercel.app');
      
      const response = await fetch(`${apiBaseUrl}/api/auth/intercom/me`, {
        method: 'GET',
        credentials: 'include', // Important: include cookies
      });

      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
        setUser(data.user);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
    
    // Check if we just came back from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('authenticated') === 'true') {
      // Remove the query parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      checkAuth();
    }

    // Listen for messages from OAuth popup
    const handleMessage = (event) => {
      // Verify origin for security
      const apiBaseUrl = process.env.NODE_ENV === 'production' 
        ? window.location.origin
        : (process.env.REACT_APP_API_URL || 'https://queue-health-monitor.vercel.app');
      
      const allowedOrigins = [
        window.location.origin,
        apiBaseUrl.replace(/\/$/, ''),
        'https://queue-health-monitor.vercel.app'
      ];
      
      // Allow messages from same origin or the API base URL
      if (allowedOrigins.includes(event.origin) || event.data.origin) {
        if (event.data.type === 'OAUTH_SUCCESS') {
          // OAuth completed successfully, wait a moment for cookies to propagate, then refresh auth status
          setTimeout(() => {
            checkAuth();
          }, 300);
        } else if (event.data.type === 'OAUTH_ERROR') {
          console.error('OAuth error:', event.data.error);
          setIsAuthenticated(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const login = () => {
    const apiBaseUrl = process.env.NODE_ENV === 'production' 
      ? window.location.origin
      : (process.env.REACT_APP_API_URL || 'https://queue-health-monitor.vercel.app');
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    
    // Check if we're in an iframe (Sigma plugin)
    const isInIframe = window.self !== window.top;
    
    if (isInIframe) {
      // For popup flow, we need to use a callback that can communicate with parent
      // Add popup=true to the redirect URI so callback knows it's a popup
      const popupRedirectUri = encodeURIComponent(`${apiBaseUrl}/api/auth/intercom/callback?popup=true`);
      const loginUrl = `${apiBaseUrl}/api/auth/intercom/login?redirect=${popupRedirectUri}`;
      
      // Open OAuth in a popup window
      const popup = window.open(
        loginUrl,
        'intercom-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      // Poll for popup closure
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          // Check auth status when popup closes
          setTimeout(() => checkAuth(), 500);
        }
      }, 500);

      // Clean up interval after 10 minutes
      setTimeout(() => clearInterval(checkPopup), 600000);
    } else {
      // Not in iframe, redirect normally
      const loginUrl = `${apiBaseUrl}/api/auth/intercom/login?redirect=${redirectUri}`;
      window.location.href = loginUrl;
    }
  };

  const logout = async () => {
    try {
      const apiBaseUrl = process.env.NODE_ENV === 'production' 
        ? window.location.origin
        : (process.env.REACT_APP_API_URL || 'https://queue-health-monitor.vercel.app');
      
      // Call logout endpoint to clear cookies
      await fetch(`${apiBaseUrl}/api/auth/intercom/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      
      // Immediately update state
      setIsAuthenticated(false);
      setUser(null);
      setLoading(false);
      
      // Force a hard reload to ensure cookies are cleared and auth check runs fresh
      // Use window.location.reload() with a small delay to ensure state updates
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    } catch (error) {
      console.error('Logout error:', error);
      // Even if API call fails, clear local state and redirect
      setIsAuthenticated(false);
      setUser(null);
      setLoading(false);
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
