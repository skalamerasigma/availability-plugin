import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "./ThemeContext";
import { useAuth } from "./AuthContext";
import { formatDateTimeUTC, calculateTimeRemaining, formatTimeRemaining } from "./utils/dateUtils";
import "./MyQueue.css";

// Custom hook for managing dismissed items in localStorage
function useDismissedItems(storageKey) {
  const [dismissedItems, setDismissedItems] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const dismissItem = useCallback((itemId) => {
    setDismissedItems(prev => {
      const updated = [...prev, itemId];
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save dismissed items:', e);
      }
      return updated;
    });
  }, [storageKey]);

  const isDismissed = useCallback((itemId) => {
    return dismissedItems.includes(itemId);
  }, [dismissedItems]);

  const clearDismissed = useCallback(() => {
    setDismissedItems([]);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error('Failed to clear dismissed items:', e);
    }
  }, [storageKey]);

  return { dismissedItems, dismissItem, isDismissed, clearDismissed };
}

// Users who can see the footer dev controls (TSE/Manager toggle and simulation dropdowns)
// Must match Dashboard.jsx
const FOOTER_CONTROLS_USERS = ['Stephen Skalamera'];

const THRESHOLDS = {
  MAX_OPEN_SOFT: 5,
  MAX_WAITING_ON_TSE_SOFT: 5,
  MAX_OPEN_ALERT: 6,
  MAX_WAITING_ON_TSE_ALERT: 7
};

const INTERCOM_BASE_URL = "https://app.intercom.com/a/inbox/gu1e0q0t/inbox/admin/9110812/conversation/";
const BREACH_THRESHOLD_MINUTES = 10;

// Countdown Timer Component for Unassigned Conversations
function UnassignedCountdownTimer({ createdTimestamp, isDarkMode, waitTimeColor }) {
  const [timeDisplay, setTimeDisplay] = useState(() => {
    if (!createdTimestamp) return { text: "0s", isUrgent: true };
    const now = Date.now() / 1000;
    const waitTimeMinutes = (now - createdTimestamp) / 60;
    const minutesUntilBreach = BREACH_THRESHOLD_MINUTES - waitTimeMinutes;
    
    if (minutesUntilBreach <= 0) {
      return { text: "BREACHED", isUrgent: true };
    }
    
    const minsLeft = Math.floor(minutesUntilBreach);
    const secsLeft = Math.floor((minutesUntilBreach - minsLeft) * 60);
    
    if (minsLeft > 0) {
      return { text: `${minsLeft}m ${secsLeft}s`, isUrgent: minutesUntilBreach <= 2 };
    }
    return { text: `${secsLeft}s`, isUrgent: true };
  });
  
  useEffect(() => {
    if (!createdTimestamp) return;
    
    const updateTimer = () => {
      const now = Date.now() / 1000;
      const waitTimeMinutes = (now - createdTimestamp) / 60;
      const minutesUntilBreach = BREACH_THRESHOLD_MINUTES - waitTimeMinutes;
      
      if (minutesUntilBreach <= 0) {
        setTimeDisplay({ text: "BREACHED", isUrgent: true });
        return;
      }
      
      const minsLeft = Math.floor(minutesUntilBreach);
      const secsLeft = Math.floor((minutesUntilBreach - minsLeft) * 60);
      
      if (minsLeft > 0) {
        setTimeDisplay({ 
          text: `${minsLeft}m ${secsLeft}s`, 
          isUrgent: minutesUntilBreach <= 2 
        });
      } else {
        setTimeDisplay({ text: `${secsLeft}s`, isUrgent: true });
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [createdTimestamp]);
  
  return (
    <span style={{
      fontSize: '12px',
      color: isDarkMode ? '#999' : '#666'
    }}>
      <span style={{ 
        color: waitTimeColor,
        fontWeight: 600
      }}>{timeDisplay.text}</span> <span style={{ 
        color: isDarkMode ? '#999' : '#666',
        fontWeight: 400
      }}>until breach</span>
    </span>
  );
}

// Countdown Card Component (unused - kept for potential future use)
// eslint-disable-next-line no-unused-vars, react-hooks/exhaustive-deps
function CountdownCard({ conv, isDarkMode, index = 0, compact = false }) {
  const snoozedUntil = conv.snoozed_until || null;
  const snoozedUntilDate = useMemo(() => {
    return snoozedUntil 
      ? (typeof snoozedUntil === "number" ? new Date(snoozedUntil * 1000) : new Date(snoozedUntil))
      : null;
  }, [snoozedUntil]);
  
  const [timeRemaining, setTimeRemaining] = useState(() => 
    snoozedUntilDate ? calculateTimeRemaining(snoozedUntilDate) : { expired: true }
  );
  
  useEffect(() => {
    if (!snoozedUntilDate) return;
    
    const updateTimer = () => {
      const remaining = calculateTimeRemaining(snoozedUntilDate);
      setTimeRemaining(remaining);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [snoozedUntilDate]);
  
  const isExpired = timeRemaining.expired;
  const totalMinutes = timeRemaining.totalMs / (1000 * 60);
  const urgencyLevel = isExpired ? 'critical' : totalMinutes <= 30 ? 'high' : totalMinutes <= 60 ? 'medium' : 'low';
  
  // Calculate progress percentage (0-100%)
  // For expired: 100% (fully red)
  // For < 2 hours: show progress from 0-100%
  // For > 2 hours: show minimal progress (5%) to indicate active timer
  const maxMinutes = 120; // 2 hours
  let progress;
  if (isExpired) {
    progress = 100; // Fully expired
  } else if (totalMinutes <= maxMinutes) {
    progress = ((maxMinutes - totalMinutes) / maxMinutes) * 100;
  } else {
    progress = 5; // Show minimal progress for longer timers
  }
  
  const convId = conv.id || conv.conversation_id || 'unknown';
  const convUrl = `${INTERCOM_BASE_URL}${convId}`;
  const convTitle = conv.title || conv.source?.title || `Conversation ${convId}`;
  
  return (
    <div 
      className={`countdown-card countdown-${urgencyLevel} ${compact ? 'countdown-card-compact' : 'countdown-card-overlap'}`}
      onClick={() => window.open(convUrl, '_blank')}
      style={compact ? {} : {
        zIndex: 1000 - index,
        '--overlap-offset': `${index * -20}px`
      }}
      data-index={index}
    >
      <div className="countdown-card-content">
        <div className="countdown-visual">
          <div className="countdown-ring">
            <svg className="countdown-svg" viewBox="0 0 100 100">
              <circle
                className="countdown-ring-bg"
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={isDarkMode ? '#333' : '#e0e0e0'}
                strokeWidth="8"
              />
              <circle
                className={`countdown-ring-progress countdown-ring-${urgencyLevel}`}
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                transform="rotate(-90 50 50)"
                style={{
                  transition: 'stroke-dashoffset 0.5s ease',
                  stroke: urgencyLevel === 'critical' 
                    ? '#ff4444' 
                    : urgencyLevel === 'high' 
                      ? '#ff8800' 
                      : urgencyLevel === 'medium'
                        ? '#ffaa00'
                        : '#4cec8c'
                }}
              />
            </svg>
            <div className="countdown-time-display">
              {isExpired ? (
                <span className="countdown-expired">EXPIRED</span>
              ) : timeRemaining.days > 0 ? (
                <>
                  <span className="countdown-minutes">{timeRemaining.days}</span>
                  <span className="countdown-label">day{timeRemaining.days !== 1 ? 's' : ''}</span>
                </>
              ) : timeRemaining.hours > 0 ? (
                <>
                  <span className="countdown-minutes">{timeRemaining.hours}</span>
                  <span className="countdown-label">hr{timeRemaining.hours !== 1 ? 's' : ''}</span>
                </>
              ) : (
                <>
                  <span className="countdown-minutes">{Math.floor(totalMinutes)}</span>
                  <span className="countdown-label">min</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="countdown-info">
          <div className="countdown-title">{convTitle}</div>
          <div className="countdown-details">
            <span className="countdown-id">#{String(convId).slice(-6)}</span>
            {!isExpired && (
              <span className="countdown-full-time">
                {formatTimeRemaining(timeRemaining)}
              </span>
            )}
          </div>
          {isExpired && (
            <div className="countdown-warning">
              ⚠️ Snooze timer has expired
            </div>
          )}
        </div>
        
        <div className="countdown-action">
          <div className="countdown-arrow">→</div>
        </div>
      </div>
    </div>
  );
}

function MyQueue({ conversations = [], teamMembers = [], currentUserEmail, simulatedTSE = null, loading, error, onRefresh, lastUpdated, historicalSnapshots = [], responseTimeMetrics = [] }) {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  
  // Check if user has access to footer dev controls
  const hasFooterControlsAccess = FOOTER_CONTROLS_USERS.includes(user?.name);
  const [filterTags, setFilterTags] = useState(["all"]);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const [searchId, setSearchId] = useState("");
  const [expandedFilters, setExpandedFilters] = useState(new Set()); // Default collapsed
  
  // Manage dismissed insights
  const insightsDismissed = useDismissedItems('dismissedMyQueueInsights');
  const isInsightDismissed = insightsDismissed.isDismissed;
  const dismissInsightItem = insightsDismissed.dismissItem;

  // Format insight text with bold and colors
  const formatInsightText = useCallback((insight) => {
    // Performance percentage insights
    if (insight.percentage !== undefined && insight.days !== undefined) {
      const percentageText = `${insight.percentage.toFixed(0)}%`;
      const daysText = `${insight.days} day${insight.days !== 1 ? 's' : ''}`;
      const color = insight.type === 'positive' ? '#4cec8c' : '#fd8789';
      
      if (insight.type === 'positive') {
        return (
          <>
            <strong>Excellent performance:</strong> <strong style={{ color }}>{percentageText}</strong> on-track over <strong>{daysText}</strong>
          </>
        );
      } else {
        return (
          <>
            Only <strong style={{ color }}>{percentageText}</strong> on-track over <strong>{daysText}</strong>
          </>
        );
      }
    }
    
    // Average open chats insight
    if (insight.avgOpen !== undefined && insight.target !== undefined) {
      const avgText = `${insight.avgOpen.toFixed(1)}`;
      const targetText = `≤${insight.target}`;
      return (
        <>
          Average open chats (<strong style={{ color: '#fd8789' }}>{avgText}</strong>) exceeds target (<strong>{targetText}</strong>)
        </>
      );
    }
    
    // Average waiting on TSE insight
    if (insight.avgWaiting !== undefined && insight.target !== undefined) {
      const avgText = `${insight.avgWaiting.toFixed(1)}`;
      const targetText = `≤${insight.target}`;
      return (
        <>
          Average waiting on TSE (<strong style={{ color: '#fd8789' }}>{avgText}</strong>) exceeds target (<strong>{targetText}</strong>)
        </>
      );
    }
    
    // Trend insights
    if (insight.change !== undefined && insight.period !== undefined) {
      const changeText = `${insight.change > 0 ? '+' : ''}${insight.change.toFixed(1)}%`;
      const color = insight.type === 'positive' ? '#4cec8c' : '#fd8789';
      
      if (insight.type === 'positive') {
        return (
          <>
            <strong>Performance improving:</strong> <strong style={{ color }}>{changeText}</strong> on-track <strong>{insight.period}</strong>
          </>
        );
      } else {
        return (
          <>
            <strong style={{ color }}>{changeText}</strong> on-track <strong>{insight.period}</strong>
          </>
        );
      }
    }
    
    // Fallback to plain text
    return insight.text;
  }, []);

  // Find current user's TSE info from teamMembers
  // If simulatedTSE is provided (Stephen simulating another TSE), use that instead
  const currentTSE = useMemo(() => {
    // Use simulated TSE if provided
    if (simulatedTSE) return simulatedTSE;
    
    if (!currentUserEmail || !teamMembers.length) return null;
    
    // Try to match by email (case-insensitive)
    const matched = teamMembers.find(member => 
      member.email && member.email.toLowerCase() === currentUserEmail.toLowerCase()
    );
    
    return matched || null;
  }, [currentUserEmail, teamMembers, simulatedTSE]);

  // Filter conversations for current user only
  const myConversations = useMemo(() => {
    console.log(`[MyQueue] Filtering conversations for current user. Total conversations: ${conversations?.length || 0}`);
    console.log(`[MyQueue] Current TSE:`, currentTSE);
    
    if (!conversations || !currentTSE) {
      console.log(`[MyQueue] Missing conversations or currentTSE. conversations: ${!!conversations}, currentTSE: ${!!currentTSE}`);
      return [];
    }
    
    const tseId = currentTSE.id;
    if (!tseId) {
      console.log(`[MyQueue] No TSE ID found in currentTSE:`, currentTSE);
      return [];
    }
    
    console.log(`[MyQueue] Looking for conversations assigned to TSE ID: ${tseId}`);
    
    // Debug: Log sample conversations to see their structure
    const sampleConvs = conversations.slice(0, 5);
    console.log(`[MyQueue] Sample conversations (first 5):`, sampleConvs.map(conv => ({
      id: conv.id || conv.conversation_id,
      state: conv.state,
      admin_assignee_id: conv.admin_assignee_id,
      admin_assignee: conv.admin_assignee,
      closed_at: conv.closed_at || conv.closedAt
    })));
    
    // Debug: Check ALL conversations for closed state (case-insensitive)
    const allClosed = conversations.filter(conv => {
      const state = (conv.state || "").toLowerCase();
      return state === "closed";
    });
    console.log(`[MyQueue] Found ${allClosed.length} conversations with state="closed" (case-insensitive check)`);
    if (allClosed.length > 0) {
      console.log(`[MyQueue] Closed conversation IDs:`, allClosed.map(conv => ({
        id: conv.id || conv.conversation_id,
        state: conv.state,
        admin_assignee_id: conv.admin_assignee_id,
        closed_at: conv.closed_at || conv.closedAt
      })));
    }
    
    // Debug: Count conversations by state
    const stateCounts = conversations.reduce((acc, conv) => {
      const state = (conv.state || "").toLowerCase();
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});
    console.log(`[MyQueue] Conversation states in all conversations:`, stateCounts);
    
    // Debug: Check closed conversations specifically
    const closedConvs = conversations.filter(conv => (conv.state || "").toLowerCase() === "closed");
    console.log(`[MyQueue] Found ${closedConvs.length} closed conversations total`);
    if (closedConvs.length > 0) {
      console.log(`[MyQueue] Closed conversation assignment details:`, closedConvs.slice(0, 3).map(conv => ({
        id: conv.id || conv.conversation_id,
        admin_assignee_id: conv.admin_assignee_id,
        admin_assignee: conv.admin_assignee,
        admin_assignee_type: typeof conv.admin_assignee,
        closed_at: conv.closed_at || conv.closedAt
      })));
    }
    
    const filtered = conversations.filter(conv => {
      const convTseId = conv.admin_assignee_id || 
                       (conv.admin_assignee && typeof conv.admin_assignee === "object" ? conv.admin_assignee.id : null);
      const matches = String(convTseId) === String(tseId);
      
      // Debug closed conversations that don't match
      if ((conv.state || "").toLowerCase() === "closed" && !matches) {
        console.log(`[MyQueue] Closed conversation ${conv.id || conv.conversation_id} doesn't match:`, {
          convTseId,
          tseId,
          admin_assignee_id: conv.admin_assignee_id,
          admin_assignee: conv.admin_assignee
        });
      }
      
      return matches;
    });
    
    console.log(`[MyQueue] Filtered to ${filtered.length} conversations for TSE ${tseId}`);
    const filteredStateCounts = filtered.reduce((acc, conv) => {
      const state = (conv.state || "").toLowerCase();
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});
    console.log(`[MyQueue] Filtered conversation states:`, filteredStateCounts);
    
    return filtered;
  }, [conversations, currentTSE]);

  // Calculate metrics for current user
  const metrics = useMemo(() => {
    if (!myConversations.length) {
      return {
        open: 0,
        waitingOnTSE: 0,
        waitingOnCustomerResolved: 0,
        waitingOnCustomerUnresolved: 0,
        totalSnoozed: 0,
        answeredToday: 0,
        closedToday: 0,
        status: "on-track",
        isOnTrack: true
      };
    }

    let open = 0;
    let waitingOnTSE = 0;
    let waitingOnCustomerResolved = 0;
    let waitingOnCustomerUnresolved = 0;
    let totalSnoozed = 0;
    let answeredToday = 0;
    let closedToday = 0;

    // Calculate today's date in PT timezone (same logic as Close Rate %)
    const now = new Date();
    
    // Get current PT time formatter
    const ptDateFormatter = new Intl.DateTimeFormat('en-US', { 
      timeZone: 'America/Los_Angeles', 
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const todayPTDateStr = ptDateFormatter.format(now).replace(/(\d+)\/(\d+)\/(\d+)/, (_, month, day, year) => {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    });

    // Helper function to convert UTC timestamp to PT date string
    const toPTDateStr = (timestamp) => {
      if (!timestamp) return null;
      const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
      const date = new Date(ms);
      return ptDateFormatter.format(date).replace(/(\d+)\/(\d+)\/(\d+)/, (_, month, day, year) => {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      });
    };

    // Calculate today's start and end in seconds (UTC) for closedToday calculation
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
    const todayStartSeconds = Math.floor(todayStart.getTime() / 1000);
    const todayEndSeconds = Math.floor(todayEnd.getTime() / 1000);

    myConversations.forEach(conv => {
      const isSnoozed = conv.state === "snoozed" || conv.snoozed_until;
      const tags = Array.isArray(conv.tags) ? conv.tags : [];
      
      const hasWaitingOnTSETag = tags.some(t => 
        (t.name && t.name.toLowerCase() === "snooze.waiting-on-tse") || 
        (typeof t === "string" && t.toLowerCase() === "snooze.waiting-on-tse")
      );
      
      const hasWaitingOnCustomerResolvedTag = tags.some(t => 
        (t.name && t.name.toLowerCase() === "snooze.waiting-on-customer-resolved") || 
        (typeof t === "string" && t.toLowerCase() === "snooze.waiting-on-customer-resolved")
      );
      
      const hasWaitingOnCustomerUnresolvedTag = tags.some(t => 
        (t.name && t.name.toLowerCase() === "snooze.waiting-on-customer-unresolved") || 
        (typeof t === "string" && t.toLowerCase() === "snooze.waiting-on-customer-unresolved")
      );

      // Check if conversation was assigned to this TSE today (PT timezone)
      // Uses same logic as Close Rate %: counts conversations created today (PT date)
      // Conversations are already filtered to this TSE via myConversations filter
      // API already filters by team_assignee_id: 5480079
      const createdAt = conv.created_at || conv.createdAt || conv.first_opened_at;
      if (createdAt) {
        const createdDateStr = toPTDateStr(createdAt);
        // Only count conversations created today (in PT) that are assigned to this TSE
        if (createdDateStr && createdDateStr === todayPTDateStr) {
          answeredToday++;
        }
      }

      // Check if conversation has auto-closed tag and was closed today
      const hasAutoClosedTag = tags.some(t => 
        (t.name && t.name.toLowerCase() === "snooze.auto-closed") || 
        (typeof t === "string" && t.toLowerCase() === "snooze.auto-closed")
      );
      if (hasAutoClosedTag) {
        const closedAt = conv.closed_at || conv.closedAt;
        if (closedAt) {
          const closedAtSeconds = typeof closedAt === "number" 
            ? (closedAt > 1e12 ? Math.floor(closedAt / 1000) : closedAt)
            : Math.floor(new Date(closedAt).getTime() / 1000);
          if (closedAtSeconds >= todayStartSeconds && closedAtSeconds < todayEndSeconds) {
            closedToday++;
          }
        }
      }

      if (conv.state === "open" && !isSnoozed) {
        open++;
      } else if (isSnoozed) {
        totalSnoozed++;
        if (hasWaitingOnTSETag) {
          waitingOnTSE++;
        } else if (hasWaitingOnCustomerResolvedTag) {
          waitingOnCustomerResolved++;
        } else if (hasWaitingOnCustomerUnresolvedTag) {
          waitingOnCustomerUnresolved++;
        }
      }
    });

    const meetsOpen = open <= THRESHOLDS.MAX_OPEN_SOFT;
    const meetsWaitingOnTSE = waitingOnTSE <= THRESHOLDS.MAX_WAITING_ON_TSE_SOFT;
    const isOnTrack = meetsOpen && meetsWaitingOnTSE;
    
    let status = "on-track";
    if (open >= THRESHOLDS.MAX_OPEN_ALERT || waitingOnTSE >= THRESHOLDS.MAX_WAITING_ON_TSE_ALERT) {
      status = "over-limit";
    } else if (!isOnTrack) {
      status = "over-limit";
    }

    return {
      open,
      waitingOnTSE,
      waitingOnCustomerResolved,
      waitingOnCustomerUnresolved,
      totalSnoozed,
      answeredToday,
      closedToday,
      status,
      isOnTrack,
      meetsOpen,
      meetsWaitingOnTSE
    };
  }, [myConversations]);


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setFilterDropdownOpen(false);
      }
    };

    if (filterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [filterDropdownOpen]);

  // Filter options configuration - hierarchical structure
  const filterOptions = [
    { value: "all", label: "All Conversations", children: null },
    {
      value: "snoozed",
      label: "All Snoozed",
      children: [
        {
          value: "waitingoncustomer",
          label: "Waiting on Customer",
          children: [
            { value: "waitingoncustomer-resolved", label: "Resolved", children: null },
            { value: "waitingoncustomer-unresolved", label: "Unresolved", children: null }
          ]
        },
        { value: "waitingontse", label: "Waiting on TSE", children: null },
        { value: "snoozed-other", label: "Other", children: null }
      ]
    },
    { value: "open", label: "Open Chats", children: null },
    {
      value: "closed",
      label: "Closed Today",
      children: [
        { value: "closed-regular", label: "Closed", children: null },
        {
          value: "autoclosed",
          label: "Auto-Closed",
          children: [
            { value: "autoclosed-resolved", label: "Waiting On Customer - Resolved", children: null },
            { value: "autoclosed-unresolved", label: "Waiting On Customer - Unresolved", children: null }
          ]
        }
      ]
    }
  ];

  const handleFilterToggle = (value, e) => {
    if (value === "all") {
      // If "all" is clicked, toggle it and clear others
      setFilterTags(filterTags.includes("all") ? [] : ["all"]);
    } else {
      // For all other filters, make them completely independent - no cascading behavior
      // Remove "all" if it's selected and user selects something else
      let newFilters = filterTags.filter(tag => tag !== "all");
      
      if (e.target.checked) {
        // When checking any filter, remove parent categories to allow filtering to just that specific type
        if (value === "waitingoncustomer-resolved" || 
            value === "waitingoncustomer-unresolved") {
          // Remove parent categories when selecting a specific sub-subcategory
          newFilters = newFilters.filter(t => 
            t !== "snoozed" && 
            t !== "waitingoncustomer"
          );
        } else if (value === "waitingoncustomer") {
          // Remove parent category when selecting a subcategory
          newFilters = newFilters.filter(t => t !== "snoozed");
        } else if (value === "waitingontse" || value === "snoozed-other") {
          // Remove parent category when selecting a specific snoozed subcategory
          newFilters = newFilters.filter(t => t !== "snoozed");
        } else if (value === "autoclosed-resolved" || 
                   value === "autoclosed-unresolved") {
          // Remove parent categories when selecting a specific auto-closed sub-subcategory
          newFilters = newFilters.filter(t => 
            t !== "closed" && 
            t !== "closed-regular" &&
            t !== "autoclosed"
          );
        } else if (value === "autoclosed") {
          // Remove closed parent and closed-regular sibling when selecting auto-closed subcategory
          newFilters = newFilters.filter(t => 
            t !== "closed" &&
            t !== "closed-regular"
          );
        } else if (value === "closed") {
          // Remove auto-closed children when selecting closed parent to allow precise filtering
          newFilters = newFilters.filter(t => 
            t !== "closed-regular" &&
            t !== "autoclosed" && 
            t !== "autoclosed-resolved" && 
            t !== "autoclosed-unresolved"
          );
        } else if (value === "closed-regular") {
          // Remove closed parent and auto-closed children when selecting closed-regular subcategory
          newFilters = newFilters.filter(t => 
            t !== "closed" &&
            t !== "autoclosed" && 
            t !== "autoclosed-resolved" && 
            t !== "autoclosed-unresolved"
          );
        }
        
        // Add the selected filter
        if (!newFilters.includes(value)) {
          newFilters.push(value);
        }
      } else {
        // Simply remove the unchecked filter - no cascading behavior
        newFilters = newFilters.filter(tag => tag !== value);
      }
      
      // If nothing selected, default to "all"
      setFilterTags(newFilters.length === 0 ? ["all"] : newFilters);
    }
  };

  // Filter conversations by tag
  const filteredConversations = useMemo(() => {
    let filtered = myConversations;

    // If "all" is selected or no filters, include all conversations (open, snoozed, and closed)
    // Note: The API already filters closed conversations to only include today's, so we don't need to filter again
    if (filterTags.includes("all") || filterTags.length === 0) {
      // Include all conversations - API already handles filtering closed to today
      // No additional filtering needed
    } else {
      // Apply filters - conversation must match at least one selected filter
      filtered = filtered.filter(conv => {
        return filterTags.some(filterTag => {
          if (filterTag === "open") {
            const isSnoozed = conv.state === "snoozed" || conv.snoozed_until;
            return conv.state === "open" && !isSnoozed;
          } else if (filterTag === "closed") {
            // Filter for all conversations closed today (API already filters to today's closed conversations)
            const state = (conv.state || "").toLowerCase();
            return state === "closed";
          } else if (filterTag === "closed-regular") {
            // Filter for closed conversations from today that are NOT auto-closed
            const state = (conv.state || "").toLowerCase();
            if (state !== "closed") return false;
            
            // Exclude auto-closed conversations
            const customAttributes = conv.custom_attributes || {};
            const autoClosedValue = customAttributes["Auto-Closed"];
            if (autoClosedValue) return false; // Skip if has Auto-Closed attribute
            
            return true;
          } else if (filterTag === "waitingontse") {
            // Filter for snoozed conversations with "Last Snooze Workflow Used" = "Waiting On TSE"
            const isSnoozed = conv.state === "snoozed" || 
                             conv.state === "Snoozed" ||
                             conv.snoozed_until || 
                             (conv.statistics && conv.statistics.state === "snoozed");
            if (!isSnoozed) return false;
            
            const customAttributes = conv.custom_attributes || {};
            const lastSnoozeWorkflow = customAttributes["Last Snooze Workflow Used"];
            
            // Check if Last Snooze Workflow Used matches "Waiting On TSE"
            return lastSnoozeWorkflow === "Waiting On TSE";
          } else if (filterTag === "waitingoncustomer") {
            // Filter for snoozed conversations with "Last Snooze Workflow Used" = "Waiting On Customer - Resolved" or "Waiting On Customer - Unresolved"
            const isSnoozed = conv.state === "snoozed" || 
                             conv.state === "Snoozed" ||
                             conv.snoozed_until || 
                             (conv.statistics && conv.statistics.state === "snoozed");
            if (!isSnoozed) return false;
            
            const customAttributes = conv.custom_attributes || {};
            const lastSnoozeWorkflow = customAttributes["Last Snooze Workflow Used"];
            
            // Check if Last Snooze Workflow Used matches either customer waiting workflow
            return lastSnoozeWorkflow === "Waiting On Customer - Resolved" || 
                   lastSnoozeWorkflow === "Waiting On Customer - Unresolved";
          } else if (filterTag === "waitingoncustomer-resolved") {
            // Filter for snoozed conversations with "Last Snooze Workflow Used" = "Waiting On Customer - Resolved"
            const isSnoozed = conv.state === "snoozed" || 
                             conv.state === "Snoozed" ||
                             conv.snoozed_until || 
                             (conv.statistics && conv.statistics.state === "snoozed");
            if (!isSnoozed) return false;
            
            const customAttributes = conv.custom_attributes || {};
            const lastSnoozeWorkflow = customAttributes["Last Snooze Workflow Used"];
            
            return lastSnoozeWorkflow === "Waiting On Customer - Resolved";
          } else if (filterTag === "waitingoncustomer-unresolved") {
            // Filter for snoozed conversations with "Last Snooze Workflow Used" = "Waiting On Customer - Unresolved"
            const isSnoozed = conv.state === "snoozed" || 
                             conv.state === "Snoozed" ||
                             conv.snoozed_until || 
                             (conv.statistics && conv.statistics.state === "snoozed");
            if (!isSnoozed) return false;
            
            const customAttributes = conv.custom_attributes || {};
            const lastSnoozeWorkflow = customAttributes["Last Snooze Workflow Used"];
            
            return lastSnoozeWorkflow === "Waiting On Customer - Unresolved";
          } else if (filterTag === "snoozed") {
            // Filter for all snoozed conversations
            return conv.state === "snoozed" || conv.snoozed_until || 
                   (conv.statistics && conv.statistics.state === "snoozed");
          } else if (filterTag === "snoozed-other") {
            // Filter for snoozed conversations that don't have "Last Snooze Workflow Used" set to customer or TSE workflows
            const isSnoozed = conv.state === "snoozed" || 
                             conv.state === "Snoozed" ||
                             conv.snoozed_until || 
                             (conv.statistics && conv.statistics.state === "snoozed");
            if (!isSnoozed) return false;
            
            const customAttributes = conv.custom_attributes || {};
            const lastSnoozeWorkflow = customAttributes["Last Snooze Workflow Used"];
            
            // Return true if snoozed but doesn't have a recognized workflow
            return lastSnoozeWorkflow !== "Waiting On Customer - Resolved" && 
                   lastSnoozeWorkflow !== "Waiting On Customer - Unresolved" &&
                   lastSnoozeWorkflow !== "Waiting On TSE";
          } else if (filterTag === "autoclosed") {
            // Filter for all auto-closed conversations using custom_attributes
            // This matches conversations that display "Auto-Closed via..." in the table
            const state = (conv.state || "").toLowerCase();
            if (state !== "closed") return false;
            
            // Use the same logic as the table display - check for Auto-Closed custom attribute
            const customAttributes = conv.custom_attributes || {};
            const autoClosedValue = customAttributes["Auto-Closed"];
            
            // Only include if Auto-Closed exists and matches expected values (same as table display logic)
            if (!autoClosedValue) return false;
            
            const autoClosedStr = String(autoClosedValue);
            // Match only the expected values that would show "Auto-Closed via..." in the table
            return autoClosedStr === "Waiting On Customer - Resolved" || 
                   autoClosedStr === "Waiting On Customer - Unresolved";
          } else if (filterTag === "autoclosed-resolved") {
            // Filter for auto-closed conversations with Waiting On Customer - Resolved
            // This matches conversations that display "Auto-Closed via Waiting On Customer - Resolved" in the table
            const state = (conv.state || "").toLowerCase();
            if (state !== "closed") return false;
            
            // Use the same logic as the table display
            const customAttributes = conv.custom_attributes || {};
            const autoClosedValue = customAttributes["Auto-Closed"];
            
            // Check if Auto-Closed value matches "Waiting On Customer - Resolved"
            // This is the same check used in getClosedConversationStatus() for table display
            if (!autoClosedValue) return false;
            
            const autoClosedStr = String(autoClosedValue);
            return autoClosedStr === "Waiting On Customer - Resolved";
          } else if (filterTag === "autoclosed-unresolved") {
            // Filter for auto-closed conversations with Waiting On Customer - Unresolved
            // This matches conversations that display "Auto-Closed via Waiting On Customer - Unresolved" in the table
            const state = (conv.state || "").toLowerCase();
            if (state !== "closed") return false;
            
            // Use the same logic as the table display
            const customAttributes = conv.custom_attributes || {};
            const autoClosedValue = customAttributes["Auto-Closed"];
            
            // Check if Auto-Closed value matches "Waiting On Customer - Unresolved"
            // This is the same check used in getClosedConversationStatus() for table display
            if (!autoClosedValue) return false;
            
            const autoClosedStr = String(autoClosedValue);
            return autoClosedStr === "Waiting On Customer - Unresolved";
          }
          return false;
        });
      });
    }

    // Filter by search ID
    if (searchId.trim()) {
      const searchTerm = searchId.trim().toLowerCase();
      filtered = filtered.filter(conv => {
        const convId = conv.id || conv.conversation_id || "";
        return String(convId).toLowerCase().includes(searchTerm);
      });
    }

    console.log(`[MyQueue] Final filtered count: ${filtered.length} conversations`);
    if (filterTags.includes("closed")) {
      const closedFiltered = filtered.filter(conv => (conv.state || "").toLowerCase() === "closed");
      console.log(`[MyQueue] Closed conversations after filtering: ${closedFiltered.length}`);
      if (closedFiltered.length > 0) {
        closedFiltered.forEach(conv => {
          const closedAt = conv.closed_at || conv.closedAt;
          const closedAtSeconds = closedAt ? (typeof closedAt === "number" 
            ? (closedAt > 1e12 ? Math.floor(closedAt / 1000) : closedAt)
            : Math.floor(new Date(closedAt).getTime() / 1000)) : null;
          console.log(`[MyQueue]   - Included closed: ID ${conv.id || conv.conversation_id}, closed_at: ${closedAtSeconds}`);
        });
      }
    }

    return filtered;
  }, [myConversations, filterTags, searchId]);

  // Use shared date formatting utility
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    return formatDateTimeUTC(timestamp);
  };

  // Calculate TSE historical metrics and insights (similar to TSE Details Modal)
  const tseMetrics = useMemo(() => {
    if (!currentTSE || !historicalSnapshots || historicalSnapshots.length === 0) {
      return { insights: [] };
    }

    const tseId = String(currentTSE.id);
    const tseName = currentTSE.name;
    
    // Filter snapshots that contain this TSE
    const tseHistory = historicalSnapshots
      .map(snapshot => {
        const tseData = snapshot.tse_data || snapshot.tseData || [];
        const tseEntry = tseData.find(t => String(t.id) === tseId || t.name === tseName);
        if (!tseEntry) return null;

        const open = tseEntry.open || 0;
        const waitingOnTSE = tseEntry.waitingOnTSE || tseEntry.actionableSnoozed || 0;
        const meetsOpen = open <= THRESHOLDS.MAX_OPEN_SOFT;
        const meetsWaitingOnTSE = waitingOnTSE <= THRESHOLDS.MAX_WAITING_ON_TSE_SOFT;
        const isOnTrack = meetsOpen && meetsWaitingOnTSE;

        return {
          date: snapshot.date,
          open,
          waitingOnTSE,
          totalSnoozed: tseEntry.snoozed || tseEntry.totalSnoozed || 0,
          isOnTrack,
          meetsOpen,
          meetsWaitingOnTSE
        };
      })
      .filter(item => item !== null)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (tseHistory.length === 0) {
      return { insights: [] };
    }

    // Calculate averages
    const avgOpen = tseHistory.reduce((sum, d) => sum + d.open, 0) / tseHistory.length;
    const avgWaitingOnTSE = tseHistory.reduce((sum, d) => sum + d.waitingOnTSE, 0) / tseHistory.length;
    const onTrackDays = tseHistory.filter(d => d.isOnTrack).length;
    const onTrackPercentage = (onTrackDays / tseHistory.length) * 100;

    // Calculate trends (last 7 days vs previous 7 days, or last half vs first half)
    let trend;
    if (tseHistory.length >= 14) {
      const last7 = tseHistory.slice(-7);
      const previous7 = tseHistory.slice(-14, -7);
      const last7OnTrack = last7.filter(d => d.isOnTrack).length / 7;
      const previous7OnTrack = previous7.filter(d => d.isOnTrack).length / 7;
      const change = (last7OnTrack - previous7OnTrack) * 100;
      trend = {
        period: 'Last 7 days vs previous 7 days',
        change: change,
        direction: change > 2 ? 'improving' : change < -2 ? 'worsening' : 'stable'
      };
    } else if (tseHistory.length >= 2) {
      const lastHalf = tseHistory.slice(Math.floor(tseHistory.length / 2));
      const firstHalf = tseHistory.slice(0, Math.floor(tseHistory.length / 2));
      const lastHalfOnTrack = lastHalf.filter(d => d.isOnTrack).length / lastHalf.length;
      const firstHalfOnTrack = firstHalf.filter(d => d.isOnTrack).length / firstHalf.length;
      const change = (lastHalfOnTrack - firstHalfOnTrack) * 100;
      trend = {
        period: 'Recent vs earlier period',
        change: change,
        direction: change > 2 ? 'improving' : change < -2 ? 'worsening' : 'stable'
      };
    } else {
      trend = {
        period: 'Insufficient data',
        change: 0,
        direction: 'stable'
      };
    }

    // Generate key insights
    const insights = [];
    
    if (onTrackPercentage >= 80) {
      insights.push({
        type: 'positive',
        text: `Excellent performance: ${onTrackPercentage.toFixed(0)}% on-track over ${tseHistory.length} days`,
        id: `myqueue-excellent-performance-${onTrackPercentage.toFixed(0)}`,
        percentage: onTrackPercentage,
        days: tseHistory.length
      });
    } else if (onTrackPercentage < 60) {
      insights.push({
        type: 'warning',
        text: `Only ${onTrackPercentage.toFixed(0)}% on-track over ${tseHistory.length} days`,
        id: `myqueue-low-performance-${onTrackPercentage.toFixed(0)}`,
        percentage: onTrackPercentage,
        days: tseHistory.length
      });
    }

    if (avgOpen > THRESHOLDS.MAX_OPEN_SOFT) {
      insights.push({
        type: 'warning',
        text: `Average open chats (${avgOpen.toFixed(1)}) exceeds target (≤${THRESHOLDS.MAX_OPEN_SOFT})`,
        id: `myqueue-avg-open-${avgOpen.toFixed(1)}`,
        avgOpen: avgOpen,
        target: THRESHOLDS.MAX_OPEN_SOFT
      });
    }

    if (avgWaitingOnTSE > THRESHOLDS.MAX_WAITING_ON_TSE_SOFT) {
      insights.push({
        type: 'warning',
        text: `Average waiting on TSE (${avgWaitingOnTSE.toFixed(1)}) exceeds target (≤${THRESHOLDS.MAX_WAITING_ON_TSE_SOFT})`,
        id: `myqueue-avg-waiting-${avgWaitingOnTSE.toFixed(1)}`,
        avgWaiting: avgWaitingOnTSE,
        target: THRESHOLDS.MAX_WAITING_ON_TSE_SOFT
      });
    }

    if (trend.direction === 'improving') {
      insights.push({
        type: 'positive',
        text: `Performance improving: ${trend.change > 0 ? '+' : ''}${trend.change.toFixed(1)}% on-track ${trend.period}`,
        id: `myqueue-improving-${trend.period}-${trend.change.toFixed(1)}`,
        change: trend.change,
        period: trend.period
      });
    } else if (trend.direction === 'worsening') {
      insights.push({
        type: 'warning',
        text: `${trend.change.toFixed(1)}% on-track ${trend.period}`,
        id: `myqueue-worsening-${trend.period}-${trend.change.toFixed(1)}`,
        change: trend.change,
        period: trend.period
      });
    }

    // Filter dismissed insights
    const filteredInsights = insights.filter(insight => !isInsightDismissed(insight.id));

    return { 
      insights: filteredInsights,
      totalDays: tseHistory.length,
      onTrackPercentage: Math.round(onTrackPercentage),
      avgOpen: Math.round(avgOpen * 10) / 10,
      avgWaitingOnTSE: Math.round(avgWaitingOnTSE * 10) / 10,
      trend,
      history: tseHistory
    };
  }, [currentTSE, historicalSnapshots, isInsightDismissed]);

  // Show loading state while team members are being fetched
  if (loading && teamMembers.length === 0) {
    return (
      <div className="my-queue-container" style={hasFooterControlsAccess ? { paddingBottom: '150px' } : {}}>
        <div className="my-queue-header">
          <h1>My Queue</h1>
        </div>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <p>Loading your queue data...</p>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            Fetching team members and conversations...
          </p>
        </div>
      </div>
    );
  }

  if (!currentTSE) {
    // Debug info: show what we have
    const availableEmails = teamMembers.length > 0 
      ? teamMembers.map(m => m.email).filter(Boolean).slice(0, 10) // Show first 10 emails
      : [];
    
    return (
      <div className="my-queue-container" style={hasFooterControlsAccess ? { paddingBottom: '150px' } : {}}>
        <div className="my-queue-header">
          <h1>My Queue</h1>
        </div>
        <div className="my-queue-error">
          <p>Unable to identify your account. Please ensure your email matches your Intercom account.</p>
          <div className="debug-info" style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
            <p><strong>Current User Email:</strong> {currentUserEmail || "Not provided"}</p>
            {teamMembers.length === 0 && (
              <p><strong>Team Members:</strong> No team members loaded</p>
            )}
            {teamMembers.length > 0 && (
              <>
                <p><strong>Team Members Found:</strong> {teamMembers.length}</p>
                {availableEmails.length > 0 && (
                  <details style={{ marginTop: '8px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Available Emails (click to expand)</summary>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                      {availableEmails.map((email, idx) => (
                        <li key={idx} style={{ fontFamily: 'monospace', fontSize: '11px' }}>{email}</li>
                      ))}
                      {teamMembers.length > 10 && <li>... and {teamMembers.length - 10} more</li>}
                    </ul>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-queue-container" style={hasFooterControlsAccess ? { paddingBottom: '150px' } : {}}>
      {error && (
        <div className="my-queue-error">
          <p>Error: {error}</p>
        </div>
      )}

      {/* Key Insights */}
      {tseMetrics.insights && tseMetrics.insights.length > 0 && (
        <div className="key-insights-section" style={{
          marginTop: 0,
          marginBottom: '25px',
          padding: '16px',
          backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
          borderRadius: '8px',
          border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: 600,
            color: isDarkMode ? '#ffffff' : '#292929'
          }}>
            Key Insights
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tseMetrics.insights.map((insight, idx) => (
              <div 
                key={insight.id || idx}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  backgroundColor: insight.type === 'positive' 
                    ? (isDarkMode ? 'rgba(76, 236, 140, 0.1)' : 'rgba(76, 236, 140, 0.1)')
                    : (isDarkMode ? 'rgba(253, 135, 137, 0.1)' : 'rgba(253, 135, 137, 0.1)'),
                  borderLeft: `3px solid ${insight.type === 'positive' ? '#4cec8c' : '#fd8789'}`,
                  fontSize: '13px',
                  color: isDarkMode ? '#e5e5e5' : '#292929',
                  lineHeight: '1.5',
                  display: 'flex',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <button
                  onClick={() => dismissInsightItem(insight.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isDarkMode ? '#999' : '#666',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    fontSize: '18px',
                    lineHeight: '1',
                    opacity: 0.7,
                    transition: 'opacity 0.2s',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => e.target.style.opacity = '1'}
                  onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                  aria-label="Dismiss insight"
                  title="Dismiss"
                >
                  ×
                </button>
                <span style={{ flex: 1 }}>
                  {insight.type === 'positive' ? '✓ ' : '⚠ '}
                  {formatInsightText(insight)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Scorecard */}
      {tseMetrics.totalDays && tseMetrics.totalDays > 0 && (
        <div className="performance-scorecard-section" style={{
          marginBottom: '25px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px'
          }}>
            {/* On-Track % */}
            <div style={{
              padding: '20px',
              backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
              borderRadius: '12px',
              border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
              boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 500,
                color: isDarkMode ? '#888' : '#666',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px'
              }}>
                On-Track %
              </div>
              <div style={{
                fontSize: '36px',
                fontWeight: 600,
                color: tseMetrics.onTrackPercentage >= 80 
                  ? '#4cec8c' 
                  : tseMetrics.onTrackPercentage < 60 
                    ? '#fd8789' 
                    : '#ffc107',
                lineHeight: 1.2
              }}>
                {tseMetrics.onTrackPercentage}%
              </div>
              <div style={{
                fontSize: '12px',
                color: isDarkMode ? '#666' : '#999',
                marginTop: '4px'
              }}>
                {tseMetrics.totalDays} days tracked
              </div>
            </div>

            {/* Avg Open Chats */}
            <div style={{
              padding: '20px',
              backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
              borderRadius: '12px',
              border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
              boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 500,
                color: isDarkMode ? '#888' : '#666',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px'
              }}>
                Avg Open Chats
              </div>
              <div style={{
                fontSize: '36px',
                fontWeight: 600,
                color: tseMetrics.avgOpen <= THRESHOLDS.MAX_OPEN_SOFT ? '#4cec8c' : '#fd8789',
                lineHeight: 1.2
              }}>
                {tseMetrics.avgOpen.toFixed(1)}
              </div>
              <div style={{
                fontSize: '12px',
                color: isDarkMode ? '#666' : '#999',
                marginTop: '4px'
              }}>
                Target: ≤{THRESHOLDS.MAX_OPEN_SOFT}
              </div>
            </div>

            {/* Avg Waiting on TSE */}
            <div style={{
              padding: '20px',
              backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
              borderRadius: '12px',
              border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
              boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 500,
                color: isDarkMode ? '#888' : '#666',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px'
              }}>
                Avg Waiting on TSE
              </div>
              <div style={{
                fontSize: '36px',
                fontWeight: 600,
                color: tseMetrics.avgWaitingOnTSE <= THRESHOLDS.MAX_WAITING_ON_TSE_SOFT ? '#4cec8c' : '#fd8789',
                lineHeight: 1.2
              }}>
                {tseMetrics.avgWaitingOnTSE.toFixed(1)}
              </div>
              <div style={{
                fontSize: '12px',
                color: isDarkMode ? '#666' : '#999',
                marginTop: '4px'
              }}>
                Target: ≤{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT}
              </div>
            </div>

            {/* Trend with Mini Sparkline */}
            <div style={{
              padding: '20px',
              backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
              borderRadius: '12px',
              border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
              boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 500,
                color: isDarkMode ? '#888' : '#666',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px'
              }}>
                Trend
              </div>
              <div style={{
                fontSize: '36px',
                fontWeight: 600,
                color: tseMetrics.trend.direction === 'improving' 
                  ? '#4cec8c' 
                  : tseMetrics.trend.direction === 'worsening' 
                    ? '#fd8789' 
                    : (isDarkMode ? '#666' : '#999'),
                lineHeight: 1.2
              }}>
                {tseMetrics.trend.direction === 'improving' ? '↗' : tseMetrics.trend.direction === 'worsening' ? '↘' : '→'}
              </div>
              <div style={{
                fontSize: '12px',
                color: isDarkMode ? '#666' : '#999',
                marginTop: '4px'
              }}>
                {tseMetrics.trend.period === 'Insufficient data' ? 'Insufficient data' : 'Recent vs earlier period'}
              </div>
              
              {/* Mini Sparkline Visualization */}
              {tseMetrics.history && tseMetrics.history.length > 1 && (
                <div style={{
                  marginTop: '12px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '2px'
                }}>
                  {tseMetrics.history.slice(-14).map((day, idx) => (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: day.isOnTrack ? '100%' : '40%',
                        backgroundColor: day.isOnTrack 
                          ? (isDarkMode ? '#4cec8c' : '#4caf50')
                          : (isDarkMode ? '#fd8789' : '#f44336'),
                        borderRadius: '2px',
                        opacity: 0.7 + (idx / tseMetrics.history.slice(-14).length) * 0.3,
                        transition: 'all 0.2s ease'
                      }}
                      title={`${day.date}: ${day.isOnTrack ? 'On Track' : 'Over Limit'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className={`metric-card metric-card-open ${metrics.open > THRESHOLDS.MAX_OPEN_SOFT ? "over-limit" : ""}`}>
          <div className="metric-label">Open Chats</div>
          <div className="metric-value">{metrics.open}</div>
          <div className="metric-target">Target: ≤{THRESHOLDS.MAX_OPEN_SOFT}</div>
          {metrics.open > THRESHOLDS.MAX_OPEN_SOFT && (
            <div className="metric-alert">⚠ Over limit</div>
          )}
        </div>

        <div className={`metric-card metric-card-waiting-tse ${metrics.waitingOnTSE > THRESHOLDS.MAX_WAITING_ON_TSE_SOFT ? "over-limit" : ""}`}>
          <div className="metric-label">Waiting on TSE</div>
          <div className="metric-value">{metrics.waitingOnTSE}</div>
          <div className="metric-target">Target: ≤{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT}</div>
          {metrics.waitingOnTSE > THRESHOLDS.MAX_WAITING_ON_TSE_SOFT && (
            <div className="metric-alert">⚠ Over limit</div>
          )}
        </div>

        <div className="metric-card metric-card-waiting-resolved">
          <div className="metric-label">Waiting on Customer - Resolved</div>
          <div className="metric-value">{metrics.waitingOnCustomerResolved}</div>
          <div className="metric-target">No limit</div>
        </div>

        <div className="metric-card metric-card-waiting-unresolved">
          <div className="metric-label">Waiting on Customer - Unresolved</div>
          <div className="metric-value">{metrics.waitingOnCustomerUnresolved}</div>
          <div className="metric-target">No limit</div>
        </div>

        <div className="metric-card metric-card-taken">
          <div className="metric-label">Chats Taken Today</div>
          <div className="metric-value">{metrics.answeredToday}</div>
          <div className="metric-target">New chats answered</div>
        </div>

        <div className="metric-card metric-card-auto-closed">
          <div className="metric-label">Auto-Closed Today</div>
          <div className="metric-value">{metrics.closedToday}</div>
          <div className="metric-target">Auto-closed conversations</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="tag-filter">Filter by Type:</label>
          <div className="filter-dropdown-container" ref={filterDropdownRef}>
            <button
              type="button"
              id="tag-filter"
              onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
              className="filter-select filter-dropdown-button"
            >
              {filterTags.includes("all") || filterTags.length === 0
                ? "All Conversations"
                : filterTags.length === 1
                ? (filterTags[0] === "snoozed" ? "All Snoozed" :
                   filterTags[0] === "waitingoncustomer" ? "Waiting On Customer" :
                   filterTags[0] === "waitingontse" ? "Waiting On TSE" :
                   filterTags[0] === "snoozed-other" ? "Snoozed - Other" :
                  filterTags[0] === "closed" ? "Closed Today" :
                  filterTags[0] === "closed-regular" ? "Closed" :
                  filterTags[0] === "autoclosed" ? "Auto-Closed" :
                  filterTags[0] === "autoclosed-resolved" ? "Auto-Closed - Resolved" :
                  filterTags[0] === "autoclosed-unresolved" ? "Auto-Closed - Unresolved" :
                  filterOptions.find(opt => opt.value === filterTags[0])?.label || "Select filters")
                : `${filterTags.length} filters selected`}
              <span className="filter-dropdown-arrow">{filterDropdownOpen ? "▲" : "▼"}</span>
            </button>
            {filterDropdownOpen && (
              <div className="filter-dropdown-menu">
                {(() => {
                  // Recursive function to render filter items
                  const renderFilterItem = (option, level = 0) => {
                    const hasChildren = option.children && option.children.length > 0;
                    const isExpanded = expandedFilters.has(option.value);
                    const isParent = level === 0;
                    const isChild1 = level === 1;
                    const isChild2 = level === 2;
                    
                    let itemClassName = 'filter-checkbox-label';
                    if (isParent) {
                      itemClassName += ' filter-parent';
                    } else if (isChild1) {
                      itemClassName += ' filter-child-1';
                    } else if (isChild2) {
                      itemClassName += ' filter-child-2';
                    }

                    const toggleExpand = (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setExpandedFilters(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(option.value)) {
                          newSet.delete(option.value);
                        } else {
                          newSet.add(option.value);
                        }
                        return newSet;
                      });
                    };

                    return (
                      <div key={option.value}>
                        <label
                          className={itemClassName}
                          onClick={(e) => {
                            if (hasChildren && e.target.type !== 'checkbox') {
                              toggleExpand(e);
                            } else {
                              e.stopPropagation();
                            }
                          }}
                        >
                          {hasChildren && (
                            <span
                              className="filter-expand-icon"
                              onClick={toggleExpand}
                              style={{
                                display: 'inline-block',
                                width: '16px',
                                marginRight: '4px',
                                cursor: 'pointer',
                                userSelect: 'none',
                                fontSize: '10px',
                                color: isDarkMode ? '#999' : '#666'
                              }}
                            >
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          )}
                          {!hasChildren && <span style={{ display: 'inline-block', width: '16px', marginRight: '4px' }} />}
                          <input
                            type="checkbox"
                            checked={filterTags.includes(option.value)}
                            onChange={(e) => handleFilterToggle(option.value, e)}
                            className="filter-checkbox"
                          />
                          <span>{option.label}</span>
                        </label>
                        {hasChildren && isExpanded && (
                          <div className="filter-children-container">
                            {option.children.map(child => renderFilterItem(child, level + 1))}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return filterOptions.map(option => renderFilterItem(option, 0));
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="filter-group">
          <label htmlFor="search-id">Search by ID:</label>
          <input
            id="search-id"
            type="text"
            placeholder="Enter conversation ID..."
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              fontSize: '11px',
              color: isDarkMode ? '#999' : '#666',
              marginTop: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#4cec8c',
                  border: '2px solid #339933'
                }} />
                <span>0-5 min</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#ffc107',
                  border: '2px solid #ffc107'
                }} />
                <span>5-8 min</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#ff9800',
                  border: '2px solid #f57c00'
                }} />
                <span>8-10 min</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: '#fd8789',
                  border: '2px solid #d84c4c'
                }} />
                <span>Breached</span>
              </div>
            </div>
          </div>
      )}

      {/* Conversations List */}
      <div className="conversations-section">
        <h3>
          {filterTags.includes("all") || filterTags.length === 0
            ? "All Conversations"
            : filterTags.length === 1
            ? (filterTags[0] === "closed" ? "Closed" :
               filterTags[0] === "snoozed" ? "All Snoozed" :
               filterTags[0] === "waitingoncustomer" ? "Waiting On Customer" :
               filterTags[0] === "waitingontse" ? "Waiting On TSE" :
               filterTags[0] === "snoozed-other" ? "Snoozed - Other" :
               filterTags[0] === "autoclosed" ? "Auto-Closed" :
               filterTags[0] === "autoclosed-resolved" ? "Auto-Closed - Resolved" :
               filterTags[0] === "autoclosed-unresolved" ? "Auto-Closed - Unresolved" :
               filterOptions.find(opt => opt.value === filterTags[0])?.label || "All Conversations")
            : `${filterTags.length} Filters Selected`} 
          ({filteredConversations.length})
        </h3>

        {filteredConversations.length === 0 ? (
          <div className="no-conversations">
            <p>No conversations found matching your filters.</p>
          </div>
        ) : (
          <div className="conversations-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Active Snooze Workflow</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredConversations.map((conv, index) => {
                  const rowNumber = index + 1;
                  const isSnoozed = conv.state === "snoozed" || conv.snoozed_until;
                  const snoozedUntil = conv.snoozed_until || null;
                  const snoozedUntilDate = snoozedUntil ? (typeof snoozedUntil === "number" ? new Date(snoozedUntil * 1000) : new Date(snoozedUntil)) : null;
                  
                  const isClosed = (conv.state || "").toLowerCase() === "closed";
                  
                  // Helper function to determine status and workflow for closed conversations
                  const getClosedConversationStatus = () => {
                    if (!isClosed) return null;
                    
                    // Check custom_attributes["Auto-Closed"] field
                    const customAttributes = conv.custom_attributes || {};
                    const autoClosedValue = customAttributes["Auto-Closed"];
                    
                    if (!autoClosedValue) {
                      // No Auto-Closed custom attribute: return "Closed" status and "--" workflow
                      return { status: "Closed", workflow: "--" };
                    }
                    
                    // Check if Auto-Closed value matches the expected workflow values
                    const autoClosedStr = String(autoClosedValue);
                    if (autoClosedStr === "Waiting On Customer - Unresolved") {
                      return { status: "Auto-Closed via Waiting On Customer - Unresolved", workflow: "--" };
                    } else if (autoClosedStr === "Waiting On Customer - Resolved") {
                      return { status: "Auto-Closed via Waiting On Customer - Resolved", workflow: "--" };
                    }
                    
                    // Auto-Closed exists but doesn't match expected values: return "Closed"
                    return { status: "Closed", workflow: "--" };
                  };
                  
                  const closedStatusInfo = getClosedConversationStatus();
                  
                  // Check state first - if "Open" or "Closed", always show "--"
                  const convState = (conv.state || "open").toLowerCase();
                  const isOpenState = convState === "open";
                  
                  // For closed conversations, use the closed status logic
                  // For other states, check for workflow tags
                  let displayWorkflow = "--";
                  let displayStatus = isClosed ? "Closed" : isSnoozed ? "Snoozed" : "Open";
                  
                  if (isClosed && closedStatusInfo) {
                    // Use closed conversation logic for status
                    displayStatus = closedStatusInfo.status;
                    // For closed conversations, always show "--" for workflow
                    displayWorkflow = "--";
                  } else if (isOpenState) {
                    // If state is "Open", ALWAYS show "--"
                    displayWorkflow = "--";
                  } else if (isSnoozed) {
                    // If state is "Snoozed", use "Last Snooze Workflow Used" custom attribute
                    const customAttributes = conv.custom_attributes || {};
                    const lastSnoozeWorkflow = customAttributes["Last Snooze Workflow Used"];
                    
                    if (lastSnoozeWorkflow) {
                      displayWorkflow = String(lastSnoozeWorkflow);
                    } else {
                      // Fallback to "--" if not set
                      displayWorkflow = "--";
                    }
                  }
                  
                  // Countdown timer component for snoozed conversations
                  const SnoozeCountdownTimer = ({ targetDate }) => {
                    const [timeRemaining, setTimeRemaining] = useState(() => 
                      calculateTimeRemaining(targetDate)
                    );
                    
                    useEffect(() => {
                      if (!targetDate) return;
                      
                      const updateTimer = () => {
                        const remaining = calculateTimeRemaining(targetDate);
                        setTimeRemaining(remaining);
                      };
                      
                      // Update immediately
                      updateTimer();
                      
                      // Update every second
                      const interval = setInterval(updateTimer, 1000);
                      
                      return () => clearInterval(interval);
                    }, [targetDate]);
                    
                    const snoozeBg = isDarkMode ? '#5A3A2A' : '#FFE5D9';
                    const snoozeColor = isDarkMode ? '#FF9A74' : '#D84C4C';
                    
                    if (timeRemaining.expired) {
                      return (
                        <span style={{
                          backgroundColor: snoozeBg,
                          color: snoozeColor,
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'inline-block'
                        }}>
                          Snoozed (Expired)
                        </span>
                      );
                    }
                    
                    return (
                      <span style={{
                        backgroundColor: snoozeBg,
                        color: snoozeColor,
                        padding: '4px 12px',
                        borderRadius: '16px',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'inline-block',
                        whiteSpace: 'nowrap'
                      }}>
                        Snoozed: {formatTimeRemaining(timeRemaining)}
                      </span>
                    );
                  };
                  
                  // Helper function to render status badge(s)
                  const renderStatusBadge = (status) => {
                    if (status.startsWith("Auto-Closed via ")) {
                      // Split into two badges connected by "via"
                      const waitingTag = status.replace("Auto-Closed via ", "");
                      const autoClosedBg = isDarkMode ? '#1F4A4A' : '#C8E6F0';
                      const autoClosedColor = isDarkMode ? '#7BC8D8' : '#4F9C9C';
                      const unresolvedBg = isDarkMode ? '#5A2A2A' : '#FFDDDD';
                      const unresolvedColor = isDarkMode ? '#FF6B6B' : '#D84C4C';
                      const resolvedBg = isDarkMode ? '#3A2A5A' : '#E6E6FA';
                      const resolvedColor = isDarkMode ? '#9370DB' : '#6A5ACD';
                      
                      return (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{
                            backgroundColor: autoClosedBg,
                            color: autoClosedColor,
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'inline-block'
                          }}>
                            Auto-Closed
                          </span>
                          <span style={{ color: isDarkMode ? '#ccc' : '#333', fontSize: '12px' }}>via</span>
                          <span style={{
                            backgroundColor: waitingTag.includes("Unresolved") ? unresolvedBg : resolvedBg,
                            color: waitingTag.includes("Unresolved") ? unresolvedColor : resolvedColor,
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'inline-block'
                          }}>
                            {waitingTag}
                          </span>
                        </span>
                      );
                    } else if (status === "Auto-Closed") {
                      return (
                        <span style={{
                          backgroundColor: isDarkMode ? '#1F4A4A' : '#C8E6F0',
                          color: isDarkMode ? '#7BC8D8' : '#4F9C9C',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'inline-block'
                        }}>
                          Auto-Closed
                        </span>
                      );
                    } else if (status === "Closed") {
                      return (
                        <span style={{
                          backgroundColor: isDarkMode ? '#2A5A2A' : '#CCFFCC',
                          color: isDarkMode ? '#90EE90' : '#339933',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'inline-block'
                        }}>
                          Closed
                        </span>
                      );
                    } else if (status === "Open" || status === "open") {
                      return (
                        <span style={{
                          backgroundColor: isDarkMode ? 'rgba(53, 161, 180, 0.2)' : '#e3f2fd',
                          color: isDarkMode ? '#35a1b4' : '#1976d2',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'inline-block'
                        }}>
                          Open
                        </span>
                      );
                    } else if (conv.state === 'snoozed' && snoozedUntilDate) {
                      return <SnoozeCountdownTimer targetDate={snoozedUntilDate} />;
                    } else {
                      return (
                        <span style={{ 
                          textTransform: 'capitalize',
                          fontWeight: 400
                        }}>
                          {status}
                        </span>
                      );
                    }
                  };
                  
                  // Helper function to render workflow badge
                  const renderWorkflowBadge = (workflow) => {
                    if (workflow === "N/A" || workflow === "--" || workflow === "No Active Snooze Workflows") {
                      return <span style={{ color: isDarkMode ? '#999' : '#999' }}>—</span>;
                    }
                    
                    let backgroundColor, color;
                    if (workflow === "Waiting On TSE - Deep Dive") {
                      backgroundColor = isDarkMode ? '#5A4A1F' : '#FFFACD';
                      color = isDarkMode ? '#D4AF37' : '#B8860B';
                    } else if (workflow === "Waiting On Customer - Unresolved") {
                      backgroundColor = isDarkMode ? '#5A2A2A' : '#FFDDDD';
                      color = isDarkMode ? '#FF6B6B' : '#D84C4C';
                    } else if (workflow === "Waiting On Customer - Resolved") {
                      backgroundColor = isDarkMode ? '#3A2A5A' : '#E6E6FA';
                      color = isDarkMode ? '#9370DB' : '#6A5ACD';
                    } else {
                      return <span style={{ color: isDarkMode ? '#999' : '#999' }}>—</span>;
                    }
                    
                    return (
                      <span style={{
                        backgroundColor,
                        color,
                        padding: '4px 12px',
                        borderRadius: '16px',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'inline-block',
                        whiteSpace: 'nowrap'
                      }}>
                        {workflow}
                      </span>
                    );
                  };
                  
                  return (
                    <tr key={conv.id || conv.conversation_id}>
                      <td style={{ textAlign: 'center', color: isDarkMode ? '#999' : '#666' }}>
                        {rowNumber}
                      </td>
                      <td className="conv-id">{conv.id || conv.conversation_id}</td>
                      <td>
                        {renderStatusBadge(displayStatus)}
                      </td>
                      <td>
                        {renderWorkflowBadge(displayWorkflow)}
                      </td>
                      <td>{formatDate(conv.created_at || conv.createdAt)}</td>
                      <td>
                        <a 
                          href={`${INTERCOM_BASE_URL}${conv.id || conv.conversation_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="intercom-link"
                        >
                          Open in Intercom →
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

export default MyQueue;
