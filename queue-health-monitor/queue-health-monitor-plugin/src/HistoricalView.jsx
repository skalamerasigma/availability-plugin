import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter, Cell, ReferenceLine } from 'recharts';
import { formatTimestampUTC, formatDateForChart, formatDateForTooltip, formatDateFull, formatDateUTC } from './utils/dateUtils';
import { useTheme } from './ThemeContext';
import './HistoricalView.css';

// Wait time targets
const WAIT_TIME_TARGETS = {
  TARGET_10_PLUS_MIN: 0, // Target for 10+ min waits: 0%
  TARGET_5_TO_10_MIN: 2  // Target for 5-10 min waits: 2%
};

// TSE Region mapping
const TSE_REGIONS = {
  'UK': ['Salman Filli', 'Erin Liu', 'Kabilan Thayaparan', 'J', 'Nathan Simpson', 'Somachi Ngoka'],
  'NY': ['Lyle Pierson Stachecki', 'Nick Clancey', 'Swapnil Deshpande', 'Ankita Dalvi', 'Grace Sanford', 'Erez Yagil', 'Julia Lusala', 'Betty Liu', 'Xyla Fang', 'Rashi Madnani', 'Nikhil Krishnappa', 'Ryan Jaipersaud', 'Krish Pawooskar', 'Siddhi Jadhav', 'Arley Schenker', 'Stephen Skalamera', 'David Zingher'],
  'SF': ['Sanyam Khurana', 'Hem Kamdar', 'Sagarika Sardesai', 'Nikita Bangale', 'Payton Steiner', 'Bhavana Prasad Kote', 'Grania M', 'Soheli Das', 'Hayden Greif-Neill', 'Roshini Padmanabha', 'Abhijeet Lal', 'Ratna Shivakumar', 'Sahibeer Singh', 'Vruddhi Kapre', 'Priyanshi Singh']
};

// Region icons (SVG URLs)
const REGION_ICONS = {
  'UK': 'https://res.cloudinary.com/doznvxtja/image/upload/v1768284230/3_150_x_150_px_4_kxkr26.svg',
  'NY': 'https://res.cloudinary.com/doznvxtja/image/upload/v1768284817/3_150_x_150_px_7_i1jnre.svg',
  'SF': 'https://res.cloudinary.com/doznvxtja/image/upload/v1768314189/3_150_x_150_px_9_x6vkvp.svg',
  'Other': null
};

// Helper function to get region for a TSE name
const getTSERegion = (tseName) => {
  for (const [region, names] of Object.entries(TSE_REGIONS)) {
    if (names.includes(tseName)) {
      return region;
    }
  }
  return 'Other'; // Fallback for any TSEs not in the list
};

// Holiday configuration with SVG URLs
const HOLIDAYS = {
  '01-01': 'https://res.cloudinary.com/doznvxtja/image/upload/v1767183389/new_years_gsfi9s.svg', // New Year's Day
  '06-19': 'https://res.cloudinary.com/doznvxtja/image/upload/v1767183557/juneteenth_wgccmi.svg', // Juneteenth
  '07-04': 'https://res.cloudinary.com/doznvxtja/image/upload/v1767183658/independence_day_xkqltc.svg', // Independence Day
  '12-25': 'https://res.cloudinary.com/doznvxtja/image/upload/v1767180781/xmas_hat_o0mk2w.svg', // Christmas Day
};

// Helper function to get the Nth weekday of a month
const getNthWeekday = (year, month, weekday, n) => {
  // weekday: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // n: 1 = first, 2 = second, etc.
  const firstDay = new Date(year, month, 1).getDay();
  let day = 1 + ((weekday - firstDay + 7) % 7);
  day += (n - 1) * 7;
  return day;
};

// Helper function to get the last weekday of a month
const getLastWeekday = (year, month, weekday) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const lastDayOfWeek = new Date(year, month, lastDay).getDay();
  let day = lastDay - ((lastDayOfWeek - weekday + 7) % 7);
  return day;
};

// Function to check if a date matches any holiday and return the icon URL
const getHolidayIcon = (dateStr) => {
  if (!dateStr) return null;
  
  // Parse date - handle both "YYYY-MM-DD" and "MM/DD" formats
  let year, month, day;
  if (dateStr.includes('-')) {
    // Format: "YYYY-MM-DD"
    [year, month, day] = dateStr.split('-').map(Number);
  } else if (dateStr.includes('/')) {
    // Format: "MM/DD" - need to get year from current context
    const parts = dateStr.split('/');
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
    year = new Date().getFullYear();
  } else {
    return null;
  }
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  
  const date = new Date(year, month - 1, day);
  const dateMonth = date.getMonth() + 1; // 1-12
  const dateDay = date.getDate();
  const dateYear = date.getFullYear();
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Check fixed date holidays
  const monthDayKey = `${String(dateMonth).padStart(2, '0')}-${String(dateDay).padStart(2, '0')}`;
  if (HOLIDAYS[monthDayKey]) {
    return HOLIDAYS[monthDayKey];
  }
  
  // Check variable holidays
  // MLK Day - 3rd Monday in January
  if (dateMonth === 1 && dayOfWeek === 1) {
    const mlkDay = getNthWeekday(dateYear, 0, 1, 3); // month is 0-indexed
    if (dateDay === mlkDay) {
      return 'https://res.cloudinary.com/doznvxtja/image/upload/v1767184247/mlk_n0k97m.svg';
    }
  }
  
  // Presidents' Day - 3rd Monday in February
  if (dateMonth === 2 && dayOfWeek === 1) {
    const presidentsDay = getNthWeekday(dateYear, 1, 1, 3);
    if (dateDay === presidentsDay) {
      return 'https://res.cloudinary.com/doznvxtja/image/upload/v1767184785/white_house_kjvx5t.svg';
    }
  }
  
  // Memorial Day - last Monday in May
  if (dateMonth === 5 && dayOfWeek === 1) {
    const memorialDay = getLastWeekday(dateYear, 4, 1); // month is 0-indexed
    if (dateDay === memorialDay) {
      return 'https://res.cloudinary.com/doznvxtja/image/upload/v1767182069/memorial_day_jg4tdh.svg';
    }
  }
  
  // Labor Day - 1st Monday in September
  if (dateMonth === 9 && dayOfWeek === 1) {
    const laborDay = getNthWeekday(dateYear, 8, 1, 1);
    if (dateDay === laborDay) {
      return 'https://res.cloudinary.com/doznvxtja/image/upload/v1767185195/labor_day_qppq3c.svg';
    }
  }
  
  // Thanksgiving - 4th Thursday in November
  if (dateMonth === 11 && dayOfWeek === 4) {
    const thanksgiving = getNthWeekday(dateYear, 10, 4, 4);
    if (dateDay === thanksgiving) {
      return 'https://res.cloudinary.com/doznvxtja/image/upload/v1767183818/thanksgiving_wsdwsa.svg';
    }
  }
  
  // Day after Thanksgiving - Friday after Thanksgiving
  if (dateMonth === 11 && dayOfWeek === 5) {
    const thanksgiving = getNthWeekday(dateYear, 10, 4, 4);
    if (dateDay === thanksgiving + 1) {
      return 'https://res.cloudinary.com/doznvxtja/image/upload/v1767184107/black_friday_sjz6g1.svg';
    }
  }
  
  return null;
};

// Custom label function to render holiday icons
// Only renders on the first line (dataKey='overallOnTrack') to avoid duplicates for multi-line charts
// For single-line charts, renders on that line
// Positions icon above the highest data point across all series
const createHolidayLabel = (data, isBarChart = false, dataKey = null) => (props) => {
  const { x, y, index, width } = props;
  if (index === undefined || !data || !data[index]) return null;
  
  // For multi-line charts (on-track trends), only render on overallOnTrack line
  // For single-line charts (response time), render on that line
  if (dataKey && dataKey !== 'overallOnTrack' && dataKey !== 'percentage5PlusMin' && dataKey !== 'count5PlusMin') return null;
  
  const dataPoint = data[index];
  const dateStr = dataPoint.date || dataPoint.displayLabel;
  
  const iconUrl = getHolidayIcon(dateStr);
  if (!iconUrl) return null;
  
  // For multi-line charts, find the highest value across all data series
  // For single-line charts, use the current line's value
  let maxValue;
  let finalY;
  
  if (dataPoint.overallOnTrack !== undefined) {
    // Multi-line chart (on-track trends)
    maxValue = Math.max(
      dataPoint.overallOnTrack || 0,
      dataPoint.openOnTrack || 0,
      dataPoint.snoozedOnTrack || 0
    );
    
    // Calculate the y position for the highest value
    // Chart height is 400px, margin top is 70px, so usable height is ~330px
    const chartUsableHeight = 330;
    const marginTop = 70;
    const maxValueY = marginTop + (chartUsableHeight - (maxValue / 100) * chartUsableHeight);
    finalY = maxValueY > 0 && maxValueY < 450 ? maxValueY : y;
  } else {
    // Single-line chart (response time)
    finalY = y;
  }
  
  // For bar charts, center the icon horizontally within the bar
  // For line/area charts, center on the data point
  const iconX = isBarChart && width ? (x + width / 2 - 15) : (x - 15);
  
  return (
    <g>
      <image
        href={iconUrl}
        x={iconX}
        y={finalY - 60}
        width="30"
        height="30"
      />
    </g>
  );
};

const THRESHOLDS = {
  MAX_OPEN_SOFT: 5,
  MAX_ACTIONABLE_SNOOZED_SOFT: 5
};

// Info Icon Component with Tooltip
const InfoIcon = ({ content, isDarkMode, position = 'right' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0, right: 0 });
  const iconRef = useRef(null);

  const updateTooltipPosition = useCallback(() => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      if (position === 'left') {
        setTooltipPosition({
          top: rect.top,
          right: window.innerWidth - rect.left + 24,
          left: undefined
        });
      } else {
        setTooltipPosition({
          top: rect.top,
          left: rect.right + 24,
          right: undefined
        });
      }
    }
  }, [position]);

  const handleMouseEnter = () => {
    setIsOpen(true);
    // Small delay to ensure DOM is updated
    setTimeout(updateTooltipPosition, 0);
  };

  const getTooltipStyle = () => {
    if (!isOpen || tooltipPosition.top === 0) {
      return { display: 'none' };
    }

    const style = {
      position: 'fixed',
      top: `${tooltipPosition.top}px`,
      zIndex: 999999,
      minWidth: '280px',
      maxWidth: '400px',
      backgroundColor: isDarkMode ? '#1e1e1e' : 'white',
      border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`,
      borderRadius: '8px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      fontSize: '12px',
      lineHeight: '1.5',
      color: isDarkMode ? '#e5e5e5' : '#292929',
      pointerEvents: 'auto',
      whiteSpace: 'normal',
      textAlign: 'left'
    };

    if (position === 'left') {
      style.right = `${tooltipPosition.right}px`;
      style.left = 'auto';
    } else {
      style.left = `${tooltipPosition.left}px`;
      style.right = 'auto';
    }

    return style;
  };

  useEffect(() => {
    if (isOpen) {
      updateTooltipPosition();
      const handleScroll = () => updateTooltipPosition();
      const handleResize = () => updateTooltipPosition();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen, position, updateTooltipPosition]);

  return (
    <span ref={iconRef} style={{ position: 'relative', display: 'inline-block', marginLeft: '6px', verticalAlign: 'middle' }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: isDarkMode ? '#999' : '#666',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          fontSize: '14px',
          lineHeight: 1,
          borderRadius: '50%',
          width: '18px',
          height: '18px',
          justifyContent: 'center'
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsOpen(false)}
      >
        ℹ️
      </button>
      {isOpen && createPortal(
        <div
          style={getTooltipStyle()}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          {content}
        </div>,
        document.body
      )}
    </span>
  );
};

function HistoricalView({ onSaveSnapshot, refreshTrigger, managerTeamFilter = null, isManager = false, managerTeam = null, myTeamOnly = false, onToggleMyTeamOnly = null }) {
  const { isDarkMode } = useTheme();
  const [snapshots, setSnapshots] = useState([]);
  const [responseTimeMetrics, setResponseTimeMetrics] = useState([]);
  
  // Use shared date formatting utility
  const formatTimestamp = formatTimestampUTC;
  
  // Get last snapshot timestamp
  const lastSnapshotTimestamp = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return null;
    const sorted = [...snapshots].sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA; // Most recent first
    });
    return sorted[0]?.timestamp || null;
  }, [snapshots]);
  
  // Get last response time metric timestamp
  const lastResponseTimeTimestamp = useMemo(() => {
    if (!responseTimeMetrics || responseTimeMetrics.length === 0) return null;
    const sorted = [...responseTimeMetrics].sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA; // Most recent first
    });
    return sorted[0]?.timestamp || null;
  }, [responseTimeMetrics]);
  const [clickedTooltip, setClickedTooltip] = useState(null); // { date, tseName } or null
  const [loading, setLoading] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [selectedTSEs, setSelectedTSEs] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateRange, setDateRange] = useState('7days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [availableTSEs, setAvailableTSEs] = useState([]);
  const [activeTab, setActiveTab] = useState('on-track'); // 'on-track', 'response-time', or 'results'
  const [resultsData, setResultsData] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [expandedDates, setExpandedDates] = useState(new Set());
  const [expandedResponseTimeDates, setExpandedResponseTimeDates] = useState(new Set());
  const [onTrackSortConfig, setOnTrackSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [responseTimeSortConfig, setResponseTimeSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [onTrackDaysToShow, setOnTrackDaysToShow] = useState(7);
  const [responseTimeDaysToShow, setResponseTimeDaysToShow] = useState(7);
  const [expandedRegions, setExpandedRegions] = useState(new Set()); // All collapsed by default
  const [timePeriod, setTimePeriod] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [viewType, setViewType] = useState('all'); // 'all', 'by-region', 'by-team', 'by-tse'
  // Track dismissed insights with localStorage persistence
  const [dismissedInsights, setDismissedInsights] = useState(() => {
    try {
      const stored = localStorage.getItem('dismissedAnalyticsInsights');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
      return new Set();
    }
  });
  const [hasManuallyCleared, setHasManuallyCleared] = useState(false); // Track if user manually cleared selection
  const [showPeriodComparison, setShowPeriodComparison] = useState(false); // Toggle for period comparison

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (clickedTooltip && !event.target.closest('.tooltip-popup') && !event.target.closest('.clickable-badge')) {
        setClickedTooltip(null);
      }
    };

    if (clickedTooltip) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [clickedTooltip]);

  // Calculate default date range (last 7 days including weekends)
  const getLast7Weekdays = () => {
    const dates = [];
    const today = new Date();
    
    // Get last 7 days (including weekends)
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates.sort();
  };

  useEffect(() => {
    // Fetch all data on initial mount (no date filters)
    fetchSnapshots();
    fetchResponseTimeMetrics();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Auto-fetch when dates change, but only if not in custom mode
    // (custom mode requires clicking Apply button)
    // If no dates are set, fetch all data
    if (dateRange !== 'custom') {
      fetchSnapshots();
    }
  }, [startDate, endDate, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Auto-fetch when dates change, but only if not in custom mode
    // (custom mode requires clicking Apply button)
    // If no dates are set, fetch all data
    if (dateRange !== 'custom') {
      fetchResponseTimeMetrics();
    }
  }, [startDate, endDate, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch results data when results tab is active or when date range changes
  useEffect(() => {
    if (activeTab === 'results') {
      // Clear old data first
      setResultsData(null);
      fetchResultsData();
    }
  }, [activeTab, startDate, endDate, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch results data (on-track vs slow first response)
  const fetchResultsData = async () => {
    setLoadingResults(true);
    setResultsData(null); // Clear old data immediately
    
    try {
      let startDateStr, endDateStr;
      
      // Use startDate and endDate if they're set (works for all range types including presets)
      if (startDate && endDate) {
        startDateStr = startDate;
        endDateStr = endDate;
      } else {
        // Fallback: if dates aren't set yet, use default 30 days
        // This should rarely happen, but provides a safety net
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        startDateStr = thirtyDaysAgo.toISOString().slice(0, 10);
        endDateStr = today.toISOString().slice(0, 10);
      }

      // Fetch snapshots and response time metrics
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

      const snapshots = snapshotRes.ok ? (await snapshotRes.json()).snapshots || [] : [];
      const metrics = metricRes.ok ? (await metricRes.json()).metrics || [] : [];

      // Process data to correlate on-track status with slow first response
      const correlationData = processOnTrackResponseTimeCorrelation(snapshots, metrics);
      
      // Only set data if we actually got valid correlation data
      // If correlationData is null (no data or insufficient data), resultsData stays null
      setResultsData(correlationData);
    } catch (error) {
      console.error('Error fetching results data:', error);
      setResultsData(null);
    } finally {
      setLoadingResults(false);
    }
  };

  // Process on-track vs response time correlation
  const processOnTrackResponseTimeCorrelation = (snapshots, responseTimeMetrics) => {
    if (!snapshots.length || !responseTimeMetrics.length) return null;

    const EXCLUDED_TSE_NAMES = ["Prerit Sachdeva"];
    const ON_TRACK_THRESHOLDS = {
      MAX_OPEN_SOFT: 5,
      MAX_WAITING_ON_TSE_SOFT: 5
    };

    // Create a map of date -> on-track data
    const onTrackByDate = {};
    snapshots.forEach(snapshot => {
      let tseData = snapshot.tseData.filter(tse => !EXCLUDED_TSE_NAMES.includes(tse.name));
      // Apply manager team filter if set
      if (managerTeamFilter) {
        tseData = tseData.filter(tse => managerTeamFilter.includes(tse.name));
      }
      if (tseData.length === 0) return;

      let onTrackCount = 0;
      let totalCount = 0;

      tseData.forEach(tse => {
        totalCount++;
        const meetsOpen = tse.open <= ON_TRACK_THRESHOLDS.MAX_OPEN_SOFT;
        // On-track uses: all snoozed conversations EXCEPT customer-waiting tags
        // Use snoozedForOnTrack if available (new format), otherwise calculate from snapshot data
        let snoozedForOnTrack = tse.snoozedForOnTrack;
        if (snoozedForOnTrack === undefined) {
          // Calculate from snapshot data: totalSnoozed - customerWaitSnoozed
          const totalSnoozed = tse.totalSnoozed || 0;
          const customerWaitSnoozed = tse.customerWaitSnoozed || 0;
          snoozedForOnTrack = totalSnoozed - customerWaitSnoozed;
          // Fallback to old format if new calculation doesn't work
          if (snoozedForOnTrack < 0) {
            snoozedForOnTrack = tse.actionableSnoozed || 0;
          }
        }
        const meetsSnoozed = snoozedForOnTrack <= ON_TRACK_THRESHOLDS.MAX_WAITING_ON_TSE_SOFT;
        
        if (meetsOpen && meetsSnoozed) {
          onTrackCount++;
        }
      });

      const onTrackPct = totalCount > 0 ? Math.round((onTrackCount / totalCount) * 100) : 0;
      onTrackByDate[snapshot.date] = {
        date: snapshot.date,
        onTrack: onTrackPct,
        onTrackCount,
        totalCount
      };
    });

    // Combine with response time metrics
    const combinedData = responseTimeMetrics
      .map(metric => {
        const onTrack = onTrackByDate[metric.date];
        if (!onTrack) return null;

        return {
          date: metric.date,
          onTrack: onTrack.onTrack,
          slowResponsePct: metric.percentage5PlusMin || 0,
          slowResponseCount: metric.count5PlusMin || 0,
          // Add breakdown by wait time buckets
          slowResponse5to10Pct: metric.percentage5to10Min || 0,
          slowResponse5to10Count: metric.count5to10Min || 0,
          slowResponse10PlusPct: metric.percentage10PlusMin || 0,
          slowResponse10PlusCount: metric.count10PlusMin || 0,
          totalConversations: metric.totalConversations || 0
        };
      })
      .filter(d => d !== null)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (combinedData.length === 0) return null;

    // Helper function to calculate correlation
    const calculateCorrelation = (dataPoints, yKey) => {
      const avgOnTrack = dataPoints.reduce((sum, d) => sum + d.onTrack, 0) / dataPoints.length;
      const avgY = dataPoints.reduce((sum, d) => sum + d[yKey], 0) / dataPoints.length;

      let numerator = 0;
      let sumSqOnTrack = 0;
      let sumSqY = 0;

      dataPoints.forEach(d => {
        const onTrackDiff = d.onTrack - avgOnTrack;
        const yDiff = d[yKey] - avgY;
        numerator += onTrackDiff * yDiff;
        sumSqOnTrack += onTrackDiff * onTrackDiff;
        sumSqY += yDiff * yDiff;
      });

      const correlation = sumSqOnTrack > 0 && sumSqY > 0
        ? numerator / Math.sqrt(sumSqOnTrack * sumSqY)
        : 0;

      return {
        correlation: Math.round(correlation * 1000) / 1000,
        correlationStrength: Math.abs(correlation) < 0.3 ? 'weak' : Math.abs(correlation) < 0.7 ? 'moderate' : 'strong',
        correlationDirection: correlation < 0 ? 'negative' : 'positive',
        avgY: Math.round(avgY * 100) / 100
      };
    };

    // Calculate correlations for all three metrics
    const correlation5Plus = calculateCorrelation(combinedData, 'slowResponsePct');
    const correlation5to10 = calculateCorrelation(combinedData, 'slowResponse5to10Pct');
    const correlation10Plus = calculateCorrelation(combinedData, 'slowResponse10PlusPct');

    const avgOnTrack = combinedData.reduce((sum, d) => sum + d.onTrack, 0) / combinedData.length;
    const avgSlowResponse = correlation5Plus.avgY;

    // Group by on-track ranges
    const onTrackRanges = {
      'High (80-100%)': { min: 80, max: 100, data: [] },
      'Medium (60-79%)': { min: 60, max: 79, data: [] },
      'Low (0-59%)': { min: 0, max: 59, data: [] }
    };

    combinedData.forEach(d => {
      if (d.onTrack >= 80) {
        onTrackRanges['High (80-100%)'].data.push(d);
      } else if (d.onTrack >= 60) {
        onTrackRanges['Medium (60-79%)'].data.push(d);
      } else {
        onTrackRanges['Low (0-59%)'].data.push(d);
      }
    });

    const rangeStats = Object.entries(onTrackRanges).map(([range, { data }]) => {
      if (data.length === 0) return null;
      const avgSlowResponse = data.reduce((sum, d) => sum + d.slowResponsePct, 0) / data.length;
      const avgSlowResponse5to10 = data.reduce((sum, d) => sum + d.slowResponse5to10Pct, 0) / data.length;
      const avgSlowResponse10Plus = data.reduce((sum, d) => sum + d.slowResponse10PlusPct, 0) / data.length;
      const totalSlowResponses = data.reduce((sum, d) => sum + d.slowResponseCount, 0);
      const totalSlowResponses5to10 = data.reduce((sum, d) => sum + d.slowResponse5to10Count, 0);
      const totalSlowResponses10Plus = data.reduce((sum, d) => sum + d.slowResponse10PlusCount, 0);
      const totalConversations = data.reduce((sum, d) => sum + d.totalConversations, 0);
      
      return {
        range,
        count: data.length,
        avgOnTrack: data.reduce((sum, d) => sum + d.onTrack, 0) / data.length,
        avgSlowResponsePct: Math.round(avgSlowResponse * 100) / 100,
        avgSlowResponse5to10Pct: Math.round(avgSlowResponse5to10 * 100) / 100,
        avgSlowResponse10PlusPct: Math.round(avgSlowResponse10Plus * 100) / 100,
        totalSlowResponses,
        totalSlowResponses5to10,
        totalSlowResponses10Plus,
        totalConversations,
        slowResponseRate: totalConversations > 0 ? Math.round((totalSlowResponses / totalConversations) * 100 * 100) / 100 : 0
      };
    }).filter(s => s !== null);

    // Calculate improvement potential (if Low days matched High days)
    const highRange = rangeStats.find(s => s.range === 'High (80-100%)');
    const currentAvg = avgSlowResponse;
    const highAvg = highRange ? highRange.avgSlowResponsePct : currentAvg;
    const improvementPotential5Plus = currentAvg - highAvg;
    const improvementPotential5to10 = correlation5to10.avgY - (highRange ? highRange.avgSlowResponse5to10Pct : correlation5to10.avgY);
    const improvementPotential10Plus = correlation10Plus.avgY - (highRange ? highRange.avgSlowResponse10PlusPct : correlation10Plus.avgY);

    return {
      correlation: correlation5Plus.correlation,
      correlationStrength: correlation5Plus.correlationStrength,
      correlationDirection: correlation5Plus.correlationDirection,
      correlation5to10: correlation5to10.correlation,
      correlation5to10Strength: correlation5to10.correlationStrength,
      correlation5to10Direction: correlation5to10.correlationDirection,
      correlation10Plus: correlation10Plus.correlation,
      correlation10PlusStrength: correlation10Plus.correlationStrength,
      correlation10PlusDirection: correlation10Plus.correlationDirection,
      dataPoints: combinedData,
      rangeStats,
      avgOnTrack: Math.round(avgOnTrack * 100) / 100,
      avgSlowResponse: Math.round(avgSlowResponse * 100) / 100,
      avgSlowResponse5to10: correlation5to10.avgY,
      avgSlowResponse10Plus: correlation10Plus.avgY,
      improvementPotential5Plus: Math.round(improvementPotential5Plus * 100) / 100,
      improvementPotential5to10: Math.round(improvementPotential5to10 * 100) / 100,
      improvementPotential10Plus: Math.round(improvementPotential10Plus * 100) / 100
    };
  };

  // Refresh data when refreshTrigger changes (for auto-refresh)
  // This ensures all data refreshes when conversations are auto-refreshed
  useEffect(() => {
    // Only refresh if refreshTrigger exists (not on initial mount)
    // This will refresh both snapshots and response time metrics
    if (refreshTrigger) {
      console.log('HistoricalView: Auto-refresh triggered, refreshing snapshots and response time metrics');
      fetchSnapshots();
      fetchResponseTimeMetrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  useEffect(() => {
    // Extract unique TSEs from snapshots, excluding Prerit Sachdeva
    const EXCLUDED_TSE_NAMES = ["Prerit Sachdeva"];
    const tseMap = new Map(); // Use Map to track by name for deduplication
    snapshots.forEach(snapshot => {
      snapshot.tseData?.forEach(tse => {
        // Skip excluded TSEs
        if (!EXCLUDED_TSE_NAMES.includes(tse.name)) {
          // If manager filter is active, only include their team members
          if (managerTeamFilter && !managerTeamFilter.includes(tse.name)) {
            return;
          }
          // Use name as key to handle cases where ID might differ but name is same
          if (!tseMap.has(tse.name)) {
            tseMap.set(tse.name, { id: tse.id, name: tse.name });
          }
        }
      });
    });
    
    // Also ensure all TSEs from TSE_REGIONS are included, even if not in snapshots
    // But filter by manager team if applicable
    const allTSENames = managerTeamFilter || Object.values(TSE_REGIONS).flat();
    allTSENames.forEach(tseName => {
      if (!EXCLUDED_TSE_NAMES.includes(tseName) && !tseMap.has(tseName)) {
        // Create a placeholder entry with name as ID if no snapshot data exists
        tseMap.set(tseName, { id: tseName.toLowerCase().replace(/\s+/g, '-'), name: tseName });
      }
    });
    
    const newAvailableTSEs = Array.from(tseMap.values());
    setAvailableTSEs(newAvailableTSEs);
  }, [snapshots, managerTeamFilter]);

  // Select all TSEs by default when they first become available (only if not manually cleared)
  // Use a ref to track if we've already done the initial selection
  const hasInitialSelectionRef = useRef(false);
  const hasManuallyClearedRef = useRef(false);
  
  // Keep ref in sync with state
  useEffect(() => {
    hasManuallyClearedRef.current = hasManuallyCleared;
  }, [hasManuallyCleared]);
  
  useEffect(() => {
    // Always select all TSEs by default when they become available
    // Only skip if user has manually cleared the selection
    if (
      availableTSEs.length > 0 && 
      !hasManuallyClearedRef.current
    ) {
      const allTSEIds = availableTSEs.map(tse => String(tse.id));
      // Only update if the selection doesn't match all available TSEs
      const currentIdsSet = new Set(selectedTSEs);
      // eslint-disable-next-line no-unused-vars
      const allIdsSet = new Set(allTSEIds);
      const isSelectionComplete = allTSEIds.length === selectedTSEs.length && 
                                  allTSEIds.every(id => currentIdsSet.has(id));
      
      if (!isSelectionComplete) {
        setSelectedTSEs(allTSEIds);
        hasInitialSelectionRef.current = true;
      }
    }
  }, [availableTSEs, selectedTSEs]);

  // Group TSEs by region
  const tseByRegion = useMemo(() => {
    const grouped = { 'UK': [], 'NY': [], 'SF': [], 'Other': [] };
    availableTSEs.forEach(tse => {
      const region = getTSERegion(tse.name);
      grouped[region].push(tse);
    });
    // Sort TSEs within each region
    Object.keys(grouped).forEach(region => {
      grouped[region].sort((a, b) => a.name.localeCompare(b.name));
    });
    return grouped;
  }, [availableTSEs]);


  const toggleRegion = (region) => {
    const newExpanded = new Set(expandedRegions);
    if (newExpanded.has(region)) {
      newExpanded.delete(region);
    } else {
      newExpanded.add(region);
    }
    setExpandedRegions(newExpanded);
  };

  const fetchSnapshots = async (overrideStartDate = null, overrideEndDate = null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      // Use override dates if provided, otherwise use state dates
      const useStartDate = overrideStartDate !== null ? overrideStartDate : startDate;
      const useEndDate = overrideEndDate !== null ? overrideEndDate : endDate;
      // Only add date filters if dates are set; otherwise fetch all
      if (useStartDate && useEndDate) {
        params.append('startDate', useStartDate);
        params.append('endDate', useEndDate);
      }
      // Removed selectedTSEs filtering - we always fetch all snapshots
      // The filtering happens in the useMemo hooks for chart calculations

      // In development, use production API URL since local dev server doesn't have API routes
      const url = process.env.NODE_ENV === 'production'
        ? `${window.location.origin}/api/snapshots/get?${params}`
        : `https://queue-health-monitor.vercel.app/api/snapshots/get?${params}`;

      console.log('HistoricalView: Fetching snapshots from:', url);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        console.log('HistoricalView: Received snapshots:', data.snapshots?.length || 0);
        setSnapshots(data.snapshots || []);
      } else {
        const errorText = await res.text();
        console.error('Error fetching snapshots:', res.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching snapshots:', error);
      // Silently fail in development - historical data is optional
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchResponseTimeMetrics = async (overrideStartDate = null, overrideEndDate = null) => {
    setLoadingMetrics(true);
    try {
      const params = new URLSearchParams();
      // Use override dates if provided, otherwise use state dates
      const useStartDate = overrideStartDate !== null ? overrideStartDate : startDate;
      const useEndDate = overrideEndDate !== null ? overrideEndDate : endDate;
      // If dates are set, use them; otherwise fetch all
      if (useStartDate && useEndDate) {
        params.append('startDate', useStartDate);
        params.append('endDate', useEndDate);
      } else {
        // Fetch all metrics if no date range is specified
        params.append('all', 'true');
      }

      // In development, use production API URL since local dev server doesn't have API routes
      const url = process.env.NODE_ENV === 'production'
        ? `${window.location.origin}/api/response-time-metrics/get?${params}`
        : `https://queue-health-monitor.vercel.app/api/response-time-metrics/get?${params}`;

      console.log('HistoricalView: Fetching response time metrics from:', url);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        console.log('HistoricalView: Received response time metrics:', data.metrics?.length || 0);
        setResponseTimeMetrics(data.metrics || []);
      } else {
        const errorText = await res.text();
        console.error('Failed to fetch metrics:', res.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching response time metrics:', error);
      // Silently fail in development - historical data is optional
      setResponseTimeMetrics([]);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    const today = new Date();
    let start, end;
    
    switch (range) {
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        // If yesterday was a weekend, go back to Friday
        const yesterdayDay = yesterday.getDay();
        if (yesterdayDay === 0) { // Sunday
          yesterday.setDate(yesterday.getDate() - 2); // Go to Friday
        } else if (yesterdayDay === 6) { // Saturday
          yesterday.setDate(yesterday.getDate() - 1); // Go to Friday
        }
        start = yesterday.toISOString().split('T')[0];
        end = yesterday.toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        break;
      case '7days':
        const dates = getLast7Weekdays();
        start = dates[0];
        end = dates[dates.length - 1];
        setStartDate(start);
        setEndDate(end);
        break;
      case '30days':
        end = today.toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        start = thirtyDaysAgo.toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        break;
      case '90days':
        end = today.toISOString().split('T')[0];
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        start = ninetyDaysAgo.toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        break;
      case 'custom':
        // Initialize custom dates with current start/end dates if they exist
        if (startDate && endDate) {
          setCustomStartDate(startDate);
          setCustomEndDate(endDate);
        } else {
          // Default to last 7 weekdays
          const defaultDates = getLast7Weekdays();
          if (defaultDates.length > 0) {
            setCustomStartDate(defaultDates[0]);
            setCustomEndDate(defaultDates[defaultDates.length - 1]);
          }
        }
        break;
      default:
        return;
    }
  };

  const handleApplyCustomDateRange = () => {
    if (!customStartDate || !customEndDate) {
      alert('Please select both start and end dates');
      return;
    }
    
    if (new Date(customStartDate) > new Date(customEndDate)) {
      alert('Start date must be before end date');
      return;
    }
    
    // Update state first
    setStartDate(customStartDate);
    setEndDate(customEndDate);
    
    // Pass dates directly to fetch functions to avoid race condition with state updates
    fetchSnapshots(customStartDate, customEndDate);
    fetchResponseTimeMetrics(customStartDate, customEndDate);
  };

  // Calculate on-track metrics for chart
  const chartData = useMemo(() => {
    if (!snapshots.length) return [];

    const dataByDate = {};
    
    snapshots
      .filter(snapshot => {
        // Filter by date range if dates are set
        if (startDate && endDate && snapshot.date) {
          return snapshot.date >= startDate && snapshot.date <= endDate;
        }
        return true;
      })
      .forEach(snapshot => {
      const date = snapshot.date;
      if (!dataByDate[date]) {
        dataByDate[date] = {
          date,
          totalTSEs: 0,
          onTrackOpen: 0,
          onTrackSnoozed: 0,
          onTrackBoth: 0
        };
      }

      const EXCLUDED_TSE_NAMES = ["Prerit Sachdeva", "Stephen Skalamera"];
      let tseData = selectedTSEs.length > 0
        ? snapshot.tseData.filter(tse => selectedTSEs.includes(String(tse.id)))
        : snapshot.tseData;
      
      // Filter out excluded TSEs
      tseData = tseData.filter(tse => !EXCLUDED_TSE_NAMES.includes(tse.name));
      
      // Apply manager team filter if set
      if (managerTeamFilter) {
        tseData = tseData.filter(tse => managerTeamFilter.includes(tse.name));
      }

      tseData.forEach(tse => {
        dataByDate[date].totalTSEs++;
        const meetsOpen = tse.open <= THRESHOLDS.MAX_OPEN_SOFT;
        // On-track uses: all snoozed conversations EXCEPT customer-waiting tags
        // Use snoozedForOnTrack if available (new format), otherwise calculate from snapshot data
        let snoozedForOnTrack = tse.snoozedForOnTrack;
        if (snoozedForOnTrack === undefined) {
          // Calculate from snapshot data: totalSnoozed - customerWaitSnoozed
          const totalSnoozed = tse.totalSnoozed || 0;
          const customerWaitSnoozed = tse.customerWaitSnoozed || 0;
          snoozedForOnTrack = totalSnoozed - customerWaitSnoozed;
          // Fallback to old format if new calculation doesn't work
          if (snoozedForOnTrack < 0) {
            snoozedForOnTrack = tse.actionableSnoozed || 0;
          }
        }
        const meetsSnoozed = snoozedForOnTrack <= THRESHOLDS.MAX_ACTIONABLE_SNOOZED_SOFT;
        
        if (meetsOpen) dataByDate[date].onTrackOpen++;
        if (meetsSnoozed) dataByDate[date].onTrackSnoozed++;
        if (meetsOpen && meetsSnoozed) dataByDate[date].onTrackBoth++;
      });
    });

    return Object.values(dataByDate)
      .map(d => ({
        ...d,
        openOnTrack: d.totalTSEs > 0 ? Math.round((d.onTrackOpen / d.totalTSEs) * 100) : 0,
        snoozedOnTrack: d.totalTSEs > 0 ? Math.round((d.onTrackSnoozed / d.totalTSEs) * 100) : 0,
        overallOnTrack: d.totalTSEs > 0 ? Math.round((d.onTrackBoth / d.totalTSEs) * 100) : 0
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [snapshots, selectedTSEs, startDate, endDate, managerTeamFilter]);

  // Day-of-week analysis
  const dayOfWeekAnalysis = useMemo(() => {
    if (!chartData.length) return null;
    
    const dayStats = {
      'Monday': { count: 0, overall: 0, open: 0, snoozed: 0 },
      'Tuesday': { count: 0, overall: 0, open: 0, snoozed: 0 },
      'Wednesday': { count: 0, overall: 0, open: 0, snoozed: 0 },
      'Thursday': { count: 0, overall: 0, open: 0, snoozed: 0 },
      'Friday': { count: 0, overall: 0, open: 0, snoozed: 0 }
    };
    
    chartData.forEach(d => {
      const [year, month, day] = d.date.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      
      if (dayStats[dayName]) {
        dayStats[dayName].count++;
        dayStats[dayName].overall += d.overallOnTrack;
        dayStats[dayName].open += d.openOnTrack;
        dayStats[dayName].snoozed += d.snoozedOnTrack;
      }
    });
    
    return Object.entries(dayStats).map(([day, stats]) => ({
      day: day.substring(0, 3), // Mon, Tue, etc.
      fullDay: day,
      overallOnTrack: stats.count > 0 ? Math.round(stats.overall / stats.count) : 0,
      openOnTrack: stats.count > 0 ? Math.round(stats.open / stats.count) : 0,
      snoozedOnTrack: stats.count > 0 ? Math.round(stats.snoozed / stats.count) : 0,
      count: stats.count
    })).filter(d => d.count > 0);
  }, [chartData]);

  // Best/worst days analysis
  const bestWorstDays = useMemo(() => {
    if (!chartData.length) return null;
    
    const sorted = [...chartData].sort((a, b) => b.overallOnTrack - a.overallOnTrack);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    
    const [bestYear, bestMonth, bestDay] = best.date.split('-').map(Number);
    const [worstYear, worstMonth, worstDay] = worst.date.split('-').map(Number);
    const bestDate = new Date(bestYear, bestMonth - 1, bestDay);
    const worstDate = new Date(worstYear, worstMonth - 1, worstDay);
    
    return {
      best: {
        date: best.date,
        displayDate: `${bestDate.getMonth() + 1}/${bestDate.getDate()}`,
        overall: best.overallOnTrack,
        open: best.openOnTrack,
        snoozed: best.snoozedOnTrack
      },
      worst: {
        date: worst.date,
        displayDate: `${worstDate.getMonth() + 1}/${worstDate.getDate()}`,
        overall: worst.overallOnTrack,
        open: worst.openOnTrack,
        snoozed: worst.snoozedOnTrack
      }
    };
  }, [chartData]);

  // Region comparison
  const regionComparison = useMemo(() => {
    if (!snapshots.length || !selectedTSEs.length) return null;
    
    const regionStats = { 'UK': [], 'NY': [], 'SF': [], 'Other': [] };
    
    snapshots
      .filter(snapshot => {
        // Filter by date range if dates are set
        if (startDate && endDate && snapshot.date) {
          return snapshot.date >= startDate && snapshot.date <= endDate;
        }
        return true;
      })
      .forEach(snapshot => {
      const EXCLUDED_TSE_NAMES = ["Prerit Sachdeva"];
      let tseData = snapshot.tseData.filter(tse => selectedTSEs.includes(String(tse.id)));
      tseData = tseData.filter(tse => !EXCLUDED_TSE_NAMES.includes(tse.name));
      // Apply manager team filter if set
      if (managerTeamFilter) {
        tseData = tseData.filter(tse => managerTeamFilter.includes(tse.name));
      }
      
      const regionOnTrack = { 'UK': { total: 0, onTrack: 0 }, 'NY': { total: 0, onTrack: 0 }, 'SF': { total: 0, onTrack: 0 }, 'Other': { total: 0, onTrack: 0 } };
      
      tseData.forEach(tse => {
        const region = getTSERegion(tse.name);
        const meetsOpen = tse.open <= THRESHOLDS.MAX_OPEN_SOFT;
        // On-track uses: all snoozed conversations EXCEPT customer-waiting tags
        // Use snoozedForOnTrack if available (new format), otherwise calculate from snapshot data
        let snoozedForOnTrack = tse.snoozedForOnTrack;
        if (snoozedForOnTrack === undefined) {
          // Calculate from snapshot data: totalSnoozed - customerWaitSnoozed
          const totalSnoozed = tse.totalSnoozed || 0;
          const customerWaitSnoozed = tse.customerWaitSnoozed || 0;
          snoozedForOnTrack = totalSnoozed - customerWaitSnoozed;
          // Fallback to old format if new calculation doesn't work
          if (snoozedForOnTrack < 0) {
            snoozedForOnTrack = tse.actionableSnoozed || 0;
          }
        }
        const meetsSnoozed = snoozedForOnTrack <= THRESHOLDS.MAX_ACTIONABLE_SNOOZED_SOFT;
        
        regionOnTrack[region].total++;
        if (meetsOpen && meetsSnoozed) regionOnTrack[region].onTrack++;
      });
      
      Object.keys(regionOnTrack).forEach(region => {
        if (regionOnTrack[region].total > 0) {
          const onTrack = Math.round((regionOnTrack[region].onTrack / regionOnTrack[region].total) * 100);
          regionStats[region].push(onTrack);
        }
      });
    });
    
    return Object.entries(regionStats).map(([region, values]) => {
      if (values.length === 0) return null;
      const avg = Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
      return { region, average: avg, count: values.length };
    }).filter(r => r !== null && r.region !== 'Other');
  }, [snapshots, selectedTSEs, startDate, endDate, managerTeamFilter]);

  // Trend analysis with moving averages
  const trendAnalysis = useMemo(() => {
    if (!chartData.length || chartData.length < 2) return null;
    
    const firstHalf = chartData.slice(0, Math.ceil(chartData.length / 2));
    const secondHalf = chartData.slice(Math.ceil(chartData.length / 2));
    
    const firstAvg = Math.round((firstHalf.reduce((sum, d) => sum + d.overallOnTrack, 0) / firstHalf.length) * 100) / 100;
    const secondAvg = Math.round((secondHalf.reduce((sum, d) => sum + d.overallOnTrack, 0) / secondHalf.length) * 100) / 100;
    const change = Math.round((secondAvg - firstAvg) * 100) / 100;
    
    // Calculate volatility (standard deviation)
    const avg = chartData.reduce((sum, d) => sum + d.overallOnTrack, 0) / chartData.length;
    const variance = chartData.reduce((sum, d) => sum + Math.pow(d.overallOnTrack - avg, 2), 0) / chartData.length;
    const volatility = Math.round(Math.sqrt(variance) * 100) / 100;
    
    return {
      firstHalfAvg: firstAvg,
      secondHalfAvg: secondAvg,
      change,
      trend: change > 2 ? 'improving' : change < -2 ? 'worsening' : 'stable',
      volatility,
      currentAvg: Math.round(avg * 100) / 100
    };
  }, [chartData]);


  // Calculate chart data with 3-day moving averages
  const chartDataWithMovingAvg = useMemo(() => {
    if (!chartData.length) return [];
    
    return chartData.map((item, index) => {
      if (index < 2) {
        return { 
          ...item, 
          movingAvgOverall: item.overallOnTrack,
          movingAvgOpen: item.openOnTrack,
          movingAvgSnoozed: item.snoozedOnTrack
        };
      }
      const window = chartData.slice(Math.max(0, index - 2), index + 1);
      const avgOverall = window.reduce((sum, d) => sum + d.overallOnTrack, 0) / window.length;
      const avgOpen = window.reduce((sum, d) => sum + d.openOnTrack, 0) / window.length;
      const avgSnoozed = window.reduce((sum, d) => sum + d.snoozedOnTrack, 0) / window.length;
      
      return { 
        ...item, 
        movingAvgOverall: Math.round(avgOverall * 10) / 10,
        movingAvgOpen: Math.round(avgOpen * 10) / 10,
        movingAvgSnoozed: Math.round(avgSnoozed * 10) / 10
      };
    });
  }, [chartData]);

  // Calculate actionable metrics for summary cards
  const actionableMetrics = useMemo(() => {
    if (!chartData.length) return null;

    const TARGET_PERCENTAGE = 100; // Target is 100% on-track
    
    // Days meeting target (100% overall on-track)
    const daysMeetingTarget = chartData.filter(d => d.overallOnTrack === TARGET_PERCENTAGE).length;
    const daysMeetingTargetPct = Math.round((daysMeetingTarget / chartData.length) * 100);

    // Current streak (consecutive days at 100%)
    let currentStreak = 0;
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i].overallOnTrack === TARGET_PERCENTAGE) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Best streak
    let bestStreak = 0;
    let tempStreak = 0;
    chartData.forEach(d => {
      if (d.overallOnTrack === TARGET_PERCENTAGE) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    });

    // Trend direction (comparing last 3 days vs previous 3 days)
    let trendDirection = 'stable';
    let trendChange = 0;
    if (chartData.length >= 6) {
      const recent3 = chartData.slice(-3);
      const previous3 = chartData.slice(-6, -3);
      const recentAvg = recent3.reduce((sum, d) => sum + d.overallOnTrack, 0) / recent3.length;
      const previousAvg = previous3.reduce((sum, d) => sum + d.overallOnTrack, 0) / previous3.length;
      trendChange = Math.round((recentAvg - previousAvg) * 10) / 10;
      if (trendChange > 2) trendDirection = 'improving';
      else if (trendChange < -2) trendDirection = 'worsening';
    } else if (chartData.length >= 2) {
      const recent = chartData[chartData.length - 1].overallOnTrack;
      const previous = chartData[chartData.length - 2].overallOnTrack;
      trendChange = Math.round((recent - previous) * 10) / 10;
      if (trendChange > 2) trendDirection = 'improving';
      else if (trendChange < -2) trendDirection = 'worsening';
    }

    return {
      daysMeetingTarget,
      daysMeetingTargetPct,
      currentStreak,
      bestStreak,
      trendDirection,
      trendChange
    };
  }, [chartData]);

  // Trend acceleration metric (is the trend accelerating, decelerating, or stable?)
  const trendAcceleration = useMemo(() => {
    if (!chartData.length || chartData.length < 6) return null;

    // Compare rate of change in first half vs second half
    const firstHalf = chartData.slice(0, Math.ceil(chartData.length / 2));
    const secondHalf = chartData.slice(Math.ceil(chartData.length / 2));

    // Calculate rate of change for first half
    const firstHalfStart = firstHalf[0].overallOnTrack;
    const firstHalfEnd = firstHalf[firstHalf.length - 1].overallOnTrack;
    const firstHalfChange = firstHalf.length > 1 
      ? (firstHalfEnd - firstHalfStart) / (firstHalf.length - 1)
      : 0;

    // Calculate rate of change for second half
    const secondHalfStart = secondHalf[0].overallOnTrack;
    const secondHalfEnd = secondHalf[secondHalf.length - 1].overallOnTrack;
    const secondHalfChange = secondHalf.length > 1
      ? (secondHalfEnd - secondHalfStart) / (secondHalf.length - 1)
      : 0;

    const acceleration = Math.round((secondHalfChange - firstHalfChange) * 100) / 100;
    
    let status = 'stable';
    if (acceleration > 0.5) status = 'accelerating';
    else if (acceleration < -0.5) status = 'decelerating';

    return {
      acceleration,
      status,
      firstHalfRate: Math.round(firstHalfChange * 10) / 10,
      secondHalfRate: Math.round(secondHalfChange * 10) / 10
    };
  }, [chartData]);

  // Period comparison data (current period vs previous period)
  const periodComparison = useMemo(() => {
    if (!chartData.length || chartData.length < 4) return null;

    const midPoint = Math.ceil(chartData.length / 2);
    const currentPeriod = chartData.slice(midPoint);
    const previousPeriod = chartData.slice(0, midPoint);

    if (previousPeriod.length === 0) return null;

    const currentAvg = currentPeriod.reduce((sum, d) => sum + d.overallOnTrack, 0) / currentPeriod.length;
    const previousAvg = previousPeriod.reduce((sum, d) => sum + d.overallOnTrack, 0) / previousPeriod.length;
    const change = Math.round((currentAvg - previousAvg) * 10) / 10;
    const changePct = previousAvg > 0 ? Math.round((change / previousAvg) * 100 * 10) / 10 : 0;

    return {
      currentPeriod: {
        avg: Math.round(currentAvg * 10) / 10,
        startDate: formatDateForChart(currentPeriod[0].date),
        endDate: formatDateForChart(currentPeriod[currentPeriod.length - 1].date),
        days: currentPeriod.length
      },
      previousPeriod: {
        avg: Math.round(previousAvg * 10) / 10,
        startDate: formatDateForChart(previousPeriod[0].date),
        endDate: formatDateForChart(previousPeriod[previousPeriod.length - 1].date),
        days: previousPeriod.length
      },
      change,
      changePct,
      direction: change > 0 ? 'improving' : change < 0 ? 'worsening' : 'stable'
    };
  }, [chartData]);

  // Week-over-week comparison
  const weekOverWeekComparison = useMemo(() => {
    if (!chartData.length || chartData.length < 7) return null;

    // Get last 7 days (this week)
    const thisWeek = chartData.slice(-7);
    // Get previous 7 days (last week)
    const lastWeek = chartData.slice(-14, -7);

    if (lastWeek.length === 0) return null;

    const thisWeekAvg = thisWeek.reduce((sum, d) => sum + d.overallOnTrack, 0) / thisWeek.length;
    const lastWeekAvg = lastWeek.reduce((sum, d) => sum + d.overallOnTrack, 0) / lastWeek.length;
    const change = Math.round((thisWeekAvg - lastWeekAvg) * 10) / 10;
    const changePct = lastWeekAvg > 0 ? Math.round((change / lastWeekAvg) * 100 * 10) / 10 : 0;

    return {
      thisWeek: Math.round(thisWeekAvg * 10) / 10,
      lastWeek: Math.round(lastWeekAvg * 10) / 10,
      change,
      changePct,
      direction: change > 0 ? 'improving' : change < 0 ? 'worsening' : 'stable',
      thisWeekDates: {
        start: formatDateForChart(thisWeek[0].date),
        end: formatDateForChart(thisWeek[thisWeek.length - 1].date)
      },
      lastWeekDates: {
        start: formatDateForChart(lastWeek[0].date),
        end: formatDateForChart(lastWeek[lastWeek.length - 1].date)
      }
    };
  }, [chartData]);

  // Distribution histogram data
  const distributionData = useMemo(() => {
    if (!chartData.length) return null;

    const bins = [
      { range: '0-50%', min: 0, max: 50, count: 0 },
      { range: '50-75%', min: 50, max: 75, count: 0 },
      { range: '75-90%', min: 75, max: 90, count: 0 },
      { range: '90-100%', min: 90, max: 100, count: 0 },
      { range: '100%', min: 100, max: 100, count: 0 }
    ];

    chartData.forEach(d => {
      const value = d.overallOnTrack;
      bins.forEach(bin => {
        if (value >= bin.min && value <= bin.max) {
          bin.count++;
        }
      });
    });

    return bins.map(bin => ({
      range: bin.range,
      count: bin.count,
      percentage: Math.round((bin.count / chartData.length) * 100)
    }));
  }, [chartData]);




  // Helper function to aggregate data by time period
  const aggregateByTimePeriod = (data, period) => {
    if (period === 'daily') return data;
    
    const grouped = {};
    data.forEach(item => {
      const date = new Date(item.date);
      let key;
      
      if (period === 'weekly') {
        // Get week start (Monday)
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - diff + 1);
        weekStart.setHours(0, 0, 0, 0);
        key = weekStart.toISOString().split('T')[0];
      } else if (period === 'monthly') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      if (!grouped[key]) {
        grouped[key] = { date: key, items: [] };
      }
      grouped[key].items.push(item);
    });
    
    return Object.values(grouped).map(group => {
      const avgOpen = group.items.reduce((sum, item) => sum + (item.avgOpen || item.open || 0), 0) / group.items.length;
      const avgActionableSnoozed = group.items.reduce((sum, item) => sum + (item.avgActionableSnoozed || item.actionableSnoozed || 0), 0) / group.items.length;
      return {
        date: group.date,
        avgOpen: Math.round(avgOpen * 10) / 10,
        avgActionableSnoozed: Math.round(avgActionableSnoozed * 10) / 10,
        count: group.items.length
      };
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Calculate average open and actionable snoozed chats over time
  const averageChatsData = useMemo(() => {
    if (!snapshots.length) return { daily: [], byRegion: {}, byTeam: {}, byTSE: {} };

    const EXCLUDED_TSE_NAMES = ["Prerit Sachdeva", "Stephen Skalamera"];
    const dailyData = [];
    const byRegion = {};
    const byTeam = {};
    const byTSE = {};

    snapshots.forEach(snapshot => {
      let tseData = snapshot.tseData.filter(tse => !EXCLUDED_TSE_NAMES.includes(tse.name));
      
      // Apply manager team filter if set
      if (managerTeamFilter) {
        tseData = tseData.filter(tse => managerTeamFilter.includes(tse.name));
      }

      if (tseData.length === 0) return;

      // Calculate averages for this snapshot
      let totalOpen = 0;
      let totalActionableSnoozed = 0;
      let tseCount = 0;

      const regionTotals = {};
      const teamTotals = {};

      tseData.forEach(tse => {
        const open = tse.open || 0;
        // Calculate actionable snoozed: totalSnoozed - customerWaitSnoozed
        let actionableSnoozed = tse.snoozedForOnTrack;
        if (actionableSnoozed === undefined) {
          const totalSnoozed = tse.totalSnoozed || 0;
          const customerWaitSnoozed = tse.customerWaitSnoozed || 0;
          actionableSnoozed = totalSnoozed - customerWaitSnoozed;
          if (actionableSnoozed < 0) {
            actionableSnoozed = tse.actionableSnoozed || 0;
          }
        }

        totalOpen += open;
        totalActionableSnoozed += actionableSnoozed;
        tseCount++;

        // Group by region
        const region = getTSERegion(tse.name);
        if (!regionTotals[region]) {
          regionTotals[region] = { open: 0, actionableSnoozed: 0, count: 0 };
        }
        regionTotals[region].open += open;
        regionTotals[region].actionableSnoozed += actionableSnoozed;
        regionTotals[region].count++;

        // Group by team (using manager team filter or all)
        const team = managerTeamFilter ? 'Selected Team' : 'All Teams';
        if (!teamTotals[team]) {
          teamTotals[team] = { open: 0, actionableSnoozed: 0, count: 0 };
        }
        teamTotals[team].open += open;
        teamTotals[team].actionableSnoozed += actionableSnoozed;
        teamTotals[team].count++;

        // Individual TSE
        if (!byTSE[tse.id]) {
          byTSE[tse.id] = { name: tse.name, data: [] };
        }
        byTSE[tse.id].data.push({
          date: snapshot.date,
          open,
          actionableSnoozed
        });
      });

      const avgOpen = tseCount > 0 ? totalOpen / tseCount : 0;
      const avgActionableSnoozed = tseCount > 0 ? totalActionableSnoozed / tseCount : 0;

      dailyData.push({
        date: snapshot.date,
        avgOpen: Math.round(avgOpen * 10) / 10,
        avgActionableSnoozed: Math.round(avgActionableSnoozed * 10) / 10
      });

      // Store region averages
      Object.keys(regionTotals).forEach(region => {
        if (!byRegion[region]) {
          byRegion[region] = [];
        }
        const regionAvg = {
          date: snapshot.date,
          avgOpen: Math.round((regionTotals[region].open / regionTotals[region].count) * 10) / 10,
          avgActionableSnoozed: Math.round((regionTotals[region].actionableSnoozed / regionTotals[region].count) * 10) / 10
        };
        byRegion[region].push(regionAvg);
      });

      // Store team averages
      Object.keys(teamTotals).forEach(team => {
        if (!byTeam[team]) {
          byTeam[team] = [];
        }
        const teamAvg = {
          date: snapshot.date,
          avgOpen: Math.round((teamTotals[team].open / teamTotals[team].count) * 10) / 10,
          avgActionableSnoozed: Math.round((teamTotals[team].actionableSnoozed / teamTotals[team].count) * 10) / 10
        };
        byTeam[team].push(teamAvg);
      });
    });

    // Sort all data by date
    dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));
    Object.keys(byRegion).forEach(region => {
      byRegion[region].sort((a, b) => new Date(a.date) - new Date(b.date));
    });
    Object.keys(byTeam).forEach(team => {
      byTeam[team].sort((a, b) => new Date(a.date) - new Date(b.date));
    });
    Object.keys(byTSE).forEach(tseId => {
      byTSE[tseId].data.sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    return { daily: dailyData, byRegion, byTeam, byTSE };
  }, [snapshots, managerTeamFilter]);

  // Prepare combined data for by-region view
  const regionChartData = useMemo(() => {
    if (viewType !== 'by-region') return [];
    
    // Aggregate each region's data by time period first
    const aggregatedRegions = {};
    Object.keys(averageChatsData.byRegion).forEach(region => {
      aggregatedRegions[region] = aggregateByTimePeriod(averageChatsData.byRegion[region], timePeriod);
    });
    
    // Get all unique dates from aggregated data
    const allDates = new Set();
    Object.values(aggregatedRegions).forEach(regionData => {
      regionData.forEach(item => allDates.add(item.date));
    });
    
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));
    
    return sortedDates.map(date => {
      const dataPoint = { date };
      Object.keys(aggregatedRegions).forEach(region => {
        const regionData = aggregatedRegions[region];
        const matchingData = regionData.find(d => d.date === date);
        if (matchingData) {
          dataPoint[`${region}_open`] = matchingData.avgOpen;
          dataPoint[`${region}_snoozed`] = matchingData.avgActionableSnoozed;
        }
      });
      return dataPoint;
    });
  }, [averageChatsData, viewType, timePeriod]);

  // Prepare combined data for by-team view
  const teamChartData = useMemo(() => {
    if (viewType !== 'by-team') return [];
    
    // Aggregate each team's data by time period first
    const aggregatedTeams = {};
    Object.keys(averageChatsData.byTeam).forEach(team => {
      aggregatedTeams[team] = aggregateByTimePeriod(averageChatsData.byTeam[team], timePeriod);
    });
    
    // Get all unique dates from aggregated data
    const allDates = new Set();
    Object.values(aggregatedTeams).forEach(teamData => {
      teamData.forEach(item => allDates.add(item.date));
    });
    
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));
    
    return sortedDates.map(date => {
      const dataPoint = { date };
      Object.keys(aggregatedTeams).forEach(team => {
        const teamData = aggregatedTeams[team];
        const matchingData = teamData.find(d => d.date === date);
        if (matchingData) {
          dataPoint[`${team}_open`] = matchingData.avgOpen;
          dataPoint[`${team}_snoozed`] = matchingData.avgActionableSnoozed;
        }
      });
      return dataPoint;
    });
  }, [averageChatsData, viewType, timePeriod]);

  // Prepare combined data for by-tse view (top 10)
  const tseChartData = useMemo(() => {
    if (viewType !== 'by-tse') return [];
    
    const topTSEs = Object.keys(averageChatsData.byTSE).slice(0, 10);
    
    // Aggregate each TSE's data by time period first
    const aggregatedTSEs = {};
    topTSEs.forEach(tseId => {
      const tseData = averageChatsData.byTSE[tseId];
      aggregatedTSEs[tseId] = aggregateByTimePeriod(tseData.data, timePeriod);
    });
    
    // Get all unique dates from aggregated data
    const allDates = new Set();
    Object.values(aggregatedTSEs).forEach(tseData => {
      tseData.forEach(item => allDates.add(item.date));
    });
    
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));
    
    return sortedDates.map(date => {
      const dataPoint = { date };
      topTSEs.forEach(tseId => {
        const tseData = aggregatedTSEs[tseId];
        const matchingData = tseData.find(d => d.date === date);
        if (matchingData) {
          dataPoint[`${tseId}_open`] = matchingData.avgOpen;
          dataPoint[`${tseId}_snoozed`] = matchingData.avgActionableSnoozed;
        }
      });
      return dataPoint;
    });
  }, [averageChatsData, viewType, timePeriod]);

  // Prepare table data grouped by date
  const groupedTableData = useMemo(() => {
    if (!snapshots.length) return [];

    const EXCLUDED_TSE_NAMES = ["Prerit Sachdeva"];
    const groupedByDate = {};
    
    snapshots.forEach(snapshot => {
      let tseData = selectedTSEs.length > 0
        ? snapshot.tseData.filter(tse => selectedTSEs.includes(String(tse.id)))
        : snapshot.tseData;
      
      // Filter out excluded TSEs
      tseData = tseData.filter(tse => !EXCLUDED_TSE_NAMES.includes(tse.name));
      
      // Apply manager team filter if set
      if (managerTeamFilter) {
        tseData = tseData.filter(tse => managerTeamFilter.includes(tse.name));
      }

      if (!groupedByDate[snapshot.date]) {
        groupedByDate[snapshot.date] = {
          date: snapshot.date,
          tses: [],
          totalTSEs: 0,
          onTrackOpen: 0,
          onTrackSnoozed: 0,
          onTrackBoth: 0,
          totalOpen: 0,
          totalActionableSnoozed: 0
        };
      }

      // Track region-level stats for team averages
      const regionStats = {};
      
      tseData.forEach(tse => {
        const meetsOpen = tse.open <= THRESHOLDS.MAX_OPEN_SOFT;
        // On-track uses: all snoozed conversations EXCEPT customer-waiting tags
        // Use snoozedForOnTrack if available (new format), otherwise calculate from snapshot data
        let snoozedForOnTrack = tse.snoozedForOnTrack;
        if (snoozedForOnTrack === undefined) {
          // Calculate from snapshot data: totalSnoozed - customerWaitSnoozed
          const totalSnoozed = tse.totalSnoozed || 0;
          const customerWaitSnoozed = tse.customerWaitSnoozed || 0;
          snoozedForOnTrack = totalSnoozed - customerWaitSnoozed;
          // Fallback to old format if new calculation doesn't work
          if (snoozedForOnTrack < 0) {
            snoozedForOnTrack = tse.actionableSnoozed || 0;
          }
        }
        const meetsSnoozed = snoozedForOnTrack <= THRESHOLDS.MAX_ACTIONABLE_SNOOZED_SOFT;
        const exceedsTargets = tse.open === 0 && snoozedForOnTrack === 0;
        const overallOnTrack = meetsOpen && meetsSnoozed;
        
        // Get region for this TSE
        const region = getTSERegion(tse.name);
        if (!regionStats[region]) {
          regionStats[region] = {
            totalTSEs: 0,
            onTrackOpen: 0,
            onTrackSnoozed: 0,
            onTrackBoth: 0
          };
        }
        
        regionStats[region].totalTSEs++;
        if (meetsOpen) regionStats[region].onTrackOpen++;
        if (meetsSnoozed) regionStats[region].onTrackSnoozed++;
        if (meetsOpen && meetsSnoozed) regionStats[region].onTrackBoth++;
        
        groupedByDate[snapshot.date].tses.push({
          tseName: tse.name,
          open: tse.open,
          actionableSnoozed: tse.actionableSnoozed,
          customerWaitSnoozed: tse.customerWaitSnoozed,
          totalSnoozed: tse.totalSnoozed || 0,
          snoozedForOnTrack: snoozedForOnTrack,
          openOnTrack: meetsOpen,
          snoozedOnTrack: meetsSnoozed,
          overallOnTrack: overallOnTrack,
          exceedsTargets: exceedsTargets,
          region: region
        });

        groupedByDate[snapshot.date].totalTSEs++;
        groupedByDate[snapshot.date].totalOpen += tse.open || 0;
        groupedByDate[snapshot.date].totalActionableSnoozed += snoozedForOnTrack;
        if (meetsOpen) groupedByDate[snapshot.date].onTrackOpen++;
        if (meetsSnoozed) groupedByDate[snapshot.date].onTrackSnoozed++;
        if (meetsOpen && meetsSnoozed) groupedByDate[snapshot.date].onTrackBoth++;
      });
      
      // Store region averages for this date
      groupedByDate[snapshot.date].regionAverages = {};
      Object.keys(regionStats).forEach(region => {
        const stats = regionStats[region];
        groupedByDate[snapshot.date].regionAverages[region] = {
          totalTSEs: stats.totalTSEs,
          openOnTrack: stats.totalTSEs > 0 ? Math.round((stats.onTrackOpen / stats.totalTSEs) * 100) : 0,
          snoozedOnTrack: stats.totalTSEs > 0 ? Math.round((stats.onTrackSnoozed / stats.totalTSEs) * 100) : 0,
          overallOnTrack: stats.totalTSEs > 0 ? Math.round((stats.onTrackBoth / stats.totalTSEs) * 100) : 0
        };
      });

      // Sort TSEs within each date
      groupedByDate[snapshot.date].tses.sort((a, b) => a.tseName.localeCompare(b.tseName));
    });

    // Convert to array
    let sorted = Object.values(groupedByDate);
    
    // Apply sorting
    if (onTrackSortConfig.key) {
      sorted = [...sorted].sort((a, b) => {
        let aVal, bVal;
        
        switch (onTrackSortConfig.key) {
          case 'date':
            aVal = new Date(a.date);
            bVal = new Date(b.date);
            break;
          case 'tse':
            aVal = a.totalTSEs;
            bVal = b.totalTSEs;
            break;
          case 'openOnTrack':
            aVal = a.totalTSEs > 0 ? Math.round((a.onTrackOpen / a.totalTSEs) * 100) : 0;
            bVal = b.totalTSEs > 0 ? Math.round((b.onTrackOpen / b.totalTSEs) * 100) : 0;
            break;
          case 'snoozedOnTrack':
            aVal = a.totalTSEs > 0 ? Math.round((a.onTrackSnoozed / a.totalTSEs) * 100) : 0;
            bVal = b.totalTSEs > 0 ? Math.round((b.onTrackSnoozed / b.totalTSEs) * 100) : 0;
            break;
          case 'overallOnTrack':
            aVal = a.totalTSEs > 0 ? Math.round((a.onTrackBoth / a.totalTSEs) * 100) : 0;
            bVal = b.totalTSEs > 0 ? Math.round((b.onTrackBoth / b.totalTSEs) * 100) : 0;
            break;
          default:
            return 0;
        }
        
        if (aVal < bVal) return onTrackSortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return onTrackSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default: sort by date (newest first)
      sorted = sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    
    // Limit to last N days
    return sorted.slice(0, onTrackDaysToShow);
  }, [snapshots, selectedTSEs, onTrackSortConfig, onTrackDaysToShow, managerTeamFilter]);
  
  // Calculate total available days for On Track data
  const onTrackTotalDays = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return 0;
    const groupedByDate = {};
    snapshots.forEach(snapshot => {
      if (!groupedByDate[snapshot.date]) {
        groupedByDate[snapshot.date] = true;
      }
    });
    return Object.keys(groupedByDate).length;
  }, [snapshots]);

  const toggleDate = (date) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  const toggleResponseTimeDate = (date) => {
    const newExpanded = new Set(expandedResponseTimeDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedResponseTimeDates(newExpanded);
  };

  const handleOnTrackSort = (key) => {
    setOnTrackSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleResponseTimeSort = (key) => {
    setResponseTimeSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleTSEChange = (tseId, checked) => {
    const tseIdString = String(tseId);
    // Update both state and ref immediately to prevent race conditions
    setHasManuallyCleared(true);
    hasManuallyClearedRef.current = true;
    
    setSelectedTSEs(prev => {
      if (checked) {
        // Add TSE if not already in the list
        if (prev.includes(tseIdString)) {
          return prev; // Already selected, don't change
        }
        return [...prev, tseIdString];
      } else {
        // Remove TSE from the list
        return prev.filter(id => id !== tseIdString);
      }
    });
  };

  const selectAllTSEs = () => {
    setSelectedTSEs(availableTSEs.map(tse => String(tse.id)));
    setHasManuallyCleared(false); // Reset flag when selecting all
  };

  const clearTSEs = () => {
    setSelectedTSEs([]);
    setHasManuallyCleared(true);
    hasManuallyClearedRef.current = true;
  };

  const selectRegionTSEs = (region) => {
    const regionTSEs = tseByRegion[region] || [];
    const regionTSEIds = regionTSEs.map(tse => String(tse.id));
    
    setHasManuallyCleared(true);
    hasManuallyClearedRef.current = true;
    
    setSelectedTSEs(prev => {
      // Add all region TSEs that aren't already selected
      const newSelection = [...prev];
      regionTSEIds.forEach(id => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      return newSelection;
    });
  };

  const unselectRegionTSEs = (region) => {
    const regionTSEs = tseByRegion[region] || [];
    const regionTSEIds = regionTSEs.map(tse => String(tse.id));
    
    setHasManuallyCleared(true);
    hasManuallyClearedRef.current = true;
    
    setSelectedTSEs(prev => {
      // Remove all region TSEs from selection
      return prev.filter(id => !regionTSEIds.includes(id));
    });
  };

  // Prepare response time chart data
  const responseTimeChartData = useMemo(() => {
    if (!responseTimeMetrics || responseTimeMetrics.length === 0) {
      return [];
    }
    
    return responseTimeMetrics
      .filter(metric => {
        // Only include metrics with a date
        if (!metric.date) return false;
        
        // Filter by date range if dates are set
        if (startDate && endDate) {
          const metricDate = metric.date;
          return metricDate >= startDate && metricDate <= endDate;
        }
        
        return true;
      })
      .map(metric => {
        try {
          // date format: YYYY-MM-DD (e.g., "2025-12-29")
          const [year, month, day] = metric.date.split('-').map(Number);
          
          if (isNaN(year) || isNaN(month) || isNaN(day)) {
            console.warn('Invalid date format:', metric.date);
            return null;
          }
          
          return {
            date: metric.date,
            timestamp: metric.timestamp,
            displayLabel: formatDateForChart(metric.date),
            count5PlusMin: metric.count5PlusMin || 0,
            count5to10Min: metric.count5to10Min || (metric.count5PlusMin || 0) - (metric.count10PlusMin || 0),
            count10PlusMin: metric.count10PlusMin || 0,
            totalConversations: metric.totalConversations || 0,
            percentage5PlusMin: metric.percentage5PlusMin || 0,
            percentage5to10Min: metric.percentage5to10Min || 0,
            percentage10PlusMin: metric.percentage10PlusMin || 0,
            conversationIds5PlusMin: metric.conversationIds5PlusMin || [],
            conversationIds10PlusMin: metric.conversationIds10PlusMin || []
          };
        } catch (error) {
          console.error('Error processing metric:', metric, error);
          return null;
        }
      })
      .filter(item => item !== null) // Remove any null entries
      .sort((a, b) => {
        // Apply sorting if configured
        if (responseTimeSortConfig.key) {
          let aVal, bVal;
          
          switch (responseTimeSortConfig.key) {
            case 'date':
              aVal = new Date(a.date);
              bVal = new Date(b.date);
              break;
            case 'totalConversations':
              aVal = a.totalConversations;
              bVal = b.totalConversations;
              break;
            case 'count5PlusMin':
              aVal = a.count5PlusMin;
              bVal = b.count5PlusMin;
              break;
            case 'percentage5Plus':
              aVal = a.percentage5PlusMin;
              bVal = b.percentage5PlusMin;
              break;
            default:
              return 0;
          }
          
          if (aVal < bVal) return responseTimeSortConfig.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return responseTimeSortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }
        
        // Default: sort by date (newest first)
        return new Date(b.date) - new Date(a.date);
      })
      // Limit to last N days (only if no date range filter is applied)
      .slice(0, startDate && endDate ? undefined : responseTimeDaysToShow);
  }, [responseTimeMetrics, responseTimeSortConfig, responseTimeDaysToShow, startDate, endDate]);
  
  // Calculate total available days for Response Time data
  const responseTimeTotalDays = useMemo(() => {
    if (!responseTimeMetrics || responseTimeMetrics.length === 0) return 0;
    const uniqueDates = new Set();
    responseTimeMetrics.forEach(metric => {
      if (metric.date) uniqueDates.add(metric.date);
    });
    return uniqueDates.size;
  }, [responseTimeMetrics]);
  
  // Calculate min/max for heat map colors (per column)
  const responseTimeHeatMapRanges = useMemo(() => {
    if (!responseTimeChartData || responseTimeChartData.length === 0) {
      return {
        percentage5PlusMin: { min: 0, max: 0 },
        percentage5to10Min: { min: 0, max: 0 },
        percentage10PlusMin: { min: 0, max: 0 }
      };
    }
    
    const percentage5PlusMinValues = responseTimeChartData.map(d => d.percentage5PlusMin || 0);
    const percentage5to10MinValues = responseTimeChartData.map(d => d.percentage5to10Min || 0);
    const percentage10PlusMinValues = responseTimeChartData.map(d => d.percentage10PlusMin || 0);
    
    return {
      percentage5PlusMin: {
        min: Math.min(...percentage5PlusMinValues),
        max: Math.max(...percentage5PlusMinValues)
      },
      percentage5to10Min: {
        min: Math.min(...percentage5to10MinValues),
        max: Math.max(...percentage5to10MinValues)
      },
      percentage10PlusMin: {
        min: Math.min(...percentage10PlusMinValues),
        max: Math.max(...percentage10PlusMinValues)
      }
    };
  }, [responseTimeChartData]);
  
  // Function to get heat map color (blue with varying opacity - lowest is transparent, highest is opaque)
  const getHeatMapColor = (value, min, max) => {
    // If all values are the same, return medium opacity
    if (max === min) {
      return 'rgba(53, 161, 180, 0.4)'; // Medium transparent blue
    }
    
    // Calculate position in range (0 = min, 1 = max)
    const ratio = (value - min) / (max - min);
    
    // Interpolate opacity from 0.4 (readable but light) to 1.0 (fully opaque)
    // Using blue color: #35a1b4 (RGB: 53, 161, 180)
    const opacity = 0.4 + (0.6 * ratio); // Range from 0.4 to 1.0
    
    return `rgba(53, 161, 180, ${opacity})`;
  };

  // Calculate date range for response time data
  const responseTimeDateRange = useMemo(() => {
    if (!responseTimeChartData || responseTimeChartData.length === 0) return null;
    
    const dates = responseTimeChartData.map(d => d.date).sort();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    
    return {
      start: formatDateFull(startDate),
      end: formatDateFull(endDate)
    };
  }, [responseTimeChartData]);

  // Day-of-week analysis for response time
  const responseTimeDayOfWeek = useMemo(() => {
    if (!responseTimeChartData.length) return null;
    
    const dayStats = {
      'Monday': { count: 0, percentage5Plus: 0, totalConversations: 0, count5PlusMin: 0, count5to10Min: 0, count10PlusMin: 0, totalWithResponse: 0 },
      'Tuesday': { count: 0, percentage5Plus: 0, totalConversations: 0, count5PlusMin: 0, count5to10Min: 0, count10PlusMin: 0, totalWithResponse: 0 },
      'Wednesday': { count: 0, percentage5Plus: 0, totalConversations: 0, count5PlusMin: 0, count5to10Min: 0, count10PlusMin: 0, totalWithResponse: 0 },
      'Thursday': { count: 0, percentage5Plus: 0, totalConversations: 0, count5PlusMin: 0, count5to10Min: 0, count10PlusMin: 0, totalWithResponse: 0 },
      'Friday': { count: 0, percentage5Plus: 0, totalConversations: 0, count5PlusMin: 0, count5to10Min: 0, count10PlusMin: 0, totalWithResponse: 0 }
    };
    
    responseTimeChartData.forEach(d => {
      const [year, month, day] = d.date.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      
      if (dayStats[dayName]) {
        dayStats[dayName].count++;
        dayStats[dayName].percentage5Plus += d.percentage5PlusMin;
        dayStats[dayName].count5PlusMin += d.count5PlusMin || 0;
        dayStats[dayName].count5to10Min += d.count5to10Min || 0;
        dayStats[dayName].count10PlusMin += d.count10PlusMin || 0;
        
        // Calculate totalWithResponse from percentage and count
        // percentage5PlusMin = (count5PlusMin / totalWithResponse) * 100
        // So: totalWithResponse = (count5PlusMin / percentage5PlusMin) * 100
        if (d.percentage5PlusMin > 0 && d.count5PlusMin > 0) {
          const totalWithResponse = (d.count5PlusMin / d.percentage5PlusMin) * 100;
          dayStats[dayName].totalWithResponse += totalWithResponse;
        } else {
          // If no 5+ min waits, we can't calculate totalWithResponse from this metric
          // Use totalConversations as an approximation (though it's not exact)
          dayStats[dayName].totalWithResponse += d.totalConversations;
        }
      }
    });
    
    return Object.entries(dayStats).map(([day, stats]) => {
      const avgTotalWithResponse = stats.count > 0 ? Math.round((stats.totalWithResponse / stats.count) * 100) / 100 : 0;
      const avgCount5PlusMin = stats.count > 0 ? Math.round((stats.count5PlusMin / stats.count) * 100) / 100 : 0;
      const avgCount5to10Min = stats.count > 0 ? Math.round((stats.count5to10Min / stats.count) * 100) / 100 : 0;
      const avgCount10PlusMin = stats.count > 0 ? Math.round((stats.count10PlusMin / stats.count) * 100) / 100 : 0;
      const avgPercentage5Plus = stats.count > 0 ? Math.round((stats.percentage5Plus / stats.count) * 100) / 100 : 0;
      
      return {
        day: day.substring(0, 3),
        fullDay: day,
        avgTotalWithResponse: avgTotalWithResponse,
        avgCount5PlusMin: avgCount5PlusMin,
        avgCount5to10Min: avgCount5to10Min,
        avgCount10PlusMin: avgCount10PlusMin,
        avgPercentage5Plus: avgPercentage5Plus,
        avgOtherResponses: Math.max(0, avgTotalWithResponse - avgCount5PlusMin), // Responses under 5 min
        count: stats.count
      };
    }).filter(d => d.count > 0);
  }, [responseTimeChartData]);

  // Best/worst days for response time
  const responseTimeBestWorst = useMemo(() => {
    if (!responseTimeChartData.length) return null;
    
    const sortedByPercentage = [...responseTimeChartData].sort((a, b) => b.percentage5PlusMin - a.percentage5PlusMin);
    const sortedByCount = [...responseTimeChartData].sort((a, b) => b.count5PlusMin - a.count5PlusMin);
    
    const worstPercentage = sortedByPercentage[0];
    const bestPercentage = sortedByPercentage[sortedByPercentage.length - 1];
    const worstCount = sortedByCount[0];
    const bestCount = sortedByCount[sortedByCount.length - 1];
    
    // Use shared date formatting utility
    const formatDate = formatDateForChart;
    
    return {
      worstPercentage: {
        date: worstPercentage.date,
        displayDate: formatDate(worstPercentage.date),
        percentage: worstPercentage.percentage5PlusMin,
        count: worstPercentage.count5PlusMin,
        total: worstPercentage.totalConversations
      },
      bestPercentage: {
        date: bestPercentage.date,
        displayDate: formatDate(bestPercentage.date),
        percentage: bestPercentage.percentage5PlusMin,
        count: bestPercentage.count5PlusMin,
        total: bestPercentage.totalConversations
      },
      worstCount: {
        date: worstCount.date,
        displayDate: formatDate(worstCount.date),
        percentage: worstCount.percentage5PlusMin,
        count: worstCount.count5PlusMin,
        total: worstCount.totalConversations
      },
      bestCount: {
        date: bestCount.date,
        displayDate: formatDate(bestCount.date),
        percentage: bestCount.percentage5PlusMin,
        count: bestCount.count5PlusMin,
        total: bestCount.totalConversations
      }
    };
  }, [responseTimeChartData]);

  // Volume vs performance correlation
  const volumePerformanceData = useMemo(() => {
    if (!responseTimeChartData.length) return null;
    
    return responseTimeChartData.map(d => ({
      totalConversations: d.totalConversations,
      percentage: d.percentage5PlusMin,
      date: d.displayLabel
    }));
  }, [responseTimeChartData]);

  // Calculate correlation coefficient
  const volumeCorrelation = useMemo(() => {
    if (!volumePerformanceData || volumePerformanceData.length < 2) return null;
    
    const n = volumePerformanceData.length;
    const sumX = volumePerformanceData.reduce((sum, d) => sum + d.totalConversations, 0);
    const sumY = volumePerformanceData.reduce((sum, d) => sum + d.percentage, 0);
    const sumXY = volumePerformanceData.reduce((sum, d) => sum + d.totalConversations * d.percentage, 0);
    const sumX2 = volumePerformanceData.reduce((sum, d) => sum + d.totalConversations * d.totalConversations, 0);
    const sumY2 = volumePerformanceData.reduce((sum, d) => sum + d.percentage * d.percentage, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    const correlation = denominator !== 0 ? numerator / denominator : 0;
    
    return {
      correlation: Math.round(correlation * 100) / 100,
      interpretation: Math.abs(correlation) < 0.3 ? 'weak' : Math.abs(correlation) < 0.7 ? 'moderate' : 'strong',
      direction: correlation > 0 ? 'positive' : 'negative'
    };
  }, [volumePerformanceData]);

  // Trend analysis with moving averages
  const responseTimeTrendAnalysis = useMemo(() => {
    if (!responseTimeChartData.length || responseTimeChartData.length < 2) return null;
    
    const sorted = [...responseTimeChartData].sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
    const secondHalf = sorted.slice(Math.ceil(sorted.length / 2));
    
    const firstAvg = Math.round((firstHalf.reduce((sum, d) => sum + d.percentage5PlusMin, 0) / firstHalf.length) * 100) / 100;
    const secondAvg = Math.round((secondHalf.reduce((sum, d) => sum + d.percentage5PlusMin, 0) / secondHalf.length) * 100) / 100;
    const change = Math.round((secondAvg - firstAvg) * 100) / 100;
    
    // Calculate volatility (standard deviation)
    const avg = sorted.reduce((sum, d) => sum + d.percentage5PlusMin, 0) / sorted.length;
    const variance = sorted.reduce((sum, d) => sum + Math.pow(d.percentage5PlusMin - avg, 2), 0) / sorted.length;
    const volatility = Math.round(Math.sqrt(variance) * 100) / 100;
    
    // Calculate moving average (7-day if enough data)
    const movingAvg = sorted.length >= 7 ? sorted.slice(-7).reduce((sum, d) => sum + d.percentage5PlusMin, 0) / 7 : avg;
    
    return {
      firstHalfAvg: firstAvg,
      secondHalfAvg: secondAvg,
      change,
      trend: change < -1 ? 'improving' : change > 1 ? 'worsening' : 'stable',
      volatility,
      currentAvg: Math.round(avg * 100) / 100,
      movingAvg: Math.round(movingAvg * 100) / 100
    };
  }, [responseTimeChartData]);

  // Peak detection (outlier days)
  // eslint-disable-next-line no-unused-vars
  const responseTimePeaks = useMemo(() => {
    if (!responseTimeChartData.length) return null;
    
    const percentages = responseTimeChartData.map(d => d.percentage5PlusMin);
    const avg = percentages.reduce((sum, p) => sum + p, 0) / percentages.length;
    const variance = percentages.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / percentages.length;
    const stdDev = Math.sqrt(variance);
    
    const threshold = avg + (2 * stdDev); // 2 standard deviations
    
    const outliers = responseTimeChartData
      .filter(d => d.percentage5PlusMin >= threshold)
      .map(d => {
        const [year, month, day] = d.date.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return {
          date: d.date,
          displayDate: `${date.getMonth() + 1}/${date.getDate()}`,
          percentage: Math.round(d.percentage5PlusMin * 100) / 100,
          count: d.count5PlusMin,
          total: d.totalConversations,
          deviation: Math.round((d.percentage5PlusMin - avg) / stdDev * 100) / 100
        };
      })
      .sort((a, b) => b.percentage - a.percentage);
    
    return {
      outliers,
      threshold: Math.round(threshold * 100) / 100,
      average: Math.round(avg * 100) / 100
    };
  }, [responseTimeChartData]);


  // Calculate response time summary metrics
  const responseTimeSummary = useMemo(() => {
    if (responseTimeMetrics.length === 0) {
      return { 
        avgPercentage5Plus: 0, 
        avgPercentage5to10: 0,
        avgPercentage10Plus: 0,
        totalCount5Plus: 0, 
        totalCount5to10: 0,
        totalCount10Plus: 0,
        trend: 'no-data', 
        change: 0, 
        comparisonText: '',
        recentTrendDirection: 'stable',
        recentTrendChange: 0
      };
    }
    
    // Filter metrics by date range if dates are set (same as responseTimeChartData)
    const filteredMetrics = responseTimeMetrics.filter(metric => {
      if (!metric.date) return false;
      if (startDate && endDate) {
        const metricDate = metric.date;
        return metricDate >= startDate && metricDate <= endDate;
      }
      return true;
    });
    
    if (filteredMetrics.length === 0) {
      return { 
        avgPercentage5Plus: 0, 
        avgPercentage5to10: 0,
        avgPercentage10Plus: 0,
        totalCount5Plus: 0, 
        totalCount5to10: 0,
        totalCount10Plus: 0,
        trend: 'no-data', 
        change: 0, 
        comparisonText: '',
        recentTrendDirection: 'stable',
        recentTrendChange: 0
      };
    }
    
    // Sort metrics by date to ensure chronological order
    const sortedMetrics = [...filteredMetrics].sort((a, b) => {
      return new Date(a.date) - new Date(b.date);
    });
    
    const avgPercentage5Plus = Math.round(
      sortedMetrics.reduce((sum, m) => sum + (m.percentage5PlusMin || 0), 0) / sortedMetrics.length
    );
    
    const avgPercentage5to10 = Math.round(
      sortedMetrics.reduce((sum, m) => sum + (m.percentage5to10Min || 0), 0) / sortedMetrics.length
    );
    
    const avgPercentage10Plus = Math.round(
      sortedMetrics.reduce((sum, m) => sum + (m.percentage10PlusMin || 0), 0) / sortedMetrics.length
    );
    
    const totalCount5Plus = sortedMetrics.reduce((sum, m) => sum + (m.count5PlusMin || 0), 0);
    const totalCount5to10 = sortedMetrics.reduce((sum, m) => sum + (m.count5to10Min || 0), 0);
    const totalCount10Plus = sortedMetrics.reduce((sum, m) => sum + (m.count10PlusMin || 0), 0);
    
    // Calculate trend (comparing last 7 days vs previous 7 days)
    // If we have 14+ data points, compare last 7 vs previous 7
    // Otherwise, compare last half vs first half
    let previousPeriodAvg = 0;
    let lastPeriodAvg = 0;
    let previousPeriodStart = null;
    let previousPeriodEnd = null;
    let lastPeriodStart = null;
    let lastPeriodEnd = null;
    
    if (sortedMetrics.length >= 14) {
      // Last 7 days vs previous 7 days
      const last7Days = sortedMetrics.slice(-7);
      const previous7Days = sortedMetrics.slice(-14, -7);
      
      previousPeriodAvg = previous7Days.length > 0 
        ? previous7Days.reduce((sum, m) => sum + (m.percentage5PlusMin || 0), 0) / previous7Days.length 
        : 0;
      lastPeriodAvg = last7Days.length > 0 
        ? last7Days.reduce((sum, m) => sum + (m.percentage5PlusMin || 0), 0) / last7Days.length 
        : 0;
      
      if (previous7Days.length > 0) {
        previousPeriodStart = previous7Days[0].date;
        previousPeriodEnd = previous7Days[previous7Days.length - 1].date;
      }
      if (last7Days.length > 0) {
        lastPeriodStart = last7Days[0].date;
        lastPeriodEnd = last7Days[last7Days.length - 1].date;
      }
    } else if (sortedMetrics.length >= 2) {
      // Fallback: compare last half vs first half
      const midPoint = Math.floor(sortedMetrics.length / 2);
      const firstHalf = sortedMetrics.slice(0, midPoint);
      const secondHalf = sortedMetrics.slice(midPoint);
      
      previousPeriodAvg = firstHalf.length > 0 
        ? firstHalf.reduce((sum, m) => sum + (m.percentage5PlusMin || 0), 0) / firstHalf.length 
        : 0;
      lastPeriodAvg = secondHalf.length > 0 
        ? secondHalf.reduce((sum, m) => sum + (m.percentage5PlusMin || 0), 0) / secondHalf.length 
        : 0;
      
      if (firstHalf.length > 0) {
        previousPeriodStart = firstHalf[0].date;
        previousPeriodEnd = firstHalf[firstHalf.length - 1].date;
      }
      if (secondHalf.length > 0) {
        lastPeriodStart = secondHalf[0].date;
        lastPeriodEnd = secondHalf[secondHalf.length - 1].date;
      }
    }
    
    const trend = lastPeriodAvg < previousPeriodAvg ? 'improving' : lastPeriodAvg > previousPeriodAvg ? 'worsening' : 'stable';
    const change = Math.round(previousPeriodAvg - lastPeriodAvg); // Positive change means improvement (reduction)
    
    // Determine comparison period text with actual dates
    let comparisonText = '';
    if (lastPeriodStart && lastPeriodEnd && previousPeriodStart && previousPeriodEnd) {
      const formatDateShort = (dateStr) => {
        if (!dateStr) return '';
        const [, month, day] = dateStr.split('-');
        return `${month}/${day}`;
      };
      
      if (sortedMetrics.length >= 14) {
        comparisonText = `${formatDateShort(lastPeriodStart)}-${formatDateShort(lastPeriodEnd)} vs ${formatDateShort(previousPeriodStart)}-${formatDateShort(previousPeriodEnd)}`;
      } else {
        comparisonText = `${formatDateShort(lastPeriodStart)}-${formatDateShort(lastPeriodEnd)} vs ${formatDateShort(previousPeriodStart)}-${formatDateShort(previousPeriodEnd)}`;
      }
    } else if (sortedMetrics.length >= 14) {
      comparisonText = 'vs previous 7 days';
    } else if (sortedMetrics.length >= 2) {
      comparisonText = 'vs earlier period';
    }
    
    // Calculate recent trend (last 3 days vs previous 3 days)
    let recentTrendDirection = 'stable';
    let recentTrendChange = 0;
    if (sortedMetrics.length >= 6) {
      const recent3 = sortedMetrics.slice(-3);
      const previous3 = sortedMetrics.slice(-6, -3);
      const recentAvg = recent3.reduce((sum, m) => sum + (m.percentage5PlusMin || 0), 0) / recent3.length;
      const previousAvg = previous3.reduce((sum, m) => sum + (m.percentage5PlusMin || 0), 0) / previous3.length;
      recentTrendChange = Math.round((previousAvg - recentAvg) * 10) / 10; // Positive = improvement
      if (recentTrendChange > 2) recentTrendDirection = 'improving';
      else if (recentTrendChange < -2) recentTrendDirection = 'worsening';
    } else if (sortedMetrics.length >= 2) {
      const recent = sortedMetrics[sortedMetrics.length - 1].percentage5PlusMin || 0;
      const previous = sortedMetrics[sortedMetrics.length - 2].percentage5PlusMin || 0;
      recentTrendChange = Math.round((previous - recent) * 10) / 10; // Positive = improvement
      if (recentTrendChange > 2) recentTrendDirection = 'improving';
      else if (recentTrendChange < -2) recentTrendDirection = 'worsening';
    }

    return { 
      avgPercentage5Plus, 
      avgPercentage5to10,
      avgPercentage10Plus,
      totalCount5Plus, 
      totalCount5to10,
      totalCount10Plus,
      trend, 
      change, 
      comparisonText,
      recentTrendDirection,
      recentTrendChange
    };
  }, [responseTimeMetrics, startDate, endDate]);

  return (
    <div className="historical-view">
      <div className="historical-header">
        <h2>Analytics</h2>
        <div className="header-buttons">
          {activeTab === 'response-time' && (
            <div className="last-snapshot-display">
              {lastResponseTimeTimestamp ? (
                <span>Last Snapshot taken {formatTimestamp(lastResponseTimeTimestamp)}</span>
              ) : (
                <span>No snapshot data available</span>
              )}
            </div>
          )}
          {activeTab === 'on-track' && (
            <div className="last-snapshot-display">
              {lastSnapshotTimestamp ? (
                <span>Last Snapshot taken {formatTimestamp(lastSnapshotTimestamp)}</span>
              ) : (
                <span>No snapshot data available</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="historical-tabs">
        <button 
          className={activeTab === 'on-track' ? 'active' : ''}
          onClick={() => setActiveTab('on-track')}
        >
          Daily On Track Trends
        </button>
        <button 
          className={activeTab === 'response-time' ? 'active' : ''}
          onClick={() => setActiveTab('response-time')}
        >
          Response Time Metrics
        </button>
        <button 
          className={activeTab === 'results' ? 'active' : ''}
          onClick={() => setActiveTab('results')}
        >
          Impact
        </button>
      </div>

      <div className="historical-filters">
        <div className="filter-group">
          <label>Date Range:</label>
          <select 
            value={dateRange} 
            onChange={(e) => handleDateRangeChange(e.target.value)} 
            className="filter-select"
            style={{
              background: isDarkMode ? '#2a2a2a' : 'white',
              color: isDarkMode ? '#ffffff' : '#292929',
              borderColor: isDarkMode ? '#35a1b4' : '#35a1b4'
            }}
          >
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Weekdays</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {dateRange === 'custom' && (
          <>
            <div className="filter-group">
              <label>Start Date:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="date-input"
                max={customEndDate || undefined}
                style={{
                  background: isDarkMode ? '#2a2a2a' : 'white',
                  color: isDarkMode ? '#ffffff' : '#292929',
                  borderColor: isDarkMode ? '#35a1b4' : '#35a1b4'
                }}
              />
            </div>
            <div className="filter-group">
              <label>End Date:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="date-input"
                min={customStartDate || undefined}
                style={{
                  background: isDarkMode ? '#2a2a2a' : 'white',
                  color: isDarkMode ? '#ffffff' : '#292929',
                  borderColor: isDarkMode ? '#35a1b4' : '#35a1b4'
                }}
              />
            </div>
            <div className="filter-group">
              <button 
                onClick={handleApplyCustomDateRange}
                className="apply-date-button"
                disabled={!customStartDate || !customEndDate}
              >
                Apply Date Range
              </button>
            </div>
          </>
        )}

        {(activeTab === 'on-track' || activeTab === 'response-time') && (
          <div className="filter-group tse-selector">
            <label>Filter by TSE:</label>
            <div className="tse-checkboxes">
              <button onClick={selectAllTSEs} className="select-all-button">Select All</button>
              <button onClick={clearTSEs} className="clear-button">Unselect All</button>
              <div className="tse-checkbox-list">
                {['UK', 'NY', 'SF', 'Other'].map(region => {
                  const regionTSEs = tseByRegion[region] || [];
                  if (regionTSEs.length === 0) return null;

                  const isRegionExpanded = expandedRegions.has(region);
                  const regionLabels = {
                    'UK': 'UK',
                    'NY': 'New York',
                    'SF': 'San Francisco',
                    'Other': 'Other'
                  };
                  // Use dark mode icon for NY when in dark mode
                  let iconUrl = REGION_ICONS[region];
                  if (region === 'NY' && isDarkMode) {
                    iconUrl = 'https://res.cloudinary.com/doznvxtja/image/upload/v1768716963/3_150_x_150_px_16_ozl21j.svg';
                  }

                  const allRegionTSEsSelected = regionTSEs.every(tse => selectedTSEs.includes(String(tse.id)));
                  const anyRegionTSEsSelected = regionTSEs.some(tse => selectedTSEs.includes(String(tse.id)));
                  
                  return (
                    <div key={region} className="tse-region-filter-group">
                      <div 
                        className="tse-region-filter-header"
                        onClick={() => toggleRegion(region)}
                      >
                        <span className="region-expand-icon">{isRegionExpanded ? '▼' : '▶'}</span>
                        <span className="region-filter-name">{regionLabels[region]}</span>
                        {iconUrl && (
                          <img 
                            src={iconUrl} 
                            alt={region} 
                            className="region-filter-icon"
                          />
                        )}
                        <span className="region-filter-count">({regionTSEs.length})</span>
                        <button
                          className="region-select-all-button"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent region toggle
                            selectRegionTSEs(region);
                          }}
                          title={allRegionTSEsSelected ? "All TSEs in this region are selected" : "Select all TSEs in this region"}
                        >
                          {allRegionTSEsSelected ? '✓ All' : 'Select All'}
                        </button>
                        {anyRegionTSEsSelected && (
                          <button
                            className="region-unselect-all-button"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent region toggle
                              unselectRegionTSEs(region);
                            }}
                            title="Unselect all TSEs in this region"
                          >
                            Unselect All
                          </button>
                        )}
                      </div>
                      {isRegionExpanded && (
                        <div className="tse-region-checkbox-list">
                          {regionTSEs.map(tse => (
                            <label key={tse.id} className="tse-checkbox-label">
                              <input
                                type="checkbox"
                                checked={selectedTSEs.includes(String(tse.id))}
                                onChange={(e) => handleTSEChange(tse.id, e.target.checked)}
                              />
                              <span>{tse.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* On Track Trends Tab */}
      {activeTab === 'on-track' && (
        <>
          <div className="cron-info-banner">
            <span className="cron-info-icon">⏰</span>
            <span className="cron-info-text">
              Automated snapshots are captured nightly after all shifts have completed, providing a comprehensive view of each TSE's queue status at the end of each business day.
            </span>
          </div>
          <div className="cron-info-banner">
            <span className="cron-info-text">
              <span className="cron-info-line">
                <span className="emoji-spacer">✅</span>
                <span><strong>"On Track"</strong> means a TSE meets both criteria on a given day: (1) open conversations ≤ 5, and (2) snoozed conversations with "waiting-on-tse" tag ≤ 5.</span>
              </span>
              <span className="cron-info-line">
                <span className="emoji-spacer">📊</span>
                <span><strong>For an individual TSE over time:</strong> The percentage is calculated as <strong>(number of days the TSE was on track) ÷ (total days in the selected date range)</strong>.</span>
              </span>
              <span className="cron-info-line">
                <span className="emoji-spacer">👥</span>
                <span><strong>For a group of TSEs over time:</strong> Each day's percentage is calculated as (number of TSEs on track that day) ÷ (total TSEs that day), shown as a daily trend.</span>
              </span>
            </span>
          </div>
          {loading && (
            <div className="loading-state">Loading historical data...</div>
          )}

          {!loading && chartData.length > 0 && (
        <>
          {/* Key Insights Section */}
          {(() => {
            const insights = [];
            
            // Days meeting target
            if (actionableMetrics) {
              if (actionableMetrics.daysMeetingTargetPct >= 80) {
                insights.push({
                  type: 'positive',
                  text: `Excellent performance: ${actionableMetrics.daysMeetingTarget} of ${chartData.length} days (${actionableMetrics.daysMeetingTargetPct}%) met 100% on-track target`
                });
              } else if (actionableMetrics.daysMeetingTargetPct < 50) {
                insights.push({
                  type: 'warning',
                  text: `Performance below target: Only ${actionableMetrics.daysMeetingTarget} of ${chartData.length} days (${actionableMetrics.daysMeetingTargetPct}%) met 100% on-track target`
                });
              }
              
              // Current streak
              if (actionableMetrics.currentStreak >= 3) {
                insights.push({
                  type: 'positive',
                  text: `Strong current streak: ${actionableMetrics.currentStreak} consecutive days at 100% on-track`
                });
              } else if (actionableMetrics.currentStreak === 0 && chartData.length > 0) {
                const latestOnTrack = chartData[chartData.length - 1]?.overallOnTrack || 0;
                if (latestOnTrack < 80) {
                  insights.push({
                    type: 'warning',
                    text: `No current streak: Latest day shows ${latestOnTrack}% on-track (target: 100%)`
                  });
                }
              }
              
              // Trend direction
              if (actionableMetrics.trendDirection === 'improving' && actionableMetrics.trendChange >= 5) {
                insights.push({
                  type: 'positive',
                  text: `Performance improving: +${actionableMetrics.trendChange}% increase in on-track percentage over recent period`
                });
              } else if (actionableMetrics.trendDirection === 'worsening' && actionableMetrics.trendChange <= -5) {
                insights.push({
                  type: 'warning',
                  text: `Performance declining: ${actionableMetrics.trendChange}% decrease in on-track percentage over recent period`
                });
              }
              
              // Best streak
              if (actionableMetrics.bestStreak >= 5) {
                insights.push({
                  type: 'positive',
                  text: `Best streak achieved: ${actionableMetrics.bestStreak} consecutive days at 100% on-track during this period`
                });
              }
            }
            
            // Average performance
            if (chartData.length > 0) {
              const avgOnTrack = Math.round(chartData.reduce((sum, d) => sum + d.overallOnTrack, 0) / chartData.length);
              if (avgOnTrack >= 90) {
                insights.push({
                  type: 'positive',
                  text: `Strong average performance: ${avgOnTrack}% average on-track across ${chartData.length} days`
                });
              } else if (avgOnTrack < 70) {
                insights.push({
                  type: 'warning',
                  text: `Average performance below target: ${avgOnTrack}% average on-track across ${chartData.length} days (target: 100%)`
                });
              }
            }
            
            // Format insight text function
            const formatInsightText = (insight) => {
              const text = insight.text;
              const parts = [];
              let lastIndex = 0;
              
              // Try to extract label if text starts with common labels
              const labelMatch = text.match(/^(Excellent performance|Performance below target|Strong current streak|No current streak|Performance improving|Performance declining|Best streak achieved|Strong average performance|Average performance below target|Recent improvement|Recent decline|Overall improving trend|Overall declining trend|Strong performance at scale):/);
              let label = null;
              let textWithoutLabel = text;
              
              if (labelMatch) {
                label = labelMatch[1];
                textWithoutLabel = text.substring(label.length + 1).trim();
              }
              
              // Match patterns like "XX%", "Strong", "moderate", "weak", etc.
              const patterns = [
                { regex: /\b(strongest|stronger|Strongest|Stronger)\b/g, color: '#fd8789' },
                { regex: /\b(Strong|strong)\b/g, color: '#fd8789' },
                { regex: /\b(moderate|Moderate)\b/g, color: '#fbbf24' },
                { regex: /\b(weakest|weaker|Weakest|Weaker)\b/g, color: '#4cec8c' },
                { regex: /\b(weak|Weak)\b/g, color: '#4cec8c' },
                { regex: /([+-]?\d+\.?\d*)%/g, color: '#4cec8c' },
              ];
              
              // Find all matches in text without label
              const matches = [];
              patterns.forEach(({ regex, color }) => {
                let match;
                regex.lastIndex = 0;
                while ((match = regex.exec(textWithoutLabel)) !== null) {
                  matches.push({
                    index: match.index,
                    length: match[0].length,
                    text: match[0],
                    color
                  });
                }
              });
              
              // Sort matches by index
              matches.sort((a, b) => a.index - b.index);
              
              // Build formatted parts
              if (label) {
                parts.push(<strong key="label">{label}:</strong>);
                parts.push(' ');
              }
              
              matches.forEach((match) => {
                if (match.index > lastIndex) {
                  parts.push(textWithoutLabel.substring(lastIndex, match.index));
                }
                parts.push(
                  <strong key={`${match.index}-${match.text}`} style={{ color: match.color }}>
                    {match.text}
                  </strong>
                );
                lastIndex = match.index + match.length;
              });
              
              if (lastIndex < textWithoutLabel.length) {
                parts.push(textWithoutLabel.substring(lastIndex));
              }
              
              // If no matches found but we have a label, return formatted label + text
              if (matches.length === 0 && label) {
                return (
                  <>
                    <strong>{label}:</strong> {textWithoutLabel}
                  </>
                );
              }
              
              // If no matches and no label, return original text
              if (matches.length === 0 && !label) {
                return text;
              }
              
              return <>{parts}</>;
            };
            
            const dismissInsight = (insightId) => {
              setDismissedInsights(prev => {
                const updated = new Set([...prev, insightId]);
                try {
                  localStorage.setItem('dismissedAnalyticsInsights', JSON.stringify([...updated]));
                } catch (e) {
                  console.error('Failed to save dismissed insights:', e);
                }
                return updated;
              });
            };
            
            const isInsightDismissed = (insightId) => {
              return dismissedInsights.has(insightId);
            };
            
            // Add IDs to insights and filter dismissed ones
            const insightsWithIds = insights.slice(0, 4).map((insight, idx) => ({
              ...insight,
              id: `on-track-${idx}-${insight.text}` // Use text as unique ID
            })).filter(insight => !isInsightDismissed(insight.id));
            
            return insightsWithIds.length > 0 ? (
              <div style={{ 
                backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa', 
                border: `1px solid ${isDarkMode ? '#444' : '#e0e0e0'}`,
                borderRadius: '8px',
                padding: '16px 20px',
                marginBottom: '24px'
              }}>
                <h3 style={{ 
                  fontSize: '16px', 
                  fontWeight: 600, 
                  color: isDarkMode ? '#ffffff' : '#292929',
                  marginBottom: '12px'
                }}>
                  Key Insights
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {insightsWithIds.map((insight, idx) => (
                    <div
                      key={insight.id}
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
                        onClick={() => dismissInsight(insight.id)}
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
                      <span style={{ flex: 1 }}>{formatInsightText(insight)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* Actionable Metrics Summary */}
          <div className="historical-summary">
            {actionableMetrics && (
              <>
                <div className="summary-card">
                  <h4>Days Meeting Target</h4>
                  <div className="summary-value-large">
                    {actionableMetrics.daysMeetingTarget}
                  </div>
                  <div className="summary-subtext">of {chartData.length} days ({actionableMetrics.daysMeetingTargetPct}%)</div>
                </div>
                <div className="summary-card">
                  <h4>Current Streak</h4>
                  <div className="summary-value-large">
                    {actionableMetrics.currentStreak}
                  </div>
                  <div className="summary-subtext">consecutive days at 100%</div>
                </div>
                <div className="summary-card">
                  <h4>Best Streak</h4>
                  <div className="summary-value-large">
                    {actionableMetrics.bestStreak}
                  </div>
                  <div className="summary-subtext">consecutive days at 100%</div>
                </div>
                <div className="summary-card">
                  <h4>
                    Recent Trend
                    <InfoIcon 
                      isDarkMode={isDarkMode}
                      position="left"
                      content={
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>Recent Trend</div>
                          <div style={{ marginBottom: '6px' }}>
                            <strong>Calculation:</strong> Compares the average on-track percentage of the last 3 days against the previous 3 days (or last 2 days if fewer than 6 days of data).
                          </div>
                          <div style={{ marginBottom: '6px' }}>
                            <strong>Direction:</strong>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                              <li><strong>↑ Improving:</strong> Recent average is 2%+ higher than previous</li>
                              <li><strong>↓ Declining:</strong> Recent average is 2%+ lower than previous</li>
                              <li><strong>→ Stable:</strong> Change is within ±2%</li>
                            </ul>
                          </div>
                          <div>
                            This metric helps identify short-term performance trends and whether the team is improving or declining in recent days.
                          </div>
                        </div>
                      }
                    />
                  </h4>
                  <div className={`summary-value-large trend-indicator ${actionableMetrics.trendDirection}`}>
                    {actionableMetrics.trendDirection === 'improving' && '↑'}
                    {actionableMetrics.trendDirection === 'worsening' && '↓'}
                    {actionableMetrics.trendDirection === 'stable' && '→'}
                    {Math.abs(actionableMetrics.trendChange)}%
                  </div>
                  <div className="summary-subtext">
                    {actionableMetrics.trendDirection === 'improving' ? 'Improving' : actionableMetrics.trendDirection === 'worsening' ? 'Declining' : 'Stable'}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="chart-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 className="chart-title" style={{ margin: 0 }}>
                Team Daily On Track Percentage Trends
                <InfoIcon 
                  isDarkMode={isDarkMode}
                  content={
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>Team Daily On Track Trends</div>
                      <div style={{ marginBottom: '6px' }}>
                        <strong>Chart Elements:</strong>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          <li><strong>Solid lines:</strong> Daily on-track percentages</li>
                          <li><strong>Dashed lines:</strong> 3-day moving averages (smoothed trend)</li>
                          <li><strong>Gray dotted line:</strong> Target reference at 80%</li>
                        </ul>
                      </div>
                      <div style={{ marginBottom: '6px' }}>
                        <strong>Period Comparison:</strong> Click "Show Period Comparison" to see a side-by-side comparison of the first half vs. second half of your selected date range. This helps identify if performance is improving or declining over time.
                      </div>
                      <div>
                        <strong>How to read:</strong> Values above the 80% target line indicate good performance. The moving average lines help smooth out daily fluctuations to show the underlying trend.
                      </div>
                    </div>
                  }
                />
              </h3>
              <button
                onClick={() => setShowPeriodComparison(!showPeriodComparison)}
                style={{
                  background: showPeriodComparison ? '#35a1b4' : 'transparent',
                  color: showPeriodComparison ? 'white' : (isDarkMode ? '#ffffff' : '#292929'),
                  border: `1px solid #35a1b4`,
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {showPeriodComparison ? 'Hide' : 'Show'} Period Comparison
              </button>
            </div>
            {showPeriodComparison && periodComparison && (
              <div style={{ 
                marginBottom: '16px', 
                padding: '12px', 
                background: isDarkMode ? '#2a2a2a' : '#f8f9fa', 
                borderRadius: '6px',
                border: `1px solid ${isDarkMode ? '#444' : '#e0e0e0'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: isDarkMode ? '#999' : '#666', marginBottom: '4px' }}>Previous Period</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: isDarkMode ? '#ffffff' : '#292929' }}>
                      {periodComparison.previousPeriod.avg}%
                    </div>
                    <div style={{ fontSize: '10px', color: isDarkMode ? '#999' : '#666', marginTop: '2px' }}>
                      {periodComparison.previousPeriod.startDate} - {periodComparison.previousPeriod.endDate}
                    </div>
                    <div style={{ fontSize: '10px', color: isDarkMode ? '#999' : '#666' }}>
                      ({periodComparison.previousPeriod.days} days)
                    </div>
                  </div>
                  <div style={{ fontSize: '24px', color: '#35a1b4' }}>→</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: isDarkMode ? '#999' : '#666', marginBottom: '4px' }}>Current Period</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: isDarkMode ? '#ffffff' : '#292929' }}>
                      {periodComparison.currentPeriod.avg}%
                    </div>
                    <div style={{ fontSize: '10px', color: isDarkMode ? '#999' : '#666', marginTop: '2px' }}>
                      {periodComparison.currentPeriod.startDate} - {periodComparison.currentPeriod.endDate}
                    </div>
                    <div style={{ fontSize: '10px', color: isDarkMode ? '#999' : '#666' }}>
                      ({periodComparison.currentPeriod.days} days)
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginLeft: '16px' }}>
                    <div style={{ fontSize: '11px', color: isDarkMode ? '#999' : '#666', marginBottom: '4px' }}>Change</div>
                    <div className={`trend-indicator ${periodComparison.direction}`} style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                      {periodComparison.direction === 'improving' && '↑'}
                      {periodComparison.direction === 'worsening' && '↓'}
                      {periodComparison.direction === 'stable' && '→'}
                      {periodComparison.change > 0 ? '+' : ''}{periodComparison.change}%
                    </div>
                    <div style={{ fontSize: '10px', color: isDarkMode ? '#999' : '#666', marginTop: '4px' }}>
                      ({periodComparison.changePct > 0 ? '+' : ''}{periodComparison.changePct}%)
                    </div>
                  </div>
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartDataWithMovingAvg} margin={{ top: 70, right: 80, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                <XAxis 
                  dataKey="date" 
                  stroke={isDarkMode ? '#ffffff' : '#292929'}
                  tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                  tickFormatter={formatDateForChart}
                />
                <YAxis 
                  stroke={isDarkMode ? '#ffffff' : '#292929'}
                  tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                  domain={[0, 100]}
                  label={{ value: 'On Track %', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                    border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                    borderRadius: '4px',
                    color: isDarkMode ? '#e5e5e5' : '#292929'
                  }}
                  labelFormatter={formatDateForTooltip}
                  formatter={(value, name) => {
                    if (name.includes('Moving Avg')) return [`${value.toFixed(1)}%`, name];
                    return [`${value}%`, name];
                  }}
                />
                {/* Target Reference Line */}
                <ReferenceLine 
                  y={80} 
                  stroke="#999" 
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  label={{ value: "Target (80%)", position: "top", fill: isDarkMode ? '#999' : '#666', fontSize: 11, offset: 10 }}
                />
                {/* Overall On Track Line */}
                <Line 
                  type="monotone" 
                  dataKey="overallOnTrack" 
                  stroke="#4cec8c" 
                  strokeWidth={3}
                  dot={{ fill: '#4cec8c', r: 4 }}
                  name="Overall On Track"
                  label={createHolidayLabel(chartDataWithMovingAvg, false, 'overallOnTrack')}
                />
                {/* Overall Moving Average */}
                <Line 
                  type="monotone" 
                  dataKey="movingAvgOverall" 
                  stroke="#4cec8c" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Overall 3-Day Avg"
                />
                {/* Open On Track Line */}
                <Line 
                  type="monotone" 
                  dataKey="openOnTrack" 
                  stroke="#35a1b4" 
                  strokeWidth={2}
                  dot={{ fill: '#35a1b4', r: 3 }}
                  name="Open On Track"
                />
                {/* Open Moving Average */}
                <Line 
                  type="monotone" 
                  dataKey="movingAvgOpen" 
                  stroke="#35a1b4" 
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Open 3-Day Avg"
                />
                {/* Snoozed On Track Line */}
                <Line 
                  type="monotone" 
                  dataKey="snoozedOnTrack" 
                  stroke="#ff9a74" 
                  strokeWidth={2}
                  dot={{ fill: '#ff9a74', r: 3 }}
                  name="Snoozed On Track"
                />
                {/* Snoozed Moving Average */}
                <Line 
                  type="monotone" 
                  dataKey="movingAvgSnoozed" 
                  stroke="#ff9a74" 
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Snoozed 3-Day Avg"
                />
                <Legend 
                  wrapperStyle={{ color: isDarkMode ? '#ffffff' : '#292929' }}
                  content={({ payload }) => {
                    if (!payload) return null;
                    // Reorder payload: Overall 3-Day Avg, Overall On Track, Open 3-Day Avg, Open On Track, Snoozed 3-Day Avg, Snoozed On Track
                    const orderedPayload = [
                      payload.find(item => item.dataKey === 'movingAvgOverall'),
                      payload.find(item => item.dataKey === 'overallOnTrack'),
                      payload.find(item => item.dataKey === 'movingAvgOpen'),
                      payload.find(item => item.dataKey === 'openOnTrack'),
                      payload.find(item => item.dataKey === 'movingAvgSnoozed'),
                      payload.find(item => item.dataKey === 'snoozedOnTrack')
                    ].filter(Boolean);
                    
                    return (
                      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', padding: '10px 0' }}>
                        {orderedPayload.map((entry, index) => {
                          if (!entry) return null;
                          // Check if it's a dashed line (3-Day Avg lines)
                          const isDashed = entry.dataKey?.includes('movingAvg') || entry.dataKey === 'movingAvgOverall' || entry.dataKey === 'movingAvgOpen' || entry.dataKey === 'movingAvgSnoozed';
                          return (
                            <div key={`legend-item-${index}`} style={{ display: 'flex', alignItems: 'center', margin: '0 10px', cursor: 'pointer' }}>
                              <svg width="14" height="14" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                                <line
                                  x1="0"
                                  y1="7"
                                  x2="14"
                                  y2="7"
                                  stroke={entry.color}
                                  strokeWidth={isDashed ? 2 : 3}
                                  strokeDasharray={isDashed ? '5 5' : '0'}
                                />
                              </svg>
                              <span style={{ color: isDarkMode ? '#ffffff' : '#292929', fontSize: '12px' }}>
                                {entry.value}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Insights Section */}
          <div className="insights-section">
            {/* Trend Analysis & Best/Worst Days */}
            {trendAnalysis && bestWorstDays && (
              <div className="insights-row">
                <div className="summary-card trend-card">
                  <h4>
                    Trend Analysis
                    <InfoIcon 
                      isDarkMode={isDarkMode}
                      content={
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>Trend Analysis</div>
                          <div style={{ marginBottom: '6px' }}>
                            <strong>First Half vs Second Half:</strong> Compares the average on-track percentage of the first half of your selected date range against the second half.
                          </div>
                          <div style={{ marginBottom: '6px' }}>
                            <strong>Trend Direction:</strong>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                              <li><strong>↑ Improving:</strong> Second half average is 2%+ higher</li>
                              <li><strong>↓ Worsening:</strong> Second half average is 2%+ lower</li>
                              <li><strong>→ Stable:</strong> Change is within ±2%</li>
                            </ul>
                          </div>
                          <div style={{ marginBottom: '6px' }}>
                            <strong>Volatility:</strong> Measures how much the daily on-track percentages vary from the average. Calculated as standard deviation.
                            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                              <li><strong>Stable:</strong> ±0-5% variation (consistent performance)</li>
                              <li><strong>Moderate:</strong> ±5-10% variation (some fluctuation)</li>
                              <li><strong>Volatile:</strong> ±10%+ variation (high fluctuation)</li>
                            </ul>
                          </div>
                          <div style={{ marginBottom: '6px' }}>
                            <strong>Acceleration:</strong> Shows if the trend is speeding up or slowing down by comparing the rate of change per day in the first half vs. second half.
                          </div>
                          <div>
                            Lower volatility indicates more consistent performance, while acceleration helps identify if improvements or declines are happening faster over time.
                          </div>
                        </div>
                      }
                    />
                  </h4>
                  <div className="trend-content">
                    <div className="trend-comparison">
                      <div className="trend-period">
                        <span className="trend-label">First Half</span>
                        <span className="trend-value">{trendAnalysis.firstHalfAvg}%</span>
                      </div>
                      <div className="trend-arrow">→</div>
                      <div className="trend-period">
                        <span className="trend-label">Second Half</span>
                        <span className="trend-value">{trendAnalysis.secondHalfAvg}%</span>
                      </div>
                    </div>
                    <div className={`trend-indicator ${trendAnalysis.trend}`}>
                      {trendAnalysis.trend === 'improving' && '↑'}
                      {trendAnalysis.trend === 'worsening' && '↓'}
                      {trendAnalysis.trend === 'stable' && '→'}
                      {Math.abs(trendAnalysis.change)}% {trendAnalysis.trend === 'improving' ? 'improvement' : trendAnalysis.trend === 'worsening' ? 'decline' : 'stable'}
                    </div>
                    <div className="volatility-metric">
                      <span className="volatility-label">Volatility</span>
                      <span className="volatility-value">±{trendAnalysis.volatility}%</span>
                    </div>
                    {trendAcceleration && (
                      <div className="volatility-metric">
                        <span className="volatility-label">Acceleration</span>
                        <span className={`volatility-value ${trendAcceleration.status === 'accelerating' ? 'trend-indicator improving' : trendAcceleration.status === 'decelerating' ? 'trend-indicator worsening' : ''}`}>
                          {trendAcceleration.status === 'accelerating' && '↑'}
                          {trendAcceleration.status === 'decelerating' && '↓'}
                          {trendAcceleration.status === 'stable' && '→'}
                          {trendAcceleration.acceleration > 0 ? '+' : ''}{trendAcceleration.acceleration}% per day
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="summary-card best-worst-card">
                  <h4>Best Day</h4>
                  <div className="best-worst-content">
                    <div className="best-worst-date">{bestWorstDays.best.displayDate}</div>
                    <div className="best-worst-value">{bestWorstDays.best.overall}%</div>
                    <div className="best-worst-breakdown">
                      Open: {bestWorstDays.best.open}% | Snoozed: {bestWorstDays.best.snoozed}%
                    </div>
                  </div>
                </div>
                <div className="summary-card best-worst-card worst">
                  <h4>Worst Day</h4>
                  <div className="best-worst-content">
                    <div className="best-worst-date">{bestWorstDays.worst.displayDate}</div>
                    <div className="best-worst-value">{bestWorstDays.worst.overall}%</div>
                    <div className="best-worst-breakdown">
                      Open: {bestWorstDays.worst.open}% | Snoozed: {bestWorstDays.worst.snoozed}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Week-over-Week Comparison */}
            {weekOverWeekComparison && (
              <div className="insights-row">
                <div className="summary-card trend-card">
                  <h4>Week-over-Week Comparison</h4>
                  <div className="trend-content">
                    <div className="trend-comparison">
                      <div className="trend-period">
                        <span className="trend-label">Last Week</span>
                        <span className="trend-value">{weekOverWeekComparison.lastWeek}%</span>
                        <div style={{ fontSize: '10px', color: isDarkMode ? '#999' : '#666', marginTop: '4px' }}>
                          {weekOverWeekComparison.lastWeekDates.start} - {weekOverWeekComparison.lastWeekDates.end}
                        </div>
                      </div>
                      <div className="trend-arrow">→</div>
                      <div className="trend-period">
                        <span className="trend-label">This Week</span>
                        <span className="trend-value">{weekOverWeekComparison.thisWeek}%</span>
                        <div style={{ fontSize: '10px', color: isDarkMode ? '#999' : '#666', marginTop: '4px' }}>
                          {weekOverWeekComparison.thisWeekDates.start} - {weekOverWeekComparison.thisWeekDates.end}
                        </div>
                      </div>
                    </div>
                    <div className={`trend-indicator ${weekOverWeekComparison.direction}`}>
                      {weekOverWeekComparison.direction === 'improving' && '↑'}
                      {weekOverWeekComparison.direction === 'worsening' && '↓'}
                      {weekOverWeekComparison.direction === 'stable' && '→'}
                      {Math.abs(weekOverWeekComparison.change)}% ({weekOverWeekComparison.changePct > 0 ? '+' : ''}{weekOverWeekComparison.changePct}%)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Day-of-Week Analysis */}
            {dayOfWeekAnalysis && dayOfWeekAnalysis.length > 0 && (
              <div className="chart-container">
                <h3 className="chart-title">Day-of-Week On Track Patterns</h3>
                <p className="chart-subtitle">Average on-track by weekday</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dayOfWeekAnalysis} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                    <XAxis 
                      dataKey="day" 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                    />
                    <YAxis 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                      domain={[0, 100]}
                      label={{ value: 'On Track %', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                    border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                    borderRadius: '4px',
                    color: isDarkMode ? '#e5e5e5' : '#292929'
                  }}
                      formatter={(value, name) => {
                        const labelMap = {
                          'overallOnTrack': 'Overall On Track',
                          'openOnTrack': 'Open On Track',
                          'snoozedOnTrack': 'Snoozed On Track'
                        };
                        return [`${value}%`, labelMap[name] || name];
                      }}
                    />
                    <Legend wrapperStyle={{ color: isDarkMode ? '#ffffff' : '#292929' }} />
                    <Bar dataKey="overallOnTrack" fill="#4cec8c" name="Overall On Track" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="openOnTrack" fill="#35a1b4" name="Open On Track" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="snoozedOnTrack" fill="#ff9a74" name="Snoozed On Track" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Region Comparison */}
            {regionComparison && regionComparison.length > 0 && (
              <div className="chart-container">
                <h3 className="chart-title">Region Comparison</h3>
                <p className="chart-subtitle">Average on-track by region</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={regionComparison} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                    <XAxis 
                      dataKey="region" 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                    />
                    <YAxis 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                      domain={[0, 100]}
                      label={{ value: 'On Track %', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const region = payload[0].payload?.region || '';
                          const value = payload[0].value || 0;
                          return (
                            <div style={{ 
                              backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                              border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                              borderRadius: '4px',
                              padding: '8px 12px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? '#ffffff' : '#292929', marginBottom: '4px' }}>
                                {region}
                              </div>
                              <div style={{ fontSize: '12px', color: isDarkMode ? '#ffffff' : '#292929' }}>
                                {value}%
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      content={() => {
                        const regionColors = {
                          'UK': '#4cec8c',
                          'NY': '#35a1b4',
                          'SF': '#ff9a74'
                        };
                        return (
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            flexWrap: 'wrap', 
                            gap: '20px',
                            padding: '10px 0',
                            marginTop: '8px'
                          }}>
                            {regionComparison.map((entry) => (
                              <div 
                                key={entry.region}
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '6px'
                                }}
                              >
                                <div 
                                  style={{ 
                                    width: '16px', 
                                    height: '16px', 
                                    backgroundColor: regionColors[entry.region] || '#35a1b4',
                                    borderRadius: '2px',
                                    flexShrink: 0
                                  }} 
                                />
                                <span style={{ 
                                  color: isDarkMode ? '#ffffff' : '#292929', 
                                  fontSize: '12px',
                                  fontWeight: 500
                                }}>
                                  {entry.region}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="average" radius={[4, 4, 0, 0]}>
                      {regionComparison.map((entry, index) => {
                        const regionColors = {
                          'UK': '#4cec8c',
                          'NY': '#35a1b4',
                          'SF': '#ff9a74'
                        };
                        return <Cell key={`cell-${index}`} fill={regionColors[entry.region] || '#35a1b4'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

            {/* Distribution Histogram */}
            {distributionData && distributionData.length > 0 && (
              <div className="chart-container">
                <h3 className="chart-title">On Track Distribution</h3>
                <p className="chart-subtitle">Number of days in each percentage range</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={distributionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                    <XAxis 
                      dataKey="range" 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                    />
                    <YAxis 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                      label={{ value: 'Number of Days', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                        border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                        borderRadius: '4px',
                        color: isDarkMode ? '#e5e5e5' : '#292929'
                      }}
                      itemStyle={{ color: isDarkMode ? '#e5e5e5' : '#292929' }}
                      labelStyle={{ color: isDarkMode ? '#ffffff' : '#292929', fontWeight: 600 }}
                      formatter={(value, name) => {
                        if (name === 'count') {
                          return [value, 'Days'];
                        }
                        return [value, name];
                      }}
                      labelFormatter={(label) => `Range: ${label}`}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {distributionData.map((entry, index) => {
                        const colors = {
                          '0-50%': '#fd8789',
                          '50-75%': '#ff9a74',
                          '75-90%': '#35a1b4',
                          '90-100%': '#4cec8c',
                          '100%': '#4cec8c'
                        };
                        return <Cell key={`cell-${index}`} fill={colors[entry.range] || '#35a1b4'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

          {/* Average Chats Visualization */}
          {averageChatsData.daily.length > 0 && (
            <div className="chart-container" style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 className="chart-title" style={{ marginBottom: '4px' }}>Average Chats per TSE</h3>
                  <p className="chart-subtitle">Open chats and actionable snoozed chats over time</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', color: isDarkMode ? '#e5e5e5' : '#666', fontWeight: 500 }}>Time Period:</label>
                    <select
                      value={timePeriod}
                      onChange={(e) => setTimePeriod(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                        backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
                        color: isDarkMode ? '#ffffff' : '#292929',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={{ fontSize: '13px', color: isDarkMode ? '#e5e5e5' : '#666', fontWeight: 500 }}>View:</label>
                    <select
                      value={viewType}
                      onChange={(e) => setViewType(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                        backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
                        color: isDarkMode ? '#ffffff' : '#292929',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="all">All Teams</option>
                      <option value="by-region">By Region</option>
                      <option value="by-team">By Team</option>
                      <option value="by-tse">By TSE</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* All Teams View */}
              {viewType === 'all' && (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart 
                    data={aggregateByTimePeriod(averageChatsData.daily, timePeriod)} 
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                    <XAxis 
                      dataKey="date" 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                      tickFormatter={formatDateForChart}
                    />
                    <YAxis 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                      label={{ value: 'Average Chats', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                        border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        color: isDarkMode ? '#e5e5e5' : '#292929'
                      }}
                      labelFormatter={formatDateForTooltip}
                      formatter={(value, name) => {
                        const labels = {
                          'avgOpen': 'Open Chats',
                          'avgActionableSnoozed': 'Actionable Snoozed'
                        };
                        return [`${value.toFixed(1)}`, labels[name] || name];
                      }}
                    />
                    <ReferenceLine 
                      y={5} 
                      stroke="#999" 
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      label={{ value: "Target (5)", position: "top", fill: isDarkMode ? '#999' : '#666', fontSize: 11, offset: 10 }}
                    />
                    <Legend 
                      wrapperStyle={{ color: isDarkMode ? '#ffffff' : '#292929', paddingTop: '20px' }}
                      iconType="line"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="avgOpen" 
                      stroke="#35a1b4" 
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#35a1b4' }}
                      activeDot={{ r: 6 }}
                      name="Open Chats"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="avgActionableSnoozed" 
                      stroke="#ff9a74" 
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#ff9a74' }}
                      activeDot={{ r: 6 }}
                      name="Actionable Snoozed"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* By Region View */}
              {viewType === 'by-region' && regionChartData.length > 0 && (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={regionChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                    <XAxis 
                      dataKey="date" 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                      tickFormatter={formatDateForChart}
                    />
                    <YAxis 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                      label={{ value: 'Average Chats', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                        border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        color: isDarkMode ? '#e5e5e5' : '#292929'
                      }}
                      labelFormatter={formatDateForTooltip}
                      formatter={(value, name) => {
                        if (!value) return [null, null];
                        return [`${value.toFixed(1)}`, name.replace('_', ' - ')];
                      }}
                    />
                    <ReferenceLine 
                      y={5} 
                      stroke="#999" 
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      label={{ value: "Target (5)", position: "top", fill: isDarkMode ? '#999' : '#666', fontSize: 11, offset: 10 }}
                    />
                    <Legend 
                      wrapperStyle={{ color: isDarkMode ? '#ffffff' : '#292929', paddingTop: '20px' }}
                      iconType="line"
                    />
                    {Object.keys(averageChatsData.byRegion).map((region) => {
                      const regionColors = {
                        'UK': '#4cec8c',
                        'NY': '#35a1b4',
                        'SF': '#ff9a74',
                        'Other': '#9dd866'
                      };
                      const color = regionColors[region] || '#35a1b4';
                      return (
                        <React.Fragment key={region}>
                          <Line 
                            type="monotone" 
                            dataKey={`${region}_open`} 
                            stroke={color} 
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                            name={`${region} - Open`}
                            connectNulls
                          />
                          <Line 
                            type="monotone" 
                            dataKey={`${region}_snoozed`} 
                            stroke={color} 
                            strokeWidth={2.5}
                            strokeDasharray="5 5"
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                            name={`${region} - Snoozed`}
                            connectNulls
                          />
                        </React.Fragment>
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* By Team View */}
              {viewType === 'by-team' && teamChartData.length > 0 && (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={teamChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                    <XAxis 
                      dataKey="date" 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                      tickFormatter={formatDateForChart}
                    />
                    <YAxis 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                      label={{ value: 'Average Chats', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                        border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        color: isDarkMode ? '#e5e5e5' : '#292929'
                      }}
                      labelFormatter={formatDateForTooltip}
                      formatter={(value, name) => {
                        if (!value) return [null, null];
                        return [`${value.toFixed(1)}`, name.replace('_', ' - ')];
                      }}
                    />
                    <ReferenceLine 
                      y={5} 
                      stroke="#999" 
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      label={{ value: "Target (5)", position: "top", fill: isDarkMode ? '#999' : '#666', fontSize: 11, offset: 10 }}
                    />
                    <Legend 
                      wrapperStyle={{ color: isDarkMode ? '#ffffff' : '#292929', paddingTop: '20px' }}
                      iconType="line"
                    />
                    {Object.keys(averageChatsData.byTeam).map((team) => {
                      return (
                        <React.Fragment key={team}>
                          <Line 
                            type="monotone" 
                            dataKey={`${team}_open`} 
                            stroke="#35a1b4" 
                            strokeWidth={2.5}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                            name={`${team} - Open`}
                            connectNulls
                          />
                          <Line 
                            type="monotone" 
                            dataKey={`${team}_snoozed`} 
                            stroke="#ff9a74" 
                            strokeWidth={2.5}
                            strokeDasharray="5 5"
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                            name={`${team} - Snoozed`}
                            connectNulls
                          />
                        </React.Fragment>
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* By TSE View - Show top 10 TSEs */}
              {viewType === 'by-tse' && tseChartData.length > 0 && (
                <div>
                  <ResponsiveContainer width="100%" height={500}>
                    <LineChart data={tseChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                      <XAxis 
                        dataKey="date" 
                        stroke={isDarkMode ? '#ffffff' : '#292929'}
                        tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                        tickFormatter={formatDateForChart}
                      />
                      <YAxis 
                        stroke={isDarkMode ? '#ffffff' : '#292929'}
                        tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                        label={{ value: 'Average Chats', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                          border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          color: isDarkMode ? '#e5e5e5' : '#292929'
                        }}
                        labelFormatter={formatDateForTooltip}
                        formatter={(value, name) => {
                          if (!value) return [null, null];
                          const parts = name.split('_');
                          const tseId = parts[0];
                          const metric = parts[1];
                          const tseName = averageChatsData.byTSE[tseId]?.name || tseId;
                          return [`${value.toFixed(1)}`, `${tseName} - ${metric === 'open' ? 'Open' : 'Snoozed'}`];
                        }}
                      />
                      <ReferenceLine 
                        y={5} 
                        stroke="#999" 
                        strokeWidth={2}
                        strokeDasharray="2 2"
                        label={{ value: "Target (5)", position: "top", fill: isDarkMode ? '#999' : '#666', fontSize: 11, offset: 10 }}
                      />
                      <Legend 
                        wrapperStyle={{ color: isDarkMode ? '#ffffff' : '#292929', paddingTop: '20px' }}
                        iconType="line"
                      />
                      {Object.keys(averageChatsData.byTSE).slice(0, 10).map((tseId) => {
                        const tseData = averageChatsData.byTSE[tseId];
                        const colors = ['#35a1b4', '#ff9a74', '#4cec8c', '#9dd866', '#ffd93d', '#fd8789', '#ff6b6b', '#a855f7', '#ec4899', '#06b6d4'];
                        const colorIdx = parseInt(tseId) % colors.length;
                        const color = colors[colorIdx];
                        return (
                          <React.Fragment key={tseId}>
                            <Line 
                              type="monotone" 
                              dataKey={`${tseId}_open`} 
                              stroke={color} 
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4 }}
                              name={`${tseData.name} - Open`}
                              connectNulls
                            />
                            <Line 
                              type="monotone" 
                              dataKey={`${tseId}_snoozed`} 
                              stroke={color} 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={false}
                              activeDot={{ r: 4 }}
                              name={`${tseData.name} - Snoozed`}
                              connectNulls
                            />
                          </React.Fragment>
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          <div className="historical-table-section">
            <h3 className="section-title">
              Historical On Track Data
              {lastSnapshotTimestamp && (
                <span className="last-snapshot-timestamp"> - Last Snapshot taken {formatTimestamp(lastSnapshotTimestamp)}</span>
              )}
            </h3>
            <div className="table-container">
              <table className="historical-table grouped-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleOnTrackSort('date')}
                    >
                      Date
                      {onTrackSortConfig.key === 'date' && (
                        <span className="sort-indicator">
                          {onTrackSortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                        </span>
                      )}
                    </th>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleOnTrackSort('tse')}
                    >
                      TSEs
                      {onTrackSortConfig.key === 'tse' && (
                        <span className="sort-indicator">
                          {onTrackSortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                        </span>
                      )}
                    </th>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleOnTrackSort('openOnTrack')}
                    >
                      Open On Track
                      {onTrackSortConfig.key === 'openOnTrack' && (
                        <span className="sort-indicator">
                          {onTrackSortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                        </span>
                      )}
                    </th>
                    <th>Avg Open Chats Per TSE</th>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleOnTrackSort('snoozedOnTrack')}
                    >
                      Actionable Snoozed On Track
                      {onTrackSortConfig.key === 'snoozedOnTrack' && (
                        <span className="sort-indicator">
                          {onTrackSortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                        </span>
                      )}
                    </th>
                    <th>Avg Actionable Snoozed</th>
                    <th 
                      className="sortable-header" 
                      onClick={() => handleOnTrackSort('overallOnTrack')}
                      title="Percentage of TSEs meeting BOTH criteria (open ≤ 5 AND actionable snoozed ≤ 5). This is not an average of the two percentages, but rather the intersection of TSEs meeting both requirements simultaneously."
                    >
                      Overall On Track
                      {onTrackSortConfig.key === 'overallOnTrack' && (
                        <span className="sort-indicator">
                          {onTrackSortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                        </span>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTableData.map((dateGroup) => {
                    const isExpanded = expandedDates.has(dateGroup.date);
                    const openOnTrackPct = dateGroup.totalTSEs > 0 
                      ? Math.round((dateGroup.onTrackOpen / dateGroup.totalTSEs) * 100) 
                      : 0;
                    const snoozedOnTrackPct = dateGroup.totalTSEs > 0 
                      ? Math.round((dateGroup.onTrackSnoozed / dateGroup.totalTSEs) * 100) 
                      : 0;
                    const overallOnTrackPct = dateGroup.totalTSEs > 0 
                      ? Math.round((dateGroup.onTrackBoth / dateGroup.totalTSEs) * 100) 
                      : 0;
                    const avgOpenChats = dateGroup.totalTSEs > 0 
                      ? Math.round((dateGroup.totalOpen / dateGroup.totalTSEs) * 10) / 10 
                      : 0;
                    const avgActionableSnoozed = dateGroup.totalTSEs > 0 
                      ? Math.round((dateGroup.totalActionableSnoozed / dateGroup.totalTSEs) * 10) / 10 
                      : 0;

                    return (
                      <React.Fragment key={dateGroup.date}>
                        <tr 
                          className="date-group-header"
                          onClick={() => toggleDate(dateGroup.date)}
                        >
                          <td className="expand-icon">
                            {isExpanded ? '▼' : '▶'}
                          </td>
                          <td className="date-cell">
                            <strong>{formatDateUTC(dateGroup.date)}</strong>
                          </td>
                          <td>{dateGroup.totalTSEs}</td>
                          <td>
                            <span className={`on-track-percentage ${openOnTrackPct === 100 ? 'on-track' : ''}`}>
                              {openOnTrackPct}%
                            </span>
                          </td>
                          <td>{avgOpenChats.toFixed(1)}</td>
                          <td>
                            <span className={`on-track-percentage ${snoozedOnTrackPct === 100 ? 'on-track' : ''}`}>
                              {snoozedOnTrackPct}%
                            </span>
                          </td>
                          <td>{avgActionableSnoozed.toFixed(1)}</td>
                          <td>
                            <span className={`on-track-percentage ${overallOnTrackPct === 100 ? 'on-track' : ''}`}>
                              {overallOnTrackPct}%
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <>
                            {/* Team Averages Row */}
                            {dateGroup.regionAverages && Object.keys(dateGroup.regionAverages).length > 0 && (
                              <tr className="team-averages-row">
                                <td colSpan="6">
                                  <div style={{ 
                                    padding: '12px 16px', 
                                    backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5',
                                    borderTop: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                                    borderBottom: `1px solid ${isDarkMode ? '#444' : '#ddd'}`
                                  }}>
                                    <div style={{ 
                                      fontWeight: 600, 
                                      marginBottom: '12px', 
                                      fontSize: '13px',
                                      color: isDarkMode ? '#ffffff' : '#292929'
                                    }}>
                                      Team (Region) Averages
                                    </div>
                                    <div style={{ 
                                      display: 'grid', 
                                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                                      gap: '16px' 
                                    }}>
                                      {Object.keys(dateGroup.regionAverages).sort().map(region => {
                                        const avg = dateGroup.regionAverages[region];
                                        return (
                                          <div key={region} style={{
                                            padding: '8px 12px',
                                            backgroundColor: isDarkMode ? '#1e1e1e' : 'white',
                                            borderRadius: '6px',
                                            border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`
                                          }}>
                                            <div style={{ 
                                              fontWeight: 600, 
                                              fontSize: '12px', 
                                              marginBottom: '6px',
                                              color: isDarkMode ? '#ffffff' : '#292929'
                                            }}>
                                              {region}
                                            </div>
                                            <div style={{ fontSize: '11px', color: isDarkMode ? '#b0b0b0' : '#666', lineHeight: '1.6' }}>
                                              <div>TSEs: {avg.totalTSEs}</div>
                                              <div>Open On Track: <strong style={{ color: isDarkMode ? '#ffffff' : '#292929' }}>{avg.openOnTrack}%</strong></div>
                                              <div>Snoozed On Track: <strong style={{ color: isDarkMode ? '#ffffff' : '#292929' }}>{avg.snoozedOnTrack}%</strong></div>
                                              <div>Overall On Track: <strong style={{ color: isDarkMode ? '#ffffff' : '#292929' }}>{avg.overallOnTrack}%</strong></div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div style={{ 
                                      marginTop: '12px', 
                                      fontSize: '11px', 
                                      color: isDarkMode ? '#999' : '#666',
                                      fontStyle: 'italic',
                                      lineHeight: '1.5'
                                    }}>
                                      <strong>Note:</strong> Overall On Track is the percentage of TSEs meeting BOTH criteria simultaneously (open ≤ 5 AND actionable snoozed ≤ 5), not an average of the two percentages. This is why it can be lower than the individual percentages.
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                            <tr className="tse-header-row">
                              <td colSpan="8">
                                <table className="nested-tse-table">
                                  <thead>
                                    <tr>
                                      <th>TSE</th>
                                      <th>Open</th>
                                      <th>Snoozed - Waiting On TSE</th>
                                      <th>Snoozed - Waiting On Customer</th>
                                      <th>Total Snoozed</th>
                                      <th>Open On Track</th>
                                      <th>Snoozed On Track</th>
                                      <th>Overall On Track</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dateGroup.tses.map((tse, idx) => (
                                      <tr key={`${dateGroup.date}-${tse.tseName}-${idx}`}>
                                        <td>{tse.tseName}</td>
                                        <td>{tse.open}</td>
                                        <td>{tse.actionableSnoozed}</td>
                                        <td>{tse.customerWaitSnoozed}</td>
                                        <td>{tse.totalSnoozed}</td>
                                        <td>
                                          <span className={tse.openOnTrack ? "on-track-badge on-track" : "on-track-badge over-limit"}>
                                            {tse.openOnTrack ? "✓" : "✗"}
                                          </span>
                                        </td>
                                        <td>
                                          <span className={tse.snoozedOnTrack ? "on-track-badge on-track" : "on-track-badge over-limit"}>
                                            {tse.snoozedOnTrack ? "✓" : "✗"}
                                          </span>
                                        </td>
                                        <td>
                                          {(() => {
                                            const tooltipKey = `${dateGroup.date}-${tse.tseName}`;
                                            const isClicked = clickedTooltip === tooltipKey;
                                            // Calculate snoozedForOnTrack for display
                                            const snoozedForOnTrack = tse.snoozedForOnTrack !== undefined 
                                              ? tse.snoozedForOnTrack 
                                              : (tse.totalSnoozed || 0) - (tse.customerWaitSnoozed || 0);
                                            const displaySnoozed = snoozedForOnTrack >= 0 ? snoozedForOnTrack : (tse.actionableSnoozed || 0);
                                            
                                            const tooltipText = tse.exceedsTargets
                                              ? `Outstanding - Open: ${tse.open} (target: ≤${THRESHOLDS.MAX_OPEN_SOFT}), Snoozed (excl. customer): ${displaySnoozed} (target: ≤${THRESHOLDS.MAX_ACTIONABLE_SNOOZED_SOFT})`
                                              : tse.overallOnTrack
                                              ? `On Track - Open: ${tse.open} (target: ≤${THRESHOLDS.MAX_OPEN_SOFT}), Snoozed (excl. customer): ${displaySnoozed} (target: ≤${THRESHOLDS.MAX_ACTIONABLE_SNOOZED_SOFT})`
                                              : `Over Limit - Needs Attention - Open: ${tse.open} (target: ≤${THRESHOLDS.MAX_OPEN_SOFT}), Snoozed (excl. customer): ${displaySnoozed} (target: ≤${THRESHOLDS.MAX_ACTIONABLE_SNOOZED_SOFT})`;
                                            
                                            return (
                                              <div style={{ position: 'relative', display: 'inline-block' }}>
                                                {tse.exceedsTargets ? (
                                                  <span 
                                                    className="on-track-badge exceeds-targets clickable-badge" 
                                                    title={tooltipText}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setClickedTooltip(isClicked ? null : tooltipKey);
                                                    }}
                                                  >
                                                    ⭐
                                                  </span>
                                                ) : (
                                                  <span 
                                                    className={`on-track-badge ${tse.overallOnTrack ? 'on-track' : 'over-limit'} clickable-badge`}
                                                    title={tooltipText}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setClickedTooltip(isClicked ? null : tooltipKey);
                                                    }}
                                                  >
                                                    {tse.overallOnTrack ? "✓" : "✗"}
                                                  </span>
                                                )}
                                                {isClicked && (
                                                  <div className="tooltip-popup">
                                                    <div className="tooltip-content">
                                                      <div className="tooltip-header">
                                                        <span className="tooltip-title">{tse.exceedsTargets ? 'Outstanding' : tse.overallOnTrack ? 'On Track' : 'Over Limit - Needs Attention'}</span>
                                                        <button 
                                                          className="tooltip-close"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            setClickedTooltip(null);
                                                          }}
                                                        >
                                                          ×
                                                        </button>
                                                      </div>
                                                      <div className="tooltip-body">
                                                        <div className="tooltip-metric">
                                                          <strong>Open:</strong> {tse.open} (target: ≤{THRESHOLDS.MAX_OPEN_SOFT})
                                                        </div>
                                                        <div className="tooltip-metric">
                                                          <strong>Snoozed (excl. customer):</strong> {(() => {
                                                            const snoozedForOnTrack = tse.snoozedForOnTrack !== undefined 
                                                              ? tse.snoozedForOnTrack 
                                                              : (tse.totalSnoozed || 0) - (tse.customerWaitSnoozed || 0);
                                                            return snoozedForOnTrack >= 0 ? snoozedForOnTrack : (tse.actionableSnoozed || 0);
                                                          })()} (target: ≤{THRESHOLDS.MAX_ACTIONABLE_SNOOZED_SOFT})
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })()}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              {groupedTableData.length < onTrackTotalDays && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <button 
                    className="load-more-button"
                    onClick={() => setOnTrackDaysToShow(prev => prev + 7)}
                  >
                    Load More ({onTrackTotalDays - groupedTableData.length} more days)
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

          {!loading && chartData.length === 0 && (
            <div className="no-data">
              <p>No historical data available for the selected date range.</p>
              <p>Snapshots are automatically taken at 10pm ET on weekdays.</p>
            </div>
          )}
        </>
      )}

      {/* Response Time Metrics Tab */}
      {activeTab === 'response-time' && (
        <>
          <div className="cron-info-banner">
            <span className="cron-info-icon">⏰</span>
            <span className="cron-info-text">
              Response time data is automatically collected nightly after all shifts have completed, analyzing metrics from the most recently completed business day.
            </span>
          </div>
          {loadingMetrics && (
            <div className="loading-state">Loading response time metrics...</div>
          )}

          {!loadingMetrics && responseTimeChartData.length > 0 && (
            <>
              {/* Key Insights Section */}
              {(() => {
                const insights = [];
                
                // 10+ min breakdown
                if (responseTimeSummary.avgPercentage10Plus > WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN) {
                  insights.push({
                    type: 'warning',
                    text: `${responseTimeSummary.avgPercentage10Plus}% average 10+ min wait rate - exceeds target (target: ${WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}%)`
                  });
                } else if (responseTimeSummary.avgPercentage10Plus === WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN) {
                  insights.push({
                    type: 'positive',
                    text: `${responseTimeSummary.avgPercentage10Plus}% average 10+ min wait rate - within target (target: ${WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}%)`
                  });
                }
                
                // 5-10 min breakdown
                if (responseTimeSummary.avgPercentage5to10 !== undefined) {
                  if (responseTimeSummary.avgPercentage5to10 > WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN) {
                    insights.push({
                      type: 'warning',
                      text: `${responseTimeSummary.avgPercentage5to10.toFixed(1)}% average 5-10 min wait rate - exceeds target (target: ≤${WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}%)`
                    });
                  } else {
                    insights.push({
                      type: 'positive',
                      text: `${responseTimeSummary.avgPercentage5to10.toFixed(1)}% average 5-10 min wait rate - within target (target: ≤${WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}%)`
                    });
                  }
                }
                
                // Recent trend
                if (responseTimeSummary.recentTrendDirection === 'improving' && responseTimeSummary.recentTrendChange >= 2) {
                  insights.push({
                    type: 'positive',
                    text: `Recent improvement: ${responseTimeSummary.recentTrendChange.toFixed(1)}% reduction in wait rate over recent period`
                  });
                } else if (responseTimeSummary.recentTrendDirection === 'worsening' && responseTimeSummary.recentTrendChange >= 2) {
                  insights.push({
                    type: 'warning',
                    text: `Recent decline: ${responseTimeSummary.recentTrendChange.toFixed(1)}% increase in wait rate over recent period`
                  });
                }
                
                // Overall trend
                if (responseTimeSummary.trend === 'improving' && responseTimeSummary.change >= 2) {
                  insights.push({
                    type: 'positive',
                    text: `Overall improving trend: ${responseTimeSummary.change.toFixed(1)}% reduction compared to previous period`
                  });
                } else if (responseTimeSummary.trend === 'worsening' && responseTimeSummary.change >= 2) {
                  insights.push({
                    type: 'warning',
                    text: `Overall declining trend: ${responseTimeSummary.change.toFixed(1)}% increase compared to previous period`
                  });
                }
                
                // Volume insights
                if (responseTimeSummary.totalCount5Plus > 0) {
                  const totalConversations = responseTimeChartData.reduce((sum, d) => sum + (d.totalConversations || 0), 0);
                  const waitRate = totalConversations > 0 ? Math.round((responseTimeSummary.totalCount5Plus / totalConversations) * 100) : 0;
                  if (waitRate <= 5 && totalConversations > 50) {
                    insights.push({
                      type: 'positive',
                      text: `Strong performance at scale: ${responseTimeSummary.totalCount5Plus} of ${totalConversations} conversations (${waitRate}%) had 5+ min waits`
                    });
                  }
                }
                
                // Format insight text function
                const formatInsightText = (insight) => {
                  const text = insight.text;
                  const parts = [];
                  let lastIndex = 0;
                  
                  // Try to extract label if text starts with common labels
                  const labelMatch = text.match(/^(Excellent performance|Performance below target|Strong current streak|No current streak|Performance improving|Performance declining|Best streak achieved|Strong average performance|Average performance below target|Recent improvement|Recent decline|Overall improving trend|Overall declining trend|Strong performance at scale):/);
                  let label = null;
                  let textWithoutLabel = text;
                  
                  if (labelMatch) {
                    label = labelMatch[1];
                    textWithoutLabel = text.substring(label.length + 1).trim();
                  }
                  
                  // Match patterns like "XX%", "Strong", "moderate", "weak", etc.
                  const patterns = [
                    { regex: /\b(strongest|stronger|Strongest|Stronger)\b/g, color: '#fd8789' },
                    { regex: /\b(Strong|strong)\b/g, color: '#fd8789' },
                    { regex: /\b(moderate|Moderate)\b/g, color: '#fbbf24' },
                    { regex: /\b(weakest|weaker|Weakest|Weaker)\b/g, color: '#4cec8c' },
                    { regex: /\b(weak|Weak)\b/g, color: '#4cec8c' },
                    { regex: /([+-]?\d+\.?\d*)%/g, color: '#4cec8c' },
                  ];
                  
                  // Find all matches in text without label
                  const matches = [];
                  patterns.forEach(({ regex, color }) => {
                    let match;
                    regex.lastIndex = 0;
                    while ((match = regex.exec(textWithoutLabel)) !== null) {
                      matches.push({
                        index: match.index,
                        length: match[0].length,
                        text: match[0],
                        color
                      });
                    }
                  });
                  
                  // Sort matches by index
                  matches.sort((a, b) => a.index - b.index);
                  
                  // Build formatted parts
                  if (label) {
                    parts.push(<strong key="label">{label}:</strong>);
                    parts.push(' ');
                  }
                  
                  matches.forEach((match) => {
                    if (match.index > lastIndex) {
                      parts.push(textWithoutLabel.substring(lastIndex, match.index));
                    }
                    parts.push(
                      <strong key={`${match.index}-${match.text}`} style={{ color: match.color }}>
                        {match.text}
                      </strong>
                    );
                    lastIndex = match.index + match.length;
                  });
                  
                  if (lastIndex < textWithoutLabel.length) {
                    parts.push(textWithoutLabel.substring(lastIndex));
                  }
                  
                  // If no matches found but we have a label, return formatted label + text
                  if (matches.length === 0 && label) {
                    return (
                      <>
                        <strong>{label}:</strong> {textWithoutLabel}
                      </>
                    );
                  }
                  
                  // If no matches and no label, return original text
                  if (matches.length === 0 && !label) {
                    return text;
                  }
                  
                  return <>{parts}</>;
                };
                
                const dismissInsight = (insightId) => {
                  setDismissedInsights(prev => {
                    const updated = new Set([...prev, insightId]);
                    try {
                      localStorage.setItem('dismissedAnalyticsInsights', JSON.stringify([...updated]));
                    } catch (e) {
                      console.error('Failed to save dismissed insights:', e);
                    }
                    return updated;
                  });
                };
                
                const isInsightDismissed = (insightId) => {
                  return dismissedInsights.has(insightId);
                };
                
                // Add IDs to insights and filter dismissed ones
                const insightsWithIds = insights.slice(0, 4).map((insight, idx) => ({
                  ...insight,
                  id: `response-time-${idx}-${insight.text}` // Use text as unique ID
                })).filter(insight => !isInsightDismissed(insight.id));
                
                return insightsWithIds.length > 0 ? (
                  <div style={{ 
                    backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa', 
                    border: `1px solid ${isDarkMode ? '#444' : '#e0e0e0'}`,
                    borderRadius: '8px',
                    padding: '16px 20px',
                    marginBottom: '24px'
                  }}>
                    <h3 style={{ 
                      fontSize: '16px', 
                      fontWeight: 600, 
                      color: isDarkMode ? '#ffffff' : '#292929',
                      marginBottom: '12px'
                    }}>
                      Key Insights
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {insightsWithIds.map((insight, idx) => (
                        <div
                          key={insight.id}
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
                            onClick={() => dismissInsight(insight.id)}
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
                          <span style={{ flex: 1 }}>{formatInsightText(insight)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Summary Cards */}
              <div className="response-time-summary">
                <div className="summary-card">
                  <h4>
                    Recent Trend
                    <InfoIcon 
                      isDarkMode={isDarkMode}
                      position="right"
                      content={
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>Recent Trend</div>
                          <div style={{ marginBottom: '6px' }}>
                            <strong>Calculation:</strong> Compares the average wait time percentage of the last 3 days against the previous 3 days (or last 2 days if fewer than 6 days of data).
                          </div>
                          <div style={{ marginBottom: '6px' }}>
                            <strong>Direction:</strong>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                              <li><strong>↓ Improving:</strong> Recent average is 2%+ lower than previous (fewer waits)</li>
                              <li><strong>↑ Worsening:</strong> Recent average is 2%+ higher than previous (more waits)</li>
                              <li><strong>→ Stable:</strong> Change is within ±2%</li>
                            </ul>
                          </div>
                          <div>
                            This metric helps identify short-term performance trends and whether response times are improving or declining in recent days.
                          </div>
                        </div>
                      }
                    />
                  </h4>
                  <div className={`summary-value-large trend-indicator ${responseTimeSummary.recentTrendDirection}`}>
                    {responseTimeSummary.recentTrendDirection === 'improving' && '↓'}
                    {responseTimeSummary.recentTrendDirection === 'worsening' && '↑'}
                    {responseTimeSummary.recentTrendDirection === 'stable' && '→'}
                    {' '}
                    {Math.abs(responseTimeSummary.recentTrendChange)}%
                  </div>
                  <div className="summary-subtext">
                    {responseTimeSummary.recentTrendDirection === 'improving' ? 'Improving' : responseTimeSummary.recentTrendDirection === 'worsening' ? 'Worsening' : 'Stable'}
                  </div>
                </div>
                <div className="summary-card">
                  <h4>
                    Avg % Wait Time
                    <InfoIcon 
                      isDarkMode={isDarkMode} 
                      position="right"
                      content={
                        <div style={{ textAlign: 'left' }}>
                          <p><strong>Calculation:</strong> Average percentage of conversations that waited 5+ minutes for a first response, calculated across all days in the selected date range.</p>
                          <p><strong>Breakdown:</strong> Shows the average percentage for 5-10 minute waits (orange) and 10+ minute waits (red) separately.</p>
                          <p><strong>Trend:</strong> Compares the most recent 7 days vs the previous 7 days to show if wait times are improving (↓), worsening (↑), or stable (→).</p>
                        </div>
                      }
                    />
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 700 }}>{responseTimeSummary.avgPercentage5Plus || 0}%</span>
                    <span style={{ fontSize: '14px', color: isDarkMode ? '#b0b0b0' : '#666' }}>5+ min</span>
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '13px', color: isDarkMode ? '#cccccc' : '#666' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>5-10 min:</span>
                      <span style={{ fontWeight: 600, color: '#ff9a74' }}>{responseTimeSummary.avgPercentage5to10 || 0}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>10+ min:</span>
                      <span style={{ fontWeight: 600, color: '#fd8789' }}>{responseTimeSummary.avgPercentage10Plus || 0}%</span>
                    </div>
                  </div>
                  {responseTimeSummary.trend !== 'no-data' && (
                    <>
                      <div className={`trend-indicator ${responseTimeSummary.trend}`} style={{ marginTop: '12px' }}>
                        Trending:{' '}
                        {responseTimeSummary.trend === 'improving' && '↓'}
                        {responseTimeSummary.trend === 'worsening' && '↑'}
                        {responseTimeSummary.trend === 'stable' && '→'}
                        {' '}
                        {Math.abs(responseTimeSummary.change)}% {responseTimeSummary.trend === 'improving' ? 'improvement' : responseTimeSummary.trend === 'worsening' ? 'increase' : 'no change'}
                      </div>
                      {responseTimeSummary.comparisonText && (
                        <div style={{ fontSize: '11px', color: isDarkMode ? '#b0b0b0' : '#666', marginTop: '4px', fontStyle: 'italic' }}>
                          {responseTimeSummary.comparisonText}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="summary-card">
                  <h4>
                    Total Waits
                    <InfoIcon 
                      isDarkMode={isDarkMode} 
                      position="left"
                      content={
                        <div style={{ textAlign: 'left' }}>
                          <p><strong>Calculation:</strong> Total count of conversations that waited 5+ minutes for a first response, summed across all days in the selected date range.</p>
                          <p><strong>Breakdown:</strong> Shows the total count for 5-10 minute waits (orange) and 10+ minute waits (red) separately.</p>
                          <p><strong>Note:</strong> This is a cumulative count, not an average. Each conversation is counted once per day it occurred.</p>
                        </div>
                      }
                    />
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 700 }}>{responseTimeSummary.totalCount5Plus || 0}</span>
                    <span style={{ fontSize: '14px', color: isDarkMode ? '#b0b0b0' : '#666' }}>5+ min</span>
                  </div>
                  <div style={{ fontSize: '13px', color: isDarkMode ? '#cccccc' : '#666' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>5-10 min:</span>
                      <span style={{ fontWeight: 600, color: '#ff9a74' }}>{responseTimeSummary.totalCount5to10 || 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>10+ min:</span>
                      <span style={{ fontWeight: 600, color: '#fd8789' }}>{responseTimeSummary.totalCount10Plus || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="summary-card">
                  <h4>
                    Total Conversations
                    <InfoIcon 
                      isDarkMode={isDarkMode} 
                      position="left"
                      content={
                        <div style={{ textAlign: 'left' }}>
                          <p><strong>Calculation:</strong> Total count of all conversations that received a first response, summed across all days in the selected date range.</p>
                          <p><strong>Note:</strong> This includes conversations with response times under 5 minutes, 5-10 minutes, and 10+ minutes. Each conversation is counted once per day it occurred.</p>
                        </div>
                      }
                    />
                  </h4>
                  <div className="summary-value-large">
                    {responseTimeMetrics.reduce((sum, m) => sum + (m.totalConversations || 0), 0)}
                  </div>
                  <div className="summary-subtext">
                    Across all data points
                  </div>
                </div>
              </div>

              {/* Percentage Chart */}
              <div className="chart-container">
                <h3 className="chart-title">
                  Percentage of Conversations with Wait Time
                  <InfoIcon 
                    isDarkMode={isDarkMode} 
                    position="right"
                    content={
                      <div style={{ textAlign: 'left' }}>
                        <p><strong>What this shows:</strong> Daily percentage of conversations that waited 5+ minutes for a first response, broken down by wait time buckets.</p>
                        <p><strong>Lines:</strong></p>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          <li><strong>5+ Min Wait %</strong> (amber, solid): Total percentage of conversations waiting 5+ minutes</li>
                          <li><strong>5-10 Min Wait %</strong> (orange, dashed): Percentage waiting 5-10 minutes</li>
                          <li><strong>10+ Min Wait %</strong> (red, dashed): Percentage waiting 10+ minutes</li>
                        </ul>
                        <p><strong>Reference Lines:</strong> The red dashed line at {WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}% represents the target threshold for 10+ Min Waits ({WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}%). The orange dashed line at {WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}% represents the target threshold for 5-10 Min Waits (≤{WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}%). Values at or below these lines indicate good performance.</p>
                        <p><strong>How to use:</strong> Hover over data points to see exact values. Use the date range selector to analyze different time periods.</p>
                      </div>
                    }
                  />
                </h3>
                <p className="chart-subtitle">Breakdown by wait time buckets: 5-10 minutes and 10+ minutes</p>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={responseTimeChartData} margin={{ top: 70, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                    <XAxis 
                      dataKey="displayLabel" 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                      domain={[0, 15]}
                      label={{ value: 'Percentage %', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                    border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                    borderRadius: '4px',
                    color: isDarkMode ? '#e5e5e5' : '#292929',
                    itemStyle: { color: isDarkMode ? '#e5e5e5' : '#292929' },
                    labelStyle: { color: isDarkMode ? '#ffffff' : '#292929', fontWeight: 600 }
                  }}
                    />
                    <ReferenceLine 
                      y={WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN} 
                      stroke="#fd8789" 
                      strokeDasharray="2 2" 
                      strokeWidth={2}
                      label={{ value: `Target: ${WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}% (10+ Min Waits)`, position: "top", fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                    />
                    <ReferenceLine 
                      y={WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN} 
                      stroke="#ff9a74" 
                      strokeDasharray="2 2" 
                      strokeWidth={2}
                      label={{ value: `Target: ≤${WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}% (5-10 Min Waits)`, position: "top", fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="percentage5PlusMin" 
                      stroke="#ffc107" 
                      strokeWidth={2}
                      name="5+ Min Wait %"
                      dot={{ r: 4, fill: '#ffc107' }}
                      label={createHolidayLabel(responseTimeChartData, false, 'percentage5PlusMin')}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="percentage5to10Min" 
                      stroke="#ff9a74" 
                      strokeWidth={2}
                      name="5-10 Min Wait %"
                      dot={{ r: 4, fill: '#ff9a74' }}
                      strokeDasharray="5 5"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="percentage10PlusMin" 
                      stroke="#fd8789" 
                      strokeWidth={2}
                      name="10+ Min Wait %"
                      dot={{ r: 4, fill: '#fd8789' }}
                      strokeDasharray="5 5"
                    />
                    <Legend 
                      wrapperStyle={{ color: isDarkMode ? '#ffffff' : '#292929' }}
                      content={({ payload }) => {
                        if (!payload) return null;
                        // Reorder payload: 5+ Min Wait %, 5-10 Min Wait %, 10+ Min Wait %
                        const orderedPayload = [
                          payload.find(item => item.dataKey === 'percentage5PlusMin'),
                          payload.find(item => item.dataKey === 'percentage5to10Min'),
                          payload.find(item => item.dataKey === 'percentage10PlusMin')
                        ].filter(Boolean);
                        
                        // Use default Recharts Legend rendering with reordered payload
                        return (
                          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', padding: '10px 0' }}>
                            {orderedPayload.map((entry, index) => {
                              if (!entry) return null;
                              const isDashed = entry.dataKey === 'percentage5to10Min' || entry.dataKey === 'percentage10PlusMin';
                              return (
                                <div key={`legend-item-${index}`} style={{ display: 'flex', alignItems: 'center', margin: '0 10px', cursor: 'pointer' }}>
                                  <svg width="14" height="14" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
                                    <line
                                      x1="0"
                                      y1="7"
                                      x2="14"
                                      y2="7"
                                      stroke={entry.color}
                                      strokeWidth={2}
                                      strokeDasharray={isDashed ? '5 5' : '0'}
                                    />
                                  </svg>
                                  <span style={{ color: isDarkMode ? '#ffffff' : '#292929', fontSize: '12px' }}>
                                    {entry.value}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Count Chart */}
              <div className="chart-container">
                <h3 className="chart-title">
                  Count of Conversations with Wait Time
                  <InfoIcon 
                    isDarkMode={isDarkMode} 
                    position="right"
                    content={
                      <div style={{ textAlign: 'left' }}>
                        <p><strong>What this shows:</strong> Daily count of conversations that waited 5+ minutes for a first response, broken down by wait time buckets.</p>
                        <p><strong>Stacked Bars:</strong></p>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          <li><strong>10+ Min Waits</strong> (red, bottom): Count of conversations waiting 10+ minutes</li>
                          <li><strong>5-10 Min Waits</strong> (orange, top): Count of conversations waiting 5-10 minutes</li>
                        </ul>
                        <p><strong>Total Height:</strong> The full height of each bar represents the total count of 5+ minute waits for that day.</p>
                        <p><strong>How to use:</strong> Hover over bars to see exact counts. Use this chart to understand volume trends and identify days with unusually high wait counts.</p>
                      </div>
                    }
                  />
                </h3>
                <p className="chart-subtitle">Stacked bars showing breakdown: 5-10 minutes (orange) and 10+ minutes (red)</p>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={responseTimeChartData} margin={{ top: 70, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                    <XAxis 
                      dataKey="displayLabel" 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      stroke={isDarkMode ? '#ffffff' : '#292929'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                      label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                    border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                    borderRadius: '4px',
                    color: isDarkMode ? '#e5e5e5' : '#292929',
                    itemStyle: { color: isDarkMode ? '#e5e5e5' : '#292929' },
                    labelStyle: { color: isDarkMode ? '#ffffff' : '#292929', fontWeight: 600 }
                  }}
                    />
                    <Legend wrapperStyle={{ color: isDarkMode ? '#ffffff' : '#292929' }} />
                    <Bar 
                      dataKey="count10PlusMin" 
                      stackId="waits"
                      fill="#fd8789"
                      name="10+ Min Waits"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar 
                      dataKey="count5to10Min" 
                      stackId="waits"
                      fill="#ff9a74"
                      name="5-10 Min Waits"
                      radius={[4, 4, 0, 0]}
                      label={createHolidayLabel(responseTimeChartData, true, 'count5PlusMin')}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Response Time Insights Section */}
              <div className="insights-section">
                {/* Trend Analysis & Best/Worst Days */}
                {responseTimeTrendAnalysis && responseTimeBestWorst && (
                  <div className="insights-row">
                    <div className="summary-card trend-card">
                      <h4>
                        Trend Analysis
                        <InfoIcon 
                          isDarkMode={isDarkMode} 
                          position="right"
                          content={
                            <div style={{ textAlign: 'left' }}>
                              <p><strong>What this shows:</strong> Analysis of wait time trends across the selected date range, comparing the first half vs second half of the period.</p>
                              <p><strong>Metrics:</strong></p>
                              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                <li><strong>First/Second Half:</strong> Average wait percentage for each half of the selected period</li>
                                <li><strong>Trend:</strong> Direction of change (improving ↓, worsening ↑, or stable →)</li>
                                <li><strong>Volatility:</strong> Standard deviation showing how much daily values vary</li>
                                <li><strong>7-Day Moving Avg:</strong> Smoothed average to reduce day-to-day noise</li>
                              </ul>
                              <p><strong>How to use:</strong> Helps identify whether performance is improving or declining over time, and how consistent daily performance is.</p>
                            </div>
                          }
                        />
                      </h4>
                      <div className="trend-content">
                        <div className="trend-comparison">
                          <div className="trend-period">
                            <span className="trend-label">First Half</span>
                            <span className="trend-value">{responseTimeTrendAnalysis.firstHalfAvg}%</span>
                          </div>
                          <div className="trend-arrow">→</div>
                          <div className="trend-period">
                            <span className="trend-label">Second Half</span>
                            <span className="trend-value">{responseTimeTrendAnalysis.secondHalfAvg}%</span>
                          </div>
                        </div>
                        <div className={`trend-indicator ${responseTimeTrendAnalysis.trend}`}>
                          {responseTimeTrendAnalysis.trend === 'improving' && '↓'}
                          {responseTimeTrendAnalysis.trend === 'worsening' && '↑'}
                          {responseTimeTrendAnalysis.trend === 'stable' && '→'}
                          {Math.abs(responseTimeTrendAnalysis.change)}% {responseTimeTrendAnalysis.trend === 'improving' ? 'improvement' : responseTimeTrendAnalysis.trend === 'worsening' ? 'increase' : 'stable'}
                        </div>
                        <div className="volatility-metric">
                          <span className="volatility-label">Volatility</span>
                          <span className="volatility-value">±{responseTimeTrendAnalysis.volatility}%</span>
                        </div>
                        <div className="volatility-metric">
                          <span className="volatility-label">7-Day Moving Avg</span>
                          <span className="volatility-value">{responseTimeTrendAnalysis.movingAvg}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="summary-card best-worst-card">
                      <h4>
                        Best Day (Lowest %)
                        <InfoIcon 
                          isDarkMode={isDarkMode} 
                          position="right"
                          content={
                            <div style={{ textAlign: 'left' }}>
                              <p><strong>What this shows:</strong> The day with the lowest percentage of conversations waiting 5+ minutes for a first response.</p>
                              <p><strong>Breakdown:</strong> Shows the count of slow responses (5+ min) vs total conversations for that day.</p>
                              <p><strong>How to use:</strong> Helps identify what made the best day successful - was it lower volume, better staffing, or other factors?</p>
                            </div>
                          }
                        />
                      </h4>
                      <div className="best-worst-content">
                        <div className="best-worst-date">{responseTimeBestWorst.bestPercentage.displayDate}</div>
                        <div className="best-worst-value">{responseTimeBestWorst.bestPercentage.percentage}%</div>
                        <div className="best-worst-breakdown">
                          {responseTimeBestWorst.bestPercentage.count} slow / {responseTimeBestWorst.bestPercentage.total} total
                        </div>
                      </div>
                    </div>
                    <div className="summary-card best-worst-card worst">
                      <h4>
                        Worst Day (Highest %)
                        <InfoIcon 
                          isDarkMode={isDarkMode} 
                          position="left"
                          content={
                            <div style={{ textAlign: 'left' }}>
                              <p><strong>What this shows:</strong> The day with the highest percentage of conversations waiting 5+ minutes for a first response.</p>
                              <p><strong>Breakdown:</strong> Shows the count of slow responses (5+ min) vs total conversations for that day.</p>
                              <p><strong>How to use:</strong> Helps identify what went wrong on the worst day - was it unusually high volume, staffing issues, or other factors?</p>
                            </div>
                          }
                        />
                      </h4>
                      <div className="best-worst-content">
                        <div className="best-worst-date">{responseTimeBestWorst.worstPercentage.displayDate}</div>
                        <div className="best-worst-value">{responseTimeBestWorst.worstPercentage.percentage}%</div>
                        <div className="best-worst-breakdown">
                          {responseTimeBestWorst.worstPercentage.count} slow / {responseTimeBestWorst.worstPercentage.total} total
                        </div>
                      </div>
                    </div>
                  </div>
                )}


                {/* Day-of-Week Analysis */}
                {responseTimeDayOfWeek && responseTimeDayOfWeek.length > 0 && (
                  <div className="chart-container">
                    <h3 className="chart-title">
                      Day-of-Week Response Time Patterns
                      <InfoIcon 
                        isDarkMode={isDarkMode} 
                        position="right"
                        content={
                          <div style={{ textAlign: 'left' }}>
                            <p><strong>What this shows:</strong> Average conversation counts by day of week, broken down by wait time buckets.</p>
                            <p><strong>Stacked Bars:</strong></p>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                              <li><strong>10+ Min Waits</strong> (red, bottom): Average count waiting 10+ minutes</li>
                              <li><strong>5-10 Min Waits</strong> (orange, middle): Average count waiting 5-10 minutes</li>
                              <li><strong>Responses &lt; 5 Min</strong> (gray, top): Average count with response under 5 minutes</li>
                            </ul>
                            <p><strong>How to use:</strong> Identifies which days of the week typically have higher wait times. Helps with resource planning and identifying patterns.</p>
                          </div>
                        }
                      />
                    </h3>
                    <p className="chart-subtitle">Average total conversations with response and wait times by day of week, broken down by wait time buckets</p>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={responseTimeDayOfWeek} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                        <XAxis 
                          dataKey="day" 
                          stroke={isDarkMode ? '#ffffff' : '#292929'}
                          tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                        />
                        <YAxis 
                          stroke={isDarkMode ? '#ffffff' : '#292929'}
                          tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                          label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                    border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                    borderRadius: '4px',
                    color: isDarkMode ? '#e5e5e5' : '#292929'
                  }}
                          formatter={(value, name, props) => {
                            // Don't show individual bar values, show custom tooltip on hover
                            return null;
                          }}
                          labelFormatter={(label) => {
                            const data = responseTimeDayOfWeek.find(d => d.day === label);
                            if (data) {
                              return (
                                <div style={{ padding: '4px 0' }}>
                                  <strong>{data.fullDay}</strong>
                                </div>
                              );
                            }
                            return label;
                          }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length > 0) {
                              const data = responseTimeDayOfWeek.find(d => d.day === label);
                              if (data) {
                                return (
                                  <div style={{ 
                                    backgroundColor: isDarkMode ? '#1e1e1e' : 'white',
                                    color: isDarkMode ? '#e5e5e5' : '#292929',
                                    border: '1px solid #35a1b4', 
                                    borderRadius: '4px',
                                    padding: '10px'
                                  }}>
                                    <div style={{ 
                                      textAlign: 'center', 
                                      marginBottom: '8px',
                                      fontWeight: 'bold',
                                      fontSize: '14px',
                                      borderBottom: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                                      paddingBottom: '6px',
                                      color: isDarkMode ? '#ffffff' : '#292929'
                                    }}>
                                      Averages for {data.fullDay}
                                    </div>
                                    {responseTimeDateRange && (
                                      <div style={{ 
                                        textAlign: 'center', 
                                        marginBottom: '8px',
                                        fontSize: '11px',
                                        color: isDarkMode ? '#b0b0b0' : '#666',
                                        fontStyle: 'italic'
                                      }}>
                                        {responseTimeDateRange.start} - {responseTimeDateRange.end}
                                      </div>
                                    )}
                                    <div style={{ marginBottom: '6px', color: isDarkMode ? '#ffffff' : '#292929' }}>
                                      <strong>Total Chats:</strong> {data.avgTotalWithResponse.toFixed(1)}
                                    </div>
                                    <div style={{ marginBottom: '6px', color: isDarkMode ? '#ffffff' : '#292929' }}>
                                      <strong>Chats that waited 5+ Min:</strong> {data.avgCount5PlusMin.toFixed(1)}
                                      {data.avgPercentage5Plus > 0 && (
                                        <span 
                                          className="percentage-badge" 
                                          style={{ 
                                            marginLeft: '8px',
                                            backgroundColor: '#fd8789',
                                            color: 'white'
                                          }}
                                        >
                                          {data.avgPercentage5Plus.toFixed(1)}%
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ marginBottom: '6px', color: isDarkMode ? '#ffffff' : '#292929' }}>
                                      <strong>5-10 Min Waits:</strong> {data.avgCount5to10Min.toFixed(1)}
                                    </div>
                                    <div style={{ color: isDarkMode ? '#ffffff' : '#292929' }}>
                                      <strong>10+ Min Waits:</strong> {data.avgCount10PlusMin.toFixed(1)}
                                    </div>
                                  </div>
                                );
                              }
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="avgCount10PlusMin" stackId="responses" fill="#fd8789" name="Avg Count 10+ Min" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="avgCount5to10Min" stackId="responses" fill="#ff9a74" name="Avg Count 5-10 Min" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="avgOtherResponses" stackId="responses" fill="#e0e0e0" name="Responses < 5 Min" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Volume vs Performance Correlation */}
                {volumePerformanceData && volumeCorrelation && (
                  <div className="chart-container">
                    <h3 className="chart-title">
                      Volume vs Performance Correlation
                      <InfoIcon 
                        isDarkMode={isDarkMode} 
                        position="right"
                        content={
                          <div style={{ textAlign: 'left' }}>
                            <p><strong>What this shows:</strong> Scatter plot analyzing the relationship between conversation volume and wait time performance.</p>
                            <p><strong>Correlation Types:</strong></p>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                              <li><strong>Positive:</strong> Higher volume correlates with worse performance (more waits)</li>
                              <li><strong>Negative:</strong> Higher volume correlates with better performance (fewer waits)</li>
                              <li><strong>Weak:</strong> Little to no relationship between volume and performance</li>
                            </ul>
                            <p><strong>How to use:</strong> Helps identify if volume is a key driver of wait times. If correlation is strong and positive, consider scaling resources with volume.</p>
                          </div>
                        }
                      />
                    </h3>
                    <p className="chart-subtitle">
                      {volumeCorrelation.interpretation === 'weak' ? 'Weak' : volumeCorrelation.interpretation === 'moderate' ? 'Moderate' : 'Strong'} 
                      {' '}{volumeCorrelation.direction} correlation ({volumeCorrelation.correlation})
                      {volumeCorrelation.direction === 'positive' ? ' - Higher volume correlates with worse performance' : ' - Higher volume correlates with better performance'}
                    </p>
                    <ResponsiveContainer width="100%" height={400}>
                      <ScatterChart data={volumePerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                        <XAxis 
                          type="number"
                          dataKey="totalConversations"
                          name="Total Conversations"
                          stroke={isDarkMode ? '#ffffff' : '#292929'}
                          tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                          label={{ value: 'Total Conversations', position: 'insideBottom', offset: -5, fill: isDarkMode ? '#ffffff' : '#292929' }}
                        />
                        <YAxis 
                          type="number"
                          dataKey="percentage"
                          name="Percentage 5+ Min"
                          stroke={isDarkMode ? '#ffffff' : '#292929'}
                          tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                          label={{ value: 'Percentage 5+ Min', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
                        />
                        <Tooltip 
                          cursor={{ strokeDasharray: '3 3' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const totalConversations = data?.totalConversations || 0;
                              const percentage = data?.percentage || 0;
                              return (
                                <div style={{ 
                                  backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                                  border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                                  borderRadius: '4px',
                                  padding: '8px 12px',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                  textAlign: 'left'
                                }}>
                                  <div style={{ fontSize: '12px', color: isDarkMode ? '#ffffff' : '#292929', marginBottom: '4px' }}>
                                    <strong style={{ color: isDarkMode ? '#ffffff' : '#292929' }}>Total Conversations:</strong> {totalConversations}
                                  </div>
                                  <div style={{ fontSize: '12px', color: isDarkMode ? '#ffffff' : '#292929' }}>
                                    <strong style={{ color: isDarkMode ? '#ffffff' : '#292929' }}>Percentage:</strong> {percentage}%
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter name="Data Points" data={volumePerformanceData} fill="#35a1b4">
                          {volumePerformanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill="#35a1b4" />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                )}

              </div>

              {/* Detailed Table */}
              <div className="historical-table-section">
                <h3 className="section-title">
                  Historical Response Time Metrics
                  {lastResponseTimeTimestamp && (
                    <span className="last-snapshot-timestamp"> - Last Snapshot taken {formatTimestamp(lastResponseTimeTimestamp)}</span>
                  )}
                </h3>
                <div className="table-container">
                  <table className="historical-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th 
                          className="sortable-header" 
                          onClick={() => handleResponseTimeSort('date')}
                        >
                          Date
                          {responseTimeSortConfig.key === 'date' && (
                            <span className="sort-indicator">
                              {responseTimeSortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                            </span>
                          )}
                        </th>
                        <th 
                          className="sortable-header" 
                          onClick={() => handleResponseTimeSort('totalConversations')}
                        >
                          Total Conversations
                          {responseTimeSortConfig.key === 'totalConversations' && (
                            <span className="sort-indicator">
                              {responseTimeSortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                            </span>
                          )}
                        </th>
                        <th 
                          className="sortable-header" 
                          onClick={() => handleResponseTimeSort('count5PlusMin')}
                        >
                          5+ Min Waits
                          {responseTimeSortConfig.key === 'count5PlusMin' && (
                            <span className="sort-indicator">
                              {responseTimeSortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                            </span>
                          )}
                        </th>
                        <th>5-10 Min Waits</th>
                        <th>10+ Min Waits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {responseTimeChartData.map((row, idx) => {
                        const isExpanded = expandedResponseTimeDates.has(row.date);
                        
                        return (
                          <React.Fragment key={`${row.date}-${idx}`}>
                            <tr 
                              className="date-group-header"
                              onClick={() => toggleResponseTimeDate(row.date)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td className="expand-icon">
                                {row.count5PlusMin > 0 ? (isExpanded ? '▼' : '▶') : ''}
                              </td>
                              <td className="date-cell">
                                <strong>{formatDateUTC(row.date)}</strong>
                              </td>
                              <td>{row.totalConversations}</td>
                              <td>
                                {row.count5PlusMin}
                                {row.percentage5PlusMin > 0 && (
                                  <span 
                                    className="percentage-badge" 
                                    style={{ 
                                      marginLeft: '8px',
                                      backgroundColor: getHeatMapColor(
                                        row.percentage5PlusMin,
                                        responseTimeHeatMapRanges.percentage5PlusMin.min,
                                        responseTimeHeatMapRanges.percentage5PlusMin.max
                                      ),
                                      color: 'white',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontWeight: '600'
                                    }}
                                  >
                                    ({row.percentage5PlusMin.toFixed(1)}%)
                                  </span>
                                )}
                              </td>
                              <td>
                                {row.count5to10Min}
                                {row.percentage5to10Min > 0 && (
                                  <span 
                                    className="percentage-badge" 
                                    style={{ 
                                      marginLeft: '8px',
                                      backgroundColor: getHeatMapColor(
                                        row.percentage5to10Min,
                                        responseTimeHeatMapRanges.percentage5to10Min.min,
                                        responseTimeHeatMapRanges.percentage5to10Min.max
                                      ),
                                      color: 'white',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontWeight: '600'
                                    }}
                                  >
                                    ({row.percentage5to10Min.toFixed(1)}%)
                                  </span>
                                )}
                              </td>
                              <td>
                                {row.count10PlusMin}
                                {row.percentage10PlusMin > 0 && (
                                  <span 
                                    className="percentage-badge" 
                                    style={{ 
                                      marginLeft: '8px',
                                      backgroundColor: getHeatMapColor(
                                        row.percentage10PlusMin,
                                        responseTimeHeatMapRanges.percentage10PlusMin.min,
                                        responseTimeHeatMapRanges.percentage10PlusMin.max
                                      ),
                                      color: 'white',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontWeight: '600'
                                    }}
                                  >
                                    ({row.percentage10PlusMin.toFixed(1)}%)
                                  </span>
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="conversations-row">
                                <td colSpan="5">
                                  <div className="conversations-list">
                                    {/* Categorize conversations into 5-10 min and 10+ min buckets */}
                                    {(() => {
                                      const conversations5to10Min = [];
                                      const conversations10Plus = [];
                                      
                                      // Separate conversations based on wait time
                                      if (row.conversationIds5PlusMin && row.conversationIds5PlusMin.length > 0) {
                                        row.conversationIds5PlusMin.forEach((convData) => {
                                          // Check if this conversation is in the 10+ min list
                                          const is10Plus = row.conversationIds10PlusMin && row.conversationIds10PlusMin.some(
                                            conv10 => {
                                              const conv10Id = typeof conv10 === 'string' ? conv10 : conv10.id;
                                              const convDataId = typeof convData === 'string' ? convData : convData.id;
                                              return conv10Id === convDataId;
                                            }
                                          );
                                          
                                          if (is10Plus) {
                                            conversations10Plus.push(convData);
                                          } else {
                                            conversations5to10Min.push(convData);
                                          }
                                        });
                                      }
                                      
                                      return (
                                        <>
                                          {conversations5to10Min.length > 0 && (
                                            <div style={{ marginBottom: '20px' }}>
                                              <h4>Conversations with 5-10 Minute Wait Time ({conversations5to10Min.length}):</h4>
                                              <ul>
                                                {conversations5to10Min.map((convData, idx) => {
                                                  const convId = typeof convData === 'string' ? convData : convData.id;
                                                  const waitTimeMinutes = typeof convData === 'object' && convData.waitTimeMinutes 
                                                    ? convData.waitTimeMinutes 
                                                    : null;
                                                  
                                                  return (
                                                    <li key={`${convId || idx}`}>
                                                      <a 
                                                        href={`https://app.intercom.com/a/inbox/gu1e0q0t/inbox/admin/9110812/conversation/${convId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="conversation-link"
                                                      >
                                                        {convId}
                                                      </a>
                                                      {waitTimeMinutes !== null && (
                                                        <span className="wait-time"> ({waitTimeMinutes.toFixed(1)} min)</span>
                                                      )}
                                                    </li>
                                                  );
                                                })}
                                              </ul>
                                            </div>
                                          )}
                                          
                                          {conversations10Plus.length > 0 && (
                                            <div>
                                              <h4>Conversations with 10+ Minute Wait Time ({conversations10Plus.length}):</h4>
                                              <ul>
                                                {conversations10Plus.map((convData, idx) => {
                                                  const convId = typeof convData === 'string' ? convData : convData.id;
                                                  const waitTimeMinutes = typeof convData === 'object' && convData.waitTimeMinutes 
                                                    ? convData.waitTimeMinutes 
                                                    : null;
                                                  
                                                  return (
                                                    <li key={`${convId || idx}`}>
                                                      <a 
                                                        href={`https://app.intercom.com/a/inbox/gu1e0q0t/inbox/admin/9110812/conversation/${convId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="conversation-link"
                                                      >
                                                        {convId}
                                                      </a>
                                                      {waitTimeMinutes !== null && (
                                                        <span className="wait-time"> ({waitTimeMinutes.toFixed(1)} min)</span>
                                                      )}
                                                    </li>
                                                  );
                                                })}
                                              </ul>
                                            </div>
                                          )}
                                          
                                          {conversations5to10Min.length === 0 && conversations10Plus.length === 0 && (
                                            <div className="modal-empty-state">No conversations with 5+ minute wait times.</div>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  {responseTimeChartData.length < responseTimeTotalDays && (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                      <button 
                        className="load-more-button"
                        onClick={() => setResponseTimeDaysToShow(prev => prev + 7)}
                      >
                        Load More ({responseTimeTotalDays - responseTimeChartData.length} more days)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

              {!loadingMetrics && responseTimeChartData.length === 0 && (
                <div className="no-data">
                  <p>No response time metrics available for the selected date range.</p>
                  <p>Metrics are automatically captured daily at midnight UTC. You can also manually capture a snapshot for today using the button above (will overwrite today's entry if it exists).</p>
                </div>
              )}
        </>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && (
        <ResultsView 
          data={resultsData}
          loading={loadingResults}
          dateRange={dateRange}
          customStartDate={startDate}
          customEndDate={endDate}
        />
      )}
    </div>
  );
}

// Results View Component
function ResultsView({ data, loading, dateRange, customStartDate, customEndDate }) {
  const { isDarkMode } = useTheme();
  // Track dismissed insights with localStorage persistence
  const [dismissedInsights, setDismissedInsights] = useState(() => {
    try {
      const stored = localStorage.getItem('dismissedImpactInsights');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
      return new Set();
    }
  });
  
  if (loading) {
    return (
      <div className="results-view">
        <div className="loading-state">Loading on-track correlation data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="results-view">
        <div className="no-data">
          <p>No data available for analysis.</p>
          <p className="no-data-subtext">Historical data is required to analyze on-track impact on response times.</p>
        </div>
      </div>
    );
  }

  // Helper function to determine if correlation is good (negative = good)
  const isGoodCorrelation = (direction) => direction === 'negative';
  const getCorrelationColor = (direction) => isGoodCorrelation(direction) ? '#4cec8c' : '#fd8789';
  const getCorrelationLabel = (direction) => isGoodCorrelation(direction)
    ? 'Higher on-track correlates with lower wait times (desired)' 
    : 'Higher on-track correlates with higher wait times (concerning)';

  // Calculate key insights
  const strongestCorrelation = Math.abs(data.correlation5to10) > Math.abs(data.correlation10Plus) 
    ? { value: data.correlation5to10, bucket: '5-10 min', direction: data.correlation5to10Direction }
    : { value: data.correlation10Plus, bucket: '10+ min', direction: data.correlation10PlusDirection };
  
  const isStronger5to10 = Math.abs(data.correlation5to10) > Math.abs(data.correlation10Plus);
  const overallImpact = data.correlationStrength === 'strong' ? 'strong' : data.correlationStrength === 'moderate' ? 'moderate' : 'weak';

  return (
    <div className="results-view">
      <div className="results-header">
        <h2 className="results-title">On Track Impact on Response Times</h2>
        <p className="results-subtitle">
          Analyzing how TSE on-track status affects 5+ minute first response rates, broken down by wait time buckets
        </p>
      </div>

      {/* Key Insight Summary */}
      <div style={{ 
        backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa', 
        border: `1px solid ${isDarkMode ? '#444' : '#e0e0e0'}`,
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '24px'
      }}>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: 600, 
          color: isDarkMode ? '#ffffff' : '#292929',
          marginBottom: '12px'
        }}>
          Key Insights
        </h3>
        {(() => {
          // Build insights array
          const insights = [
            {
              id: 'impact-overall-impact',
              type: isGoodCorrelation(data.correlationDirection) ? 'positive' : 'warning',
              label: 'Overall Impact',
              backgroundColor: isGoodCorrelation(data.correlationDirection) 
                ? (isDarkMode ? 'rgba(76, 236, 140, 0.1)' : 'rgba(76, 236, 140, 0.1)')
                : (isDarkMode ? 'rgba(253, 135, 137, 0.1)' : 'rgba(253, 135, 137, 0.1)'),
              borderColor: isGoodCorrelation(data.correlationDirection) ? '#4cec8c' : '#fd8789',
              content: (
                <>
                  <strong>Overall Impact:</strong> On-track performance has a <strong style={{ color: overallImpact === 'strong' ? '#fd8789' : overallImpact === 'moderate' ? '#fbbf24' : '#4cec8c' }}>{overallImpact}</strong> impact on response times
                  {isGoodCorrelation(data.correlationDirection) ? ' (higher on-track = lower wait times)' : ' (concerning pattern)'}
                </>
              )
            },
            {
              id: 'impact-wait-time-sensitivity',
              type: 'positive',
              label: 'Wait Time Sensitivity',
              content: (
                <>
                  <strong>Wait Time Sensitivity:</strong> {isStronger5to10 ? '5-10 min waits' : '10+ min waits'} are {isStronger5to10 ? 'more' : 'less'} correlated with on-track performance than {isStronger5to10 ? '10+ min waits' : '5-10 min waits'}
                </>
              )
            },
            {
              id: 'impact-improvement-potential',
              type: (data.improvementPotential5to10 > 0 && data.improvementPotential10Plus > 0) ? 'positive' : 'warning',
              label: 'Improvement Potential',
              backgroundColor: (data.improvementPotential5to10 > 0 && data.improvementPotential10Plus > 0)
                ? (isDarkMode ? 'rgba(76, 236, 140, 0.1)' : 'rgba(76, 236, 140, 0.1)')
                : (isDarkMode ? 'rgba(253, 135, 137, 0.1)' : 'rgba(253, 135, 137, 0.1)'),
              borderColor: (data.improvementPotential5to10 > 0 && data.improvementPotential10Plus > 0) ? '#4cec8c' : '#fd8789',
              content: (
                <>
                  <strong>Improvement Potential:</strong> If all days matched High (80-100%) on-track performance, wait times could be{' '}
                  {data.improvementPotential5to10 > 0 ? 'reduced' : 'increased'} by{' '}
                  <strong style={{ color: data.improvementPotential5to10 > 0 ? '#4cec8c' : '#fd8789' }}>
                    {Math.abs(data.improvementPotential5to10).toFixed(2)}% for 5-10 min waits
                  </strong> and{' '}
                  {data.improvementPotential10Plus > 0 ? 'reduced' : 'increased'} by{' '}
                  <strong style={{ color: data.improvementPotential10Plus > 0 ? '#4cec8c' : '#fd8789' }}>
                    {Math.abs(data.improvementPotential10Plus).toFixed(2)}% for 10+ min waits
                  </strong>
                </>
              )
            },
            {
              id: 'impact-correlation-strength',
              type: Math.abs(strongestCorrelation.value) >= 0.7 ? 'positive' : Math.abs(strongestCorrelation.value) >= 0.3 ? 'warning' : 'warning',
              label: 'Correlation Strength',
              backgroundColor: Math.abs(strongestCorrelation.value) >= 0.7
                ? (isDarkMode ? 'rgba(76, 236, 140, 0.1)' : 'rgba(76, 236, 140, 0.1)')
                : Math.abs(strongestCorrelation.value) >= 0.3
                ? (isDarkMode ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.1)')
                : (isDarkMode ? 'rgba(253, 135, 137, 0.1)' : 'rgba(253, 135, 137, 0.1)'),
              borderColor: Math.abs(strongestCorrelation.value) >= 0.7 ? '#4cec8c' : Math.abs(strongestCorrelation.value) >= 0.3 ? '#fbbf24' : '#fd8789',
              content: (
                <>
                  <strong>Correlation Strength:</strong> The {strongestCorrelation.bucket} wait time bucket shows the {Math.abs(strongestCorrelation.value) < 0.3 ? 'weakest' : Math.abs(strongestCorrelation.value) < 0.7 ? 'moderate' : 'strongest'} correlation ({strongestCorrelation.value > 0 ? '+' : ''}{strongestCorrelation.value.toFixed(2)})
                </>
              )
            }
          ];
          
          const dismissInsight = (insightId) => {
            setDismissedInsights(prev => {
              const updated = new Set([...prev, insightId]);
              try {
                localStorage.setItem('dismissedImpactInsights', JSON.stringify([...updated]));
              } catch (e) {
                console.error('Failed to save dismissed insights:', e);
              }
              return updated;
            });
          };
          
          const isInsightDismissed = (insightId) => {
            return dismissedInsights.has(insightId);
          };
          
          // Filter dismissed insights
          const visibleInsights = insights.filter(insight => !isInsightDismissed(insight.id));
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {visibleInsights.map((insight) => (
                <div
                  key={insight.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    backgroundColor: insight.backgroundColor !== undefined 
                      ? insight.backgroundColor
                      : (insight.type === 'positive' 
                        ? (isDarkMode ? 'rgba(76, 236, 140, 0.1)' : 'rgba(76, 236, 140, 0.1)')
                        : (isDarkMode ? 'rgba(253, 135, 137, 0.1)' : 'rgba(253, 135, 137, 0.1)')),
                    borderLeft: `3px solid ${insight.borderColor !== undefined ? insight.borderColor : (insight.type === 'positive' ? '#4cec8c' : '#fd8789')}`,
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
                    onClick={() => dismissInsight(insight.id)}
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
                  <span style={{ flex: 1 }}>{insight.content}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Key Insights */}
      <div className="results-insights" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {/* Overall 5+ Min Correlation */}
        <div className="insight-card results-correlation">
          <div className="insight-header">
            <h3>
              5+ Min Wait Correlation
              <InfoIcon 
                isDarkMode={isDarkMode}
                position="right"
                content={
                  <div style={{ textAlign: 'left' }}>
                    <p><strong>What this measures:</strong> The correlation coefficient between daily on-track percentage and the overall 5+ minute wait rate (combining both 5-10 min and 10+ min waits).</p>
                    <p><strong>Calculation:</strong> Uses Pearson correlation coefficient to measure the linear relationship between on-track % and wait rates across all days in the selected date range.</p>
                    <p><strong>Interpretation:</strong></p>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      <li><strong>Negative correlation (desired):</strong> Higher on-track % correlates with lower wait times</li>
                      <li><strong>Positive correlation (concerning):</strong> Higher on-track % correlates with higher wait times</li>
                      <li><strong>Strength:</strong> Values closer to -1 or +1 indicate stronger correlation</li>
                    </ul>
                    <p><strong>Range:</strong> -1.0 (perfect negative) to +1.0 (perfect positive), with 0 indicating no correlation.</p>
                  </div>
                }
              />
            </h3>
          </div>
          <div className="correlation-content">
            <div className="correlation-value" style={{ color: getCorrelationColor(data.correlationDirection) }}>
              {data.correlation > 0 ? '+' : ''}{data.correlation.toFixed(2)}
            </div>
            <div className="correlation-label">
              {data.correlationStrength.charAt(0).toUpperCase() + data.correlationStrength.slice(1)} {data.correlationDirection}
            </div>
            <div className="correlation-description" style={{ fontSize: '11px', marginTop: '8px' }}>
              {getCorrelationLabel(data.correlationDirection)}
            </div>
          </div>
        </div>

        {/* 5-10 Min Correlation */}
        <div className="insight-card results-correlation">
          <div className="insight-header">
            <h3>
              5-10 Min Wait Correlation
              <InfoIcon 
                isDarkMode={isDarkMode}
                position="left"
                content={
                  <div style={{ textAlign: 'left' }}>
                    <p><strong>What this measures:</strong> The correlation coefficient between daily on-track percentage and the 5-10 minute wait rate specifically.</p>
                    <p><strong>Calculation:</strong> Uses Pearson correlation coefficient to measure the linear relationship between on-track % and 5-10 minute wait rates across all days in the selected date range.</p>
                    <p><strong>Interpretation:</strong></p>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      <li><strong>Negative correlation (desired):</strong> Higher on-track % correlates with lower 5-10 min wait rates</li>
                      <li><strong>Positive correlation (concerning):</strong> Higher on-track % correlates with higher 5-10 min wait rates</li>
                      <li><strong>Strength:</strong> Values closer to -1 or +1 indicate stronger correlation</li>
                    </ul>
                    <p><strong>Why it matters:</strong> This helps identify if on-track performance has a stronger impact on moderate wait times (5-10 min) compared to longer waits (10+ min).</p>
                  </div>
                }
              />
            </h3>
          </div>
          <div className="correlation-content">
            <div className="correlation-value" style={{ color: getCorrelationColor(data.correlation5to10Direction) }}>
              {data.correlation5to10 > 0 ? '+' : ''}{data.correlation5to10.toFixed(2)}
            </div>
            <div className="correlation-label">
              {data.correlation5to10Strength.charAt(0).toUpperCase() + data.correlation5to10Strength.slice(1)} {data.correlation5to10Direction}
            </div>
            <div className="correlation-description" style={{ fontSize: '11px', marginTop: '8px' }}>
              {getCorrelationLabel(data.correlation5to10Direction)}
            </div>
          </div>
        </div>

        {/* 10+ Min Correlation */}
        <div className="insight-card results-correlation">
          <div className="insight-header">
            <h3>
              10+ Min Wait Correlation
              <InfoIcon 
                isDarkMode={isDarkMode}
                position="left"
                content={
                  <div style={{ textAlign: 'left' }}>
                    <p><strong>What this measures:</strong> The correlation coefficient between daily on-track percentage and the 10+ minute wait rate specifically.</p>
                    <p><strong>Calculation:</strong> Uses Pearson correlation coefficient to measure the linear relationship between on-track % and 10+ minute wait rates across all days in the selected date range.</p>
                    <p><strong>Interpretation:</strong></p>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      <li><strong>Negative correlation (desired):</strong> Higher on-track % correlates with lower 10+ min wait rates</li>
                      <li><strong>Positive correlation (concerning):</strong> Higher on-track % correlates with higher 10+ min wait rates</li>
                      <li><strong>Strength:</strong> Values closer to -1 or +1 indicate stronger correlation</li>
                    </ul>
                    <p><strong>Why it matters:</strong> This helps identify if on-track performance has a stronger impact on longer wait times (10+ min) compared to moderate waits (5-10 min). Comparing this with the 5-10 min correlation shows which wait time bucket is more sensitive to on-track performance.</p>
                  </div>
                }
              />
            </h3>
          </div>
          <div className="correlation-content">
            <div className="correlation-value" style={{ color: getCorrelationColor(data.correlation10PlusDirection) }}>
              {data.correlation10Plus > 0 ? '+' : ''}{data.correlation10Plus.toFixed(2)}
            </div>
            <div className="correlation-label">
              {data.correlation10PlusStrength.charAt(0).toUpperCase() + data.correlation10PlusStrength.slice(1)} {data.correlation10PlusDirection}
            </div>
            <div className="correlation-description" style={{ fontSize: '11px', marginTop: '8px' }}>
              {getCorrelationLabel(data.correlation10PlusDirection)}
            </div>
          </div>
        </div>

        {/* Improvement Potential */}
        <div className="insight-card results-summary">
          <div className="insight-header">
            <h3>
              Improvement Potential
              <InfoIcon 
                isDarkMode={isDarkMode}
                position="left"
                content={
                  <div style={{ textAlign: 'left' }}>
                    <p><strong>What this shows:</strong> The potential reduction in wait time rates if all days in the selected date range performed at the High (80-100%) on-track level.</p>
                    <p><strong>Calculation:</strong> Compares the current average wait rate with the average wait rate observed on days when on-track performance was High (80-100%).</p>
                    <p><strong>Formula:</strong> Current Average - High Performance Average = Potential Reduction</p>
                    <p><strong>Interpretation:</strong></p>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      <li><strong>Positive reduction (green):</strong> Indicates potential improvement - wait rates would decrease</li>
                      <li><strong>Negative reduction (red):</strong> Indicates potential increase - wait rates would increase (concerning)</li>
                    </ul>
                    <p><strong>Use case:</strong> This metric helps quantify the business impact of improving on-track performance. It answers the question: "If we consistently maintained High on-track performance, how much would wait times improve?"</p>
                    <p><strong>Note:</strong> This is a projection based on historical correlation, not a guarantee. Other factors may also influence wait times.</p>
                  </div>
                }
              />
            </h3>
          </div>
          <div className="summary-content">
            <div className="summary-item">
              <span className="summary-label">If all days matched High performance:</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">5-10 min reduction</span>
              <span className="summary-value" style={{ color: data.improvementPotential5to10 > 0 ? '#4cec8c' : '#fd8789' }}>
                {data.improvementPotential5to10 > 0 ? '-' : '+'}{Math.abs(data.improvementPotential5to10).toFixed(2)}%
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">10+ min reduction</span>
              <span className="summary-value" style={{ color: data.improvementPotential10Plus > 0 ? '#4cec8c' : '#fd8789' }}>
                {data.improvementPotential10Plus > 0 ? '-' : '+'}{Math.abs(data.improvementPotential10Plus).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scatter Plot: On Track vs Wait Time Rates by Bucket */}
      <div className="results-chart-container">
        <h3 className="chart-title">On Track vs Wait Time Rates by Bucket</h3>
        <p className="chart-subtitle">Each point represents one day's on-track percentage and wait time rate, broken down by 5-10 min and 10+ min buckets</p>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart data={data.dataPoints} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
            <XAxis 
              type="number"
              dataKey="onTrack"
              name="On Track %"
              domain={[0, 100]}
              stroke={isDarkMode ? '#ffffff' : '#292929'}
              tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
              label={{ value: 'On Track %', position: 'insideBottom', offset: -5, fill: isDarkMode ? '#ffffff' : '#292929' }}
              tickFormatter={(value) => value.toFixed(0)}
            />
            <YAxis 
              type="number"
              name="Wait Time Rate %"
              domain={[0, 'dataMax + 2']}
              stroke={isDarkMode ? '#ffffff' : '#292929'}
              tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
              label={{ value: 'Wait Time Rate (%)', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
              tickFormatter={(value) => value.toFixed(1)}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const pointData = payload[0].payload;
                  const onTrackValue = pointData?.onTrack || 0;
                  return (
                    <div style={{ 
                      backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                      border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                      borderRadius: '4px',
                      padding: '8px 12px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ fontSize: '12px', color: isDarkMode ? '#ffffff' : '#292929', marginBottom: '4px', fontWeight: 600 }}>
                        Date: {pointData?.date ? formatDateFull(pointData.date) : 'N/A'}
                      </div>
                      <div style={{ fontSize: '12px', color: isDarkMode ? '#ffffff' : '#292929', marginBottom: '4px' }}>
                        <strong>On Track %:</strong> {onTrackValue.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: '12px', color: isDarkMode ? '#ffffff' : '#292929', marginBottom: '4px' }}>
                        <strong style={{ color: '#3b82f6' }}>5-10 Min:</strong> {(pointData?.slowResponse5to10Pct || 0).toFixed(2)}%
                      </div>
                      <div style={{ fontSize: '12px', color: isDarkMode ? '#ffffff' : '#292929' }}>
                        <strong style={{ color: '#ef4444' }}>10+ Min:</strong> {(pointData?.slowResponse10PlusPct || 0).toFixed(2)}%
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend 
              wrapperStyle={{ color: isDarkMode ? '#ffffff' : '#292929' }}
              verticalAlign="top"
              align="center"
              margin={{ top: 0, bottom: 20 }}
            />
            {/* 5-10 Min Wait Scatter */}
            <Scatter 
              name="5-10 Min Wait Rate" 
              data={data.dataPoints} 
              dataKey="slowResponse5to10Pct"
              fill="#3b82f6"
            >
              {data.dataPoints.map((entry, index) => (
                <Cell key={`cell-5to10-${index}`} fill="#3b82f6" opacity={0.6} />
              ))}
            </Scatter>
            {/* 10+ Min Wait Scatter */}
            <Scatter 
              name="10+ Min Wait Rate" 
              data={data.dataPoints} 
              dataKey="slowResponse10PlusPct"
              fill="#ef4444"
            >
              {data.dataPoints.map((entry, index) => (
                <Cell key={`cell-10plus-${index}`} fill="#ef4444" opacity={0.6} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* What If Scenario Visualization */}
      <div className="results-chart-container">
        <h3 className="chart-title">Improvement Potential: Current vs High Performance Scenario</h3>
        <p className="chart-subtitle">Comparison of current average wait rates vs potential rates if all days matched High (80-100%) on-track performance</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart 
            data={[
              {
                bucket: '5-10 Min Waits',
                current: data.avgSlowResponse5to10,
                potential: data.rangeStats.find(r => r.range === 'High (80-100%)')?.avgSlowResponse5to10Pct || data.avgSlowResponse5to10,
                reduction: data.improvementPotential5to10
              },
              {
                bucket: '10+ Min Waits',
                current: data.avgSlowResponse10Plus,
                potential: data.rangeStats.find(r => r.range === 'High (80-100%)')?.avgSlowResponse10PlusPct || data.avgSlowResponse10Plus,
                reduction: data.improvementPotential10Plus
              }
            ]}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
            <XAxis 
              dataKey="bucket"
              stroke={isDarkMode ? '#ffffff' : '#292929'}
              tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
            />
            <YAxis 
              stroke={isDarkMode ? '#ffffff' : '#292929'}
              tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
              domain={[0, 'dataMax + 1']}
              label={{ value: 'Wait Rate (%)', angle: -90, position: 'insideLeft', fill: isDarkMode ? '#ffffff' : '#292929' }}
              tickFormatter={(value) => value.toFixed(1)}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`, 
                borderRadius: '4px',
                color: isDarkMode ? '#e5e5e5' : '#292929'
              }}
              formatter={(value, name) => {
                if (name === 'current') return [`${value.toFixed(2)}%`, 'Current Average'];
                if (name === 'potential') return [`${value.toFixed(2)}%`, 'Potential (High Performance)'];
                return [value, name];
              }}
            />
            <Legend wrapperStyle={{ color: isDarkMode ? '#ffffff' : '#292929' }} />
            <Bar 
              dataKey="current" 
              fill="#fd8789" 
              name="Current Average"
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="potential" 
              fill="#4cec8c" 
              name="Potential (High Performance)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-around', 
          marginTop: '16px',
          padding: '12px',
          backgroundColor: isDarkMode ? '#1e1e1e' : '#f8f9fa',
          borderRadius: '6px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: isDarkMode ? '#999' : '#666', marginBottom: '4px' }}>5-10 Min Reduction</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: data.improvementPotential5to10 > 0 ? '#4cec8c' : '#fd8789' }}>
              {data.improvementPotential5to10 > 0 ? '-' : '+'}{Math.abs(data.improvementPotential5to10).toFixed(2)}%
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: isDarkMode ? '#999' : '#666', marginBottom: '4px' }}>10+ Min Reduction</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: data.improvementPotential10Plus > 0 ? '#4cec8c' : '#fd8789' }}>
              {data.improvementPotential10Plus > 0 ? '-' : '+'}{Math.abs(data.improvementPotential10Plus).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* On Track Range Analysis */}
      <div className="results-range-analysis">
        <h3 className="section-title">Performance by On Track Range</h3>
        <p className="chart-subtitle" style={{ marginBottom: '16px' }}>Breakdown showing wait time rates for each on-track performance level</p>
        <div className="range-stats-grid">
          {data.rangeStats.map((range, index) => {
            const colors = ['#4cec8c', '#fbbf24', '#fd8789'];
            return (
              <div key={index} className="range-stat-card">
                <div className="range-stat-header" style={{ borderLeftColor: colors[index] }}>
                  <h4>{range.range}</h4>
                  <span className="range-count">{range.count} days</span>
                </div>
                <div className="range-stat-content">
                  <div className="range-stat-item">
                    <span className="range-stat-label">Avg On Track</span>
                    <span className="range-stat-value">{range.avgOnTrack.toFixed(1)}%</span>
                  </div>
                  <div className="range-stat-item" style={{ borderTop: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`, paddingTop: '8px', marginTop: '8px' }}>
                    <span className="range-stat-label">Avg 5-10 Min Wait Rate</span>
                    <span className="range-stat-value" style={{ color: '#3b82f6' }}>{range.avgSlowResponse5to10Pct.toFixed(2)}%</span>
                  </div>
                  <div className="range-stat-item">
                    <span className="range-stat-label">Avg 10+ Min Wait Rate</span>
                    <span className="range-stat-value" style={{ color: '#ef4444' }}>{range.avgSlowResponse10PlusPct.toFixed(2)}%</span>
                  </div>
                  <div className="range-stat-item" style={{ borderTop: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`, paddingTop: '8px', marginTop: '8px' }}>
                    <span className="range-stat-label">Total 5-10 Min Waits</span>
                    <span className="range-stat-value">{range.totalSlowResponses5to10 || 0}</span>
                  </div>
                  <div className="range-stat-item">
                    <span className="range-stat-label">Total 10+ Min Waits</span>
                    <span className="range-stat-value">{range.totalSlowResponses10Plus || 0}</span>
                  </div>
                  <div className="range-stat-item" style={{ borderTop: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`, paddingTop: '8px', marginTop: '8px' }}>
                    <span className="range-stat-label">Total Conversations</span>
                    <span className="range-stat-value">{range.totalConversations}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

export default HistoricalView;

