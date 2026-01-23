import React, { useEffect, useState, useCallback } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { ThemeProvider } from "./ThemeContext";
import LoginPage from "./LoginPage";
import Dashboard from "./Dashboard";
import MyQueue from "./MyQueue";
import "./App.css";

// Backend URL configuration for Sigma plugin deployment
// In production (Vercel), use the full Vercel URL so API calls work from Sigma's iframe
// In development, use localhost backend
// For Sigma plugins: The plugin URL will be something like https://your-app.vercel.app
// The API endpoint will be at the same domain: https://your-app.vercel.app/api/intercom/...
// eslint-disable-next-line no-unused-vars
const getBackendUrl = () => {
  // If explicitly set via env var, use that
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  // In production, use current origin (Vercel domain) for same-origin API calls
  // This ensures the API works when the plugin is loaded in Sigma's iframe
  if (process.env.NODE_ENV === 'production') {
    return window.location.origin;
  }
  
  // Development: use localhost backend
  return 'http://localhost:3000';
};

// const BACKEND_URL = getBackendUrl(); // Reserved for future use

// Sigma plugin API integration
// Get current user email from Sigma plugin props
// In Sigma, this will be passed as a prop: currentUserEmail
// The plugin definition in Sigma should have an argument bound to CurrentUserEmail() system function
function getCurrentUserEmail(props) {
  console.log('getCurrentUserEmail: Starting email retrieval...');
  console.log('getCurrentUserEmail: Props received:', props);
  
  // Method 1: Get from Sigma plugin props (when embedded in Sigma)
  // Sigma passes props via window.sigma.getProps() or directly as component props
  if (props && props.currentUserEmail) {
    console.log('getCurrentUserEmail: Found email from props:', props.currentUserEmail);
    return props.currentUserEmail;
  }
  console.log('getCurrentUserEmail: Method 1 failed - no email in props');
  
  // Method 2: Try window.sigma API (Sigma plugin SDK)
  if (window.sigma && typeof window.sigma.getProps === 'function') {
    try {
      console.log('getCurrentUserEmail: Trying window.sigma.getProps()...');
      const sigmaProps = window.sigma.getProps();
      console.log('getCurrentUserEmail: Sigma props:', sigmaProps);
      if (sigmaProps && sigmaProps.currentUserEmail) {
        console.log('getCurrentUserEmail: Found email from Sigma API:', sigmaProps.currentUserEmail);
        return sigmaProps.currentUserEmail;
      }
    } catch (e) {
      console.warn('getCurrentUserEmail: Could not get props from Sigma API:', e);
    }
  } else {
    console.log('getCurrentUserEmail: window.sigma not available or getProps not a function');
    console.log('getCurrentUserEmail: window.sigma:', window.sigma);
  }
  
  // Method 3: Try to get from URL params (for testing/debugging)
  const urlParams = new URLSearchParams(window.location.search);
  const emailFromUrl = urlParams.get('currentUserEmail');
  if (emailFromUrl) {
    console.log('getCurrentUserEmail: Found email from URL:', emailFromUrl);
    return emailFromUrl;
  }
  console.log('getCurrentUserEmail: Method 3 failed - no email in URL params');
  
  // Method 4: Try to get from localStorage (for development)
  const emailFromStorage = localStorage.getItem('currentUserEmail');
  if (emailFromStorage) {
    console.log('getCurrentUserEmail: Found email from localStorage:', emailFromStorage);
    return emailFromStorage;
  }
  console.log('getCurrentUserEmail: Method 4 failed - no email in localStorage');
  
  console.warn('getCurrentUserEmail: All methods failed - returning null');
  return null;
}

function AppContent({ currentUserEmail: propsCurrentUserEmail }) {
  const location = useLocation();
  const { isAuthenticated, loading: authLoading, login } = useAuth();
  const [data, setData] = useState({ conversations: [], teamMembers: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [historicalSnapshots, setHistoricalSnapshots] = useState([]);
  const [responseTimeMetrics, setResponseTimeMetrics] = useState([]);

  // Suppress Intercom launcher warnings (coming from Intercom app, not our code)
  useEffect(() => {
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = (...args) => {
      const message = args.join(' ');
      // Suppress Intercom launcher warnings
      if (message.includes('Launcher is disabled') || (message.includes('Intercom') && message.includes('Launcher'))) {
        return;
      }
      originalWarn.apply(console, args);
    };
    
    console.error = (...args) => {
      const message = args.join(' ');
      // Suppress Intercom launcher errors
      if (message.includes('Launcher is disabled') || (message.includes('Intercom') && message.includes('Launcher'))) {
        return;
      }
      originalError.apply(console, args);
    };
    
    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  async function fetchData(showLoading = true, skipClosed = false) {
    if (showLoading) {
    setLoading(true);
    }
    setError("");

    // Create abort controller for this specific fetch
    const controller = new AbortController();
    let timeoutId = null;

    try {
      // In development, use production API URL since local dev server doesn't have API routes
      // In production, use /api route
      const apiBaseUrl = process.env.NODE_ENV === 'production' 
        ? `${window.location.origin}/api/intercom/conversations/open-team-5480079`
        : 'https://queue-health-monitor.vercel.app/api/intercom/conversations/open-team-5480079';
      
      // Add query parameter to skip closed conversations if requested
      const apiUrl = skipClosed 
        ? `${apiBaseUrl}?skipClosed=true`
        : apiBaseUrl;
      
      const fetchStartTime = performance.now();
      console.log('App: Fetching conversations from:', apiUrl);
      console.log('App: Fetch started at:', new Date().toISOString());
      
      // Add timeout to detect hanging requests (only in production to avoid hot reload issues)
      // Increased to 120 seconds to accommodate longer API response times
      if (process.env.NODE_ENV === 'production') {
        timeoutId = setTimeout(() => {
          controller.abort();
          console.error('App: Fetch timeout after 120 seconds');
        }, 120000);
      }
      
      // Only use abort signal in production (avoid hot reload abort issues in dev)
      const fetchOptions = process.env.NODE_ENV === 'production' 
        ? { signal: controller.signal }
        : {};
      
      const res = await fetch(apiUrl, fetchOptions);
      if (timeoutId) clearTimeout(timeoutId);
      
      const fetchEndTime = performance.now();
      const fetchDuration = fetchEndTime - fetchStartTime;
      console.log('App: Response received at:', new Date().toISOString());
      console.log(`App: API call took ${Math.round(fetchDuration)}ms (${Math.round(fetchDuration/1000)}s)`);
      console.log('App: Response status:', res.status, res.ok);
      console.log('App: Response headers:', Object.fromEntries(res.headers.entries()));

      if (!res.ok) {
        const text = await res.text();
        console.error('App: API error response:', text);
        throw new Error(text || `HTTP ${res.status}`);
      }

      const parseStartTime = performance.now();
      const response = await res.json();
      const parseEndTime = performance.now();
      console.log('App: Received response:', { 
        isArray: Array.isArray(response),
        conversationsCount: Array.isArray(response) ? response.length : (response.conversations?.length || 0),
        teamMembersCount: response.teamMembers?.length || 0,
        responseKeys: Object.keys(response),
        teamMembersSample: response.teamMembers?.slice(0, 2) || 'none',
        fullResponse: response
      });
      console.log(`App: JSON parsing took ${Math.round(parseEndTime - parseStartTime)}ms`);
      
      // Handle both old format (array) and new format (object with conversations and teamMembers)
      const conversations = Array.isArray(response) ? response : (response.conversations || []);
      const teamMembers = response.teamMembers || [];
      console.log('App: Setting data with', conversations.length, 'conversations and', teamMembers.length, 'team members');
      if (teamMembers.length === 0) {
        console.warn('App: WARNING - No team members received from API!');
        console.warn('App: Full response:', JSON.stringify(response, null, 2));
      } else {
        console.log('App: Team members loaded successfully:', teamMembers.map(m => ({ id: m.id, email: m.email, name: m.name })));
      }
      
      setData({ conversations, teamMembers });
      setLastUpdated(new Date());
      const totalTime = performance.now() - fetchStartTime;
      console.log('App: Initial fetch completed. Setting loading to false. Conversations:', conversations.length);
      console.log(`App: Total time breakdown - API call: ${Math.round(fetchDuration)}ms, Parse: ${Math.round(parseEndTime - parseStartTime)}ms, Total: ${Math.round(totalTime)}ms (${Math.round(totalTime/1000)}s)`);
    } catch (e) {
      // Clean up timeout if still active
      if (timeoutId) clearTimeout(timeoutId);
      
      // Ignore AbortError - it's usually from hot reload or intentional cancellation
      if (e.name === 'AbortError') {
        console.log('App: Request aborted (likely due to hot reload or navigation)');
        return; // Don't show error for aborted requests
      }
      
      console.error('App: Error fetching data:', e);
      console.error('App: Error details:', {
        name: e.name,
        message: e.message,
        stack: e.stack,
        cause: e.cause
      });
      setError(e.message);
    } finally {
      if (showLoading) {
        console.log('App: Setting loading to false (initial fetch finished)');
        setLoading(false);
      }
    }
  }

  // Fetch closed conversations separately in the background
  async function fetchClosedConversations() {
    const closedFetchStartTime = performance.now();
    try {
      const apiBaseUrl = process.env.NODE_ENV === 'production' 
        ? `${window.location.origin}/api/intercom/conversations/open-team-5480079`
        : 'https://queue-health-monitor.vercel.app/api/intercom/conversations/open-team-5480079';
      
      const apiUrl = `${apiBaseUrl}?closedOnly=true`;
      
      console.log('App: Fetching closed conversations from:', apiUrl);
      console.log('App: Closed conversations fetch started at:', new Date().toISOString());
      const res = await fetch(apiUrl);

      if (!res.ok) {
        const text = await res.text();
        console.warn('App: Error fetching closed conversations:', text || `HTTP ${res.status}`);
        return;
      }

      const closedFetchEndTime = performance.now();
      const closedFetchDuration = closedFetchEndTime - closedFetchStartTime;
      console.log(`App: Closed conversations API call took ${Math.round(closedFetchDuration)}ms (${Math.round(closedFetchDuration/1000)}s)`);
      
      const response = await res.json();
      const closedConversations = Array.isArray(response) ? response : (response.conversations || []);
      
      console.log('App: Received', closedConversations.length, 'closed conversations');
      
      // Merge closed conversations into existing data
      const mergeStartTime = performance.now();
      setData(prevData => {
        const existingConversations = Array.isArray(prevData) ? prevData : (prevData.conversations || []);
        const existingTeamMembers = prevData.teamMembers || [];
        
        // Create a map of existing conversation IDs to avoid duplicates
        const existingIds = new Set(existingConversations.map(c => c.id || c.conversation_id));
        
        // Filter out any closed conversations that are already in the list
        const newClosedConversations = closedConversations.filter(c => {
          const id = c.id || c.conversation_id;
          return !existingIds.has(id);
        });
        
        // Combine existing conversations with new closed conversations
        const allConversations = [...existingConversations, ...newClosedConversations];
        
        const mergeEndTime = performance.now();
        const totalClosedTime = performance.now() - closedFetchStartTime;
        console.log('App: Merged closed conversations. Total conversations:', allConversations.length);
        console.log(`App: Closed conversations total time - API: ${Math.round(closedFetchDuration)}ms, Merge: ${Math.round(mergeEndTime - mergeStartTime)}ms, Total: ${Math.round(totalClosedTime)}ms (${Math.round(totalClosedTime/1000)}s)`);
        
        return {
          conversations: allConversations,
          teamMembers: existingTeamMembers
        };
      });
    } catch (e) {
      const errorTime = performance.now() - closedFetchStartTime;
      console.warn(`App: Error fetching closed conversations after ${Math.round(errorTime)}ms:`, e.message);
      // Silently fail - closed conversations are loaded in background
    }
  }

  // Get current user email on mount and when location/props change
  useEffect(() => {
    const email = getCurrentUserEmail({ currentUserEmail: propsCurrentUserEmail });
    setCurrentUserEmail(email);
    console.log('App: Current user email:', email);
  }, [location, propsCurrentUserEmail]);

  // Fetch historical data for MyQueue
  const fetchHistoricalData = useCallback(async () => {
    if (location.pathname !== '/myqueue') return;
    
    try {
      // Get last 7 weekdays
      const getLast7Weekdays = () => {
        const dates = [];
        const today = new Date();
        let daysBack = 0;
        let weekdaysFound = 0;
        
        while (weekdaysFound < 7 && daysBack < 14) {
          const date = new Date(today);
          date.setDate(date.getDate() - daysBack);
          const dayOfWeek = date.getDay();
          
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            dates.push(date.toISOString().split('T')[0]);
            weekdaysFound++;
          }
          daysBack++;
        }
        
        return dates.sort();
      };
      
      const weekdays = getLast7Weekdays();
      const startDateStr = weekdays.length > 0 ? weekdays[0] : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const endDateStr = weekdays.length > 0 ? weekdays[weekdays.length - 1] : new Date().toISOString().slice(0, 10);

      const snapshotParams = new URLSearchParams();
      snapshotParams.append('startDate', startDateStr);
      snapshotParams.append('endDate', endDateStr);
      
      const snapshotUrl = process.env.NODE_ENV === 'production'
        ? `${window.location.origin}/api/snapshots/get?${snapshotParams}`
        : `https://queue-health-monitor.vercel.app/api/snapshots/get?${snapshotParams}`;
      
      const metricParams = new URLSearchParams();
      metricParams.append('startDate', startDateStr);
      metricParams.append('endDate', endDateStr);
      
      const metricUrl = process.env.NODE_ENV === 'production'
        ? `${window.location.origin}/api/response-time-metrics/get?${metricParams}`
        : `https://queue-health-monitor.vercel.app/api/response-time-metrics/get?${metricParams}`;

      const [snapshotRes, metricRes] = await Promise.all([
        fetch(snapshotUrl).catch(() => ({ ok: false })),
        fetch(metricUrl).catch(() => ({ ok: false }))
      ]);

      if (snapshotRes.ok) {
        const snapshotData = await snapshotRes.json();
        setHistoricalSnapshots(snapshotData.snapshots || []);
      }
      
      if (metricRes.ok) {
        const metricData = await metricRes.json();
        setResponseTimeMetrics(metricData.metrics || []);
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
      // Silently fail - historical data is optional
    }
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;
    let closedTimeout = null;
    
    // Initial load: fetch open/snoozed conversations (skip closed)
    const initialFetch = async () => {
      await fetchData(true, true); // Initial load with loading state, skip closed conversations
      
      // Only proceed if component is still mounted
      if (!isMounted) return;
      
      if (location.pathname === '/myqueue') {
        fetchHistoricalData(); // Fetch historical data for MyQueue
      }
      
      // After initial load completes, fetch closed conversations in the background
      // Small delay to ensure initial render completes
      closedTimeout = setTimeout(() => {
        if (isMounted) {
          console.log('App: Starting background fetch of closed conversations (initial fetch already completed)');
          fetchClosedConversations();
        }
      }, 100);
    };
    
    initialFetch();
    
    // Set up auto-refresh every 2 minutes (120000 ms)
    const interval = setInterval(() => {
      if (isMounted) {
        fetchData(false, false); // Background refresh without loading state, include closed conversations
        if (location.pathname === '/myqueue') {
          fetchHistoricalData(); // Refresh historical data too
        }
      }
    }, 120000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (closedTimeout) {
        clearTimeout(closedTimeout);
      }
    };
  }, [location.pathname, fetchHistoricalData]);

  // Show login page if not authenticated
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  // Determine which component to render based on route
  const commonProps = {
    conversations: data.conversations || data,
    teamMembers: data.teamMembers || [],
    loading,
    error,
    onRefresh: () => {
      fetchData(true, false); // Manual refresh includes closed conversations
    },
    lastUpdated
  };

  if (location.pathname === '/myqueue') {
    return (
      <MyQueue
        {...commonProps}
        currentUserEmail={currentUserEmail}
        historicalSnapshots={historicalSnapshots}
        responseTimeMetrics={responseTimeMetrics}
      />
    );
  }

  return (
    <Dashboard {...commonProps} />
  );
}

function App(props) {
  // Extract currentUserEmail from props (passed by Sigma plugin)
  const currentUserEmail = props?.currentUserEmail || null;
  
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent currentUserEmail={currentUserEmail} />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

