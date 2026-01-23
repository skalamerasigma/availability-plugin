import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import HistoricalView from "./HistoricalView";
import MyQueue from "./MyQueue";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ReferenceLine } from 'recharts';
import { formatDateTimeUTC, formatTimestampUTC, formatDateForChart, formatDateForTooltip, calculateTimeRemaining, formatTimeRemaining } from "./utils/dateUtils";
import "./Dashboard.css";

// Users who can see the footer dev controls (TSE/Manager toggle and simulation dropdowns)
// Add or remove names from this array to control access
const FOOTER_CONTROLS_USERS = ['Stephen Skalamera'];

// TSE Region mapping
const TSE_REGIONS = {
  'UK': ['Salman Filli', 'Erin Liu', 'Kabilan Thayaparan', 'J', 'Nathan Simpson', 'Somachi Ngoka'],
  'NY': ['Lyle Pierson Stachecki', 'Nick Clancey', 'Swapnil Deshpande', 'Ankita Dalvi', 'Grace Sanford', 'Erez Yagil', 'Julia Lusala', 'Betty Liu', 'Xyla Fang', 'Rashi Madnani', 'Nikhil Krishnappa', 'Ryan Jaipersaud', 'Krish Pawooskar', 'Siddhi Jadhav', 'Arley Schenker', 'David Zingher'],
  'SF': ['Sanyam Khurana', 'Hem Kamdar', 'Sagarika Sardesai', 'Nikita Bangale', 'Payton Steiner', 'Bhavana Prasad Kote', 'Grania M', 'Soheli Das', 'Hayden Greif-Neill', 'Roshini Padmanabha', 'Abhijeet Lal', 'Ratna Shivakumar', 'Sahibeer Singh', 'Vruddhi Kapre', 'Priyanshi Singh', 'Prerit Deshwal']
};

// Manager configuration with their teams
// Note: Manager names should match exactly how they appear in teamMembers from API
const MANAGER_CONFIG = {
  'Stephen Skalamera': {
    title: 'Manager',
    region: 'NY',
    team: [
      'Rashi Madnani',
      'Ankita Dalvi',
      'Nick Clancey',
      'Nikhil Krishnappa',
      'Ryan Jaipersaud',
      'Siddhi Jadhav',
      'Xyla Fang'
    ]
  },
  'Zen Junior': {
    title: 'Manager',
    region: 'NY',
    team: [
      'Erez Yagil',
      'Lyle Pierson Stachecki',
      'Julia Lusala',
      'Swapnil Deshpande',
      'Betty Liu',
      'David Zingher',
      'Krish Pawooskar',
      'Arley Schenker'
    ]
  },
  'Holly Coxon': {
    title: 'Manager',
    region: 'UK',
    team: ['Salman Filli', 'Erin Liu', 'Kabilan Thayaparan', 'J', 'Nathan Simpson', 'Somachi Ngoka']
  },
  'Chetena Shinde': {
    title: 'Manager',
    region: 'SF',
    team: ['Sanyam Khurana', 'Sagarika Sardesai', 'Nikita Bangale', 'Payton Steiner', 'Soheli Das', 'Roshini Padmanabha', 'Ratna Shivakumar', 'Sahibeer Singh']
  },
  'Leticia Esparza': {
    title: 'Manager',
    region: 'SF',
    team: ['Hem Kamdar', 'Hayden Greif-Neill', 'Abhijeet Lal', 'Prerit Deshwal', 'Bhavana Prasad Kote', 'Grania M', 'Priyanshi Singh']
  }
};

// Get all TSE names (non-managers) for role detection
const ALL_TSE_NAMES = Object.values(TSE_REGIONS).flat();
const ALL_MANAGER_NAMES = Object.keys(MANAGER_CONFIG);

// Helper function to determine user role: 'manager', 'tse', or 'other'
const getUserRole = (userName) => {
  if (!userName) return 'other';
  // Check if user is a manager
  if (ALL_MANAGER_NAMES.includes(userName)) return 'manager';
  // Check if user is a TSE
  if (ALL_TSE_NAMES.includes(userName)) return 'tse';
  return 'other';
};

// Helper function to get manager info for a user
const getManagerInfo = (userName) => {
  return MANAGER_CONFIG[userName] || null;
};

// Helper function to get manager's team member names
const getManagerTeam = (userName) => {
  const managerInfo = MANAGER_CONFIG[userName];
  return managerInfo ? managerInfo.team : [];
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

// TSE Avatar mapping (first name to Cloudinary URL)
const TSE_AVATARS = {
  // New York
  'Nick': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232392/2_fpxpja.svg',
  'Julia': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232388/17_hxyc2t.svg',
  'Ankita': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765282918/Untitled_design_10_bsgeve.svg',
  'Nikhil': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765284907/Untitled_design_13_qeyxww.svg',
  'Erez': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232390/10_ttgpck.svg',
  'Xyla': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232391/7_qwfphq.svg',
  'Rashi': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765293772/Untitled_design_14_w3uv23.svg',
  'Ryan': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232392/5_kw4h8x.svg',
  'Krish': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232388/15_hwmz5x.svg',
  'Lyle': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232388/14_vqo4ks.svg',
  'Betty': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232391/8_efebpc.svg',
  'Arley': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232390/9_vpzwjd.svg',
  'Siddhi': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232392/6_f3d2qt.svg',
  'Swapnil': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232390/11_xrb9qj.svg',
  'Stephen': 'https://res.cloudinary.com/doznvxtja/image/upload/v1767811907/Untitled_design_15_cvscw6.svg',
  // San Francisco
  'Priyanshi': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232390/12_avm2xl.svg',
  'Sanyam': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765382789/Untitled_design_10_kzcja0.svg',
  'Hem': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765318686/Untitled_design_22_uydf2h.svg',
  'Sagarika': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232530/Untitled_design_8_ikixmx.svg',
  'Nikita': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765284091/Untitled_design_11_mbsjbt.svg',
  'Payton': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232385/22_pammoi.svg',
  'Bhavana': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765318568/Untitled_design_21_kuwvcw.svg',
  'Grania': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232388/21_tjy6io.svg',
  'Soheli': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765318474/Untitled_design_20_zsho0q.svg',
  'Hayden': 'https://static.intercomassets.com/avatars/8411107/square_128/IMG_4063-1748968966.JPG',
  'Roshini': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765311036/Untitled_design_19_ls5fat.svg',
  'Abhijeet': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765310522/Untitled_design_16_jffaql.svg',
  'Ratna': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765311039/Untitled_design_17_lchaky.svg',
  'Sahibeer': 'https://res.cloudinary.com/doznvxtja/image/upload/v1767268642/sahibeer_g0bk1n.svg',
  'Vruddhi': 'https://res.cloudinary.com/doznvxtja/image/upload/v1768229860/Untitled_design_26_sfcjzp.svg',
  'David': 'https://res.cloudinary.com/doznvxtja/image/upload/v1768229654/Untitled_design_24_yq1bfi.svg',
  // London/UK
  'Nathan': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232389/13_flxpry.svg',
  'J': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232387/18_yqqjho.svg',
  'Kabilan': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232387/16_hgphrw.svg',
  'Salman': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232386/20_ukjqlc.svg',
  'Erin': 'https://res.cloudinary.com/doznvxtja/image/upload/v1765232386/19_q54uo5.svg',
  'Somachi': 'https://res.cloudinary.com/doznvxtja/image/upload/v1767886159/Untitled_design_17_zhhc3u.svg',
  // Managers
  'Zen': 'https://static.intercomassets.com/avatars/8893370/square_128/photo_squared-1758117953.jpeg',
  'Holly': 'https://static.intercomassets.com/avatars/7254229/square_128/IMG_5367-1740050085.jpg',
  'Chetena': 'https://static.intercomassets.com/avatars/7274393/square_128/intercom_1712708295666-1712708358.jpeg',
  'Leticia': 'https://res.cloudinary.com/doznvxtja/image/upload/v1768860295/Untitled_design_26_ntzcqf.svg'
};

// Helper function to get avatar URL for a TSE name
const getTSEAvatar = (tseName) => {
  if (!tseName) return null;
  // Extract first name from full name
  const firstName = tseName.split(' ')[0];
  return TSE_AVATARS[firstName] || null;
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
    // For display labels, we'll need to infer the year
    const parts = dateStr.split('/');
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
    // Try to get year from data if available, otherwise use current year
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
const createHolidayLabel = (data, isBarChart = false) => (props) => {
  const { x, y, index, width } = props;
  if (index === undefined || !data || !data[index]) return null;
  
  const dataPoint = data[index];
  const dateStr = dataPoint.date || dataPoint.displayLabel;
  
  const iconUrl = getHolidayIcon(dateStr);
  if (!iconUrl) return null;
  
  // For bar charts, center the icon horizontally within the bar
  // For line/area charts, center on the data point
  const iconX = isBarChart && width ? (x + width / 2 - 15) : (x - 15);
  
  return (
    <g>
      <image
        href={iconUrl}
        x={iconX}
        y={y - 60}
        width="30"
        height="30"
      />
    </g>
  );
};

// TSEs to exclude from the dashboard
const EXCLUDED_TSE_NAMES = [
  "Zen Junior",
  "Nathan Parrish",
  "Prerit Sachdeva",
  "Leticia Esparza",
  "Rob Woollen",
  "Brett Bedevian",
  "Viswa Jeyaraman",
  "Brandon Yee",
  "Holly Coxon",
  "Chetana Shinde",
  "Matt Morgenroth",
  "Grace Sanford",
  "svc-prd-tse-intercom SVC"
];

// InfoIcon Component for tooltips
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

// Thresholds from Accountability Framework
// Wait time targets
const WAIT_TIME_TARGETS = {
  TARGET_10_PLUS_MIN: 0, // Target for 10+ min waits: 0%
  TARGET_5_TO_10_MIN: 2  // Target for 5-10 min waits: 2%
};

const THRESHOLDS = {
  MAX_OPEN_IDEAL: 0,
  MAX_OPEN_SOFT: 5,
  MAX_OPEN_ALERT: 6,
  MAX_WAITING_ON_TSE_SOFT: 5,
  MAX_WAITING_ON_TSE_ALERT: 7
};

function Dashboard(props) {
  const { conversations = [], teamMembers = [], loading, error, onRefresh, lastUpdated } = props;
  const { logout, user } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  
  // Match authenticated user to a TSE in the team
  const currentTSE = useMemo(() => {
    if (!user || !teamMembers || teamMembers.length === 0) return null;
    
    // Try to match by ID first (most reliable)
    if (user.id) {
      const matchById = teamMembers.find(tse => String(tse.id) === String(user.id));
      if (matchById) return matchById;
    }
    
    // Try to match by email
    if (user.email) {
      const userEmail = user.email.toLowerCase();
      const matchByEmail = teamMembers.find(tse => 
        tse.email && tse.email.toLowerCase() === userEmail
      );
      if (matchByEmail) return matchByEmail;
    }
    
    // Try to match by name as fallback
    if (user.name) {
      const userName = user.name.toLowerCase();
      const matchByName = teamMembers.find(tse => 
        tse.name && tse.name.toLowerCase() === userName
      );
      if (matchByName) return matchByName;
    }
    
    return null;
  }, [user, teamMembers]);
  
  // Check if user has access to footer dev controls
  const hasFooterControlsAccess = FOOTER_CONTROLS_USERS.includes(user?.name);
  
  // Toggle for users with footer controls access to switch between TSE and Manager modes (defaults to Manager mode)
  const [devViewMode, setDevViewMode] = useState('manager'); // 'manager' or 'tse'
  
  // TSE simulation - allows viewing as any TSE
  const [simulatedTSEId, setSimulatedTSEId] = useState(null);
  
  // Manager simulation - allows viewing as any manager
  const [simulatedManagerName, setSimulatedManagerName] = useState(null);
  
  // Audit logs modal state
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  
  // Get the effective TSE (simulated or actual) - used for MyQueue display
  const effectiveTSE = useMemo(() => {
    // Only allow simulation when user has footer controls access and is in TSE mode
    if (hasFooterControlsAccess && devViewMode === 'tse' && simulatedTSEId && teamMembers.length > 0) {
      const simulated = teamMembers.find(tse => String(tse.id) === String(simulatedTSEId));
      if (simulated) return simulated;
    }
    return currentTSE;
  }, [hasFooterControlsAccess, devViewMode, simulatedTSEId, teamMembers, currentTSE]);
  
  // Determine user role based on their name (with dev controls toggle override)
  const userRole = useMemo(() => {
    if (!user?.name) return 'other';
    // Special case: Users with footer controls access can toggle between TSE and Manager modes
    if (hasFooterControlsAccess) {
      return devViewMode === 'manager' ? 'manager' : 'tse';
    }
    return getUserRole(user.name);
  }, [user?.name, hasFooterControlsAccess, devViewMode]);
  
  // Get manager info if user is a manager (uses simulated manager if selected)
  const managerInfo = useMemo(() => {
    if (userRole !== 'manager') return null;
    // If user is simulating another manager, use that manager's info
    if (hasFooterControlsAccess && simulatedManagerName) {
      return getManagerInfo(simulatedManagerName);
    }
    if (!user?.name) return null;
    return getManagerInfo(user.name);
  }, [userRole, user?.name, hasFooterControlsAccess, simulatedManagerName]);
  
  // Get manager's team members (filtered from teamMembers)
  const managerTeamMembers = useMemo(() => {
    if (userRole !== 'manager' || !teamMembers) return [];
    // If user is simulating another manager, use that manager's team
    const managerName = hasFooterControlsAccess && simulatedManagerName ? simulatedManagerName : user?.name;
    if (!managerName) return [];
    const teamNames = getManagerTeam(managerName);
    return teamMembers.filter(member => teamNames.includes(member.name));
  }, [userRole, user?.name, teamMembers, hasFooterControlsAccess, simulatedManagerName]);
  
  // Set default view based on role - TSE users start on MyQueue
  const [activeView, setActiveView] = useState(() => {
    // Initial state will be updated after user role is determined
    return "overview";
  });
  
  // Snooze timer modal state
  const [snoozeModalOpen, setSnoozeModalOpen] = useState(false);
  
  // Track if initial view has been set to prevent changing view on refresh
  const initialViewSetRef = useRef(false);
  
  // Update active view when user role is determined (only set initial view, don't change if user navigated)
  useEffect(() => {
    // Only set initial view once, and only if still on default view
    if (!initialViewSetRef.current && userRole === 'tse' && currentTSE && activeView === 'overview') {
      setActiveView("myqueue");
      initialViewSetRef.current = true;
    } else if (!initialViewSetRef.current && userRole !== 'tse') {
      // Mark as set for non-TSE users too (they stay on overview)
      initialViewSetRef.current = true;
    }
  }, [userRole, currentTSE, activeView]);
  const [filterTag, setFilterTag] = useState(["all"]);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const [filterTSE, setFilterTSE] = useState("all");
  const [expandedFilters, setExpandedFilters] = useState(new Set()); // Default collapsed
  
  // Dismissed items management (must be early for use throughout component)
  const insightsDismissed = useDismissedItems('dismissedKeyInsights');
  const alertsDismissed = useDismissedItems('dismissedAlerts');

  // Extract dismiss functions for useMemo (ESLint needs explicit reference)
  const isInsightDismissed = insightsDismissed.isDismissed;
  const dismissInsightItem = insightsDismissed.dismissItem;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setFilterDropdownOpen(false);
      }
    };
    
    if (filterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterDropdownOpen]);
  const [searchId, setSearchId] = useState("");
  const [historicalSnapshots, setHistoricalSnapshots] = useState([]);
  const [responseTimeMetrics, setResponseTimeMetrics] = useState([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [selectedTSE, setSelectedTSE] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [streaksRegionFilter, setStreaksRegionFilter] = useState('all');
  const [isStreaksModalOpen, setIsStreaksModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [alertsDropdownOpen, setAlertsDropdownOpen] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [wasLoading, setWasLoading] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [selectedColors, setSelectedColors] = useState(new Set(['warning', 'exceeding', 'success', 'error'])); // All selected by default
  const [selectedRegions, setSelectedRegions] = useState(new Set(['UK', 'NY', 'SF', 'Other'])); // All selected by default

  // Fetch historical data for Overview tab
  useEffect(() => {
    if (activeView === "overview") {
      fetchOverviewHistoricalData();
    }
  }, [activeView]);


  // Refresh historical data when conversations are refreshed (for auto-refresh)
  // This ensures Overview tab data refreshes automatically
  useEffect(() => {
    if (activeView === "overview" && lastUpdated) {
      // Refresh historical data when conversations are auto-refreshed
      // Only refresh if we're on overview tab
      console.log('Dashboard: Auto-refresh triggered for Overview tab');
      fetchOverviewHistoricalData();
    }
  }, [lastUpdated, activeView]);

  const fetchOverviewHistoricalData = async () => {
    setLoadingHistorical(true);
    try {
      // Get last 7 weekdays (same logic as Historical tab)
      const getLast7Weekdays = () => {
        const dates = [];
        const today = new Date();
        let daysBack = 0;
        let weekdaysFound = 0;
        
        while (weekdaysFound < 7 && daysBack < 14) {
          const date = new Date(today);
          date.setDate(date.getDate() - daysBack);
          const dayOfWeek = date.getDay();
          
          // Monday = 1, Friday = 5
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

      console.log('Overview: Fetching snapshots for date range:', { startDateStr, endDateStr, weekdays });

      // Fetch historical snapshots
      const snapshotParams = new URLSearchParams();
      snapshotParams.append('startDate', startDateStr);
      snapshotParams.append('endDate', endDateStr);
      
      // In development, use production API URL since local dev server doesn't have API routes
      const snapshotUrl = process.env.NODE_ENV === 'production'
        ? `${window.location.origin}/api/snapshots/get?${snapshotParams}`
        : `https://queue-health-monitor.vercel.app/api/snapshots/get?${snapshotParams}`;
      
      console.log('Overview: Fetching from URL:', snapshotUrl);
      try {
        const snapshotRes = await fetch(snapshotUrl);
        if (snapshotRes.ok) {
          const snapshotData = await snapshotRes.json();
          console.log('Overview: Received snapshot data:', { 
            snapshotsCount: snapshotData.snapshots?.length || 0,
            snapshots: snapshotData.snapshots 
          });
          setHistoricalSnapshots(snapshotData.snapshots || []);
        } else {
          const errorText = await snapshotRes.text();
          console.error('Overview: Failed to fetch snapshots:', snapshotRes.status, errorText);
        }
      } catch (error) {
        console.error('Overview: Error fetching snapshots:', error);
        // Silently fail in development - historical data is optional
      }

      // Fetch response time metrics
      const metricParams = new URLSearchParams();
      metricParams.append('startDate', startDateStr);
      metricParams.append('endDate', endDateStr);
      
      // In development, use production API URL since local dev server doesn't have API routes
      const metricUrl = process.env.NODE_ENV === 'production'
        ? `${window.location.origin}/api/response-time-metrics/get?${metricParams}`
        : `https://queue-health-monitor.vercel.app/api/response-time-metrics/get?${metricParams}`;
      
      try {
        const metricRes = await fetch(metricUrl);
        if (metricRes.ok) {
          const metricData = await metricRes.json();
          setResponseTimeMetrics(metricData.metrics || []);
        }
      } catch (error) {
        console.error('Overview: Error fetching response time metrics:', error);
        // Silently fail in development - historical data is optional
      }
    } catch (error) {
      console.error('Error fetching overview historical data:', error);
      // In development, this is expected since API routes aren't available locally
      // Set empty arrays so the UI doesn't break
      setHistoricalSnapshots([]);
      setResponseTimeMetrics([]);
    } finally {
      setLoadingHistorical(false);
    }
  };

  const handleSaveSnapshot = async () => {
    try {
      // Calculate current TSE metrics
      const EXCLUDED_TSE_NAMES = [
        "Zen Junior", "Nathan Parrish", "Leticia Esparza",
        "Rob Woollen", "Brett Bedevian", "Viswa Jeyaraman", "Brandon Yee",
        "Holly Coxon", "Chetana Shinde", "Matt Morgenroth", "Grace Sanford",
        "Prerit Sachdeva", "Stephen Skalamera", "svc-prd-tse-intercom SVC"
      ];

      const byTSE = {};
      teamMembers.forEach(admin => {
        const tseId = admin.id;
        if (tseId && !EXCLUDED_TSE_NAMES.includes(admin.name)) {
          byTSE[tseId] = {
            id: tseId,
            name: admin.name || admin.email?.split("@")[0] || `TSE ${tseId}`,
            open: 0,
            waitingOnTSE: 0,
            waitingOnCustomerResolved: 0,
            waitingOnCustomerUnresolved: 0,
            waitingOnCustomer: 0, // Keep for backward compatibility
            totalSnoozed: 0
          };
        }
      });

      conversations.forEach((conv) => {
        const hasAssigneeId = conv.admin_assignee_id && conv.admin_assignee_id !== null;
        const hasAssigneeObject = conv.admin_assignee && 
                                  (typeof conv.admin_assignee === "object" ? (conv.admin_assignee.id || conv.admin_assignee.name) : true);
        const isUnassigned = !hasAssigneeId && !hasAssigneeObject;
        
        if (isUnassigned) return;

        const tseId = conv.admin_assignee_id || 
                      (conv.admin_assignee && typeof conv.admin_assignee === "object" ? conv.admin_assignee.id : null);
        
        if (!tseId || !byTSE[tseId]) return;

        const assigneeName = conv.admin_assignee?.name || 
                            (typeof conv.admin_assignee === "string" ? conv.admin_assignee : null);
        if (assigneeName && EXCLUDED_TSE_NAMES.includes(assigneeName)) return;

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

        if (isSnoozed) {
          byTSE[tseId].totalSnoozed = (byTSE[tseId].totalSnoozed || 0) + 1;
          if (hasWaitingOnTSETag) {
            byTSE[tseId].waitingOnTSE++;
          } else if (hasWaitingOnCustomerResolvedTag) {
            byTSE[tseId].waitingOnCustomerResolved++;
            byTSE[tseId].waitingOnCustomer++; // Keep total for backward compatibility
          } else if (hasWaitingOnCustomerUnresolvedTag) {
            byTSE[tseId].waitingOnCustomerUnresolved++;
            byTSE[tseId].waitingOnCustomer++; // Keep total for backward compatibility
          }
        }

        if (conv.state === "open" && !isSnoozed) {
          byTSE[tseId].open++;
        }
      });

      const snapshot = {
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        tseData: Object.values(byTSE).map(tse => ({
          id: tse.id,
          name: tse.name,
          open: tse.open,
          waitingOnTSE: tse.waitingOnTSE,
          waitingOnCustomerResolved: tse.waitingOnCustomerResolved,
          waitingOnCustomerUnresolved: tse.waitingOnCustomerUnresolved,
          waitingOnCustomer: tse.waitingOnCustomer, // Keep for backward compatibility
          totalSnoozed: tse.totalSnoozed || 0
        }))
      };

      const apiPath = process.env.NODE_ENV === 'production' 
        ? '/api/snapshots/save'
        : 'http://localhost:3000/api/snapshots/save';
      
      const url = process.env.NODE_ENV === 'production'
        ? `${window.location.origin}/api/snapshots/save`
        : apiPath;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot)
      });

      if (res.ok) {
        alert('Snapshot saved successfully!');
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Snapshot save error:', errorData);
        throw new Error(errorData.error || errorData.detail || `Failed to save snapshot: ${res.status}`);
      }
    } catch (error) {
      console.error('Error saving snapshot:', error);
      alert('Failed to save snapshot: ' + error.message);
    }
  };

  // Process conversations to extract metrics
  const metrics = useMemo(() => {
    // Create a map of all team members first
    const allTSEsMap = {};
    
    // DEBUG: Log all team members received from API
    console.log('=== TSE DEBUG START ===');
    console.log(`Total team members received: ${teamMembers.length}`);
    console.log('All team members:', teamMembers.map(m => ({ id: m.id, name: m.name, email: m.email })));
    
    // Check specifically for Stephen Skalamera
    const stephenInTeam = teamMembers.find(m => m.name?.toLowerCase().includes('stephen'));
    console.log('Stephen in team members?', stephenInTeam ? stephenInTeam : 'NOT FOUND');
    
    // Add all team members to the map (even if they have 0 conversations)
    teamMembers.forEach(admin => {
      const tseId = admin.id;
      const isExcluded = EXCLUDED_TSE_NAMES.includes(admin.name);
      console.log(`Processing: ${admin.name} (ID: ${tseId}) - Excluded: ${isExcluded}`);
      
      if (tseId && !isExcluded) {
        allTSEsMap[tseId] = {
          id: tseId,
          name: admin.name || admin.email?.split("@")[0] || `TSE ${tseId}`,
          open: 0,
          totalSnoozed: 0,
          waitingOnTSE: 0,
          waitingOnCustomer: 0,
          awayModeEnabled: admin.away_mode_enabled || false
        };
      }
    });
    
    console.log(`TSEs after filtering: ${Object.keys(allTSEsMap).length}`);
    console.log('Filtered TSEs:', Object.values(allTSEsMap).map(t => ({ name: t.name, away: t.awayModeEnabled })));
    console.log('=== TSE DEBUG END ===');
    
    // Track unassigned conversations separately
    const unassignedConversations = {
      total: 0,
      waitTimes: []
    };
    
    if (!conversations || conversations.length === 0) {
      return {
        totalOpen: 0,
        totalSnoozed: 0,
        byTSE: Object.values(allTSEsMap), // Return all team members even with 0 conversations
        unassignedConversations: { total: 0, waitTimes: [], medianWaitTime: 0 },
        waitingOnTSE: [],
        waitingOnCustomer: [],
        alerts: []
      };
    }

    const byTSE = { ...allTSEsMap }; // Start with all team members
    const waitingOnTSEConvs = [];
    const waitingOnCustomerConvs = [];
    const alerts = [];

    const now = Date.now() / 1000; // Unix timestamp in seconds

    conversations.forEach((conv) => {
      // Check if conversation is unassigned - more robust check
      // Check multiple possible ways Intercom might represent unassigned
      const hasAssigneeId = conv.admin_assignee_id && 
                            conv.admin_assignee_id !== null && 
                            conv.admin_assignee_id !== undefined &&
                            conv.admin_assignee_id !== "";
      const hasAssigneeObject = conv.admin_assignee && 
                                (typeof conv.admin_assignee === "object" ? (conv.admin_assignee.id || conv.admin_assignee.name) : true);
      const isUnassigned = !hasAssigneeId && !hasAssigneeObject;
      
      // Debug: log first few conversations to understand structure
      if (conversations.indexOf(conv) < 3) {
        console.log('Sample conversation:', {
          id: conv.id,
          admin_assignee_id: conv.admin_assignee_id,
          admin_assignee: conv.admin_assignee,
          state: conv.state,
          snoozed_until: conv.snoozed_until,
          isUnassigned
        });
      }
      
      // Skip excluded TSEs
      const assigneeName = conv.admin_assignee?.name || 
                          (typeof conv.admin_assignee === "string" ? conv.admin_assignee : null);
      if (assigneeName && EXCLUDED_TSE_NAMES.includes(assigneeName)) {
        return; // Skip this conversation
      }
      
      // Handle unassigned conversations separately
      if (isUnassigned) {
        unassignedConversations.total++;
        
        // Track wait times for median calculation
        const createdAt = conv.created_at || conv.createdAt || conv.first_opened_at;
        if (createdAt) {
          const createdTimestamp = typeof createdAt === "number" ? createdAt : new Date(createdAt).getTime() / 1000;
          const waitTimeHours = (now - createdTimestamp) / 3600;
          if (!unassignedConversations.waitTimes) {
            unassignedConversations.waitTimes = [];
          }
          unassignedConversations.waitTimes.push(waitTimeHours);
        }
        
        return; // Don't process unassigned conversations as TSEs
      }
      
      // Get TSE ID for assigned conversations
      const tseId = conv.admin_assignee_id || 
                    (conv.admin_assignee && typeof conv.admin_assignee === "object" ? conv.admin_assignee.id : null);
      
      if (!tseId) {
        // Shouldn't happen if isUnassigned check worked, but fallback
        return;
      }
      
      if (!byTSE[tseId]) {
        // Try to get name from admin_assignee object, or use ID as fallback
        let tseName = "Unassigned";
        if (tseId !== "unassigned") {
          if (conv.admin_assignee) {
            // admin_assignee can be an object with name/email, or just a string
            if (typeof conv.admin_assignee === "string") {
              tseName = conv.admin_assignee;
            } else if (conv.admin_assignee.name) {
              tseName = conv.admin_assignee.name;
            } else if (conv.admin_assignee.email) {
              tseName = conv.admin_assignee.email.split("@")[0]; // Use email username
            } else {
              tseName = `TSE ${tseId}`;
            }
          } else {
            // Has ID but no admin_assignee object - use ID
            tseName = `TSE ${tseId}`;
          }
        }
        
        // Look up away status from teamMembers if available
        const teamMember = teamMembers.find(m => String(m.id) === String(tseId));
        byTSE[tseId] = {
          id: tseId,
          name: tseName,
          open: 0,
          totalSnoozed: 0,
          waitingOnTSE: 0,
          waitingOnCustomer: 0,
          snoozedForOnTrack: 0, // All snoozed EXCEPT customer-waiting tags
          awayModeEnabled: teamMember?.away_mode_enabled || false
        };
      } else {
        // Update name if we find a better one (if current is "Unassigned" or "TSE X")
        if (conv.admin_assignee) {
          let newName = null;
          if (typeof conv.admin_assignee === "string") {
            newName = conv.admin_assignee;
          } else if (conv.admin_assignee.name) {
            newName = conv.admin_assignee.name;
          } else if (conv.admin_assignee.email) {
            newName = conv.admin_assignee.email.split("@")[0];
          }
          
          // Always update if we have a real name and current is placeholder
          if (newName && (byTSE[tseId].name === "Unassigned" || byTSE[tseId].name.startsWith("TSE "))) {
            byTSE[tseId].name = newName;
          }
        }
      }

      // Check if snoozed - check multiple possible indicators
      // Intercom may use different field names, so check all possibilities
      const isSnoozed = conv.state === "snoozed" || 
                       conv.state === "Snoozed" ||
                       conv.snoozed_until || 
                       (conv.statistics && conv.statistics.state === "snoozed") ||
                       (conv.source && conv.source.type === "snoozed") ||
                       (conv.conversation_parts && conv.conversation_parts.some(part => part.state === "snoozed"));
      const tags = Array.isArray(conv.tags) ? conv.tags : [];
      
      // New tag detection: snooze.waiting-on-tse
      const hasWaitingOnTSETag = tags.some(t => 
        (t.name && t.name.toLowerCase() === "snooze.waiting-on-tse") || 
        (typeof t === "string" && t.toLowerCase() === "snooze.waiting-on-tse")
      );
      // New tag detection: snooze.waiting-on-customer-resolved OR snooze.waiting-on-customer-unresolved
      const hasWaitingOnCustomerTag = tags.some(t => 
        (t.name && (t.name.toLowerCase() === "snooze.waiting-on-customer-resolved" || t.name.toLowerCase() === "snooze.waiting-on-customer-unresolved")) || 
        (typeof t === "string" && (t.toLowerCase() === "snooze.waiting-on-customer-resolved" || t.toLowerCase() === "snooze.waiting-on-customer-unresolved"))
      );

      // Count all snoozed conversations
      if (isSnoozed) {
        byTSE[tseId].totalSnoozed++;
      }

      if (conv.state === "open" && !isSnoozed) {
        byTSE[tseId].open++;
      }

      if (isSnoozed) {
        if (hasWaitingOnTSETag) {
          byTSE[tseId].waitingOnTSE++;
          waitingOnTSEConvs.push(conv);
        } else if (hasWaitingOnCustomerTag) {
          byTSE[tseId].waitingOnCustomer++;
          waitingOnCustomerConvs.push(conv);
        }
        // Note: Snoozed conversations without specific tags are only counted in totalSnoozed
        
        // For "snoozed on track" metric: count all snoozed EXCEPT customer-waiting tags
        // This includes: waiting-on-tse tagged, and snoozed without tags
        // Excludes: waiting-on-customer-resolved and waiting-on-customer-unresolved
        if (!hasWaitingOnCustomerTag) {
          // Count all snoozed conversations that don't have customer-waiting tags
          byTSE[tseId].snoozedForOnTrack = (byTSE[tseId].snoozedForOnTrack || 0) + 1;
        }
      }

    });
    
    // Generate alerts AFTER processing all conversations (to avoid duplicates)
    Object.values(byTSE).forEach(tse => {
      // Skip excluded TSEs
      if (EXCLUDED_TSE_NAMES.includes(tse.name) || 
          tse.name === "Unassigned" || 
          tse.name.toLowerCase().includes("unassigned")) {
        return;
      }
      
      const totalOpen = tse.open;
      const totalWaitingOnTSE = tse.waitingOnTSE;
      
      if (totalOpen >= THRESHOLDS.MAX_OPEN_ALERT) {
        // Determine severity based on how far above threshold
        // Medium (🟡): threshold to threshold + 2 (6-8)
        // High (🔴): threshold + 3 or more (9+)
        const severity = totalOpen >= THRESHOLDS.MAX_OPEN_ALERT + 3 ? "high" : "medium";
        alerts.push({
          type: "open_threshold",
          severity: severity,
          tseId: tse.id,
          tseName: tse.name,
          message: `${tse.name}: ${totalOpen} open chats (threshold: ${THRESHOLDS.MAX_OPEN_ALERT}+)`,
          count: totalOpen,
          id: `alert-${tse.id}-open-${totalOpen}` // Unique ID for dismiss functionality
        });
      }
      
      if (totalWaitingOnTSE >= THRESHOLDS.MAX_WAITING_ON_TSE_ALERT) {
        // Determine severity based on how far above threshold
        // Medium (🟡): threshold to threshold + 2 (7-9)
        // High (🔴): threshold + 3 or more (10+)
        const severity = totalWaitingOnTSE >= THRESHOLDS.MAX_WAITING_ON_TSE_ALERT + 3 ? "high" : "medium";
        alerts.push({
          type: "waiting_on_tse_threshold",
          severity: severity,
          tseId: tse.id,
          tseName: tse.name,
          message: `${tse.name}: ${totalWaitingOnTSE} waiting on TSE (threshold: ${THRESHOLDS.MAX_WAITING_ON_TSE_ALERT}+)`,
          count: totalWaitingOnTSE,
          id: `alert-${tse.id}-snoozed-${totalWaitingOnTSE}` // Unique ID for dismiss functionality
        });
      }
    });

    // Filter out excluded TSEs and "Unassigned"
    const filteredByTSE = Object.values(byTSE).filter(tse => 
      !EXCLUDED_TSE_NAMES.includes(tse.name) && 
      tse.name !== "Unassigned" && 
      !tse.name.toLowerCase().includes("unassigned")
    );
    
    // Calculate median wait time for unassigned conversations
    let medianWaitTime = 0;
    if (unassignedConversations.waitTimes && unassignedConversations.waitTimes.length > 0) {
      const sorted = [...unassignedConversations.waitTimes].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianWaitTime = sorted.length % 2 === 0 
        ? (sorted[mid - 1] + sorted[mid]) / 2 
        : sorted[mid];
    }
    unassignedConversations.medianWaitTime = Math.round(medianWaitTime * 10) / 10; // Round to 1 decimal
    
    // Debug: Log TSE counts
    console.log(`Total TSEs found: ${Object.keys(byTSE).length}, After filtering: ${filteredByTSE.length}`);
    console.log('TSE names:', filteredByTSE.map(t => t.name).sort());
    console.log('Unassigned conversations:', unassignedConversations);
    
    // Filter alerts to exclude excluded TSEs
    const filteredAlerts = alerts.filter(alert => 
      !EXCLUDED_TSE_NAMES.includes(alert.tseName)
    );

    // Calculate total snoozed more robustly
    const totalSnoozedCount = conversations.filter(c => {
      const isSnoozed = c.state === "snoozed" || 
                       c.snoozed_until || 
                       (c.statistics && c.statistics.state === "snoozed") ||
                       (c.source && c.source.type === "snoozed");
      return isSnoozed;
    }).length;
    
    // Calculate on-track metrics
    const totalTSEs = filteredByTSE.length;
    let onTrackBoth = 0;
    let onTrackOpen = 0; // TSEs meeting open requirement (regardless of snoozed)
    let onTrackSnoozed = 0; // TSEs meeting snoozed requirement (regardless of open)
    
    filteredByTSE.forEach(tse => {
      const meetsOpen = tse.open <= THRESHOLDS.MAX_OPEN_SOFT;
      // For "snoozed on track": count all snoozed EXCEPT customer-waiting tags
      // This includes: waiting-on-tse tagged, and snoozed without tags
      const snoozedForOnTrack = tse.snoozedForOnTrack || tse.waitingOnTSE || 0; // Fallback to waitingOnTSE for backward compatibility
      const meetsWaitingOnTSE = snoozedForOnTrack <= THRESHOLDS.MAX_WAITING_ON_TSE_SOFT;
      
      if (meetsOpen && meetsWaitingOnTSE) {
        onTrackBoth++;
      }
      
      // Count independently - these are not mutually exclusive
      if (meetsOpen) {
        onTrackOpen++;
      }
      if (meetsWaitingOnTSE) {
        onTrackSnoozed++;
      }
    });
    
    const onTrackOverall = totalTSEs > 0 ? Math.round((onTrackBoth / totalTSEs) * 100) : 0;
    const onTrackOpenOnlyPct = totalTSEs > 0 ? Math.round((onTrackOpen / totalTSEs) * 100) : 0;
    const onTrackSnoozedOnlyPct = totalTSEs > 0 ? Math.round((onTrackSnoozed / totalTSEs) * 100) : 0;
    
    // Debug logging
    console.log('On Track breakdown:', {
      totalTSEs,
      onTrackBoth,
      onTrackOpen,
      onTrackSnoozed,
      onTrackOverall: `${onTrackOverall}%`,
      onTrackOpenOnly: `${onTrackOpenOnlyPct}%`,
      onTrackSnoozedOnly: `${onTrackSnoozedOnlyPct}%`
    });
    
    return {
      totalOpen: conversations.filter(c => {
        // Exclude conversations from excluded TSEs (to match filtered table behavior)
        const assigneeName = c.admin_assignee?.name || 
                            (typeof c.admin_assignee === "string" ? c.admin_assignee : null);
        if (assigneeName && EXCLUDED_TSE_NAMES.includes(assigneeName)) {
          return false;
        }
        const isSnoozed = c.state === "snoozed" || c.snoozed_until;
        return c.state === "open" && !isSnoozed;
      }).length,
      totalSnoozed: totalSnoozedCount,
      byTSE: Array.isArray(filteredByTSE) ? filteredByTSE : [],
      unassignedConversations,
      waitingOnTSE: Array.isArray(waitingOnTSEConvs) ? waitingOnTSEConvs : [],
      waitingOnCustomer: Array.isArray(waitingOnCustomerConvs) ? waitingOnCustomerConvs : [],
      alerts: Array.isArray(filteredAlerts) ? filteredAlerts : [],
      onTrackOverall,
      onTrackOpenOnly: onTrackOpenOnlyPct,
      onTrackSnoozedOnly: onTrackSnoozedOnlyPct
    };
    }, [conversations, teamMembers]);

  // Get current user's TSE metrics from the calculated data
  const currentTSEMetrics = useMemo(() => {
    // Use effectiveTSE (which includes simulated TSE for Stephen)
    const tseToUse = effectiveTSE || currentTSE;
    if (!tseToUse || !metrics.byTSE || metrics.byTSE.length === 0) return null;
    
    const tseData = metrics.byTSE.find(tse => 
      String(tse.id) === String(tseToUse.id)
    );
    
    if (!tseData) return null;
    
    // Calculate on-track status for current user
    const meetsOpen = (tseData.open || 0) <= THRESHOLDS.MAX_OPEN_SOFT;
    const totalWaitingOnTSE = tseData.waitingOnTSE || tseData.actionableSnoozed || 0;
    const meetsWaitingOnTSE = totalWaitingOnTSE <= THRESHOLDS.MAX_WAITING_ON_TSE_SOFT;
    const isOnTrack = meetsOpen && meetsWaitingOnTSE;
    
    return {
      ...tseData,
      isOnTrack,
      meetsOpen,
      meetsWaitingOnTSE
    };
  }, [effectiveTSE, currentTSE, metrics.byTSE]);

  // Calculate performance streaks for each TSE
  const performanceStreaks = useMemo(() => {
    if (!historicalSnapshots || historicalSnapshots.length === 0) {
      return { streak3: [] };
    }

    const EXCLUDED_TSE_NAMES = ["Prerit Sachdeva"];
    
    // Sort snapshots by date (oldest first)
    const sortedSnapshots = [...historicalSnapshots]
      .map(snapshot => ({
        ...snapshot,
        tseData: snapshot.tse_data || snapshot.tseData || []
      }))
      .filter(snapshot => snapshot.tseData.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (sortedSnapshots.length === 0) {
      return { streak3: [] };
    }

    // Track performance status for each TSE by date
    const tsePerformanceByDate = {};
    
    sortedSnapshots.forEach(snapshot => {
      snapshot.tseData.forEach(tse => {
        if (EXCLUDED_TSE_NAMES.includes(tse.name)) return;
        
        const tseId = String(tse.id);
        if (!tsePerformanceByDate[tseId]) {
          tsePerformanceByDate[tseId] = {
            id: tseId,
            name: tse.name,
            dates: []
          };
        }
        
        const totalOpen = (tse.open || 0);
        const totalWaitingOnTSE = tse.waitingOnTSE || tse.actionableSnoozed || 0;
        // Outstanding Performance: 0 open AND 0 waiting on TSE
        const isOutstanding = totalOpen === 0 && totalWaitingOnTSE === 0;
        
        tsePerformanceByDate[tseId].dates.push({
          date: snapshot.date,
          onTrack: isOutstanding
        });
      });
    });

    // Calculate current streak and total outstanding days for each TSE
    const streaks = Object.values(tsePerformanceByDate).map(tse => {
      const dates = [...tse.dates].sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
      
      let currentStreak = 0;
      let totalOutstandingDays = 0;
      
      // Calculate current streak (working backwards from most recent date)
      for (const dateEntry of dates) {
        if (dateEntry.onTrack) {
          currentStreak++;
        } else {
          break; // Streak broken
        }
      }
      
      // Calculate total outstanding days in history
      totalOutstandingDays = tse.dates.filter(d => d.onTrack).length;
      
      return {
        id: tse.id,
        name: tse.name,
        streak: currentStreak,
        totalOutstandingDays: totalOutstandingDays
      };
    });

    // Group by streak thresholds - only show 3+ days
    const streak3 = streaks.filter(s => s.streak >= 3);

    // Sort by streak length (highest first), then by total outstanding days (higher is better)
    const sortStreaks = (arr) => arr.sort((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      if (b.totalOutstandingDays !== a.totalOutstandingDays) return b.totalOutstandingDays - a.totalOutstandingDays;
      return 0; // Leave remaining ties as-is
    });

    return {
      streak3: sortStreaks(streak3)
    };
  }, [historicalSnapshots]);

  // Filter streaks by region
  const filteredPerformanceStreaks = useMemo(() => {
    if (streaksRegionFilter === 'all') {
      return performanceStreaks;
    }

    const filterByRegion = (streaks) => {
      return streaks.filter(tse => {
        const region = getTSERegion(tse.name);
        return region === streaksRegionFilter;
      });
    };

    return {
      streak3: filterByRegion(performanceStreaks.streak3)
    };
  }, [performanceStreaks, streaksRegionFilter]);

  // Helper function to get medal for a streak tier based on unique streak values
  // eslint-disable-next-line no-unused-vars
  const getMedalForStreak = (streaks, currentStreak) => {
    if (!streaks || streaks.length === 0) return null;
    
    // Get unique streak values, sorted descending
    const uniqueStreaks = [...new Set(streaks.map(s => s.streak))].sort((a, b) => b - a);
    
    // If all TSEs have the same streak, don't show any medals
    if (uniqueStreaks.length === 1) return null;
    
    // Find the rank of the current streak
    const rank = uniqueStreaks.indexOf(currentStreak);
    
    if (rank === 0) return '🥇'; // Highest streak
    if (rank === 1) return '🥈'; // Second highest
    if (rank === 2) return '🥉'; // Third highest
    return null; // No medal for 4th place and below
  };

  // Filter conversations based on selected tag and TSE, excluding conversations from excluded TSEs
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    
    const filterByTag = () => {
      // If "all" is selected (and it's the only selection), return all conversations
      if (filterTag.length === 1 && filterTag.includes("all")) return conversations;
      
      // If no filters selected, return all
      if (filterTag.length === 0) return conversations;
      
      // Collect all conversations that match ANY of the selected filters (OR logic)
      const matchedConversations = new Set();
      
      filterTag.forEach(tag => {
        if (tag === "all") {
          // If "all" is selected with other filters, ignore it
          return;
        }
        
        let filtered = [];
        
        if (tag === "snoozed") {
          filtered = conversations.filter(conv => {
            const isSnoozed = conv.state === "snoozed" || 
                             conv.state === "Snoozed" ||
                             conv.snoozed_until || 
                             (conv.statistics && conv.statistics.state === "snoozed");
            return isSnoozed;
          });
        } else if (tag === "open") {
          filtered = conversations.filter(conv => {
            const isSnoozed = conv.state === "snoozed" || 
                             conv.state === "Snoozed" ||
                             conv.snoozed_until || 
                             (conv.statistics && conv.statistics.state === "snoozed");
            return conv.state === "open" && !isSnoozed;
          });
        } else if (tag === "waitingontse") {
          // Filter for snoozed conversations with "Last Snooze Workflow Used" = "Waiting On TSE"
          filtered = conversations.filter(conv => {
            const isSnoozed = conv.state === "snoozed" || 
                             conv.state === "Snoozed" ||
                             conv.snoozed_until || 
                             (conv.statistics && conv.statistics.state === "snoozed");
            if (!isSnoozed) return false;
            
            const customAttributes = conv.custom_attributes || {};
            const lastSnoozeWorkflow = customAttributes["Last Snooze Workflow Used"];
            
            // Check if Last Snooze Workflow Used matches "Waiting On TSE"
            return lastSnoozeWorkflow === "Waiting On TSE";
          });
        } else if (tag === "waitingoncustomer") {
          // Filter for snoozed conversations with "Last Snooze Workflow Used" = "Waiting On Customer - Resolved" or "Waiting On Customer - Unresolved"
          filtered = conversations.filter(conv => {
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
          });
        } else if (tag === "snoozed-other") {
          // Filter for snoozed conversations that don't have "Last Snooze Workflow Used" set to customer or TSE workflows
          filtered = conversations.filter(conv => {
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
          });
        } else if (tag === "waitingoncustomer-resolved") {
          // Filter for snoozed conversations with "Last Snooze Workflow Used" = "Waiting On Customer - Resolved"
          filtered = conversations.filter(conv => {
            const isSnoozed = conv.state === "snoozed" || 
                             conv.state === "Snoozed" ||
                             conv.snoozed_until || 
                             (conv.statistics && conv.statistics.state === "snoozed");
            if (!isSnoozed) return false;
            
            const customAttributes = conv.custom_attributes || {};
            const lastSnoozeWorkflow = customAttributes["Last Snooze Workflow Used"];
            
            return lastSnoozeWorkflow === "Waiting On Customer - Resolved";
          });
        } else if (tag === "waitingoncustomer-unresolved") {
          // Filter for snoozed conversations with "Last Snooze Workflow Used" = "Waiting On Customer - Unresolved"
          filtered = conversations.filter(conv => {
            const isSnoozed = conv.state === "snoozed" || 
                             conv.state === "Snoozed" ||
                             conv.snoozed_until || 
                             (conv.statistics && conv.statistics.state === "snoozed");
            if (!isSnoozed) return false;
            
            const customAttributes = conv.custom_attributes || {};
            const lastSnoozeWorkflow = customAttributes["Last Snooze Workflow Used"];
            
            return lastSnoozeWorkflow === "Waiting On Customer - Unresolved";
          });
        } else if (tag === "closedtoday") {
          // Filter for conversations closed today (in PT timezone)
          const now = new Date();
          const ptDateFormatter = new Intl.DateTimeFormat('en-US', { 
            timeZone: 'America/Los_Angeles', 
            year: 'numeric', month: '2-digit', day: '2-digit'
          });
          const todayPTDateStr = ptDateFormatter.format(now).replace(/(\d+)\/(\d+)\/(\d+)/, (_, month, day, year) => {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          });
          
          // Helper to convert timestamp to PT date string
          const toPTDateStr = (timestamp) => {
            if (!timestamp) return null;
            const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
            const date = new Date(ms);
            return ptDateFormatter.format(date).replace(/(\d+)\/(\d+)\/(\d+)/, (_, month, day, year) => {
              return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            });
          };
          
          filtered = conversations.filter(conv => {
            const state = (conv.state || "").toLowerCase();
            if (state !== "closed") return false;
            
            const closedAt = conv.closed_at || conv.closedAt;
            if (!closedAt) return false;
            
            // Handle both Unix timestamp (seconds) and milliseconds
            const closedTimestamp = typeof closedAt === 'number' ? closedAt : (closedAt.getTime ? Math.floor(closedAt.getTime() / 1000) : null);
            if (!closedTimestamp) return false;
            
            const closedDateStr = toPTDateStr(closedTimestamp);
            return closedDateStr === todayPTDateStr;
          });
        } else if (tag === "closed") {
          // Filter for closed conversations from today that are NOT auto-closed
          const now = new Date();
          const ptDateFormatter = new Intl.DateTimeFormat('en-US', { 
            timeZone: 'America/Los_Angeles', 
            year: 'numeric', month: '2-digit', day: '2-digit'
          });
          const todayPTDateStr = ptDateFormatter.format(now).replace(/(\d+)\/(\d+)\/(\d+)/, (_, month, day, year) => {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          });
          
          // Helper to convert timestamp to PT date string
          const toPTDateStr = (timestamp) => {
            if (!timestamp) return null;
            const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
            const date = new Date(ms);
            return ptDateFormatter.format(date).replace(/(\d+)\/(\d+)\/(\d+)/, (_, month, day, year) => {
              return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            });
          };
          
          filtered = conversations.filter(conv => {
            const state = (conv.state || "").toLowerCase();
            if (state !== "closed") return false;
            
            // Exclude auto-closed conversations
            const customAttributes = conv.custom_attributes || {};
            const autoClosedValue = customAttributes["Auto-Closed"];
            if (autoClosedValue) return false; // Skip if has Auto-Closed attribute
            
            const closedAt = conv.closed_at || conv.closedAt;
            if (!closedAt) return false;
            
            // Handle both Unix timestamp (seconds) and milliseconds
            const closedTimestamp = typeof closedAt === 'number' ? closedAt : (closedAt.getTime ? Math.floor(closedAt.getTime() / 1000) : null);
            if (!closedTimestamp) return false;
            
            const closedDateStr = toPTDateStr(closedTimestamp);
            return closedDateStr === todayPTDateStr;
          });
        } else if (tag === "autoclosed") {
          // Filter for all auto-closed conversations using custom_attributes
          // This matches conversations that display "Auto-Closed via..." in the table
          filtered = conversations.filter(conv => {
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
          });
        } else if (tag === "autoclosed-resolved") {
          // Filter for auto-closed conversations with Waiting On Customer - Resolved
          // This matches conversations that display "Auto-Closed via Waiting On Customer - Resolved" in the table
          filtered = conversations.filter(conv => {
            const state = (conv.state || "").toLowerCase();
            if (state !== "closed") return false;
            
            // Use the same logic as the table display
            const customAttributes = conv.custom_attributes || {};
            const autoClosedValue = customAttributes["Auto-Closed"];
            
            // Check if Auto-Closed value matches "Waiting On Customer - Resolved"
            // This is the same check used in getClosedConversationStatus() for table display
            if (!autoClosedValue) return false;
            
            const autoClosedStr = String(autoClosedValue);
            const matches = autoClosedStr === "Waiting On Customer - Resolved";
            
            return matches;
          });
        } else if (tag === "autoclosed-unresolved") {
          // Filter for auto-closed conversations with Waiting On Customer - Unresolved
          // This matches conversations that display "Auto-Closed via Waiting On Customer - Unresolved" in the table
          filtered = conversations.filter(conv => {
            const state = (conv.state || "").toLowerCase();
            if (state !== "closed") return false;
            
            // Use the same logic as the table display
            const customAttributes = conv.custom_attributes || {};
            const autoClosedValue = customAttributes["Auto-Closed"];
            
            // Check if Auto-Closed value matches "Waiting On Customer - Unresolved"
            // This is the same check used in getClosedConversationStatus() for table display
            if (!autoClosedValue) return false;
            
            const autoClosedStr = String(autoClosedValue);
            const matches = autoClosedStr === "Waiting On Customer - Unresolved";
            
            return matches;
          });
        } else {
          // Unrecognized filter tag - skip it (don't add any conversations)
          return; // Skip this iteration
        }
        
        // Add conversation objects to the set (using ID as key)
        filtered.forEach(conv => {
          const convId = conv.id || conv.conversation_id;
          if (convId) {
            matchedConversations.add(String(convId));
          }
        });
      });
      
      // Convert set to array of IDs for filtering
      const matchedIds = Array.from(matchedConversations);
      
      // If we have filters selected but no matches, return empty array
      // (Don't return all conversations if filters are active but nothing matches)
      if (matchedIds.length === 0 && filterTag.length > 0 && !filterTag.includes("all")) {
        return [];
      }
      
      // Strict filtering: only return conversations that matched at least one filter
      // IMPORTANT: If auto-closed filters are selected, exclude conversations that only matched "closedtoday"
      // but don't have the "Auto-Closed" custom attribute
      const hasAutoClosedFilter = filterTag.some(tag => 
        tag === "autoclosed" || tag === "autoclosed-resolved" || tag === "autoclosed-unresolved"
      );
      
      return conversations.filter(conv => {
        const convId = conv.id || conv.conversation_id;
        if (!convId) return false;
        
        if (!matchedIds.includes(String(convId))) return false;
        
        // If auto-closed filters are selected, ensure the conversation actually has Auto-Closed attribute
        if (hasAutoClosedFilter) {
          const customAttributes = conv.custom_attributes || {};
          const autoClosedValue = customAttributes["Auto-Closed"];
          
          // If this conversation matched via "closedtoday" but doesn't have Auto-Closed, exclude it
          if (!autoClosedValue) {
            // Check if it would have matched via closedtoday
            const state = (conv.state || "").toLowerCase();
            if (state === "closed" && filterTag.includes("closedtoday")) {
              // This conversation matched via "closedtoday" but doesn't have Auto-Closed
              // Since we're filtering by auto-closed, exclude it
              return false;
            }
          }
        }
        
        return true;
      });
    };
    
    let tagFiltered = filterByTag();
    
    // Filter out conversations assigned to excluded TSEs
    tagFiltered = tagFiltered.filter(conv => {
      const assigneeName = conv.admin_assignee?.name || 
                          (typeof conv.admin_assignee === "string" ? conv.admin_assignee : null);
      return !assigneeName || !EXCLUDED_TSE_NAMES.includes(assigneeName);
    });
    
    // Filter by TSE if selected (apply regardless of filterTag)
    if (filterTSE !== "all") {
      if (filterTSE === "unassigned") {
        tagFiltered = tagFiltered.filter(conv => {
          const hasAssigneeId = conv.admin_assignee_id && conv.admin_assignee_id !== null;
          const hasAssigneeObject = conv.admin_assignee && 
                                    (typeof conv.admin_assignee === "object" ? (conv.admin_assignee.id || conv.admin_assignee.name) : true);
          return !hasAssigneeId && !hasAssigneeObject;
        });
      } else {
        tagFiltered = tagFiltered.filter(conv => {
          const tseId = conv.admin_assignee_id || 
                       (conv.admin_assignee && typeof conv.admin_assignee === "object" ? conv.admin_assignee.id : null);
          // Convert both to strings for comparison since filterTSE comes from dropdown as string
          return String(tseId) === String(filterTSE);
        });
      }
    }
    
    // Filter by ID search if provided
    if (searchId.trim()) {
      const searchTerm = searchId.trim().toLowerCase();
      tagFiltered = tagFiltered.filter(conv => {
        const convId = String(conv.id || "").toLowerCase();
        return convId.includes(searchTerm);
      });
    }
    
    return tagFiltered;
  }, [conversations, filterTag, filterTSE, searchId]);
  
  // Get list of TSEs for filter dropdown
  // eslint-disable-next-line no-unused-vars
  const tseList = useMemo(() => {
    return (metrics.byTSE || []).map(tse => ({ id: tse.id, name: tse.name }));
  }, [metrics.byTSE]);

  // "My Team Only" filter for managers - defaults to true
  const [myTeamOnly, setMyTeamOnly] = useState(true);
  
  // Group TSEs by region (memoized at component level - must be before early returns)
  // For managers with "My Team Only" enabled, filter to only show their team members
  const tseByRegion = useMemo(() => {
    const grouped = { 'UK': [], 'NY': [], 'SF': [], 'Other': [] };
    let tsesToGroup = metrics.byTSE || [];
    
    // If user is a manager with "My Team Only" enabled, filter to only their team members
    if (userRole === 'manager' && managerInfo && myTeamOnly) {
      tsesToGroup = tsesToGroup.filter(tse => managerInfo.team.includes(tse.name));
    }
    
    tsesToGroup.forEach(tse => {
      const region = getTSERegion(tse.name);
      grouped[region].push(tse);
    });
    return grouped;
  }, [metrics.byTSE, userRole, managerInfo, myTeamOnly]);

  // Get conversations for a specific TSE by category
  const getTSEConversations = (tseId) => {
    if (!conversations || !tseId) return { open: [], waitingOnTSE: [], waitingOnCustomer: [], totalSnoozed: [] };
    
    const open = [];
    const waitingOnTSE = [];
    const waitingOnCustomer = [];
    const totalSnoozed = [];
    
    conversations.forEach((conv) => {
      const convTseId = conv.admin_assignee_id || 
                        (conv.admin_assignee && typeof conv.admin_assignee === "object" ? conv.admin_assignee.id : null);
      
      if (String(convTseId) !== String(tseId)) return;
      
      const assigneeName = conv.admin_assignee?.name || 
                          (typeof conv.admin_assignee === "string" ? conv.admin_assignee : null);
      if (assigneeName && EXCLUDED_TSE_NAMES.includes(assigneeName)) return;
      
      const isSnoozed = conv.state === "snoozed" || 
                       conv.state === "Snoozed" ||
                       conv.snoozed_until || 
                       (conv.statistics && conv.statistics.state === "snoozed");
      const tags = Array.isArray(conv.tags) ? conv.tags : [];
      const hasWaitingOnTSETag = tags.some(t => 
        (t.name && t.name.toLowerCase() === "snooze.waiting-on-tse") || 
        (typeof t === "string" && t.toLowerCase() === "snooze.waiting-on-tse")
      );
      const hasWaitingOnCustomerTag = tags.some(t => 
        (t.name && (t.name.toLowerCase() === "snooze.waiting-on-customer-resolved" || t.name.toLowerCase() === "snooze.waiting-on-customer-unresolved")) || 
        (typeof t === "string" && (t.toLowerCase() === "snooze.waiting-on-customer-resolved" || t.toLowerCase() === "snooze.waiting-on-customer-unresolved"))
      );
      
      if (conv.state === "open" && !isSnoozed) {
        open.push(conv);
      } else if (isSnoozed) {
        totalSnoozed.push(conv);
        if (hasWaitingOnTSETag) {
          waitingOnTSE.push(conv);
        } else if (hasWaitingOnCustomerTag) {
          waitingOnCustomer.push(conv);
        }
      }
    });
    
    return { open, waitingOnTSE, waitingOnCustomer, totalSnoozed };
  };

  // Handle TSE card click
  const handleTSECardClick = (tse) => {
    setSelectedTSE(tse);
    setIsModalOpen(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTSE(null);
  };

  // Loading phrases - professional descriptions of what's happening
  const loadingPhrases = [
    "Fetching conversation data from Intercom...",
    "Filtering to Resolution Team conversations...",
    "Processing team member assignments...",
    "Analyzing individual TSE conversation data...",
    "Calculating TSE queue status metrics...",
    "Computing regional on-track statistics...",
    "Analyzing historical on-track trends...",
    "Calculating performance correlations...",
    "Identifying outstanding performance streaks...",
    "Building dashboard visualizations...",
    "Compiling status insights..."
  ];

  const fallbackPhrases = [
    "Almost there...",
    "Finishing up...",
    "Finalizing data..."
  ];

  // Track loading state changes to show completion animation and cycle through phrases
  useEffect(() => {
    if (loading && (!conversations || (Array.isArray(conversations) && conversations.length === 0))) {
      setWasLoading(true);
      setShowCompletion(false);
      setLoadingPhraseIndex(0);
      setLoadingStartTime(Date.now());
    } else if (wasLoading && conversations && conversations.length > 0) {
      // Loading just finished, show completion GIF
      setShowCompletion(true);
      const timer = setTimeout(() => {
        setShowCompletion(false);
        setWasLoading(false);
        setLoadingPhraseIndex(0);
        setLoadingStartTime(null);
      }, 3000); // Show completion GIF for 3 seconds
      return () => clearTimeout(timer);
    }
  }, [loading, conversations, wasLoading]);

  // Cycle through loading phrases
  useEffect(() => {
    if (!loadingStartTime) return;

    const elapsed = Date.now() - loadingStartTime;
    const totalPhrases = loadingPhrases.length;
    const phraseDuration = 5000; // 5 seconds per phrase (60 seconds / 11 phrases ≈ 5.45 seconds, but using 5s for consistent timing)
    const fallbackStartTime = 60000; // 60 seconds total - when to start showing fallback phrases

    let intervalId;
    
    if (elapsed < fallbackStartTime) {
      // Show regular phrases
      const currentIndex = Math.min(Math.floor(elapsed / phraseDuration), totalPhrases - 1);
      setLoadingPhraseIndex(currentIndex);
      
      // Set up interval to update phrase
      intervalId = setInterval(() => {
        const currentElapsed = Date.now() - loadingStartTime;
        const newIndex = Math.min(Math.floor(currentElapsed / phraseDuration), totalPhrases - 1);
        setLoadingPhraseIndex(newIndex);
      }, 1000); // Check every second
    } else {
      // Show fallback phrases (cycle through them)
      const fallbackElapsed = elapsed - fallbackStartTime;
      const fallbackIndex = Math.floor(fallbackElapsed / 2000) % fallbackPhrases.length; // Change every 2 seconds
      setLoadingPhraseIndex(totalPhrases + fallbackIndex);
      
      intervalId = setInterval(() => {
        const currentElapsed = Date.now() - loadingStartTime;
        if (currentElapsed >= fallbackStartTime) {
          const fallbackElapsed = currentElapsed - fallbackStartTime;
          const fallbackIndex = Math.floor(fallbackElapsed / 2000) % fallbackPhrases.length;
          setLoadingPhraseIndex(totalPhrases + fallbackIndex);
        }
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [loadingStartTime, loadingPhrases.length, fallbackPhrases.length]);

  // Update progress percentage continuously for smooth animation
  useEffect(() => {
    if (!loadingStartTime) {
      setProgressPercentage(0);
      return;
    }

    const updateProgress = () => {
    const elapsed = Date.now() - loadingStartTime;
    // eslint-disable-next-line no-unused-vars
    const totalPhrases = loadingPhrases.length;
    const totalRegularPhraseTime = 60000; // 60 seconds total for all regular phrases
    const fallbackStartTime = totalRegularPhraseTime;
      
      let progress = 0;
      
      if (elapsed < totalRegularPhraseTime) {
        // Use exponential ease-out curve: fills quickly initially, slows near end
        const normalizedTime = elapsed / totalRegularPhraseTime;
        const easedProgress = 1 - Math.pow(1 - normalizedTime, 2.5);
        progress = Math.min(easedProgress * 92, 92);
      } else {
        // During fallback phrases: continue from 92% to 99% smoothly
        const fallbackElapsed = elapsed - fallbackStartTime;
        const fallbackDuration = 8000;
        const fallbackProgress = Math.min(fallbackElapsed / fallbackDuration, 1);
        const easedFallback = 1 - Math.pow(1 - fallbackProgress, 2);
        progress = 92 + (easedFallback * 7);
      }
      
      // If we're about to show completion, ensure progress is near 100%
      if (wasLoading && conversations && conversations.length > 0 && progress < 99) {
        progress = 99;
      }
      
      setProgressPercentage(Math.min(progress, 99));
    };

    // Update immediately
    updateProgress();
    
    // Update every 100ms for smooth animation
    const intervalId = setInterval(updateProgress, 100);
    
    return () => clearInterval(intervalId);
  }, [loadingStartTime, loadingPhrases.length, wasLoading, conversations]);

  // Get current loading phrase
  const getCurrentLoadingPhrase = () => {
    if (loadingPhraseIndex < loadingPhrases.length) {
      return loadingPhrases[loadingPhraseIndex];
    } else {
      const fallbackIndex = loadingPhraseIndex - loadingPhrases.length;
      return fallbackPhrases[fallbackIndex % fallbackPhrases.length];
    }
  };


  // Show loading screen on initial load or during completion animation
  if ((loading && (!conversations || (Array.isArray(conversations) && conversations.length === 0))) || showCompletion) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <img 
            src={showCompletion 
              ? (isDarkMode 
                  ? "https://res.cloudinary.com/doznvxtja/image/upload/v1768690567/darkmode-success_keb0qx.gif"
                  : "https://res.cloudinary.com/doznvxtja/image/upload/v1767208870/loading_complete_n2gpbl.gif")
              : (isDarkMode
                  ? "https://res.cloudinary.com/doznvxtja/image/upload/v1768690567/darkmode-loading_u1xjdr.gif"
                  : "https://res.cloudinary.com/doznvxtja/image/upload/v1767208765/loading_qoxx0x.gif")
            } 
            alt={showCompletion ? "Complete" : "Loading..."} 
            className="loading-gif"
          />
          <div className={`loading-text ${!showCompletion ? 'pulse' : ''}`}>
            {showCompletion ? "Loading complete!" : getCurrentLoadingPhrase()}
          </div>
          {!showCompletion && (
            <div className="loading-progress-bar">
              <div 
                className="loading-progress-bar-fill"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error">Error loading data: {error}</div>
        <button onClick={onRefresh} className="refresh-button">Retry</button>
      </div>
    );
  }

  // Show error if no conversations after loading completes
  if (!loading && (!conversations || (Array.isArray(conversations) && conversations.length === 0))) {
    return (
      <div className="dashboard-container">
        <div className="error">No conversation data available. Please check the API connection.</div>
        <button onClick={onRefresh} className="refresh-button">Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={hasFooterControlsAccess ? { paddingBottom: '150px' } : {}}>
      {loading && conversations && conversations.length > 0 && (
        <div className="refreshing-indicator">
          <span>🔄 Refreshing data...</span>
        </div>
      )}
      <div className="dashboard-header">
        <div className="header-left">
          <img 
            src={isDarkMode 
              ? "https://res.cloudinary.com/doznvxtja/image/upload/v1768984017/2_de6mhs.svg"
              : "https://res.cloudinary.com/doznvxtja/image/upload/v1768984723/Untitled_design_27_bivzhg.svg"
            }
            alt="Queue Health Monitor"
            style={{ height: '32px', width: 'auto' }}
          />
          {lastUpdated && (
            <span className="last-updated">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="header-actions">
          {/* Manager Badge with My Team Only Toggle - shown only for managers */}
          {userRole === 'manager' && managerInfo && (
            <div 
              className="manager-badge-indicator"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: myTeamOnly 
                  ? (isDarkMode ? 'rgba(103, 58, 183, 0.2)' : 'rgba(103, 58, 183, 0.1)')
                  : (isDarkMode ? 'rgba(103, 58, 183, 0.15)' : 'rgba(103, 58, 183, 0.1)'),
                border: `1px solid ${myTeamOnly 
                  ? (isDarkMode ? 'rgba(103, 58, 183, 0.4)' : 'rgba(103, 58, 183, 0.3)')
                  : (isDarkMode ? 'rgba(103, 58, 183, 0.4)' : 'rgba(103, 58, 183, 0.3)')}`,
                transition: 'all 0.2s ease',
                marginRight: '12px'
              }}
            >
              <div 
                onClick={() => setActiveView("tse")}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  flex: 1
                }}
                title="Click to view your team"
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: `2px solid ${isDarkMode ? '#9575cd' : '#673ab7'}`,
                  flexShrink: 0
                }}>
                  {getTSEAvatar(simulatedManagerName || user?.name) ? (
                    <img 
                      src={getTSEAvatar(simulatedManagerName || user?.name)} 
                      alt={simulatedManagerName || user?.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isDarkMode ? '#4a148c' : '#ede7f6',
                      color: isDarkMode ? '#fff' : '#673ab7',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {(simulatedManagerName || user?.name)?.charAt(0) || '?'}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ 
                    fontSize: '11px', 
                    color: isDarkMode ? '#aaa' : '#666',
                    fontWeight: '500'
                  }}>
                    {managerInfo.title} - {managerInfo.region}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: isDarkMode ? '#b39ddb' : '#673ab7'
                    }}>
                      {simulatedManagerName || user?.name}
                      {simulatedManagerName && (
                        <span style={{ 
                          fontSize: '10px', 
                          color: isDarkMode ? '#888' : '#999',
                          fontWeight: '400',
                          marginLeft: '4px'
                        }}>
                          (simulated)
                        </span>
                      )}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: isDarkMode ? '#888' : '#999'
                    }}>
                      ({managerTeamMembers.length} team members)
                    </span>
                  </div>
                </div>
              </div>
              <label 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  paddingLeft: '8px',
                  borderLeft: `1px solid ${isDarkMode ? 'rgba(103, 58, 183, 0.3)' : 'rgba(103, 58, 183, 0.2)'}`,
                  marginLeft: '8px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={myTeamOnly}
                  onChange={() => setMyTeamOnly(!myTeamOnly)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ 
                  fontSize: '12px',
                  fontWeight: '500',
                  color: myTeamOnly 
                    ? (isDarkMode ? '#b39ddb' : '#673ab7')
                    : (isDarkMode ? '#aaa' : '#666')
                }}>
                  My Team Only ({managerInfo.team.length})
                </span>
              </label>
            </div>
          )}
          
          {/* Snooze Timer Icon - shown for TSEs */}
          {userRole !== 'manager' && currentTSE && (() => {
            const snoozedConversations = conversations
              .filter(conv => {
                const isSnoozed = conv.state === "snoozed" || conv.snoozed_until;
                if (!isSnoozed) return false;
                const snoozedUntil = conv.snoozed_until || null;
                return snoozedUntil !== null;
              })
              .map(conv => {
                const snoozedUntil = conv.snoozed_until || null;
                const snoozedUntilDate = snoozedUntil 
                  ? (typeof snoozedUntil === "number" ? new Date(snoozedUntil * 1000) : new Date(snoozedUntil))
                  : null;
                const timeRemaining = snoozedUntilDate ? calculateTimeRemaining(snoozedUntilDate) : { expired: true, totalMs: 0 };
                return { conv, timeRemaining, totalMinutes: timeRemaining.totalMs / (1000 * 60) };
              });

            const urgentCount = snoozedConversations.filter(item => 
              item.timeRemaining.expired || item.totalMinutes <= 60
            ).length;

            if (snoozedConversations.length === 0) return null;

            return (
              <button
                className="snooze-timer-header-button"
                onClick={() => setSnoozeModalOpen(true)}
                aria-label="Open snooze timers"
                title="Snooze Timers"
                style={{
                  marginRight: '12px'
                }}
              >
                <span className="snooze-header-icon">
                  <img 
                    src={isDarkMode 
                      ? "https://res.cloudinary.com/doznvxtja/image/upload/v1769015660/33_hwpe4d.svg"
                      : "https://res.cloudinary.com/doznvxtja/image/upload/v1769015660/32_qcptve.svg"
                    }
                    alt="Snooze Timer"
                    style={{
                      width: '20px',
                      height: '20px',
                      display: 'block'
                    }}
                  />
                </span>
                {urgentCount > 0 && (
                  <span className="snooze-header-badge">{urgentCount}</span>
                )}
              </button>
            );
          })()}

          {/* My Queue Status Indicator - shown for TSEs and matching users (not managers) */}
          {userRole !== 'manager' && currentTSEMetrics && (
            <div 
              className={`my-queue-indicator ${currentTSEMetrics.isOnTrack ? 'on-track' : 'needs-attention'}`}
              onClick={() => setActiveView("myqueue")}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: currentTSEMetrics.isOnTrack 
                  ? (isDarkMode ? 'rgba(76, 175, 80, 0.15)' : 'rgba(76, 175, 80, 0.1)')
                  : (isDarkMode ? 'rgba(244, 67, 54, 0.15)' : 'rgba(244, 67, 54, 0.1)'),
                border: `1px solid ${currentTSEMetrics.isOnTrack 
                  ? (isDarkMode ? 'rgba(76, 175, 80, 0.4)' : 'rgba(76, 175, 80, 0.3)')
                  : (isDarkMode ? 'rgba(244, 67, 54, 0.4)' : 'rgba(244, 67, 54, 0.3)')}`,
                transition: 'all 0.2s ease',
                marginRight: '12px'
              }}
              title="Click to view your queue details"
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: `2px solid ${currentTSEMetrics.isOnTrack ? '#4caf50' : '#f44336'}`,
                flexShrink: 0
              }}>
                {getTSEAvatar(currentTSE.name) ? (
                  <img 
                    src={getTSEAvatar(currentTSE.name)} 
                    alt={currentTSE.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDarkMode ? '#333' : '#e0e0e0',
                    color: isDarkMode ? '#fff' : '#666',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    {currentTSE.name?.charAt(0) || '?'}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ 
                  fontSize: '11px', 
                  color: isDarkMode ? '#aaa' : '#666',
                  fontWeight: '500'
                }}>
                  My Queue
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: currentTSEMetrics.isOnTrack 
                      ? (isDarkMode ? '#81c784' : '#4caf50')
                      : (isDarkMode ? '#e57373' : '#f44336')
                  }}>
                    {currentTSEMetrics.isOnTrack ? '✓ On Track' : '⚠ Needs Attention'}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: isDarkMode ? '#888' : '#999'
                  }}>
                    ({currentTSEMetrics.open || 0} open, {currentTSEMetrics.waitingOnTSE || 0} snoozed)
                  </span>
                </div>
              </div>
            </div>
          )}
          <div className="header-icon-group">
            {/* Help icon - hidden for TSE users */}
            {userRole !== 'tse' && (
              <button
                className="help-icon-button"
                onClick={() => setIsHelpModalOpen(true)}
                aria-label="Help"
                title="Help"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </button>
            )}
            {/* Streaks icon - hidden for TSE users */}
            {userRole !== 'tse' && (
              <button
                className="streaks-icon-button"
                onClick={() => setIsStreaksModalOpen(true)}
                aria-label="Outstanding Performance Streaks"
                title="Outstanding Performance Streaks"
                disabled={!performanceStreaks.streak3 || performanceStreaks.streak3.length === 0}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            )}
            <AlertsDropdown 
              alerts={
                // Filter alerts based on user role
                userRole === 'tse' && currentTSE
                  ? (metrics.alerts || []).filter(alert => 
                      String(alert.tseId) === String(currentTSE.id) || alert.tseName === currentTSE.name
                    )
                  : userRole === 'manager' && managerInfo && myTeamOnly
                    ? (metrics.alerts || []).filter(alert => 
                        managerInfo.team.includes(alert.tseName)
                      )
                    : (metrics.alerts || [])
              }
              isOpen={alertsDropdownOpen}
              onToggle={() => setAlertsDropdownOpen(!alertsDropdownOpen)}
              onClose={() => setAlertsDropdownOpen(false)}
              isAlertRead={alertsDismissed.isDismissed}
              onMarkAsRead={alertsDismissed.dismissItem}
              onMarkAllAsRead={() => {
                // Get the filtered alerts for the current user
                const filteredAlerts = userRole === 'tse' && currentTSE
                  ? (metrics.alerts || []).filter(alert => 
                      String(alert.tseId) === String(currentTSE.id) || alert.tseName === currentTSE.name
                    )
                  : userRole === 'manager' && managerInfo && myTeamOnly
                    ? (metrics.alerts || []).filter(alert => 
                        managerInfo.team.includes(alert.tseName)
                      )
                    : (metrics.alerts || []);
                filteredAlerts.forEach(alert => {
                  if (!alertsDismissed.isDismissed(alert.id)) {
                    alertsDismissed.dismissItem(alert.id);
                  }
                });
              }}
              onTSEClick={(tseId, tseName) => {
                setAlertsDropdownOpen(false);
                // Find TSE object from metrics
                const tse = (metrics.byTSE || []).find(t => 
                  String(t.id) === String(tseId) || t.name === tseName
                );
                if (tse) {
                  handleTSECardClick(tse);
                  setAlertsDropdownOpen(false); // Close dropdown when opening modal
                }
              }}
              onViewAll={() => {
                setActiveView("tse");
                setSelectedColors(new Set(['error'])); // Over Limit - Needs Attention only
                setSelectedRegions(new Set(['UK', 'NY', 'SF', 'Other'])); // All regions
                setAlertsDropdownOpen(false); // Close dropdown
              }}
              onViewChats={(tseId, alertType) => {
                setActiveView("conversations");
                if (alertType === "open") {
                  setFilterTag(["open"]);
                } else if (alertType === "snoozed") {
                  setFilterTag(["waitingontse"]);
                }
                setFilterTSE(String(tseId));
                setAlertsDropdownOpen(false); // Close dropdown
              }}
            />
          </div>

          {/* Snooze Timer Modal */}
          {snoozeModalOpen && userRole !== 'manager' && currentTSE && (() => {
            // Helper function to get tags from conversation
            const getTags = (conv) => {
              if (!conv.tags) return [];
              return Array.isArray(conv.tags) ? conv.tags : [];
            };

            // Helper function to check for specific tags
            const hasTag = (tags, tagName) => {
              return tags.some(t => {
                const tagValue = t.name || t;
                return typeof tagValue === 'string' && tagValue.toLowerCase() === tagName.toLowerCase();
              });
            };

            // Filter to only show waiting-on-tse and waiting-on-customer conversations assigned to current TSE (excluding expired)
            const tseId = currentTSE?.id;
            const filteredConversations = conversations
              .filter(conv => {
                // First filter by TSE assignment
                if (tseId) {
                  const convTseId = conv.admin_assignee_id || 
                                   (conv.admin_assignee && typeof conv.admin_assignee === "object" ? conv.admin_assignee.id : null);
                  if (String(convTseId) !== String(tseId)) {
                    return false; // Not assigned to current TSE
                  }
                }
                
                // Then filter by tags
                const tags = getTags(conv);
                const hasWaitingOnTSETag = hasTag(tags, "snooze.waiting-on-tse");
                const hasWaitingOnCustomerResolvedTag = hasTag(tags, "snooze.waiting-on-customer-resolved");
                const hasWaitingOnCustomerUnresolvedTag = hasTag(tags, "snooze.waiting-on-customer-unresolved");
                
                return hasWaitingOnTSETag || hasWaitingOnCustomerResolvedTag || hasWaitingOnCustomerUnresolvedTag;
              })
              .map(conv => {
                const tags = getTags(conv);
                let tagType = null;
                if (hasTag(tags, "snooze.waiting-on-tse")) {
                  tagType = "waiting-on-tse";
                } else if (hasTag(tags, "snooze.waiting-on-customer-resolved")) {
                  tagType = "waiting-on-customer-resolved";
                } else if (hasTag(tags, "snooze.waiting-on-customer-unresolved")) {
                  tagType = "waiting-on-customer-unresolved";
                }

                const snoozedUntil = conv.snoozed_until || null;
                const snoozedUntilDate = snoozedUntil 
                  ? (typeof snoozedUntil === "number" ? new Date(snoozedUntil * 1000) : new Date(snoozedUntil))
                  : null;
                const timeRemaining = snoozedUntilDate ? calculateTimeRemaining(snoozedUntilDate) : { expired: true, totalMs: 0 };
                return { 
                  conv, 
                  tagType,
                  timeRemaining, 
                  totalMinutes: timeRemaining.totalMs / (1000 * 60) 
                };
              })
              .filter(item => !item.timeRemaining.expired) // Filter out expired conversations
              .sort((a, b) => {
                // Sort by time remaining (ascending) - shortest time at top for heatmap
                return a.totalMinutes - b.totalMinutes;
              });

            // Calculate heatmap colors based on time remaining
            // Helper function to interpolate between red and green
            const getHeatmapColor = (totalMinutes, maxMinutes) => {
              if (maxMinutes === 0 || maxMinutes === totalMinutes) {
                // If all have same time or no max, use red for urgency
                return { r: 255, g: 68, b: 68 };
              }
              
              // Normalize to 0-1 (0 = red for less time, 1 = green for more time)
              // Invert so shorter time = more red
              const ratio = 1 - (totalMinutes / maxMinutes);
              
              // Interpolate between red (#ff4444) and green (#4cec8c)
              // Red: rgb(255, 68, 68) -> Green: rgb(76, 236, 140)
              const r = Math.round(76 + (255 - 76) * ratio); // 76 -> 255 (more red for less time)
              const g = Math.round(236 - (236 - 68) * ratio); // 236 -> 68 (less green for less time)
              const b = Math.round(140 - (140 - 68) * ratio); // 140 -> 68 (less blue for less time)
              
              return { r, g, b };
            };

            // Find max time for heatmap calculation
            const maxTimeMinutes = filteredConversations.length > 0
              ? Math.max(...filteredConversations.map(item => item.totalMinutes))
              : 0;

            const INTERCOM_BASE_URL = "https://app.intercom.com/a/inbox/gu1e0q0t/inbox/admin/9110812/conversation/";

            return (
              <>
                <div 
                  className="snooze-modal-overlay"
                  onClick={() => setSnoozeModalOpen(false)}
                />
                <div className="snooze-modal">
                  <div className="snooze-modal-header">
                    <h2>Snooze Timers</h2>
                    <button
                      className="snooze-modal-close"
                      onClick={() => setSnoozeModalOpen(false)}
                      aria-label="Close modal"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="snooze-modal-content">
                    {loading || !conversations || conversations.length === 0 ? (
                      // Show loading skeletons while conversations are loading
                      Array.from({ length: 5 }).map((_, idx) => (
                        <div 
                          key={`loading-${idx}`}
                          className="countdown-card countdown-card-compact countdown-card-loading"
                        >
                          <div className="countdown-card-content">
                            <div className="countdown-visual">
                              <div className="countdown-ring">
                                <div className="countdown-loading-spinner"></div>
                              </div>
                            </div>
                            <div className="countdown-info">
                              <div className="countdown-title countdown-skeleton-text"></div>
                              <div className="countdown-details">
                                <span className="countdown-id countdown-skeleton-text-small"></span>
                                <span className="countdown-full-time countdown-skeleton-text-small"></span>
                              </div>
                            </div>
                            <div className="countdown-action">
                              <div className="countdown-arrow">→</div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : filteredConversations.length === 0 ? (
                      <div className="snooze-modal-empty">
                        <p>No waiting conversations</p>
                      </div>
                    ) : (
                      filteredConversations.map((item, idx) => {
                        const conv = item.conv;
                        const convId = conv.id || conv.conversation_id || idx;
                        const convUrl = `${INTERCOM_BASE_URL}${convId}`;
                        const convTitle = conv.title || conv.source?.title || `Conversation ${convId}`;
                        const totalMinutes = item.totalMinutes;

                        // Get tag type display info with better contrast
                        const getTagInfo = (tagType) => {
                          switch(tagType) {
                            case "waiting-on-tse":
                              return { 
                                label: "Waiting on TSE", 
                                color: "#B8860B", 
                                bgColor: "#FFFACD" // Light yellow background for good contrast
                              };
                            case "waiting-on-customer-unresolved":
                              return { 
                                label: "Waiting on Customer (Unresolved)", 
                                color: "#FFFFFF", 
                                bgColor: "#DC143C" // Dark red background with white text
                              };
                            case "waiting-on-customer-resolved":
                              return { 
                                label: "Waiting on Customer (Resolved)", 
                                color: "#FFFFFF", 
                                bgColor: "#228B22" // Dark green background with white text
                              };
                            default:
                              return { 
                                label: "Unknown", 
                                color: "#FFFFFF", 
                                bgColor: "#666666" 
                              };
                          }
                        };

                        const tagInfo = getTagInfo(item.tagType);
                        
                        // Calculate heatmap background color
                        const heatmapColor = getHeatmapColor(totalMinutes, maxTimeMinutes);
                        const backgroundColor = `rgb(${heatmapColor.r}, ${heatmapColor.g}, ${heatmapColor.b})`;

                        return (
                          <div 
                            key={convId}
                            className="snooze-conversation-item"
                            onClick={() => window.open(convUrl, '_blank')}
                            style={{ backgroundColor: backgroundColor }}
                          >
                            <div className="snooze-item-header">
                              <span 
                                className="snooze-tag-badge"
                                style={{ 
                                  color: tagInfo.color,
                                  backgroundColor: tagInfo.bgColor,
                                  borderColor: tagInfo.color
                                }}
                              >
                                {tagInfo.label}
                              </span>
                            </div>
                            <div className="snooze-item-title">{convTitle}</div>
                            <div className="snooze-item-footer">
                              <span className="snooze-conv-id">#{String(convId).slice(-6)}</span>
                              <span className="snooze-timer-large">
                                {(() => {
                                  const formatted = formatTimeRemaining(item.timeRemaining);
                                  if (formatted && formatted !== "Expired") {
                                    return formatted;
                                  }
                                  // Fallback: format manually
                                  const { days = 0, hours = 0, minutes = 0, seconds = 0 } = item.timeRemaining || {};
                                  const parts = [];
                                  if (days > 0) parts.push(`${days}d`);
                                  if (hours > 0) parts.push(`${hours}h`);
                                  if (minutes > 0) parts.push(`${minutes}m`);
                                  parts.push(`${seconds}s`);
                                  return parts.join(' ') || '0s';
                                })()}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            );
          })()}

          <div className="view-tabs">
            {/* My Queue tab - shown for TSEs, hidden for managers */}
            {userRole !== 'manager' && currentTSE && (
              <button 
                type="button"
                className={activeView === "myqueue" ? "active" : ""}
                onClick={() => setActiveView("myqueue")}
              >
                My Queue
              </button>
            )}
            {/* Overview tab - hidden for TSE users */}
            {userRole !== 'tse' && (
              <button 
                type="button"
                className={activeView === "overview" ? "active" : ""}
                onClick={() => setActiveView("overview")}
              >
                Overview
              </button>
            )}
            {/* TSE View tab - hidden for TSE users */}
            {userRole !== 'tse' && (
              <button 
                type="button"
                className={activeView === "tse" ? "active" : ""}
                onClick={() => setActiveView("tse")}
              >
                TSE View
              </button>
            )}
            {/* Conversations tab - visible for all */}
            <button 
              type="button"
              className={activeView === "conversations" ? "active" : ""}
              onClick={() => setActiveView("conversations")}
            >
              Conversations
            </button>
            {/* Analytics tab - hidden for TSE users */}
            {userRole !== 'tse' && (
              <button 
                type="button"
                className={activeView === "historical" ? "active" : ""}
                onClick={() => setActiveView("historical")}
              >
                Analytics
              </button>
            )}
          </div>
          <div className="header-utility-icons">
            <button
              className="header-icon-btn refresh-icon-btn"
              onClick={onRefresh}
              aria-label="Refresh data"
              title="Refresh data"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
            <button
              className="header-icon-btn logout-icon-btn"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
            <button
              className="header-icon-btn dark-mode-icon-btn"
              onClick={toggleDarkMode}
              aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      {activeView === "conversations" && (
        <div className="filter-bar">
          <div className="filter-group" style={{ position: 'relative' }} ref={filterDropdownRef}>
            <label>FILTER BY TYPE</label>
            <div 
              className="filter-select"
              onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
              style={{ 
                cursor: 'pointer',
                position: 'relative',
                padding: '8px 12px',
                minHeight: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>
                {filterTag.length === 0 ? 'Select filters...' :
                 filterTag.length === 1 && filterTag[0] === 'all' ? 'All Conversations' :
                 filterTag.length === 1 && filterTag[0] === 'snoozed' ? 'All Snoozed' :
                 filterTag.length === 1 && filterTag[0] === 'waitingoncustomer' ? 'Waiting On Customer' :
                 filterTag.length === 1 && filterTag[0] === 'waitingontse' ? 'Waiting On TSE' :
                 filterTag.length === 1 && filterTag[0] === 'snoozed-other' ? 'Snoozed - Other' :
                 filterTag.length === 1 && filterTag[0] === 'closedtoday' ? 'Closed Today' :
                 filterTag.length === 1 && filterTag[0] === 'closed' ? 'Closed' :
                 filterTag.length === 1 && filterTag[0] === 'autoclosed' ? 'Auto-Closed' :
                 filterTag.length === 1 && filterTag[0] === 'autoclosed-resolved' ? 'Auto-Closed - Resolved' :
                 filterTag.length === 1 && filterTag[0] === 'autoclosed-unresolved' ? 'Auto-Closed - Unresolved' :
                 filterTag.length === 1 ? filterTag[0] :
                 `${filterTag.length} filters selected`}
              </span>
              <span style={{ marginLeft: '8px' }}>{filterDropdownOpen ? '▲' : '▼'}</span>
            </div>
            {filterDropdownOpen && (
              <div className="filter-select-dropdown">
                {(() => {
                  // Define hierarchical structure
                  const filterOptions = [
                    { value: 'all', label: 'All Conversations', children: null },
                    {
                      value: 'snoozed',
                      label: 'All Snoozed',
                      children: [
                        {
                          value: 'waitingoncustomer',
                          label: 'Waiting On Customer',
                          children: [
                            { value: 'waitingoncustomer-resolved', label: 'Resolved', children: null },
                            { value: 'waitingoncustomer-unresolved', label: 'Unresolved', children: null }
                          ]
                        },
                        { value: 'waitingontse', label: 'Waiting On TSE', children: null },
                        { value: 'snoozed-other', label: 'Other', children: null }
                      ]
                    },
                    { value: 'open', label: 'Open Chats', children: null },
                    {
                      value: 'closedtoday',
                      label: 'Closed Today',
                      children: [
                        { value: 'closed', label: 'Closed', children: null },
                        {
                          value: 'autoclosed',
                          label: 'Auto-Closed',
                          children: [
                            { value: 'autoclosed-resolved', label: 'Waiting On Customer - Resolved', children: null },
                            { value: 'autoclosed-unresolved', label: 'Waiting On Customer - Unresolved', children: null }
                          ]
                        }
                      ]
                    }
                  ];

                  // Recursive function to render filter items
                  const renderFilterItem = (option, level = 0) => {
                    const hasChildren = option.children && option.children.length > 0;
                    const isExpanded = expandedFilters.has(option.value);
                    const isParent = level === 0;
                    const isChild1 = level === 1;
                    const isChild2 = level === 2;
                    
                    let itemClassName = 'filter-select-dropdown-item';
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
                            checked={filterTag.includes(option.value)}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (option.value === 'all') {
                                // If "all" is selected, clear other selections
                                setFilterTag(['all']);
                              } else if (option.value === 'snoozed') {
                                // Handle All Snoozed parent: when checked, also check all children; when unchecked, uncheck all children
                                let newFilters = filterTag.filter(t => t !== 'all');
                                if (e.target.checked) {
                                  // Add parent and all children
                                  newFilters.push('snoozed');
                                  if (!newFilters.includes('waitingoncustomer')) {
                                    newFilters.push('waitingoncustomer');
                                  }
                                  if (!newFilters.includes('waitingoncustomer-resolved')) {
                                    newFilters.push('waitingoncustomer-resolved');
                                  }
                                  if (!newFilters.includes('waitingoncustomer-unresolved')) {
                                    newFilters.push('waitingoncustomer-unresolved');
                                  }
                                  if (!newFilters.includes('waitingontse')) {
                                    newFilters.push('waitingontse');
                                  }
                                  if (!newFilters.includes('snoozed-other')) {
                                    newFilters.push('snoozed-other');
                                  }
                                } else {
                                  // Remove parent and all children
                                  newFilters = newFilters.filter(t => 
                                    t !== 'snoozed' && 
                                    t !== 'waitingoncustomer' &&
                                    t !== 'waitingoncustomer-resolved' && 
                                    t !== 'waitingoncustomer-unresolved' &&
                                    t !== 'waitingontse' &&
                                    t !== 'snoozed-other'
                                  );
                                }
                                setFilterTag(newFilters.length === 0 ? ['all'] : newFilters);
                              } else if (option.value === 'waitingoncustomer') {
                                // Handle Waiting On Customer parent: when checked, remove "All Snoozed" parent; when unchecked, uncheck children
                                let newFilters = filterTag.filter(t => t !== 'all');
                                if (e.target.checked) {
                                  // Remove "All Snoozed" parent to allow precise filtering
                                  newFilters = newFilters.filter(t => t !== 'snoozed');
                                  // Remove specific children to allow parent-level filtering
                                  newFilters = newFilters.filter(t => 
                                    t !== 'waitingoncustomer-resolved' && 
                                    t !== 'waitingoncustomer-unresolved'
                                  );
                                  // Add parent
                                  if (!newFilters.includes('waitingoncustomer')) {
                                    newFilters.push('waitingoncustomer');
                                  }
                                } else {
                                  // Remove parent and both children
                                  newFilters = newFilters.filter(t => 
                                    t !== 'waitingoncustomer' && 
                                    t !== 'waitingoncustomer-resolved' && 
                                    t !== 'waitingoncustomer-unresolved'
                                  );
                                }
                                setFilterTag(newFilters.length === 0 ? ['all'] : newFilters);
                              } else if (option.value === 'closedtoday') {
                                // Handle Closed Today parent: when checked, just add it; when unchecked, remove it and children
                                let newFilters = filterTag.filter(t => t !== 'all');
                                if (e.target.checked) {
                                  // Remove any children to allow precise filtering
                                  newFilters = newFilters.filter(t => 
                                    t !== 'closed' &&
                                    t !== 'autoclosed' && 
                                    t !== 'autoclosed-resolved' && 
                                    t !== 'autoclosed-unresolved'
                                  );
                                  // Add parent
                                  if (!newFilters.includes('closedtoday')) {
                                    newFilters.push('closedtoday');
                                  }
                                } else {
                                  // Remove parent and all children
                                  newFilters = newFilters.filter(t => 
                                    t !== 'closedtoday' && 
                                    t !== 'closed' &&
                                    t !== 'autoclosed' && 
                                    t !== 'autoclosed-resolved' && 
                                    t !== 'autoclosed-unresolved'
                                  );
                                }
                                setFilterTag(newFilters.length === 0 ? ['all'] : newFilters);
                              } else if (option.value === 'closed') {
                                // Handle Closed subcategory: when checked, remove Closed Today parent and auto-closed children
                                let newFilters = filterTag.filter(t => t !== 'all');
                                if (e.target.checked) {
                                  // Remove Closed Today parent and auto-closed children to allow precise filtering
                                  newFilters = newFilters.filter(t => 
                                    t !== 'closedtoday' &&
                                    t !== 'autoclosed' && 
                                    t !== 'autoclosed-resolved' && 
                                    t !== 'autoclosed-unresolved'
                                  );
                                  // Add the selected filter
                                  if (!newFilters.includes('closed')) {
                                    newFilters.push('closed');
                                  }
                                } else {
                                  // Remove the filter
                                  newFilters = newFilters.filter(t => t !== 'closed');
                                }
                                setFilterTag(newFilters.length === 0 ? ['all'] : newFilters);
                              } else if (option.value === 'autoclosed') {
                                // Handle Auto-Closed parent: when checked, remove Closed Today parent, Closed, and children; when unchecked, uncheck children
                                let newFilters = filterTag.filter(t => t !== 'all');
                                if (e.target.checked) {
                                  // Remove Closed Today parent, Closed, and specific children to allow precise filtering
                                  newFilters = newFilters.filter(t => 
                                    t !== 'closedtoday' && 
                                    t !== 'closed' &&
                                    t !== 'autoclosed-resolved' && 
                                    t !== 'autoclosed-unresolved'
                                  );
                                  // Add parent
                                  if (!newFilters.includes('autoclosed')) {
                                    newFilters.push('autoclosed');
                                  }
                                } else {
                                  // Remove parent and both children
                                  newFilters = newFilters.filter(t => 
                                    t !== 'autoclosed' && 
                                    t !== 'autoclosed-resolved' && 
                                    t !== 'autoclosed-unresolved'
                                  );
                                }
                                setFilterTag(newFilters.length === 0 ? ['all'] : newFilters);
                              } else {
                                // Remove "all" if it's selected and user selects something else
                                let newFilters = filterTag.filter(t => t !== 'all');
                                if (e.target.checked) {
                                  // When checking a specific sub-sub-category, remove parent categories to allow precise filtering
                                  if (option.value === 'waitingoncustomer-resolved' || 
                                      option.value === 'waitingoncustomer-unresolved') {
                                    // Remove parent categories when selecting a specific sub-subcategory
                                    newFilters = newFilters.filter(t => 
                                      t !== 'snoozed' && 
                                      t !== 'waitingoncustomer'
                                    );
                                  } else if (option.value === 'waitingontse' || option.value === 'snoozed-other') {
                                    // Remove parent category when selecting a specific snoozed subcategory
                                    newFilters = newFilters.filter(t => t !== 'snoozed');
                                  } else if (option.value === 'autoclosed-resolved' || 
                                             option.value === 'autoclosed-unresolved') {
                                    // Remove parent categories when selecting a specific auto-closed sub-subcategory
                                    // CRITICAL: Remove "closedtoday" and "closed" to prevent matching all closed conversations
                                    newFilters = newFilters.filter(t => 
                                      t !== 'closedtoday' && 
                                      t !== 'closed' &&
                                      t !== 'autoclosed'
                                    );
                                  }
                                  
                                  // Add the selected filter
                                  if (!newFilters.includes(option.value)) {
                                    newFilters.push(option.value);
                                  }
                                } else {
                                  newFilters = newFilters.filter(t => t !== option.value);
                                  // If unchecking a child of autoclosed, also uncheck parent if both children are now unchecked
                                  if ((option.value === 'autoclosed-resolved' || option.value === 'autoclosed-unresolved')) {
                                    const hasResolved = newFilters.includes('autoclosed-resolved');
                                    const hasUnresolved = newFilters.includes('autoclosed-unresolved');
                                    if (!hasResolved && !hasUnresolved) {
                                      newFilters = newFilters.filter(t => t !== 'autoclosed');
                                      // Also uncheck "Closed Today" if no closed children remain
                                      const hasClosedChildren = newFilters.some(t => t === 'closedtoday');
                                      if (!hasClosedChildren) {
                                        newFilters = newFilters.filter(t => t !== 'closedtoday');
                                      }
                                    }
                                  }
                                  // If unchecking a child of waitingoncustomer, also uncheck parent if both children are now unchecked
                                  if ((option.value === 'waitingoncustomer-resolved' || option.value === 'waitingoncustomer-unresolved')) {
                                    const hasResolved = newFilters.includes('waitingoncustomer-resolved');
                                    const hasUnresolved = newFilters.includes('waitingoncustomer-unresolved');
                                    if (!hasResolved && !hasUnresolved) {
                                      newFilters = newFilters.filter(t => t !== 'waitingoncustomer');
                                    }
                                    // Also uncheck "All Snoozed" if no snoozed children remain
                                    const hasSnoozedChildren = newFilters.some(t => 
                                      t === 'waitingoncustomer' || t === 'waitingontse' || t === 'snoozed-other'
                                    );
                                    if (!hasSnoozedChildren) {
                                      newFilters = newFilters.filter(t => t !== 'snoozed');
                                    }
                                  }
                                  // If unchecking waitingoncustomer parent, uncheck "All Snoozed" if no other snoozed children remain
                                  if (option.value === 'waitingoncustomer') {
                                    const hasSnoozedChildren = newFilters.some(t => 
                                      t === 'waitingontse' || t === 'snoozed-other'
                                    );
                                    if (!hasSnoozedChildren) {
                                      newFilters = newFilters.filter(t => t !== 'snoozed');
                                    }
                                  }
                                  // If unchecking a snoozed child (waitingontse or snoozed-other), uncheck "All Snoozed" if no children remain
                                  if (option.value === 'waitingontse' || option.value === 'snoozed-other') {
                                    const hasSnoozedChildren = newFilters.some(t => 
                                      t === 'waitingoncustomer' || t === 'waitingontse' || t === 'snoozed-other'
                                    );
                                    if (!hasSnoozedChildren) {
                                      newFilters = newFilters.filter(t => t !== 'snoozed');
                                    }
                                  }
                                }
                                // If nothing selected, default to "all"
                                setFilterTag(newFilters.length === 0 ? ['all'] : newFilters);
                              }
                              setSearchId("");
                            }}
                            style={{ marginRight: '8px' }}
                          />
                          {option.label}
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
          <div className="filter-group">
            <label>Filter by TSE:</label>
            <select value={filterTSE} onChange={(e) => {
              setFilterTSE(e.target.value);
              // Clear search when changing TSE filter
              setSearchId("");
            }} className="filter-select">
              <option value="all">All TSEs</option>
              <option value="unassigned">Unassigned</option>
              {['UK', 'NY', 'SF', 'Other'].map(region => {
                const regionTSEs = tseByRegion[region] || [];
                if (regionTSEs.length === 0) return null;
                
                const regionLabels = {
                  'UK': 'UK',
                  'NY': 'New York',
                  'SF': 'San Francisco',
                  'Other': 'Other'
                };
                // eslint-disable-next-line no-unused-vars
                const regionIconUrls = {
                  'UK': REGION_ICONS['UK'],
                  'NY': REGION_ICONS['NY'],
                  'SF': REGION_ICONS['SF'],
                  'Other': null
                };
                
                return (
                  <optgroup key={region} label={regionLabels[region]}>
                    {regionTSEs.map(tse => (
                      <option key={tse.id} value={tse.id}>{tse.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <div className="filter-group">
            <label>Search by ID:</label>
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Enter conversation ID..."
              className="filter-input"
            />
          </div>
          <div className="filter-buttons">
            <button 
              onClick={() => {
                setFilterTSE("unassigned");
                setFilterTag(["all"]);
              }} 
              className="filter-button"
            >
              Show Unassigned
            </button>
            <button 
              onClick={() => {
                setFilterTag(["closedtoday"]);
                setFilterTSE("all");
              }} 
              className="filter-button"
            >
              Show Closed Today
            </button>
            <button 
              onClick={() => {
                setFilterTag(["snoozed"]);
              }} 
              className="filter-button"
            >
              Show Snoozed
            </button>
            <button 
              onClick={() => {
                setFilterTag(["open"]);
              }} 
              className="filter-button"
            >
              Show Open
            </button>
            <button 
              onClick={() => {
                setFilterTag(["all"]);
                setFilterTSE("all");
                setSearchId("");
              }} 
              className="filter-button clear-button"
            >
              Clear
            </button>
          </div>
        </div>
      )}


      {/* My Queue - Show only in myqueue view */}
      {activeView === "myqueue" && effectiveTSE && (
        <MyQueue
          conversations={conversations}
          teamMembers={teamMembers}
          currentUserEmail={effectiveTSE?.email || user?.email}
          simulatedTSE={hasFooterControlsAccess && devViewMode === 'tse' && simulatedTSEId ? effectiveTSE : null}
          loading={loading}
          error={error}
          onRefresh={onRefresh}
          lastUpdated={lastUpdated}
          historicalSnapshots={historicalSnapshots}
          responseTimeMetrics={responseTimeMetrics}
        />
      )}

      {/* Modern Overview - Show only in overview */}
      {activeView === "overview" && (
        <OverviewDashboard 
          metrics={metrics}
          conversations={conversations}
          historicalSnapshots={historicalSnapshots}
          responseTimeMetrics={responseTimeMetrics}
          loadingHistorical={loadingHistorical}
          onNavigateToConversations={(filterTag) => {
            setActiveView("conversations");
            const tags = Array.isArray(filterTag) ? filterTag : [filterTag];
            // If navigating to unassigned conversations, set TSE filter and reset tag filter
            if (tags.includes("unassigned")) {
              setFilterTSE("unassigned");
              setFilterTag(["all"]);
            } else {
              // For other filters, set tag filter and reset TSE filter
              setFilterTag(tags);
              setFilterTSE("all");
            }
          }}
          onNavigateToTSEView={() => {
            setActiveView("tse");
            setSelectedColors(new Set(['error'])); // Over Limit only
            setSelectedRegions(new Set(['UK', 'NY', 'SF', 'Other'])); // All regions
          }}
          onTSEClick={handleTSECardClick}
          isInsightDismissed={isInsightDismissed}
          dismissInsightItem={dismissInsightItem}
        />
      )}

      {/* TSE-Level Breakdown - Show only in TSE view */}
      {activeView === "tse" && (
        <div className="tse-section">
          <h3 className="section-title">TSE Queue Health</h3>
          
          {/* Filters Container */}
          <div className="tse-filters-container">
            <h4 className="filters-title">Filters</h4>
            
            {/* Color Filters */}
            <div className="tse-color-filters-section">
              <div className="filter-section-header">
                <span className="filter-section-label">Status:</span>
                <div className="filter-buttons">
                  <button 
                    className="filter-button"
                    onClick={() => setSelectedColors(new Set(['warning', 'exceeding', 'success', 'error']))}
                  >
                    Select All
                  </button>
                  <button 
                    className="filter-button"
                    onClick={() => setSelectedColors(new Set())}
                  >
                    Unselect All
                  </button>
                </div>
              </div>
              <div className="tse-color-filters">
                <div 
                  className={`legend-item legend-clickable ${selectedColors.has('exceeding') ? 'legend-selected' : ''}`}
                  onClick={() => {
                    const newColors = new Set(selectedColors);
                    if (newColors.has('exceeding')) {
                      newColors.delete('exceeding');
                    } else {
                      newColors.add('exceeding');
                    }
                    setSelectedColors(newColors);
                  }}
                >
                  <div className="legend-color legend-exceeding">
                    {selectedColors.has('exceeding') && <span className="legend-checkmark">✓</span>}
                  </div>
                  <span className="legend-label">Outstanding (0 open, 0 waiting on TSE)</span>
                </div>
                <div 
                  className={`legend-item legend-clickable ${selectedColors.has('success') ? 'legend-selected' : ''}`}
                  onClick={() => {
                    const newColors = new Set(selectedColors);
                    if (newColors.has('success')) {
                      newColors.delete('success');
                    } else {
                      newColors.add('success');
                    }
                    setSelectedColors(newColors);
                  }}
                >
                  <div className="legend-color legend-success">
                    {selectedColors.has('success') && <span className="legend-checkmark">✓</span>}
                  </div>
                  <span className="legend-label">On Track (≤{THRESHOLDS.MAX_OPEN_SOFT} open, ≤{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT} waiting on TSE)</span>
                </div>
                <div 
                  className={`legend-item legend-clickable ${selectedColors.has('warning') ? 'legend-selected' : ''}`}
                  onClick={() => {
                    const newColors = new Set(selectedColors);
                    if (newColors.has('warning')) {
                      newColors.delete('warning');
                    } else {
                      newColors.add('warning');
                    }
                    setSelectedColors(newColors);
                  }}
                >
                  <div className="legend-color legend-warning">
                    {selectedColors.has('warning') && <span className="legend-checkmark">✓</span>}
                  </div>
                  <span className="legend-label">Missing Snooze Tags (Total Snoozed &gt; Waiting On TSE + Waiting On Customer)</span>
                </div>
                <div 
                  className={`legend-item legend-clickable ${selectedColors.has('error') ? 'legend-selected' : ''}`}
                  onClick={() => {
                    const newColors = new Set(selectedColors);
                    if (newColors.has('error')) {
                      newColors.delete('error');
                    } else {
                      newColors.add('error');
                    }
                    setSelectedColors(newColors);
                  }}
                >
                  <div className="legend-color legend-error">
                    {selectedColors.has('error') && <span className="legend-checkmark">✓</span>}
                  </div>
                  <span className="legend-label">Over Limit - Needs Attention</span>
                </div>
              </div>
            </div>

            {/* Region Filter */}
            <div className="tse-region-filter-section">
              <div className="filter-section-header">
                <span className="filter-section-label">Region:</span>
                <div className="filter-buttons">
                  <button 
                    className="filter-button"
                    onClick={() => setSelectedRegions(new Set(['UK', 'NY', 'SF', 'Other']))}
                  >
                    Select All
                  </button>
                  <button 
                    className="filter-button"
                    onClick={() => setSelectedRegions(new Set())}
                  >
                    Unselect All
                  </button>
                </div>
              </div>
              <div className="tse-region-filter">
                {['UK', 'NY', 'SF', 'Other'].map(region => {
                  const regionLabels = {
                    'UK': { text: 'UK' },
                    'NY': { text: 'New York' },
                    'SF': { text: 'San Francisco' },
                    'Other': { text: 'Other' }
                  };
                  const label = regionLabels[region];
                  // Use dark mode icon for NY when in dark mode
                  let iconUrl = REGION_ICONS[region];
                  if (region === 'NY' && isDarkMode) {
                    iconUrl = 'https://res.cloudinary.com/doznvxtja/image/upload/v1768716963/3_150_x_150_px_16_ozl21j.svg';
                  }
                  return (
                    <label key={region} className="region-filter-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedRegions.has(region)}
                        onChange={(e) => {
                          const newRegions = new Set(selectedRegions);
                          if (e.target.checked) {
                            newRegions.add(region);
                          } else {
                            newRegions.delete(region);
                          }
                          setSelectedRegions(newRegions);
                        }}
                      />
                      <span className="region-filter-text">{label.text}</span>
                      {iconUrl && (
                        <img 
                          src={iconUrl} 
                          alt={region} 
                          className="region-filter-icon"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {['UK', 'NY', 'SF', 'Other'].map(region => {
            // Skip if region is not selected
            if (!selectedRegions.has(region)) return null;
            
            const tses = tseByRegion[region];
            if (tses.length === 0) return null;

            const regionLabels = {
              'UK': 'UK',
              'NY': 'New York',
              'SF': 'San Francisco',
              'Other': 'Other'
            };

            // Helper function to get status for a TSE
            const getTSEStatus = (tse) => {
              const totalOpen = tse.open;
              const totalWaitingOnTSE = tse.waitingOnTSE || 0;
              const totalWaitingOnCustomer = tse.waitingOnCustomer || 0;
              const totalSnoozed = tse.totalSnoozed || 0;
              
              // Outstanding: 0 open and 0 waiting on TSE
              if (totalOpen === 0 && totalWaitingOnTSE === 0) {
                return "exceeding";
              }
              // Over Limit - Needs Attention: either >5 open OR >5 waiting on TSE
              // Check this BEFORE warning to prioritize critical issues
              if (totalOpen > THRESHOLDS.MAX_OPEN_SOFT || totalWaitingOnTSE > THRESHOLDS.MAX_WAITING_ON_TSE_SOFT) {
                return "error";
              }
              // On Track: ≤5 open AND ≤5 waiting on TSE
              if (totalOpen <= THRESHOLDS.MAX_OPEN_SOFT && totalWaitingOnTSE <= THRESHOLDS.MAX_WAITING_ON_TSE_SOFT) {
                // Check for warning condition: Total Snoozed > Waiting On TSE + Waiting On Customer
                // This indicates snoozed conversations without proper tags
                if (totalSnoozed > (totalWaitingOnTSE + totalWaitingOnCustomer)) {
                  return "warning";
                }
                return "success";
              }
              // Fallback (shouldn't reach here, but just in case)
              return "error";
            };

            // Filter TSEs by selected colors, then sort by status
            const filteredAndSortedTSEs = [...tses]
              .filter(tse => selectedColors.has(getTSEStatus(tse)))
              .sort((a, b) => {
                const statusOrder = { "warning": 0, "exceeding": 1, "success": 2, "error": 3 };
                return statusOrder[getTSEStatus(a)] - statusOrder[getTSEStatus(b)];
              });

            // Don't render region group if no TSEs match the filter
            if (filteredAndSortedTSEs.length === 0) return null;

            const regionText = regionLabels[region];
            // Use dark mode icon for NY when in dark mode
            let iconUrl = REGION_ICONS[region];
            if (region === 'NY' && isDarkMode) {
              iconUrl = 'https://res.cloudinary.com/doznvxtja/image/upload/v1768716963/3_150_x_150_px_16_ozl21j.svg';
            }

            return (
              <div key={region} className="tse-region-group">
                <h4 className="tse-region-title">
                  <span className="region-title-text">{regionText}</span>
                  {iconUrl && (
                    <img 
                      src={iconUrl} 
                      alt={region} 
                      className="region-title-icon"
                    />
                  )}
                </h4>
                <div className="tse-grid">
                  {filteredAndSortedTSEs.map((tse) => {
                    const totalOpen = tse.open;
                    const totalWaitingOnTSE = tse.waitingOnTSE || 0;
                    const totalWaitingOnCustomer = tse.waitingOnCustomer || 0;
                    const totalSnoozed = tse.totalSnoozed || 0;
                    const status = getTSEStatus(tse);

                    const avatarUrl = getTSEAvatar(tse.name);

                    return (
                      <div 
                        key={tse.id} 
                        className={`tse-card tse-${status} tse-card-clickable`}
                        onClick={() => handleTSECardClick(tse)}
                      >
                        <div className={`tse-card-click-icon status-${status}`}>→</div>
                        <div className="tse-header">
                          <div className="tse-header-left">
                            <div className="tse-avatar-container">
                              {avatarUrl && (
                                <img 
                                  src={avatarUrl} 
                                  alt={tse.name}
                                  className="tse-avatar"
                                />
                              )}
                              {tse.awayModeEnabled ? (
                                <span className="avatar-away-indicator" title="Away mode enabled">
                                  🌙
                                </span>
                              ) : (
                                <span className="avatar-available-indicator" title="Available">
                                </span>
                              )}
                            </div>
                            <h4>
                              {tse.name}
                              {status === "exceeding" && (
                                <span 
                                  className="tse-status-icon tse-exceeding-star"
                                  title={`Outstanding - ${tse.open || 0} open, ${tse.waitingOnTSE || 0} waiting on TSE`}
                                >
                                  ⭐
                                </span>
                              )}
                              {status === "success" && (
                                <span 
                                  className="tse-status-icon tse-success-checkmark"
                                  title={`On Track - ${tse.open || 0} open, ${tse.waitingOnTSE || 0} waiting on TSE (target: ≤${THRESHOLDS.MAX_OPEN_SOFT} open, ≤${THRESHOLDS.MAX_WAITING_ON_TSE_SOFT} waiting)`}
                                >
                                  ✓
                                </span>
                              )}
                              {status === "warning" && (
                                <span 
                                  className="tse-status-icon tse-warning-exclamation"
                                  title={`Missing Snooze Tags - ${tse.totalSnoozed || 0} total snoozed, but only ${(tse.waitingOnTSE || 0) + (tse.waitingOnCustomer || 0)} have proper tags. Please tag snoozed conversations with one of: Waiting On TSE, Waiting On Customer - Resolved, or Waiting On Customer - Unresolved.`}
                                >
                                  ⚠
                                </span>
                              )}
                              {status === "error" && (
                                <span 
                                  className="tse-status-icon tse-error-x"
                                  title={`Over Limit - Needs Attention - ${tse.open || 0} open, ${tse.waitingOnTSE || 0} waiting on TSE (target: ≤${THRESHOLDS.MAX_OPEN_SOFT} open, ≤${THRESHOLDS.MAX_WAITING_ON_TSE_SOFT} waiting)`}
                                >
                                  ✗
                                </span>
                              )}
                            </h4>
                          </div>
                        </div>
                        <div className="tse-metrics">
                          <div className="tse-metric">
                            <span className="metric-label">Open:</span>
                            <span className={`metric-value ${totalOpen > THRESHOLDS.MAX_OPEN_SOFT ? "metric-error" : ""}`}>
                              {totalOpen}
                            </span>
                          </div>
                          <div className="tse-metric">
                            <span className="metric-label">Waiting On TSE:</span>
                            <span className={`metric-value ${totalWaitingOnTSE > THRESHOLDS.MAX_WAITING_ON_TSE_SOFT ? "metric-error" : ""}`}>
                              {totalWaitingOnTSE}
                            </span>
                          </div>
                          <div className="tse-metric">
                            <span className="metric-label">Waiting On Customer:</span>
                            <span className="metric-value">{totalWaitingOnCustomer}</span>
                          </div>
                          <div className="tse-metric">
                            <span className="metric-label">Total Snoozed:</span>
                            <span className="metric-value">{totalSnoozed}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeView === "conversations" && (
        <div className="conversations-view">
          <h3 className="section-title">
            {filterTSE === "unassigned" && "Unassigned Conversations"}
            {filterTag.length === 1 && filterTag[0] === "open" && filterTSE !== "unassigned" && "Open Conversations"}
            {filterTag.length === 1 && filterTag[0] === "all" && filterTSE !== "unassigned" && "All Open & Snoozed Conversations"}
            {filterTag.length === 1 && filterTag[0] === "snoozed" && "Total Snoozed Conversations"}
            {filterTag.length === 1 && filterTag[0] === "closedtoday" && "Closed Today"}
            {filterTag.length === 1 && filterTag[0] === "closed" && "Closed"}
            {filterTag.length === 1 && filterTag[0] === "waitingontse" && "Snoozed - Waiting On TSE"}
            {filterTag.length === 1 && filterTag[0] === "waitingoncustomer" && "Snoozed - Waiting On Customer"}
            {filterTag.length === 1 && filterTag[0] === "waitingoncustomer-resolved" && "Waiting On Customer - Resolved"}
            {filterTag.length === 1 && filterTag[0] === "waitingoncustomer-unresolved" && "Waiting On Customer - Unresolved"}
            {filterTag.length > 1 && `Filtered Conversations (${filterTag.length} filters)`}
            <span className="count-badge">({filteredConversations.length})</span>
          </h3>
          <ConversationTable 
            conversations={filteredConversations} 
          />
        </div>
      )}


      {/* Historical View */}
      {activeView === "historical" && (
        <HistoricalView 
          onSaveSnapshot={handleSaveSnapshot} 
          refreshTrigger={lastUpdated}
          managerTeamFilter={userRole === 'manager' && managerInfo && myTeamOnly ? managerInfo.team : null}
          isManager={userRole === 'manager'}
          managerTeam={userRole === 'manager' && managerInfo ? managerInfo.team : null}
          myTeamOnly={myTeamOnly}
          onToggleMyTeamOnly={() => setMyTeamOnly(!myTeamOnly)}
        />
      )}


      {/* TSE Details Modal */}
      {isModalOpen && selectedTSE && (
        <TSEDetailsModal
          tse={selectedTSE}
          conversations={getTSEConversations(selectedTSE.id)}
          historicalSnapshots={historicalSnapshots}
          responseTimeMetrics={responseTimeMetrics}
          onClose={handleCloseModal}
        />
      )}

      {/* Help Modal */}
      {isHelpModalOpen && (
        <HelpModal onClose={() => setIsHelpModalOpen(false)} />
      )}

      {/* Outstanding Performance Streaks Modal */}
      {isStreaksModalOpen && performanceStreaks.streak3.length > 0 && (
        <div className="modal-overlay streaks-modal-overlay" onClick={() => setIsStreaksModalOpen(false)}>
          <div className="modal-content streaks-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="streaks-modal-header">
              <h2 className="streaks-modal-title">🔥 Outstanding Performance Streaks</h2>
              <button 
                className="modal-close-button" 
                onClick={() => setIsStreaksModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            
            <div className="streaks-modal-body">
              {/* Region Filter Buttons */}
              <div className="streaks-region-filters">
                <button
                  type="button"
                  className={`streaks-filter-btn ${streaksRegionFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setStreaksRegionFilter('all')}
                >
                  All Regions
                </button>
                <button
                  type="button"
                  className={`streaks-filter-btn ${streaksRegionFilter === 'UK' ? 'active' : ''}`}
                  onClick={() => setStreaksRegionFilter('UK')}
                >
                  <img src={REGION_ICONS['UK']} alt="UK" className="streaks-region-icon" />
                  UK
                </button>
                <button
                  type="button"
                  className={`streaks-filter-btn ${streaksRegionFilter === 'NY' ? 'active' : ''}`}
                  onClick={() => setStreaksRegionFilter('NY')}
                >
                  <img 
                    src={isDarkMode ? 'https://res.cloudinary.com/doznvxtja/image/upload/v1768716963/3_150_x_150_px_16_ozl21j.svg' : REGION_ICONS['NY']} 
                    alt="NY" 
                    className="streaks-region-icon" 
                  />
                  NY
                </button>
                <button
                  type="button"
                  className={`streaks-filter-btn ${streaksRegionFilter === 'SF' ? 'active' : ''}`}
                  onClick={() => setStreaksRegionFilter('SF')}
                >
                  <img src={REGION_ICONS['SF']} alt="SF" className="streaks-region-icon" />
                  SF
                </button>
              </div>

              {/* Streaks Container */}
              <div className="streaks-container">
                {filteredPerformanceStreaks.streak3.length > 0 && (
                  <div className="streak-tier streak-tier-bronze">
                    <div className="streak-tier-header">
                      <span className="streak-tier-icon">💪</span>
                      <div className="streak-tier-info">
                        <h3 className="streak-tier-title">Building Momentum</h3>
                        <p className="streak-tier-subtitle">⭐ 3+ Consecutive Outstanding Days</p>
                      </div>
                    </div>
                    <div className="streak-avatars">
                      {filteredPerformanceStreaks.streak3.map((streakTSE) => {
                        const avatarUrl = getTSEAvatar(streakTSE.name);
                        // Find the full TSE object from metrics
                        const fullTSE = (metrics.byTSE || []).find(t => 
                          String(t.id) === String(streakTSE.id) || t.name === streakTSE.name
                        ) || streakTSE; // Fallback to streakTSE if not found in metrics
                        
                        return (
                          <div 
                            key={streakTSE.id} 
                            className="streak-avatar-item streak-avatar-clickable" 
                            title={`${streakTSE.name} - ${streakTSE.streak} days`}
                            onClick={() => {
                              setIsStreaksModalOpen(false);
                              handleTSECardClick(fullTSE);
                            }}
                          >
                            {avatarUrl ? (
                              <img 
                                src={avatarUrl} 
                                alt={streakTSE.name}
                                className="streak-avatar streak-avatar-bronze"
                              />
                            ) : (
                              <div className="streak-avatar streak-avatar-bronze streak-avatar-placeholder">
                                {streakTSE.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                            )}
                            <div className="streak-badge streak-badge-bronze">{streakTSE.streak}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer - Dev Controls (configurable via FOOTER_CONTROLS_USERS) */}
      {hasFooterControlsAccess && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderTop: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          zIndex: 1000,
          backdropFilter: 'blur(10px)'
        }}>
          {/* TSE/Manager Mode Toggle */}
          <div 
            className="view-mode-toggle"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
            }}
          >
            <span style={{ 
              fontSize: '11px', 
              color: devViewMode === 'tse' 
                ? (isDarkMode ? '#81c784' : '#4caf50')
                : (isDarkMode ? '#888' : '#999'),
              fontWeight: devViewMode === 'tse' ? '600' : '400'
            }}>
              TSE
            </span>
            <button
              onClick={() => {
                const newMode = devViewMode === 'manager' ? 'tse' : 'manager';
                setDevViewMode(newMode);
                // Switch to appropriate default view
                if (newMode === 'tse') {
                  setActiveView('myqueue');
                } else {
                  setActiveView('overview');
                }
              }}
              style={{
                position: 'relative',
                width: '40px',
                height: '20px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: devViewMode === 'manager'
                  ? (isDarkMode ? '#673ab7' : '#9575cd')
                  : (isDarkMode ? '#4caf50' : '#81c784'),
                transition: 'all 0.2s ease',
                padding: 0
              }}
              title={`Switch to ${devViewMode === 'manager' ? 'TSE' : 'Manager'} mode`}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  left: devViewMode === 'manager' ? '22px' : '2px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}
              />
            </button>
            <span style={{ 
              fontSize: '11px', 
              color: devViewMode === 'manager' 
                ? (isDarkMode ? '#b39ddb' : '#673ab7')
                : (isDarkMode ? '#888' : '#999'),
              fontWeight: devViewMode === 'manager' ? '600' : '400'
            }}>
              Manager
            </span>
          </div>
          
          {/* TSE Simulation Dropdown - only visible in TSE mode */}
          {devViewMode === 'tse' && teamMembers.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ 
                fontSize: '11px', 
                color: isDarkMode ? '#888' : '#666',
                fontWeight: '500'
              }}>
                Simulate:
              </span>
              <select
                value={simulatedTSEId || ''}
                onChange={(e) => setSimulatedTSEId(e.target.value || null)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`,
                  backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                  color: isDarkMode ? '#fff' : '#333',
                  fontSize: '12px',
                  cursor: 'pointer',
                  minWidth: '160px'
                }}
              >
                <option value="">-- Select TSE --</option>
                {['UK', 'NY', 'SF', 'Other'].map(region => {
                  const regionTSEs = teamMembers.filter(tse => getTSERegion(tse.name) === region);
                  if (regionTSEs.length === 0) return null;
                  return (
                    <optgroup key={region} label={region === 'NY' ? 'New York' : region === 'SF' ? 'San Francisco' : region}>
                      {regionTSEs.sort((a, b) => a.name.localeCompare(b.name)).map(tse => (
                        <option key={tse.id} value={tse.id}>{tse.name}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              {simulatedTSEId && (
                <button
                  onClick={() => setSimulatedTSEId(null)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: isDarkMode ? '#444' : '#e0e0e0',
                    color: isDarkMode ? '#fff' : '#333',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                  title="Clear simulation"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          
          {/* Manager Simulation Dropdown - only visible in Manager mode */}
          {devViewMode === 'manager' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ 
                fontSize: '11px', 
                color: isDarkMode ? '#888' : '#666',
                fontWeight: '500'
              }}>
                Simulate:
              </span>
              <select
                value={simulatedManagerName || ''}
                onChange={(e) => setSimulatedManagerName(e.target.value || null)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`,
                  backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                  color: isDarkMode ? '#fff' : '#333',
                  fontSize: '12px',
                  cursor: 'pointer',
                  minWidth: '160px'
                }}
              >
                <option value="">-- Select Manager --</option>
                {ALL_MANAGER_NAMES.filter(name => !FOOTER_CONTROLS_USERS.includes(name)).map(name => (
                  <option key={name} value={name}>
                    {name} ({getManagerInfo(name)?.region})
                  </option>
                ))}
              </select>
              {simulatedManagerName && (
                <button
                  onClick={() => setSimulatedManagerName(null)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: isDarkMode ? '#444' : '#e0e0e0',
                    color: isDarkMode ? '#fff' : '#333',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                  title="Clear simulation"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Audit Logs Button */}
          <button
            onClick={() => setShowAuditLogs(true)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`,
              backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
              color: isDarkMode ? '#fff' : '#333',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="View audit logs"
          >
            <span>📋</span>
            <span>Audit Logs</span>
          </button>
        </div>
      )}

      {/* Audit Logs Modal */}
      {showAuditLogs && (
        <AuditLogsModal 
          isOpen={showAuditLogs} 
          onClose={() => setShowAuditLogs(false)}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}

// Audit Logs Modal Component
function AuditLogsModal({ isOpen, onClose, isDarkMode }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterAction, setFilterAction] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const pageSize = 50;

  useEffect(() => {
    if (!isOpen) return;

    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiBaseUrl = process.env.NODE_ENV === 'production' 
          ? window.location.origin
          : (process.env.REACT_APP_API_URL || 'https://queue-health-monitor.vercel.app');
        
        const params = new URLSearchParams({
          limit: pageSize.toString(),
          offset: (page * pageSize).toString()
        });
        
        if (filterAction) params.append('action', filterAction);
        if (filterUserId) params.append('user_id', filterUserId);

        const response = await fetch(`${apiBaseUrl}/api/audit-logs/get?${params}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch audit logs');
        }

        const data = await response.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [isOpen, page, filterAction, filterUserId]);

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: isDarkMode ? '#1e1e1e' : '#fff',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '1200px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${isDarkMode ? '#444' : '#e0e0e0'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: isDarkMode ? '#fff' : '#292929'
          }}>
            Audit Logs
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: isDarkMode ? '#fff' : '#666',
              padding: '4px 8px',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${isDarkMode ? '#444' : '#e0e0e0'}`,
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <label style={{
            fontSize: '13px',
            color: isDarkMode ? '#e5e5e5' : '#666',
            fontWeight: 500
          }}>
            Filter by Action:
          </label>
          <select
            value={filterAction}
            onChange={(e) => {
              setFilterAction(e.target.value);
              setPage(0);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`,
              backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
              color: isDarkMode ? '#fff' : '#333',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <option value="">All Actions</option>
            <option value="sign_in">Sign In</option>
            <option value="sign_out">Sign Out</option>
          </select>

          <label style={{
            fontSize: '13px',
            color: isDarkMode ? '#e5e5e5' : '#666',
            fontWeight: 500,
            marginLeft: '16px'
          }}>
            Filter by User ID:
          </label>
          <input
            type="text"
            value={filterUserId}
            onChange={(e) => {
              setFilterUserId(e.target.value);
              setPage(0);
            }}
            placeholder="Enter user ID"
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`,
              backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
              color: isDarkMode ? '#fff' : '#333',
              fontSize: '13px',
              minWidth: '150px'
            }}
          />
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px 24px'
        }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: isDarkMode ? '#999' : '#666'
            }}>
              Loading audit logs...
            </div>
          ) : error ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#ff6b6b'
            }}>
              Error: {error}
            </div>
          ) : logs.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: isDarkMode ? '#999' : '#666'
            }}>
              No audit logs found
            </div>
          ) : (
            <>
              <div style={{
                marginBottom: '16px',
                fontSize: '13px',
                color: isDarkMode ? '#999' : '#666'
              }}>
                Showing {logs.length} of {total} logs
              </div>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px'
              }}>
                <thead>
                  <tr style={{
                    borderBottom: `2px solid ${isDarkMode ? '#444' : '#e0e0e0'}`
                  }}>
                    <th style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: isDarkMode ? '#fff' : '#292929'
                    }}>Timestamp</th>
                    <th style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: isDarkMode ? '#fff' : '#292929'
                    }}>Action</th>
                    <th style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: isDarkMode ? '#fff' : '#292929'
                    }}>User</th>
                    <th style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: isDarkMode ? '#fff' : '#292929'
                    }}>Email</th>
                    <th style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: isDarkMode ? '#fff' : '#292929'
                    }}>IP Address</th>
                    <th style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: isDarkMode ? '#fff' : '#292929'
                    }}>User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <tr 
                      key={log.id}
                      style={{
                        borderBottom: `1px solid ${isDarkMode ? '#333' : '#f0f0f0'}`,
                        backgroundColor: idx % 2 === 0 
                          ? (isDarkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)')
                          : 'transparent'
                      }}
                    >
                      <td style={{
                        padding: '12px',
                        color: isDarkMode ? '#e5e5e5' : '#333',
                        whiteSpace: 'nowrap'
                      }}>
                        {formatDateTime(log.created_at)}
                      </td>
                      <td style={{
                        padding: '12px',
                        color: log.action === 'sign_in' 
                          ? (isDarkMode ? '#4cec8c' : '#4caf50')
                          : (isDarkMode ? '#ff9a74' : '#ff6b6b'),
                        fontWeight: 500
                      }}>
                        {log.action === 'sign_in' ? '✓ Sign In' : '✗ Sign Out'}
                      </td>
                      <td style={{
                        padding: '12px',
                        color: isDarkMode ? '#e5e5e5' : '#333'
                      }}>
                        {log.user_name || log.user_id || 'N/A'}
                      </td>
                      <td style={{
                        padding: '12px',
                        color: isDarkMode ? '#e5e5e5' : '#333'
                      }}>
                        {log.user_email || 'N/A'}
                      </td>
                      <td style={{
                        padding: '12px',
                        color: isDarkMode ? '#999' : '#666',
                        fontFamily: 'monospace',
                        fontSize: '12px'
                      }}>
                        {log.ip_address || 'N/A'}
                      </td>
                      <td style={{
                        padding: '12px',
                        color: isDarkMode ? '#999' : '#666',
                        fontSize: '12px',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }} title={log.user_agent || ''}>
                        {log.user_agent || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {total > pageSize && (
                <div style={{
                  marginTop: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`,
                      backgroundColor: page === 0 
                        ? (isDarkMode ? '#2a2a2a' : '#f5f5f5')
                        : (isDarkMode ? '#2a2a2a' : '#fff'),
                      color: page === 0 
                        ? (isDarkMode ? '#666' : '#999')
                        : (isDarkMode ? '#fff' : '#333'),
                      cursor: page === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Previous
                  </button>
                  <span style={{
                    color: isDarkMode ? '#999' : '#666',
                    fontSize: '13px'
                  }}>
                    Page {page + 1} of {Math.ceil(total / pageSize)}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(Math.ceil(total / pageSize) - 1, page + 1))}
                    disabled={page >= Math.ceil(total / pageSize) - 1}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: `1px solid ${isDarkMode ? '#444' : '#ccc'}`,
                      backgroundColor: page >= Math.ceil(total / pageSize) - 1
                        ? (isDarkMode ? '#2a2a2a' : '#f5f5f5')
                        : (isDarkMode ? '#2a2a2a' : '#fff'),
                      color: page >= Math.ceil(total / pageSize) - 1
                        ? (isDarkMode ? '#666' : '#999')
                        : (isDarkMode ? '#fff' : '#333'),
                      cursor: page >= Math.ceil(total / pageSize) - 1 ? 'not-allowed' : 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Alerts Dropdown Component
function AlertsDropdown({ alerts, isOpen, onToggle, onClose, onTSEClick, onViewAll, onViewChats, isAlertRead, onMarkAsRead, onMarkAllAsRead }) {
  const { isDarkMode } = useTheme();
  const [expandedRegions, setExpandedRegions] = useState(new Set()); // All collapsed by default
  const [expandedTSEs, setExpandedTSEs] = useState(new Set());
  const [expandedAlertTypes, setExpandedAlertTypes] = useState(new Set());
  const dropdownRef = useRef(null);
  
  // Count unread alerts
  const unreadCount = useMemo(() => {
    return (alerts || []).filter(alert => !isAlertRead || !isAlertRead(alert.id)).length;
  }, [alerts, isAlertRead]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Group alerts by region, then by TSE
  const alertsByRegion = useMemo(() => {
    const regionGroups = {
      'UK': [],
      'NY': [],
      'SF': [],
      'Other': []
    };

    // First group by TSE
    const tseGroups = {};
    (alerts || []).forEach(alert => {
      const tseKey = alert.tseId || alert.tseName;
      if (!tseGroups[tseKey]) {
        tseGroups[tseKey] = {
          tseId: alert.tseId,
          tseName: alert.tseName,
          openAlerts: [],
          snoozedAlerts: []
        };
      }
      
      if (alert.type === "open_threshold") {
        tseGroups[tseKey].openAlerts.push(alert);
      } else if (alert.type === "waiting_on_tse_threshold") {
        tseGroups[tseKey].snoozedAlerts.push(alert);
      }
    });

    // Then group TSEs by region
    Object.values(tseGroups).forEach(tseGroup => {
      const region = getTSERegion(tseGroup.tseName);
      if (regionGroups[region]) {
        regionGroups[region].push(tseGroup);
      } else {
        regionGroups['Other'].push(tseGroup);
      }
    });

    // Sort TSEs within each region
    Object.keys(regionGroups).forEach(region => {
      regionGroups[region].sort((a, b) => a.tseName.localeCompare(b.tseName));
    });

    return regionGroups;
  }, [alerts]);

  // eslint-disable-next-line no-unused-vars
  const allTSEs = useMemo(() => {
    return Object.values(alertsByRegion).flat();
  }, [alertsByRegion]);

  // Get TSEs from expanded regions only
  const expandedRegionTSEs = useMemo(() => {
    return ['UK', 'NY', 'SF', 'Other']
      .filter(region => expandedRegions.has(region))
      .flatMap(region => alertsByRegion[region] || []);
  }, [expandedRegions, alertsByRegion]);
  
  // Create a Set of TSE keys from expanded regions for quick lookup
  // eslint-disable-next-line no-unused-vars
  const visibleTSEKeys = useMemo(() => {
    return new Set(expandedRegionTSEs.map(tse => `${tse.tseId}-${tse.tseName}`));
  }, [expandedRegionTSEs]);

  const toggleRegion = (region) => {
    const newExpanded = new Set(expandedRegions);
    if (newExpanded.has(region)) {
      newExpanded.delete(region);
    } else {
      newExpanded.add(region);
    }
    setExpandedRegions(newExpanded);
  };

  const toggleTSE = (tseKey) => {
    const newExpanded = new Set(expandedTSEs);
    if (newExpanded.has(tseKey)) {
      newExpanded.delete(tseKey);
    } else {
      newExpanded.add(tseKey);
    }
    setExpandedTSEs(newExpanded);
  };

  const toggleAlertType = (key) => {
    const newExpanded = new Set(expandedAlertTypes);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedAlertTypes(newExpanded);
  };

  const alertCount = alerts?.length || 0;

  return (
    <div className="alerts-dropdown-container" ref={dropdownRef}>
      <button 
        className="alerts-icon-button"
        onClick={onToggle}
        aria-label="Alerts"
      >
        {unreadCount > 0 ? (
          <img 
            src="https://res.cloudinary.com/doznvxtja/image/upload/v1767012829/3_150_x_150_px_b2yyf9.svg" 
            alt="Alerts" 
            className="alerts-icon alerts-icon-with-badge"
          />
        ) : alertCount > 0 ? (
          <img 
            src="https://res.cloudinary.com/doznvxtja/image/upload/v1767012190/2_nkazbo.svg" 
            alt="All read" 
            className="alerts-icon"
          />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        )}
      </button>
      
      {isOpen && (
        <div className="alerts-dropdown">
          <div className="alerts-dropdown-header">
            <h3>Active Alerts {unreadCount > 0 && <span style={{ fontSize: '14px', fontWeight: 'normal', color: isDarkMode ? '#999' : '#666' }}>({unreadCount} unread)</span>}</h3>
            <div className="alerts-dropdown-header-actions">
              {onMarkAllAsRead && unreadCount > 0 && (
                <button 
                  className="alerts-mark-all-read-button" 
                  onClick={onMarkAllAsRead}
                  style={{
                    background: 'none',
                    border: `1px solid ${isDarkMode ? '#555' : '#ddd'}`,
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    color: isDarkMode ? '#4fc3f7' : '#1976d2',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Mark all as read
                </button>
              )}
              {onViewAll && (
                <button 
                  className="alerts-view-all-button" 
                  onClick={onViewAll}
                >
                  View All
                </button>
              )}
              <button className="alerts-close-button" onClick={onClose}>×</button>
            </div>
          </div>
          <div className="alerts-dropdown-content">
            {alertCount === 0 ? (
              <div className="alerts-empty">
                <p>No active alerts</p>
              </div>
            ) : (
              <>
                {['UK', 'NY', 'SF', 'Other'].map(region => {
                  const regionTSEs = alertsByRegion[region] || [];
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

                  // Calculate total alerts for this region
                  const regionAlertCount = regionTSEs.reduce((sum, tse) => 
                    sum + tse.openAlerts.length + tse.snoozedAlerts.length, 0
                  );

                  return (
                    <div key={region} className="region-alert-group">
                      <div 
                        className="region-alert-header" 
                        onClick={() => toggleRegion(region)}
                      >
                        <span className="region-expand-icon">{isRegionExpanded ? '▼' : '▶'}</span>
                        <span className="region-name">{regionLabels[region]}</span>
                        {iconUrl && (
                          <img 
                            src={iconUrl} 
                            alt={region} 
                            className="region-alert-icon"
                          />
                        )}
                        <span className="region-alert-count">({regionAlertCount})</span>
                      </div>
                      
                      {isRegionExpanded && (
                        <div className="region-tse-list">
                          {regionTSEs.map((tseGroup) => {
                            const tseKey = `${tseGroup.tseId}-${tseGroup.tseName}`;
                            const isTSEExpanded = expandedTSEs.has(tseKey);
                            const hasOpenAlerts = tseGroup.openAlerts.length > 0;
                            const hasSnoozedAlerts = tseGroup.snoozedAlerts.length > 0;

                            return (
                              <div key={tseKey} className="tse-alert-group">
                                <div 
                                  className="tse-alert-header" 
                                  onClick={() => toggleTSE(tseKey)}
                                >
                                  <span className="tse-expand-icon">{isTSEExpanded ? '▼' : '▶'}</span>
                                  <span className="tse-name">{tseGroup.tseName}</span>
                                  <span className="tse-alert-count">
                                    ({tseGroup.openAlerts.length + tseGroup.snoozedAlerts.length})
                                  </span>
                                </div>
                                
                                {isTSEExpanded && (
                                  <div className="tse-alert-types">
                                    {hasOpenAlerts && (
                                      <div className="alert-type-group">
                                        <div 
                                          className="alert-type-header"
                                          onClick={() => toggleAlertType(`${tseKey}-open`)}
                                        >
                                          <span className="alert-type-expand-icon">
                                            {expandedAlertTypes.has(`${tseKey}-open`) ? '▼' : '▶'}
                                          </span>
                                          <span className="alert-type-label">Open Chat Alerts</span>
                                          <span className="alert-type-count">({tseGroup.openAlerts.length})</span>
                                        </div>
                                        {expandedAlertTypes.has(`${tseKey}-open`) && (
                                          <div className="alert-type-items">
                                            {tseGroup.openAlerts.map((alert, idx) => {
                                              const isRead = isAlertRead && isAlertRead(alert.id);
                                              return (
                                                <div 
                                                  key={idx} 
                                                  className={`alert-item alert-item-clickable ${isRead ? 'alert-item-read' : ''}`}
                                                  onClick={() => onTSEClick && onTSEClick(tseGroup.tseId, tseGroup.tseName)}
                                                  style={{ 
                                                    cursor: onTSEClick ? 'pointer' : 'default',
                                                    opacity: isRead ? 0.6 : 1,
                                                    backgroundColor: isRead ? (isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') : 'transparent'
                                                  }}
                                                >
                                                  <span className="alert-severity" style={{ opacity: isRead ? 0.5 : 1 }}>
                                                    {alert.severity === "high" ? "🔴" : "🟡"}
                                                  </span>
                                                  <span className="alert-message" style={{ textDecoration: isRead ? 'none' : 'none' }}>{alert.message}</span>
                                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    {onViewChats && (
                                                      <button
                                                        className="alert-view-chats-button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          onViewChats(tseGroup.tseId, "open");
                                                        }}
                                                      >
                                                        View Chats
                                                      </button>
                                                    )}
                                                    {onMarkAsRead && !isRead && (
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          onMarkAsRead(alert.id);
                                                        }}
                                                        style={{
                                                          background: 'none',
                                                          border: `1px solid ${isDarkMode ? '#555' : '#ddd'}`,
                                                          borderRadius: '4px',
                                                          color: isDarkMode ? '#4fc3f7' : '#1976d2',
                                                          cursor: 'pointer',
                                                          padding: '2px 6px',
                                                          fontSize: '11px',
                                                          lineHeight: '1.2',
                                                          opacity: 0.8,
                                                          transition: 'all 0.2s',
                                                          whiteSpace: 'nowrap'
                                                        }}
                                                        onMouseEnter={(e) => { e.target.style.opacity = '1'; e.target.style.backgroundColor = isDarkMode ? 'rgba(79,195,247,0.1)' : 'rgba(25,118,210,0.1)'; }}
                                                        onMouseLeave={(e) => { e.target.style.opacity = '0.8'; e.target.style.backgroundColor = 'transparent'; }}
                                                        aria-label="Mark as read"
                                                        title="Mark as read"
                                                      >
                                                        ✓ Read
                                                      </button>
                                                    )}
                                                    {isRead && (
                                                      <span style={{ 
                                                        fontSize: '11px', 
                                                        color: isDarkMode ? '#666' : '#999',
                                                        fontStyle: 'italic'
                                                      }}>
                                                        Read
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {hasSnoozedAlerts && (
                                      <div className="alert-type-group">
                                        <div 
                                          className="alert-type-header"
                                          onClick={() => toggleAlertType(`${tseKey}-snoozed`)}
                                        >
                                          <span className="alert-type-expand-icon">
                                            {expandedAlertTypes.has(`${tseKey}-snoozed`) ? '▼' : '▶'}
                                          </span>
                                          <span className="alert-type-label">Snoozed Alerts</span>
                                          <span className="alert-type-count">({tseGroup.snoozedAlerts.length})</span>
                                        </div>
                                        {expandedAlertTypes.has(`${tseKey}-snoozed`) && (
                                          <div className="alert-type-items">
                                            {tseGroup.snoozedAlerts.map((alert, idx) => {
                                              const isRead = isAlertRead && isAlertRead(alert.id);
                                              return (
                                                <div 
                                                  key={idx} 
                                                  className={`alert-item alert-item-clickable ${isRead ? 'alert-item-read' : ''}`}
                                                  onClick={() => onTSEClick && onTSEClick(tseGroup.tseId, tseGroup.tseName)}
                                                  style={{ 
                                                    cursor: onTSEClick ? 'pointer' : 'default',
                                                    opacity: isRead ? 0.6 : 1,
                                                    backgroundColor: isRead ? (isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') : 'transparent'
                                                  }}
                                                >
                                                  <span className="alert-severity" style={{ opacity: isRead ? 0.5 : 1 }}>
                                                    {alert.severity === "high" ? "🔴" : "🟡"}
                                                  </span>
                                                  <span className="alert-message">{alert.message}</span>
                                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    {onViewChats && (
                                                      <button
                                                        className="alert-view-chats-button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          onViewChats(tseGroup.tseId, "snoozed");
                                                        }}
                                                      >
                                                        View Chats
                                                      </button>
                                                    )}
                                                    {onMarkAsRead && !isRead && (
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          onMarkAsRead(alert.id);
                                                        }}
                                                        style={{
                                                          background: 'none',
                                                          border: `1px solid ${isDarkMode ? '#555' : '#ddd'}`,
                                                          borderRadius: '4px',
                                                          color: isDarkMode ? '#4fc3f7' : '#1976d2',
                                                          cursor: 'pointer',
                                                          padding: '2px 6px',
                                                          fontSize: '11px',
                                                          lineHeight: '1.2',
                                                          opacity: 0.8,
                                                          transition: 'all 0.2s',
                                                          whiteSpace: 'nowrap'
                                                        }}
                                                        onMouseEnter={(e) => { e.target.style.opacity = '1'; e.target.style.backgroundColor = isDarkMode ? 'rgba(79,195,247,0.1)' : 'rgba(25,118,210,0.1)'; }}
                                                        onMouseLeave={(e) => { e.target.style.opacity = '0.8'; e.target.style.backgroundColor = 'transparent'; }}
                                                        aria-label="Mark as read"
                                                        title="Mark as read"
                                                      >
                                                        ✓ Read
                                                      </button>
                                                    )}
                                                    {isRead && (
                                                      <span style={{ 
                                                        fontSize: '11px', 
                                                        color: isDarkMode ? '#666' : '#999',
                                                        fontStyle: 'italic'
                                                      }}>
                                                        Read
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Constants for Unassigned Conversations
const OVERVIEW_INTERCOM_BASE_URL = "https://app.intercom.com/a/inbox/gu1e0q0t/inbox/admin/9110812/conversation/";
const OVERVIEW_BREACH_THRESHOLD_MINUTES = 10;

// Countdown Timer Component for Unassigned Conversations (Overview)
function OverviewUnassignedCountdownTimer({ createdTimestamp, isDarkMode, waitTimeColor }) {
  const [timeDisplay, setTimeDisplay] = useState(() => {
    if (!createdTimestamp) return { text: "0s", isUrgent: true };
    const now = Date.now() / 1000;
    const waitTimeMinutes = (now - createdTimestamp) / 60;
    const minutesUntilBreach = OVERVIEW_BREACH_THRESHOLD_MINUTES - waitTimeMinutes;
    
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
      const minutesUntilBreach = OVERVIEW_BREACH_THRESHOLD_MINUTES - waitTimeMinutes;
      
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

// Modern Overview Dashboard Component
function OverviewDashboard({ metrics, historicalSnapshots, responseTimeMetrics, loadingHistorical, onNavigateToConversations, onNavigateToTSEView, onTSEClick, conversations, isInsightDismissed, dismissInsightItem }) {
  const { isDarkMode } = useTheme();
  const [isWaitRateModalOpen, setIsWaitRateModalOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(null); // null = show all, number = filter by hour
  const [showAllResponders, setShowAllResponders] = useState(false);
  const [showAllWaits, setShowAllWaits] = useState(false);
  const [isSameDayCloseModalOpen, setIsSameDayCloseModalOpen] = useState(false);
  

  // Prepare on-track trend data with breakdown (Overall, Open, Snoozed)
  const onTrackChartData = useMemo(() => {
    console.log('Overview: Processing on-track trend data, snapshots:', historicalSnapshots);
    if (!historicalSnapshots || historicalSnapshots.length === 0) {
      console.log('Overview: No historical snapshots available');
      return [];
    }
    
    const EXCLUDED_TSE_NAMES = ["Prerit Sachdeva", "Stephen Skalamera"];
    
    const processed = historicalSnapshots
      .map(snapshot => {
        const tseData = (snapshot.tse_data || snapshot.tseData || []).filter(tse => !EXCLUDED_TSE_NAMES.includes(tse.name));
        const totalTSEs = tseData.length;
        if (totalTSEs === 0) return null;

        let onTrackOpen = 0;
        let onTrackSnoozed = 0;
        let onTrackBoth = 0;
        
        tseData.forEach(tse => {
          const meetsOpen = (tse.open || 0) <= THRESHOLDS.MAX_OPEN_SOFT;
          // For "snoozed on track": count all snoozed EXCEPT customer-waiting tags
          // Use snoozedForOnTrack if available (new format), otherwise calculate from snapshot data
          let snoozedForOnTrack = tse.snoozedForOnTrack;
          if (snoozedForOnTrack === undefined) {
            // Calculate from snapshot data: totalSnoozed - customerWaitSnoozed
            const totalSnoozed = tse.totalSnoozed || 0;
            const customerWaitSnoozed = tse.customerWaitSnoozed || 0;
            snoozedForOnTrack = totalSnoozed - customerWaitSnoozed;
            // Fallback to old format if new calculation doesn't work
            if (snoozedForOnTrack < 0) {
              snoozedForOnTrack = tse.waitingOnTSE || tse.actionableSnoozed || 0;
            }
          }
          const meetsWaitingOnTSE = snoozedForOnTrack <= THRESHOLDS.MAX_WAITING_ON_TSE_SOFT;
          
          if (meetsOpen) onTrackOpen++;
          if (meetsWaitingOnTSE) onTrackSnoozed++;
          if (meetsOpen && meetsWaitingOnTSE) onTrackBoth++;
        });

        return {
          date: snapshot.date,
          totalTSEs,
          openOnTrack: totalTSEs > 0 ? Math.round((onTrackOpen / totalTSEs) * 100) : 0,
          snoozedOnTrack: totalTSEs > 0 ? Math.round((onTrackSnoozed / totalTSEs) * 100) : 0,
          overallOnTrack: totalTSEs > 0 ? Math.round((onTrackBoth / totalTSEs) * 100) : 0
        };
      })
      .filter(item => item !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    console.log('Overview: Processed on-track chart data:', processed);
    return processed;
  }, [historicalSnapshots]);

  // Calculate moving averages for Team Daily On Track chart
  const onTrackChartDataWithMovingAvg = useMemo(() => {
    if (!onTrackChartData.length) return [];
    
    return onTrackChartData.map((item, index) => {
      if (index < 2) {
        return { 
          ...item, 
          movingAvgOverall: item.overallOnTrack,
          movingAvgOpen: item.openOnTrack,
          movingAvgSnoozed: item.snoozedOnTrack
        };
      }
      const window = onTrackChartData.slice(Math.max(0, index - 2), index + 1);
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
  }, [onTrackChartData]);

  // Legacy onTrackTrendData for backward compatibility
  const onTrackTrendData = useMemo(() => {
    return onTrackChartData.map(item => ({
      date: item.date,
      displayLabel: formatDateForChart(item.date),
      onTrack: item.overallOnTrack
    }));
  }, [onTrackChartData]);

  // Prepare response time trend data (5+ minute)
  const responseTimeTrendData = useMemo(() => {
    if (!responseTimeMetrics || responseTimeMetrics.length === 0) return [];
    
    return responseTimeMetrics
      .map(metric => {
        return {
          date: metric.date,
          displayLabel: formatDateForChart(metric.date),
          percentage5Plus: parseFloat(metric.percentage5PlusMin || 0),
          percentage5to10: parseFloat(metric.percentage5to10Min || 0),
          percentage10Plus: parseFloat(metric.percentage10PlusMin || 0),
          percentage: parseFloat(metric.percentage5PlusMin || 0) // Use 5+ min for backward compatibility
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
      // Don't limit - we need all data for week-over-week comparison
  }, [responseTimeMetrics]);

  // Calculate today vs yesterday comparison
  // eslint-disable-next-line no-unused-vars
  const todayVsYesterday = useMemo(() => {
    if (!onTrackTrendData || onTrackTrendData.length < 2) return null;
    
    const today = onTrackTrendData[onTrackTrendData.length - 1];
    const yesterday = onTrackTrendData[onTrackTrendData.length - 2];
    
    const onTrackChange = today.onTrack - yesterday.onTrack;
    
    // Get response time comparison
    let responseTimeChange = null;
    if (responseTimeTrendData && responseTimeTrendData.length >= 2) {
      const todayRT = responseTimeTrendData[responseTimeTrendData.length - 1];
      const yesterdayRT = responseTimeTrendData[responseTimeTrendData.length - 2];
      responseTimeChange = todayRT.percentage - yesterdayRT.percentage;
    }
    
    return {
      onTrack: {
        today: today.onTrack,
        yesterday: yesterday.onTrack,
        change: onTrackChange,
        direction: onTrackChange > 0 ? 'up' : onTrackChange < 0 ? 'down' : 'stable'
      },
      responseTime: responseTimeChange !== null ? {
        today: responseTimeTrendData[responseTimeTrendData.length - 1].percentage,
        yesterday: responseTimeTrendData[responseTimeTrendData.length - 2].percentage,
        change: responseTimeChange,
        direction: responseTimeChange < 0 ? 'up' : responseTimeChange > 0 ? 'down' : 'stable' // Lower is better
      } : null
    };
  }, [onTrackTrendData, responseTimeTrendData]);


  // Prepare response time chart data for Percentage of Conversations with Wait Time chart
  const responseTimeChartData = useMemo(() => {
    if (!responseTimeMetrics || responseTimeMetrics.length === 0) return [];
    
    return responseTimeMetrics
      .map(metric => ({
        date: metric.date,
        displayLabel: formatDateForChart(metric.date),
        percentage5PlusMin: parseFloat(metric.percentage5PlusMin || 0),
        percentage5to10Min: parseFloat(metric.percentage5to10Min || 0),
        percentage10PlusMin: parseFloat(metric.percentage10PlusMin || 0),
        count5PlusMin: metric.count5PlusMin || 0,
        count5to10Min: metric.count5to10Min || 0,
        count10PlusMin: metric.count10PlusMin || 0,
        totalConversations: metric.totalConversations || 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // Last 7 days
  }, [responseTimeMetrics]);

  // Calculate real-time wait rate percentages from conversations created today between 2am PT and 6pm PT
  const realtimeWaitRate = useMemo(() => {
    const conversationList = conversations || [];
    if (conversationList.length === 0) return { pct5Plus: 0, pct5to10: 0, pct10Plus: 0, totalCount: 0 };

    // Calculate today's window: 2am PT to 6pm PT
    // PT is UTC-8 (PST) or UTC-7 (PDT)
    const now = new Date();
    
    // Get current PT offset (handles daylight saving automatically)
    const ptFormatter = new Intl.DateTimeFormat('en-US', { 
      timeZone: 'America/Los_Angeles', 
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false 
    });
    const ptParts = ptFormatter.formatToParts(now);
    const ptYear = parseInt(ptParts.find(p => p.type === 'year').value);
    const ptMonth = parseInt(ptParts.find(p => p.type === 'month').value) - 1;
    const ptDay = parseInt(ptParts.find(p => p.type === 'day').value);
    
    // Create 2am PT and 6pm PT for today in UTC
    // Using a fixed PT offset calculation
    const todayPT = new Date(Date.UTC(ptYear, ptMonth, ptDay));
    
    // Determine PT offset (PST = -8, PDT = -7)
    const jan = new Date(ptYear, 0, 1);
    const jul = new Date(ptYear, 6, 1);
    const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    const isDST = now.getTimezoneOffset() < stdOffset;
    const ptOffsetHours = isDST ? 7 : 8; // PDT = UTC-7, PST = UTC-8
    
    // 2am PT = 2 + ptOffsetHours in UTC
    const startHourUTC = 2 + ptOffsetHours; // 9 or 10 UTC
    // 6pm PT = 18 + ptOffsetHours in UTC  
    const endHourUTC = 18 + ptOffsetHours; // 25 or 26 UTC (wraps to next day)
    
    const windowStart = new Date(todayPT);
    windowStart.setUTCHours(startHourUTC, 0, 0, 0);
    
    const windowEnd = new Date(todayPT);
    if (endHourUTC >= 24) {
      windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);
      windowEnd.setUTCHours(endHourUTC - 24, 0, 0, 0);
    } else {
      windowEnd.setUTCHours(endHourUTC, 0, 0, 0);
    }

    const toTimestamp = (timestamp) => {
      if (!timestamp) return null;
      return timestamp > 1e12 ? timestamp : timestamp * 1000;
    };

    let totalWithResponse = 0;
    let count5Plus = 0;
    let count5to10 = 0;
    let count10Plus = 0;

    conversationList.forEach(conv => {
      const createdAt = toTimestamp(conv.created_at || conv.createdAt || conv.first_opened_at);
      if (!createdAt) return;

      // Only include conversations created today between 2am PT and 6pm PT
      if (createdAt < windowStart.getTime() || createdAt >= windowEnd.getTime()) return;

      const timeToReply = conv.statistics?.time_to_admin_reply;
      const firstAdminReplyAt = conv.statistics?.first_admin_reply_at;

      let waitTimeSeconds = null;
      if (timeToReply !== null && timeToReply !== undefined) {
        waitTimeSeconds = timeToReply;
      } else if (firstAdminReplyAt && createdAt) {
        // firstAdminReplyAt is in seconds, createdAt is now in ms
        const createdAtSeconds = createdAt / 1000;
        waitTimeSeconds = firstAdminReplyAt - createdAtSeconds;
      }

      if (waitTimeSeconds !== null && waitTimeSeconds >= 0) {
        totalWithResponse++;
        const waitTimeMinutes = waitTimeSeconds / 60;

        if (waitTimeMinutes >= 5) {
          count5Plus++;
          if (waitTimeMinutes >= 10) {
            count10Plus++;
          } else {
            count5to10++;
          }
        }
      }
    });

    const pct5Plus = totalWithResponse > 0 ? (count5Plus / totalWithResponse) * 100 : 0;
    const pct5to10 = totalWithResponse > 0 ? (count5to10 / totalWithResponse) * 100 : 0;
    const pct10Plus = totalWithResponse > 0 ? (count10Plus / totalWithResponse) * 100 : 0;

    return {
      pct5Plus: Math.round(pct5Plus * 10) / 10,
      pct5to10: Math.round(pct5to10 * 10) / 10,
      pct10Plus: Math.round(pct10Plus * 10) / 10,
      totalCount: totalWithResponse
    };
  }, [conversations]);

  // Calculate yesterday's wait rate from conversations created yesterday
  // eslint-disable-next-line no-unused-vars
  const yesterdayWaitRate = useMemo(() => {
    const conversationList = conversations || [];
    if (conversationList.length === 0) return { pct5Plus: 0, pct5to10: 0, pct10Plus: 0 };

    const now = Date.now();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    const yesterdayEnd = new Date(todayStart);

    const toTimestamp = (timestamp) => {
      if (!timestamp) return null;
      return timestamp > 1e12 ? timestamp : timestamp * 1000;
    };

    let totalWithResponse = 0;
    let count5Plus = 0;
    let count5to10 = 0;
    let count10Plus = 0;

    conversationList.forEach(conv => {
      const createdAt = toTimestamp(conv.created_at || conv.createdAt || conv.first_opened_at);
      if (!createdAt) return;

      // Only include conversations created yesterday (UTC)
      if (createdAt < yesterdayStart.getTime() || createdAt >= yesterdayEnd.getTime()) return;

      const timeToReply = conv.statistics?.time_to_admin_reply;
      const firstAdminReplyAt = conv.statistics?.first_admin_reply_at;

      let waitTimeSeconds = null;
      if (timeToReply !== null && timeToReply !== undefined) {
        waitTimeSeconds = timeToReply;
      } else if (firstAdminReplyAt && createdAt) {
        waitTimeSeconds = firstAdminReplyAt - createdAt;
      }

      if (waitTimeSeconds !== null && waitTimeSeconds >= 0) {
        totalWithResponse++;
        const waitTimeMinutes = waitTimeSeconds / 60;

        if (waitTimeMinutes >= 5) {
          count5Plus++;
          if (waitTimeMinutes >= 10) {
            count10Plus++;
          } else {
            count5to10++;
          }
        }
      }
    });

    const pct5Plus = totalWithResponse > 0 ? (count5Plus / totalWithResponse) * 100 : 0;
    const pct5to10 = totalWithResponse > 0 ? (count5to10 / totalWithResponse) * 100 : 0;
    const pct10Plus = totalWithResponse > 0 ? (count10Plus / totalWithResponse) * 100 : 0;

    return {
      pct5Plus: Math.round(pct5Plus * 10) / 10,
      pct5to10: Math.round(pct5to10 * 10) / 10,
      pct10Plus: Math.round(pct10Plus * 10) / 10
    };
  }, [conversations]);

  // Calculate current response time percentages (most recent day) - kept for other uses
  // Calculate current response time percentages (most recent day)
  const currentResponseTimePct10Plus = useMemo(() => {
    if (responseTimeTrendData.length === 0) return 0;
    return Math.round((responseTimeTrendData[responseTimeTrendData.length - 1]?.percentage10Plus || 0) * 10) / 10;
  }, [responseTimeTrendData]);

  const currentResponseTimePct5to10 = useMemo(() => {
    if (responseTimeTrendData.length === 0) return undefined;
    return Math.round((responseTimeTrendData[responseTimeTrendData.length - 1]?.percentage5to10Min || 0) * 10) / 10;
  }, [responseTimeTrendData]);


  // Calculate Close Rate %: Percentage of conversations created today that were closed (PT timezone)
  // Counts all conversations created today (PT), then calculates what percentage were closed
  const sameDayCloseData = useMemo(() => {
    const conversationList = conversations || [];
    if (conversationList.length === 0) return { pct: 0, conversations: [], totalClosed: 0, totalCreated: 0 };

    const now = new Date();
    
    // Get current PT time formatter
    const ptFormatter = new Intl.DateTimeFormat('en-US', { 
      timeZone: 'America/Los_Angeles', 
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false 
    });

    const toTimestamp = (timestamp) => {
      if (!timestamp) return null;
      return timestamp > 1e12 ? timestamp : timestamp * 1000;
    };

    // Get today's date string in PT timezone
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

    let totalCreatedToday = 0;
    let totalClosedToday = 0;
    const closedConversations = [];

    console.log(`[Close Rate] Today PT date string: ${todayPTDateStr}`);
    console.log(`[Close Rate] Current PT time: ${ptFormatter.format(now)}`);

    // Loop through ALL conversations to find those created today
    conversationList.forEach(conv => {
      const createdAt = conv.created_at || conv.createdAt || conv.first_opened_at;
      if (!createdAt) return;

      // Get created date in PT
      const createdDateStr = toPTDateStr(createdAt);
      
      // Only count conversations created today (in PT)
      if (!createdDateStr || createdDateStr !== todayPTDateStr) {
        return;
      }

      totalCreatedToday++;

      // Check if this conversation is closed
      const state = (conv.state || "").toLowerCase();
      if (state === "closed") {
        const closedAt = conv.closed_at || conv.closedAt;
        const closedTimestamp = toTimestamp(closedAt);
        
        if (!closedTimestamp) {
          return; // Closed but no closed_at timestamp
        }

        // Get assignee info to filter out service account
        const assignee = conv.admin_assignee || conv.adminAssignee || conv.assignee;
        const assigneeName = assignee?.name || 'Unassigned';
        
        // Exclude service account closures
        if (assigneeName === 'svc-prd-tse-intercom SVC') {
          return;
        }

        totalClosedToday++;
        
        // Calculate time to close in minutes
        const createdTimestamp = toTimestamp(createdAt);
        const timeToCloseMinutes = closedTimestamp && createdTimestamp 
          ? Math.round((closedTimestamp - createdTimestamp) / 60000) 
          : null;
        
        closedConversations.push({
          id: conv.id,
          createdAt: createdTimestamp,
          closedAt: closedTimestamp,
          timeToCloseMinutes,
          assigneeName,
          title: conv.source?.subject || conv.title || `Conversation ${conv.id}`
        });
      }
    });

    // Sort by most recently closed
    closedConversations.sort((a, b) => b.closedAt - a.closedAt);

    // Calculate percentage: (closed / created today) × 100
    const pct = totalCreatedToday === 0 ? 0 : Math.round((totalClosedToday / totalCreatedToday) * 1000) / 10;
    
    // Debug summary
    console.log(`[Close Rate] Summary:`);
    console.log(`  - Total created today (PT): ${totalCreatedToday}`);
    console.log(`  - Total closed today (PT): ${totalClosedToday}`);
    console.log(`  - Close rate percentage: ${pct}%`);
    
    return { pct, conversations: closedConversations, totalClosed: totalClosedToday, totalCreated: totalCreatedToday };
  }, [conversations]);

  // For backward compatibility
  const sameDayClosePct = sameDayCloseData.pct;

  // Calculate Avg Initial Response for conversations created today between 2am-6pm PT
  const avgInitialResponseMinutes = useMemo(() => {
    const conversationList = conversations || [];
    if (conversationList.length === 0) return 0;

    // Calculate today's window: 2am PT to 6pm PT (same as Wait Rate and Same-Day Close %)
    const now = new Date();
    
    // Get current PT offset (handles daylight saving automatically)
    const ptFormatter = new Intl.DateTimeFormat('en-US', { 
      timeZone: 'America/Los_Angeles', 
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false 
    });
    const ptParts = ptFormatter.formatToParts(now);
    const ptYear = parseInt(ptParts.find(p => p.type === 'year').value);
    const ptMonth = parseInt(ptParts.find(p => p.type === 'month').value) - 1;
    const ptDay = parseInt(ptParts.find(p => p.type === 'day').value);
    
    // Create 2am PT and 6pm PT for today in UTC
    const todayPT = new Date(Date.UTC(ptYear, ptMonth, ptDay));
    
    // Determine PT offset (PST = -8, PDT = -7)
    const jan = new Date(ptYear, 0, 1);
    const jul = new Date(ptYear, 6, 1);
    const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    const isDST = now.getTimezoneOffset() < stdOffset;
    const ptOffsetHours = isDST ? 7 : 8; // PDT = UTC-7, PST = UTC-8
    
    // 2am PT = 2 + ptOffsetHours in UTC
    const startHourUTC = 2 + ptOffsetHours;
    // 6pm PT = 18 + ptOffsetHours in UTC  
    const endHourUTC = 18 + ptOffsetHours;
    
    const windowStart = new Date(todayPT);
    windowStart.setUTCHours(startHourUTC, 0, 0, 0);
    
    const windowEnd = new Date(todayPT);
    if (endHourUTC >= 24) {
      windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);
      windowEnd.setUTCHours(endHourUTC - 24, 0, 0, 0);
    } else {
      windowEnd.setUTCHours(endHourUTC, 0, 0, 0);
    }

    const toTimestamp = (timestamp) => {
      if (!timestamp) return null;
      return timestamp > 1e12 ? timestamp : timestamp * 1000;
    };

    let totalSeconds = 0;
    let count = 0;

    conversationList.forEach(conv => {
      const createdAt = conv.created_at || conv.createdAt || conv.first_opened_at;
      const createdTimestamp = toTimestamp(createdAt);
      
      if (!createdTimestamp) return;
      
      // Only include conversations created today between 2am PT and 6pm PT
      if (createdTimestamp < windowStart.getTime() || createdTimestamp >= windowEnd.getTime()) return;

      const timeToReply = conv.statistics?.time_to_admin_reply;
      const firstAdminReplyAt = conv.statistics?.first_admin_reply_at;

      let responseSeconds = null;
      if (timeToReply !== null && timeToReply !== undefined) {
        responseSeconds = timeToReply;
      } else if (firstAdminReplyAt && createdAt) {
        const createdAtSeconds = createdTimestamp / 1000;
        responseSeconds = firstAdminReplyAt - createdAtSeconds;
      }

      if (responseSeconds !== null && responseSeconds >= 0) {
        totalSeconds += responseSeconds;
        count += 1;
      }
    });

    if (count === 0) return 0;
    return Math.round((totalSeconds / count / 60) * 10) / 10;
  }, [conversations]);

  const latestResponseMetric = useMemo(() => {
    if (!responseTimeMetrics || responseTimeMetrics.length === 0) return null;
    const sorted = [...responseTimeMetrics].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[sorted.length - 1] || null;
  }, [responseTimeMetrics]);

  const waitRateDrilldown = useMemo(() => {
    const conversations5Plus = latestResponseMetric?.conversationIds5PlusMin || [];
    if (!conversations5Plus.length) {
      return { hourly: [], assignees: [], conversations: [] };
    }

    const hourlyCounts = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "a" : "p"}`,
      count: 0
    }));
    const assigneeCounts = {};

    const toHour = (timestamp) => {
      if (!timestamp) return null;
      const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
      const hourStr = new Date(ms).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "2-digit",
        hour12: false
      });
      const hour = parseInt(hourStr, 10);
      return Number.isNaN(hour) ? null : hour;
    };

    // Debug: Log first few items to see structure
    if (conversations5Plus.length > 0) {
      console.log('Wait Rate Drilldown - Sample conversation item structure:', conversations5Plus[0]);
      console.log('Wait Rate Drilldown - All field names:', Object.keys(conversations5Plus[0]));
      console.log('Wait Rate Drilldown - adminAssigneeName value:', conversations5Plus[0].adminAssigneeName);
      console.log('Wait Rate Drilldown - adminAssigneeId value:', conversations5Plus[0].adminAssigneeId);
      console.log('Wait Rate Drilldown - admin_assignee value:', conversations5Plus[0].admin_assignee);
    }

    const normalizedConversations = conversations5Plus.map(item => {
      const createdAt = item.createdAt || item.created_at;
      const firstAdminReplyAt = item.firstAdminReplyAt || item.first_admin_reply_at;
      const hour = toHour(createdAt || firstAdminReplyAt);
      if (hour !== null) hourlyCounts[hour].count += 1;

      // Try multiple possible field names and structures
      // Check for null/undefined explicitly, not just falsy values (empty string is valid)
      let assigneeName = null;
      
      if (item.adminAssigneeName && item.adminAssigneeName !== null && item.adminAssigneeName !== 'null') {
        assigneeName = item.adminAssigneeName;
      } else if (item.admin_assignee_name && item.admin_assignee_name !== null && item.admin_assignee_name !== 'null') {
        assigneeName = item.admin_assignee_name;
      } else if (item.admin_assignee) {
        if (typeof item.admin_assignee === 'object' && item.admin_assignee.name) {
          assigneeName = item.admin_assignee.name;
        } else if (typeof item.admin_assignee === 'string') {
          assigneeName = item.admin_assignee;
        }
      }
      
      // If still no assignee name found, check if we have an assignee ID
      // This indicates the data needs enrichment (which the backfill script will fix)
      if (!assigneeName && (item.adminAssigneeId || item.admin_assignee_id)) {
        const assigneeId = item.adminAssigneeId || item.admin_assignee_id;
        // We have an ID but no name - mark as needing enrichment
        // The backfill script should fix this, but for now show a placeholder
        assigneeName = `[Needs Enrichment: ${assigneeId}]`;
      }
      
      // Default to "Unassigned" only if we truly have no assignee information
      if (!assigneeName || assigneeName === 'null' || assigneeName === null) {
        assigneeName = "Unassigned";
      }
      
      assigneeCounts[assigneeName] = (assigneeCounts[assigneeName] || 0) + 1;

      return {
        id: item.id,
        waitTimeMinutes: item.waitTimeMinutes || item.wait_time_minutes || 0,
        createdAt,
        firstAdminReplyAt,
        assigneeName,
        hour // Include hour for filtering
      };
    });

    const assignees = Object.entries(assigneeCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const conversationsSorted = [...normalizedConversations].sort((a, b) => b.waitTimeMinutes - a.waitTimeMinutes);

    return { hourly: hourlyCounts, assignees, conversations: conversationsSorted };
  }, [latestResponseMetric]);

  const INTERCOM_BASE_URL = "https://app.intercom.com/a/inbox/gu1e0q0t/inbox/admin/9110812/conversation/";

  const agingChartData = useMemo(() => {
    const conversationList = conversations || [];
    if (conversationList.length === 0) return [];

    const buckets = [
      { label: "0-1h", min: 0, max: 1 },
      { label: "1-4h", min: 1, max: 4 },
      { label: "4-8h", min: 4, max: 8 },
      { label: "8-24h", min: 8, max: 24 },
      { label: "24-48h", min: 24, max: 48 },
      { label: "48h+", min: 48, max: Infinity }
    ];

    const data = buckets.map(bucket => ({
      bucket: bucket.label,
      open: 0,
      waitingOnCustomerResolved: 0,
      waitingOnCustomerUnresolved: 0,
      waitingOnTse: 0
    }));

    const nowSeconds = Date.now() / 1000;

    conversationList.forEach(conv => {
      const createdAt = conv.created_at || conv.createdAt || conv.first_opened_at;
      if (!createdAt) return;

      const createdSeconds = typeof createdAt === "number"
        ? (createdAt > 1e12 ? createdAt / 1000 : createdAt)
        : new Date(createdAt).getTime() / 1000;
      if (!createdSeconds) return;

      const ageHours = (nowSeconds - createdSeconds) / 3600;
      const bucketIndex = buckets.findIndex(bucket => ageHours >= bucket.min && ageHours < bucket.max);
      const idx = bucketIndex === -1 ? buckets.length - 1 : bucketIndex;

      const tags = Array.isArray(conv.tags) ? conv.tags : [];
      
      // Check if conversation is snoozed (same logic as metrics calculation)
      const isSnoozed = conv.state === "snoozed" || 
                       conv.snoozed_until || 
                       (conv.statistics && conv.statistics.state === "snoozed") ||
                       (conv.source && conv.source.type === "snoozed") ||
                       (conv.conversation_parts && conv.conversation_parts.some(part => part.state === "snoozed"));
      
      // Check if conversation state is "open" (not snoozed)
      const isOpen = conv.state === "open" && !isSnoozed;

      if (isOpen) {
        // If state is "Open" and not snoozed, count as open
        data[idx].open += 1;
        return;
      }

      // Only categorize snoozed conversations (matching filter logic)
      if (isSnoozed) {
        // Extract tag names (same logic as conversations table)
        const tagNames = tags.map(t => typeof t === "string" ? t : t.name);
        
        // Define the three snooze tags we care about (in priority order)
        const snoozeTags = [
          "snooze.waiting-on-customer-resolved",
          "snooze.waiting-on-customer-unresolved",
          "snooze.waiting-on-tse"
        ];
        
        // Find the first tag that matches one of our three snooze tags (case-insensitive)
        const activeWorkflowTag = tagNames.find(tagName => 
          tagName && snoozeTags.some(snoozeTag => 
            tagName.toLowerCase() === snoozeTag.toLowerCase()
          )
        );
        
        // Use the same priority-based tag matching as conversations table and filter logic
        if (activeWorkflowTag) {
          const normalizedTag = activeWorkflowTag.toLowerCase();
          if (normalizedTag === "snooze.waiting-on-customer-resolved") {
            data[idx].waitingOnCustomerResolved += 1;
          } else if (normalizedTag === "snooze.waiting-on-customer-unresolved") {
            data[idx].waitingOnCustomerUnresolved += 1;
          } else if (normalizedTag === "snooze.waiting-on-tse") {
            data[idx].waitingOnTse += 1;
          }
        }
        // Note: Snoozed conversations without specific tags are not counted in any category
        // (matching the filter logic which only shows conversations with tags)
      }
    });

    return data;
  }, [conversations]);

  // Calculate current on-track from historical data (to match Historical tab)

  // Calculate trend indicators
  const onTrackTrend = useMemo(() => {
    if (onTrackTrendData.length < 2) return { direction: 'stable', change: 0 };
    // Compare today vs yesterday (same as responseTimeTrend and Today vs Yesterday card)
    const today = onTrackTrendData[onTrackTrendData.length - 1].onTrack;
    const yesterday = onTrackTrendData[onTrackTrendData.length - 2].onTrack;
    const change = today - yesterday;
    return {
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      change: Math.abs(change)
    };
  }, [onTrackTrendData]);

  // Real-time wait rate trend (for Performance Metrics vs Yesterday card)
  // Uses snapshot data for yesterday to be consistent with Historical Response Time Metrics table
  const realtimeWaitRateTrend = useMemo(() => {
    const today = realtimeWaitRate.pct5Plus;
    // Use the most recent snapshot data for yesterday (consistent with Historical table)
    const yesterday = responseTimeTrendData.length > 0 
      ? responseTimeTrendData[responseTimeTrendData.length - 1].percentage5Plus 
      : 0;
    const change = today - yesterday;
    return {
      direction: change < 0 ? 'up' : change > 0 ? 'down' : 'stable', // Lower is better for response time
      change: Math.abs(change),
      yesterdayValue: yesterday
    };
  }, [realtimeWaitRate, responseTimeTrendData]);

  const responseTimeTrend = useMemo(() => {
    if (responseTimeTrendData.length < 2) return { direction: 'stable', change: 0 };
    // Compare today vs yesterday (same as Today vs Yesterday card)
    const today = responseTimeTrendData[responseTimeTrendData.length - 1].percentage;
    const yesterday = responseTimeTrendData[responseTimeTrendData.length - 2].percentage;
    const change = today - yesterday;
    return {
      direction: change < 0 ? 'up' : change > 0 ? 'down' : 'stable', // Lower is better for response time
      change: Math.abs(change)
    };
  }, [responseTimeTrendData]);

  // Calculate trend for Avg Initial Response (compare last 7 days vs previous 7 days)
  const avgInitialResponseTrend = useMemo(() => {
    if (!conversations || conversations.length === 0) return { direction: 'stable', change: 0 };
    
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = now - (14 * 24 * 60 * 60 * 1000);
    
    const toTimestamp = (timestamp) => {
      if (!timestamp) return null;
      return timestamp > 1e12 ? timestamp : timestamp * 1000;
    };
    
    let recentTotal = 0, recentCount = 0;
    let previousTotal = 0, previousCount = 0;
    
    conversations.forEach(conv => {
      const createdAt = toTimestamp(conv.created_at || conv.createdAt || conv.first_opened_at);
      if (!createdAt) return;
      
      const timeToReply = conv.statistics?.time_to_admin_reply;
      const firstAdminReplyAt = conv.statistics?.first_admin_reply_at;
      
      let responseSeconds = null;
      if (timeToReply !== null && timeToReply !== undefined) {
        responseSeconds = timeToReply;
      } else if (firstAdminReplyAt && createdAt) {
        responseSeconds = firstAdminReplyAt - createdAt;
      }
      
      if (responseSeconds === null || responseSeconds < 0) return;
      
      const responseMinutes = responseSeconds / 60;
      
      if (createdAt >= sevenDaysAgo) {
        recentTotal += responseMinutes;
        recentCount++;
      } else if (createdAt >= fourteenDaysAgo && createdAt < sevenDaysAgo) {
        previousTotal += responseMinutes;
        previousCount++;
      }
    });
    
    const recentAvg = recentCount > 0 ? recentTotal / recentCount : 0;
    const previousAvg = previousCount > 0 ? previousTotal / previousCount : 0;
    const change = recentAvg - previousAvg;
    
    return {
      direction: change < 0 ? 'up' : change > 0 ? 'down' : 'stable', // Lower is better
      change: Math.abs(change)
    };
  }, [conversations]);

  // Calculate trend for Same-Day Close % (compare last 7 days vs previous 7 days)
  const sameDayCloseTrend = useMemo(() => {
    if (!conversations || conversations.length === 0) return { direction: 'stable', change: 0 };
    
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = now - (14 * 24 * 60 * 60 * 1000);
    
    const toUtcDate = (timestamp) => {
      if (!timestamp) return null;
      const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
      return new Date(ms).toISOString().slice(0, 10);
    };
    
    let recentClosedTotal = 0, recentClosedSameDay = 0;
    let previousClosedTotal = 0, previousClosedSameDay = 0;
    
    conversations.forEach(conv => {
      const state = (conv.state || "").toLowerCase();
      if (state !== "closed") return;
      
      const createdAt = conv.created_at || conv.createdAt || conv.first_opened_at;
      const closedAt = conv.closed_at || conv.closedAt;
      const createdDate = toUtcDate(createdAt);
      const closedDate = toUtcDate(closedAt);
      
      if (!createdDate || !closedDate) return;
      
      const createdTimestamp = toUtcDate(createdAt) ? new Date(createdDate).getTime() : null;
      if (!createdTimestamp) return;
      
      if (createdTimestamp >= sevenDaysAgo) {
        recentClosedTotal++;
        if (createdDate === closedDate) recentClosedSameDay++;
      } else if (createdTimestamp >= fourteenDaysAgo && createdTimestamp < sevenDaysAgo) {
        previousClosedTotal++;
        if (createdDate === closedDate) previousClosedSameDay++;
      }
    });
    
    const recentPct = recentClosedTotal > 0 ? (recentClosedSameDay / recentClosedTotal) * 100 : 0;
    const previousPct = previousClosedTotal > 0 ? (previousClosedSameDay / previousClosedTotal) * 100 : 0;
    const change = recentPct - previousPct;
    
    return {
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable', // Higher is better
      change: Math.abs(change)
    };
  }, [conversations]);

  // Calculate Improvement Potential (based on Impact page logic)
  const improvementPotential = useMemo(() => {
    if (!historicalSnapshots || historicalSnapshots.length === 0 || !responseTimeMetrics || responseTimeMetrics.length === 0) {
      return null;
    }

    const EXCLUDED_TSE_NAMES = ["Prerit Sachdeva", "Stephen Skalamera"];
    
    // Create a map of date -> on-track data
    const onTrackByDate = {};
    historicalSnapshots.forEach(snapshot => {
      const tseData = (snapshot.tse_data || snapshot.tseData || []).filter(tse => !EXCLUDED_TSE_NAMES.includes(tse.name));
      if (tseData.length === 0) return;

      let onTrackCount = 0;
      let totalCount = 0;

      tseData.forEach(tse => {
        totalCount++;
        const meetsOpen = (tse.open || 0) <= THRESHOLDS.MAX_OPEN_SOFT;
        const totalWaitingOnTSE = tse.waitingOnTSE || tse.actionableSnoozed || 0;
        const meetsWaitingOnTSE = totalWaitingOnTSE <= THRESHOLDS.MAX_WAITING_ON_TSE_SOFT;
        
        if (meetsOpen && meetsWaitingOnTSE) {
          onTrackCount++;
        }
      });

      const onTrackPct = totalCount > 0 ? Math.round((onTrackCount / totalCount) * 100) : 0;
      onTrackByDate[snapshot.date] = {
        date: snapshot.date,
        onTrack: onTrackPct
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
          slowResponse5to10Pct: parseFloat(metric.percentage5to10Min || 0),
          slowResponse10PlusPct: parseFloat(metric.percentage10PlusMin || 0)
        };
      })
      .filter(d => d !== null);

    if (combinedData.length === 0) return null;

    // Calculate current averages
    const currentAvg5to10 = combinedData.reduce((sum, d) => sum + d.slowResponse5to10Pct, 0) / combinedData.length;
    const currentAvg10Plus = combinedData.reduce((sum, d) => sum + d.slowResponse10PlusPct, 0) / combinedData.length;

    // Group by on-track ranges
    const highRangeData = combinedData.filter(d => d.onTrack >= 80);
    
    if (highRangeData.length === 0) return null;

    const highAvg5to10 = highRangeData.reduce((sum, d) => sum + d.slowResponse5to10Pct, 0) / highRangeData.length;
    const highAvg10Plus = highRangeData.reduce((sum, d) => sum + d.slowResponse10PlusPct, 0) / highRangeData.length;

    const improvement5to10 = currentAvg5to10 - highAvg5to10;
    const improvement10Plus = currentAvg10Plus - highAvg10Plus;

    return {
      improvement5to10: Math.round(improvement5to10 * 100) / 100,
      improvement10Plus: Math.round(improvement10Plus * 100) / 100,
      currentAvg5to10: Math.round(currentAvg5to10 * 100) / 100,
      currentAvg10Plus: Math.round(currentAvg10Plus * 100) / 100,
      highAvg5to10: Math.round(highAvg5to10 * 100) / 100,
      highAvg10Plus: Math.round(highAvg10Plus * 100) / 100,
      highRangeDays: highRangeData.length,
      totalDays: combinedData.length
    };
  }, [historicalSnapshots, responseTimeMetrics]);

  // Calculate correlation data once for reuse
  const correlationData = useMemo(() => {
    if (!improvementPotential || historicalSnapshots.length === 0 || responseTimeMetrics.length === 0) {
      return null;
    }
    
    const combinedData = responseTimeMetrics
      .map(metric => {
        const snapshot = historicalSnapshots.find(s => s.date === metric.date);
        if (!snapshot) return null;
        
        const tseData = (snapshot.tse_data || snapshot.tseData || []).filter(tse => !["Prerit Sachdeva", "Stephen Skalamera"].includes(tse.name));
        if (tseData.length === 0) return null;
        
        let onTrackCount = 0;
        tseData.forEach(tse => {
          const meetsOpen = (tse.open || 0) <= THRESHOLDS.MAX_OPEN_SOFT;
          const totalWaitingOnTSE = tse.waitingOnTSE || tse.actionableSnoozed || 0;
          const meetsWaitingOnTSE = totalWaitingOnTSE <= THRESHOLDS.MAX_WAITING_ON_TSE_SOFT;
          if (meetsOpen && meetsWaitingOnTSE) onTrackCount++;
        });
        
        const onTrackPct = tseData.length > 0 ? Math.round((onTrackCount / tseData.length) * 100) : 0;
        
        return {
          onTrack: onTrackPct,
          slowResponsePct: parseFloat(metric.percentage5PlusMin || 0)
        };
      })
      .filter(d => d !== null);
    
    if (combinedData.length < 3) {
      return null;
    }
    
    // Calculate correlation
    const avgOnTrack = combinedData.reduce((sum, d) => sum + d.onTrack, 0) / combinedData.length;
    const avgSlowResponse = combinedData.reduce((sum, d) => sum + d.slowResponsePct, 0) / combinedData.length;
    
    let numerator = 0;
    let sumSqOnTrack = 0;
    let sumSqY = 0;
    
    combinedData.forEach(d => {
      const onTrackDiff = d.onTrack - avgOnTrack;
      const yDiff = d.slowResponsePct - avgSlowResponse;
      numerator += onTrackDiff * yDiff;
      sumSqOnTrack += onTrackDiff * onTrackDiff;
      sumSqY += yDiff * yDiff;
    });
    
    const correlation = sumSqOnTrack > 0 && sumSqY > 0
      ? numerator / Math.sqrt(sumSqOnTrack * sumSqY)
      : 0;
    
    const correlationStrength = Math.abs(correlation) < 0.3 ? 'weak' : Math.abs(correlation) < 0.7 ? 'moderate' : 'strong';
    const correlationDirection = correlation < 0 ? 'negative' : 'positive';
    
    return {
      correlation,
      correlationStrength,
      correlationDirection
    };
  }, [improvementPotential, historicalSnapshots, responseTimeMetrics]);

  // Calculate key insights
  const keyInsights = useMemo(() => {
    const insights = [];

    // On Track performance - always include current status
    if (metrics.onTrackOverall >= 80) {
      insights.push({
        type: 'positive',
        text: `Strong on-track performance: ${metrics.onTrackOverall}% of TSEs are meeting targets`,
        label: 'Strong on-track performance',
        percentage: metrics.onTrackOverall
      });
    } else if (metrics.onTrackOverall < 60) {
      insights.push({
        type: 'warning',
        text: `On-track performance needs attention: Only ${metrics.onTrackOverall}% of TSEs are meeting targets`,
        label: 'On-track performance needs attention',
        percentage: metrics.onTrackOverall
      });
    } else {
      // Middle range - still provide insight
      insights.push({
        type: 'positive',
        text: `On-track performance: ${metrics.onTrackOverall}% of TSEs are meeting targets`,
        label: 'On-track performance',
        percentage: metrics.onTrackOverall
      });
    }

    // Response time breakdown - 10+ min wait
    if (currentResponseTimePct10Plus > WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN) {
      insights.push({
        type: 'warning',
        text: `${currentResponseTimePct10Plus}% of conversations have 10+ min wait time - exceeds target (target: ${WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}%)`,
        percentage: currentResponseTimePct10Plus
      });
    } else if (currentResponseTimePct10Plus === 0) {
      insights.push({
        type: 'positive',
        text: `${currentResponseTimePct10Plus}% of conversations have 10+ min wait time - within target (target: ${WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}%)`,
        percentage: currentResponseTimePct10Plus
      });
    }
    
    // Response time breakdown - 5-10 min wait
    if (currentResponseTimePct5to10 !== undefined && currentResponseTimePct5to10 > WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN) {
      insights.push({
        type: 'warning',
        text: `${currentResponseTimePct5to10.toFixed(1)}% of conversations have 5-10 min wait time - exceeds target (target: ≤${WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}%)`,
        percentage: currentResponseTimePct5to10
      });
    } else if (currentResponseTimePct5to10 !== undefined && currentResponseTimePct5to10 <= WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN) {
      insights.push({
        type: 'positive',
        text: `${currentResponseTimePct5to10.toFixed(1)}% of conversations have 5-10 min wait time - within target (target: ≤${WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}%)`,
        percentage: currentResponseTimePct5to10
      });
    }

    // Add Overall Impact insight early if correlation data is available (prioritize this)
    if (correlationData) {
      const overallImpact = correlationData.correlationStrength;
      const isGoodCorrelation = correlationData.correlationDirection === 'negative';
      insights.push({
        type: isGoodCorrelation ? 'positive' : 'warning',
        text: `Overall Impact: On-track performance has a ${overallImpact} impact on response times${isGoodCorrelation ? ' (higher on-track = lower wait times)' : ' (concerning pattern)'}`,
        label: 'Overall Impact',
        impactStrength: overallImpact,
        isGoodCorrelation
      });
    }

    // Trend insights - calculate period length
    const onTrackPeriodDays = onTrackTrendData.length > 1
      ? Math.ceil((new Date(onTrackTrendData[onTrackTrendData.length - 1].date) - new Date(onTrackTrendData[0].date)) / (1000 * 60 * 60 * 24))
      : 0;
    const responseTimePeriodDays = responseTimeTrendData.length > 1
      ? Math.ceil((new Date(responseTimeTrendData[responseTimeTrendData.length - 1].date) - new Date(responseTimeTrendData[0].date)) / (1000 * 60 * 60 * 24))
      : 0;


    // Trend insights with lower thresholds to catch more changes
    if (onTrackTrend.direction === 'up' && onTrackTrend.change >= 2 && onTrackPeriodDays > 0) {
      insights.push({
        type: 'positive',
        text: `On-track performance improving: +${onTrackTrend.change.toFixed(1)}% vs yesterday`,
        label: 'On-track performance improving',
        percentage: onTrackTrend.change
      });
    } else if (onTrackTrend.direction === 'down' && onTrackTrend.change >= 2 && onTrackPeriodDays > 0) {
      insights.push({
        type: 'warning',
        text: `On-track performance declining: -${onTrackTrend.change.toFixed(1)}% vs yesterday`,
        label: 'On-track performance declining',
        percentage: onTrackTrend.change
      });
    }

    if (responseTimeTrend.direction === 'down' && responseTimeTrend.change >= 1 && responseTimePeriodDays > 0) {
      insights.push({
        type: 'positive',
        text: `Wait rate improving: -${responseTimeTrend.change.toFixed(1)}% vs yesterday`,
        label: 'Wait rate improving',
        percentage: responseTimeTrend.change
      });
    } else if (responseTimeTrend.direction === 'up' && responseTimeTrend.change >= 1 && responseTimePeriodDays > 0) {
      insights.push({
        type: 'warning',
        text: `Wait rate worsening: +${responseTimeTrend.change.toFixed(1)}% vs yesterday`,
        label: 'Wait rate worsening',
        percentage: responseTimeTrend.change
      });
    }

    // Add Impact tab insights if correlation data is available
    if (correlationData) {
      // Note: Correlation insight moved to separate insights above

      // Add improvement potential insight
      if (improvementPotential.improvement5to10 > 0 || improvementPotential.improvement10Plus > 0) {
        insights.push({
          type: 'positive',
          text: `Improvement potential: Maintaining High (80-100%) on-track could reduce wait times by ${improvementPotential.improvement5to10.toFixed(2)}% for 5-10 min waits and reduced by ${improvementPotential.improvement10Plus.toFixed(2)}% for 10+ min waits`,
          label: 'Improvement Potential',
          improvement5to10: improvementPotential.improvement5to10,
          improvement10Plus: improvementPotential.improvement10Plus
        });
      }
      
      // Add Wait Time Sensitivity insight
      if (improvementPotential.improvement5to10 !== undefined && improvementPotential.improvement10Plus !== undefined) {
        const isStronger5to10 = Math.abs(improvementPotential.improvement5to10) > Math.abs(improvementPotential.improvement10Plus);
        if (isStronger5to10) {
          insights.push({
            type: 'positive',
            text: `Wait Time Sensitivity: 5-10 min waits are more correlated with on-track performance than 10+ min waits`,
            label: 'Wait Time Sensitivity'
          });
        }
      }
      
      // Add Correlation Strength insight
      if (Math.abs(correlationData.correlation) >= 0.3) {
        insights.push({
          type: correlationData.correlationDirection === 'negative' ? 'positive' : 'warning',
          text: `Correlation Strength: The 5-10 min wait time bucket shows the ${correlationData.correlationStrength === 'strong' ? 'strongest' : correlationData.correlationStrength === 'moderate' ? 'moderate' : 'weakest'} correlation (${correlationData.correlation > 0 ? '+' : ''}${correlationData.correlation.toFixed(2)})`,
          label: 'Correlation Strength',
          correlationValue: correlationData.correlation,
          correlationStrength: correlationData.correlationStrength
        });
      }
    }

    // Add IDs to insights and filter dismissed ones
    const insightsWithIds = insights.slice(0, 5).map(insight => ({
      ...insight,
      id: insight.text // Use text as unique ID
    }));

    return insightsWithIds.filter(insight => !isInsightDismissed(insight.id));
  }, [metrics.onTrackOverall, currentResponseTimePct10Plus, currentResponseTimePct5to10, onTrackTrend, responseTimeTrend, onTrackTrendData, responseTimeTrendData, correlationData, improvementPotential, isInsightDismissed]);

  // Format insight text with bold and colors
  const formatInsightText = (insight) => {
    // If insight has structured data, format it specially
    if (insight.label === 'Overall Impact' && insight.impactStrength) {
      const impactColor = insight.impactStrength === 'strong' ? '#fd8789' : insight.impactStrength === 'moderate' ? '#fbbf24' : '#4cec8c';
      return (
        <>
          <strong>{insight.label}:</strong> On-track performance has a{' '}
          <strong style={{ color: impactColor }}>{insight.impactStrength}</strong> impact on response times
          {insight.isGoodCorrelation ? ' (higher on-track = lower wait times)' : ' (concerning pattern)'}
        </>
      );
    }
    
    // Handle insights with percentage field - format them properly
    if (insight.percentage !== undefined && insight.label) {
      const percentageText = `${Math.abs(insight.percentage).toFixed(insight.percentage % 1 === 0 ? 0 : 1)}%`;
      const sign = insight.percentage >= 0 ? '+' : '-';
      
      if (insight.label.includes('improving') || insight.label.includes('declining')) {
        // Trend insights
        return (
          <>
            <strong>{insight.label}:</strong> {sign}{percentageText} vs yesterday
          </>
        );
      } else if (insight.label.includes('Strong on-track') || insight.label.includes('On-track performance')) {
        // On-track performance insights
        return (
          <>
            <strong>{insight.label}:</strong> <strong style={{ color: '#4cec8c' }}>{percentageText}</strong> of TSEs are meeting targets
          </>
        );
      } else {
        // Default percentage formatting
        return (
          <>
            <strong>{insight.label}:</strong> <strong style={{ color: '#4cec8c' }}>{percentageText}</strong>
            {insight.text.includes('exceeds target') && insight.text.includes('10+ min') && ' - exceeds target (target: 0%)'}
            {insight.text.includes('within target') && insight.text.includes('10+ min') && ' - within target (target: 0%)'}
            {insight.text.includes('exceeds target') && insight.text.includes('5-10 min') && ' - exceeds target (target: ≤2%)'}
            {insight.text.includes('within target') && insight.text.includes('5-10 min') && ' - within target (target: ≤2%)'}
          </>
        );
      }
    }
    
    if (insight.label === 'Improvement Potential' && insight.improvement5to10 !== undefined) {
      return (
        <>
          <strong>{insight.label}:</strong> If all days matched High (80-100%) on-track performance, wait times could be{' '}
          {insight.improvement5to10 > 0 ? 'reduced' : 'increased'} by{' '}
          <strong style={{ color: '#4cec8c' }}>
            {Math.abs(insight.improvement5to10).toFixed(2)}% for 5-10 min waits
          </strong> and{' '}
          {insight.improvement10Plus > 0 ? 'reduced' : 'increased'} by{' '}
          <strong style={{ color: '#4cec8c' }}>
            {Math.abs(insight.improvement10Plus).toFixed(2)}% for 10+ min waits
          </strong>
        </>
      );
    }
    
    if (insight.label === 'Wait Time Sensitivity') {
      return (
        <>
          <strong>{insight.label}:</strong> 5-10 min waits are more correlated with on-track performance than 10+ min waits
        </>
      );
    }
    
    if (insight.label === 'Correlation Strength' && insight.correlationValue !== undefined) {
      const strengthText = insight.correlationStrength === 'strong' ? 'strongest' : insight.correlationStrength === 'moderate' ? 'moderate' : 'weakest';
      return (
        <>
          <strong>{insight.label}:</strong> The 5-10 min wait time bucket shows the {strengthText} correlation ({insight.correlationValue > 0 ? '+' : ''}{insight.correlationValue.toFixed(2)})
        </>
      );
    }
    
    // Default formatting for other insights - extract percentages and make them bold
    const text = insight.text;
    const parts = [];
    let lastIndex = 0;
    
    // Try to extract label if text starts with common labels
    const labelMatch = text.match(/^(Overall Impact|Wait Time Sensitivity|Improvement Potential|Correlation Strength|On-track performance|Wait rate|Strong on-track performance|On-track performance needs attention|On-track performance improving|On-track performance declining|Wait rate improving|Wait rate worsening):/);
    let label = null;
    let textWithoutLabel = text;
    
    if (labelMatch) {
      label = labelMatch[1];
      textWithoutLabel = text.substring(label.length + 1).trim();
    }
    
    // Match patterns like "XX%", "Strong", "moderate", "weak", etc.
    // Order matters - match longer patterns first
    const patterns = [
      { regex: /\b(strongest|stronger|Strongest|Stronger)\b/g, color: '#fd8789' }, // "strongest/stronger" in red
      { regex: /\b(Strong|strong)\b/g, color: '#fd8789' }, // "Strong" in red
      { regex: /\b(moderate|Moderate)\b/g, color: '#fbbf24' }, // "moderate" in yellow
      { regex: /\b(weakest|weaker|Weakest|Weaker)\b/g, color: '#4cec8c' }, // "weakest/weaker" in green
      { regex: /\b(weak|Weak)\b/g, color: '#4cec8c' }, // "weak" in green
      { regex: /([+-]?\d+\.?\d*)%/g, color: '#4cec8c' }, // Percentages (including +/-) in green
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

  // Calculate Region Performance Summary
  const regionPerformance = useMemo(() => {
    if (!metrics.byTSE || metrics.byTSE.length === 0) return [];
    
    const regionStats = { 'UK': { total: 0, onTrack: 0 }, 'NY': { total: 0, onTrack: 0 }, 'SF': { total: 0, onTrack: 0 }, 'Other': { total: 0, onTrack: 0 } };
    
    metrics.byTSE.forEach(tse => {
      const region = getTSERegion(tse.name);
      const meetsOpen = (tse.open || 0) <= THRESHOLDS.MAX_OPEN_SOFT;
      const totalWaitingOnTSE = tse.waitingOnTSE || tse.actionableSnoozed || 0;
      const meetsWaitingOnTSE = totalWaitingOnTSE <= THRESHOLDS.MAX_WAITING_ON_TSE_SOFT;
      
      regionStats[region].total++;
      if (meetsOpen && meetsWaitingOnTSE) {
        regionStats[region].onTrack++;
      }
    });
    
    return Object.entries(regionStats)
      .filter(([region]) => regionStats[region].total > 0)
      .map(([region, stats]) => {
        const onTrackPct = stats.total > 0 ? Math.round((stats.onTrack / stats.total) * 100) : 0;
        return {
          region,
          total: stats.total,
          onTrack: stats.onTrack,
          onTrackPct,
          icon: REGION_ICONS[region] || null
        };
      })
      .sort((a, b) => b.onTrackPct - a.onTrackPct);
  }, [metrics.byTSE]);

  // Calculate Alert Summary
  const alertSummary = useMemo(() => {
    if (!metrics.alerts || metrics.alerts.length === 0) {
      return {
        total: 0,
        byType: { open_threshold: 0, waiting_on_tse_threshold: 0 },
        bySeverity: { high: 0, medium: 0 }
      };
    }
    
    const byType = { open_threshold: 0, waiting_on_tse_threshold: 0 };
    const bySeverity = { high: 0, medium: 0 };
    
    metrics.alerts.forEach(alert => {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
    });
    
    return {
      total: metrics.alerts.length,
      byType,
      bySeverity
    };
  }, [metrics.alerts]);


  // Calculate OPEN CHATS age breakdown
  const openChatsAgeBreakdown = useMemo(() => {
    if (!conversations || conversations.length === 0) return { '0-2h': 0, '2-4h': 0, '4-8h': 0, '8h+': 0 };
    
    const now = Date.now();
    const breakdown = { '0-2h': 0, '2-4h': 0, '4-8h': 0, '8h+': 0 };
    
    conversations.forEach(conv => {
      const isSnoozed = conv.state === "snoozed" || conv.snoozed_until;
      if (conv.state !== "open" || isSnoozed) return;
      
      const createdAt = conv.created_at || conv.createdAt || conv.first_opened_at;
      if (!createdAt) return;
      
      const createdTimestamp = createdAt > 1e12 ? createdAt : createdAt * 1000;
      const ageHours = (now - createdTimestamp) / (1000 * 60 * 60);
      
      if (ageHours < 2) breakdown['0-2h']++;
      else if (ageHours < 4) breakdown['2-4h']++;
      else if (ageHours < 8) breakdown['4-8h']++;
      else breakdown['8h+']++;
    });
    
    return breakdown;
  }, [conversations]);

  // Calculate SNOOZED trends (compare to yesterday if available)
  const snoozedTrends = useMemo(() => {
    if (!historicalSnapshots || historicalSnapshots.length < 2) {
      return { waitingOnTSE: null, waitingOnCustomerResolved: null, waitingOnCustomerUnresolved: null, total: null };
    }
    
    const sorted = [...historicalSnapshots].sort((a, b) => a.date.localeCompare(b.date));
    const today = sorted[sorted.length - 1];
    const yesterday = sorted[sorted.length - 2];
    
    const calculateSnoozedCounts = (snapshot) => {
      const tseData = snapshot.tse_data || snapshot.tseData || [];
      let waitingOnTSE = 0;
      let waitingOnCustomerResolved = 0;
      let waitingOnCustomerUnresolved = 0;
      let total = 0;
      
      tseData.forEach(tse => {
        waitingOnTSE += tse.waitingOnTSE || tse.actionableSnoozed || 0;
        // Get resolved and unresolved counts if available in snapshot
        waitingOnCustomerResolved += tse.waitingOnCustomerResolved || 0;
        waitingOnCustomerUnresolved += tse.waitingOnCustomerUnresolved || 0;
        total += tse.snoozed || 0;
      });
      
      return { waitingOnTSE, waitingOnCustomerResolved, waitingOnCustomerUnresolved, total };
    };
    
    const todayCounts = calculateSnoozedCounts(today);
    const yesterdayCounts = calculateSnoozedCounts(yesterday);
    
    return {
      waitingOnTSE: {
        today: todayCounts.waitingOnTSE,
        yesterday: yesterdayCounts.waitingOnTSE,
        change: todayCounts.waitingOnTSE - yesterdayCounts.waitingOnTSE,
        direction: todayCounts.waitingOnTSE > yesterdayCounts.waitingOnTSE ? 'up' : todayCounts.waitingOnTSE < yesterdayCounts.waitingOnTSE ? 'down' : 'stable'
      },
      waitingOnCustomerResolved: {
        today: todayCounts.waitingOnCustomerResolved,
        yesterday: yesterdayCounts.waitingOnCustomerResolved,
        change: todayCounts.waitingOnCustomerResolved - yesterdayCounts.waitingOnCustomerResolved,
        direction: todayCounts.waitingOnCustomerResolved > yesterdayCounts.waitingOnCustomerResolved ? 'up' : todayCounts.waitingOnCustomerResolved < yesterdayCounts.waitingOnCustomerResolved ? 'down' : 'stable'
      },
      waitingOnCustomerUnresolved: {
        today: todayCounts.waitingOnCustomerUnresolved,
        yesterday: yesterdayCounts.waitingOnCustomerUnresolved,
        change: todayCounts.waitingOnCustomerUnresolved - yesterdayCounts.waitingOnCustomerUnresolved,
        direction: todayCounts.waitingOnCustomerUnresolved > yesterdayCounts.waitingOnCustomerUnresolved ? 'up' : todayCounts.waitingOnCustomerUnresolved < yesterdayCounts.waitingOnCustomerUnresolved ? 'down' : 'stable'
      },
      total: {
        today: todayCounts.total,
        yesterday: yesterdayCounts.total,
        change: todayCounts.total - yesterdayCounts.total,
        direction: todayCounts.total > yesterdayCounts.total ? 'up' : todayCounts.total < yesterdayCounts.total ? 'down' : 'stable'
      }
    };
  }, [historicalSnapshots]);

  // Calculate Recent Performance Comparison (Today vs Yesterday)
  const recentPerformanceComparison = useMemo(() => {
    if (!onTrackTrendData || onTrackTrendData.length < 1) return null;
    if (!responseTimeTrendData || responseTimeTrendData.length < 2) return null;
    
    // Use realtime on-track for today, historical snapshot for yesterday
    const todayOnTrackRealtime = metrics.onTrackOverall || 0;
    const yesterdayOnTrack = onTrackTrendData[onTrackTrendData.length - 1];
    
    const todayResponseTime = responseTimeTrendData[responseTimeTrendData.length - 1];
    const yesterdayResponseTime = responseTimeTrendData[responseTimeTrendData.length - 2];
    
    return {
      onTrack: {
        today: todayOnTrackRealtime,
        yesterday: yesterdayOnTrack.onTrack,
        change: todayOnTrackRealtime - yesterdayOnTrack.onTrack,
        direction: todayOnTrackRealtime > yesterdayOnTrack.onTrack ? 'up' : todayOnTrackRealtime < yesterdayOnTrack.onTrack ? 'down' : 'stable'
      },
      waitRate: {
        today: todayResponseTime.percentage5Plus,
        yesterday: yesterdayResponseTime.percentage5Plus,
        change: todayResponseTime.percentage5Plus - yesterdayResponseTime.percentage5Plus,
        direction: todayResponseTime.percentage5Plus < yesterdayResponseTime.percentage5Plus ? 'up' : todayResponseTime.percentage5Plus > yesterdayResponseTime.percentage5Plus ? 'down' : 'stable' // Lower is better
      }
    };
  }, [onTrackTrendData, responseTimeTrendData, metrics.onTrackOverall]);


  // Calculate Response Time Distribution
  const responseTimeDistribution = useMemo(() => {
    if (!conversations || conversations.length === 0) return { '0-2min': 0, '2-5min': 0, '5-10min': 0, '10+min': 0 };
    
    const distribution = { '0-2min': 0, '2-5min': 0, '5-10min': 0, '10+min': 0 };
    
    conversations.forEach(conv => {
      const timeToReply = conv.statistics?.time_to_admin_reply;
      const firstAdminReplyAt = conv.statistics?.first_admin_reply_at;
      const createdAt = conv.created_at || conv.createdAt || conv.first_opened_at;
      
      let responseMinutes = null;
      if (timeToReply !== null && timeToReply !== undefined) {
        responseMinutes = timeToReply / 60;
      } else if (firstAdminReplyAt && createdAt) {
        const createdTimestamp = createdAt > 1e12 ? createdAt : createdAt * 1000;
        const replyTimestamp = firstAdminReplyAt > 1e12 ? firstAdminReplyAt : firstAdminReplyAt * 1000;
        responseMinutes = (replyTimestamp - createdTimestamp) / (1000 * 60);
      }
      
      if (responseMinutes !== null && responseMinutes >= 0) {
        if (responseMinutes < 2) distribution['0-2min']++;
        else if (responseMinutes < 5) distribution['2-5min']++;
        else if (responseMinutes < 10) distribution['5-10min']++;
        else distribution['10+min']++;
      }
    });
    
    return distribution;
  }, [conversations]);


  return (
    <div className="modern-overview">
      {/* Key Insights Section */}
      <div className="key-insights-section" style={{
        marginBottom: '24px',
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
        {keyInsights.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {keyInsights.map((insight, idx) => (
              <div
                key={idx}
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
                <span style={{ flex: 1 }}>{formatInsightText(insight)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            padding: '8px 12px',
            fontSize: '13px',
            color: isDarkMode ? '#999' : '#666',
            fontStyle: 'italic'
          }}>
            No key insights available at this time.
          </div>
        )}
      </div>


      {/* Key KPIs - Organized by Realtime vs Historical */}
      <div className="overview-kpis">
        {/* Realtime Metrics Section */}
        <div className="kpi-section">
          <h3 className="kpi-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Today / Realtime Metrics</span>
            <img 
              src="https://res.cloudinary.com/doznvxtja/image/upload/v1768787154/3_150_x_150_px_4_momerl.gif"
              alt="Realtime Metrics"
              title="Automatically refreshes live Intercom conversation data every 2 minutes"
              style={{ width: '36px', height: '36px', cursor: 'help' }}
            />
          </h3>
          <div className="kpi-section-cards realtime-kpis">
            <div
              className="kpi-card primary kpi-card-clickable"
              onClick={() => setIsWaitRateModalOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              <img 
                src="https://res.cloudinary.com/doznvxtja/image/upload/v1768981418/3_150_x_150_px_20_tqz16p.svg"
                alt="Wait Rate indicator"
                className="wait-rate-kpi-gif"
              />
              <div className="kpi-label">
                Performance Metrics vs Yesterday
                <InfoIcon 
                  content={
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>Performance Metrics vs Yesterday</div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Wait Rate (Today):</strong> Percentage of conversations with 5+ minute wait time before first admin reply.
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          <li>Calculated from conversations created today during business hours</li>
                          <li>Shows breakdown: 5+ min (total), 5-10 min, and 10+ min</li>
                          <li>Trend compares today vs yesterday's snapshot data</li>
                        </ul>
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>On Track:</strong> Percentage of TSEs meeting both thresholds (≤5 open chats AND ≤5 conversations waiting on TSE).
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          <li>Shows Overall, Open-only, and Snoozed-only breakdowns</li>
                          <li>Trend compares today (realtime) vs yesterday</li>
                        </ul>
                      </div>
                      <div style={{ fontSize: '11px', color: isDarkMode ? '#999' : '#666', marginTop: '8px' }}>
                        Click to see detailed Wait Rate breakdown by hour and responder.
                      </div>
                    </div>
                  }
                  isDarkMode={isDarkMode}
                  position="right"
                />
              </div>
              <div className="kpi-content-with-viz">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 700 }}>{realtimeWaitRate.pct5Plus}%</span>
                    <span style={{ fontSize: '14px', color: isDarkMode ? '#999' : '#666' }}>Wait Rate (Today)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: isDarkMode ? '#999' : '#666', marginTop: '4px' }}>
                    <span>5-10 min: {realtimeWaitRate.pct5to10}%</span>
                    <span>10+ min: {realtimeWaitRate.pct10Plus}%</span>
                  </div>
                </div>
                {responseTimeTrendData.length >= 1 && (() => {
                  // Use historical data for previous 6 days, real-time for today
                  const historicalData = responseTimeTrendData.slice(-6);
                  const dataPoints = [
                    ...historicalData.map(p => ({ percentage: p.percentage5Plus })),
                    { percentage: realtimeWaitRate.pct5Plus }
                  ];
                  const maxValue = Math.max(...dataPoints.map(p => p.percentage), 1);
                  const minValue = Math.min(...dataPoints.map(p => p.percentage), 0);
                  const range = maxValue - minValue || 1;
                  const sparkWidth = 140;
                  const sparkHeight = 30;
                  
                  return (
                    <div className="kpi-sparkline-container">
                      <svg className="kpi-sparkline" viewBox={`0 0 ${sparkWidth} ${sparkHeight}`} width={sparkWidth} height={sparkHeight}>
                        {dataPoints.map((point, idx) => {
                          if (idx === 0) return null;
                          const prevPoint = dataPoints[idx - 1];
                          const x = (idx / Math.max(dataPoints.length - 1, 1)) * sparkWidth;
                          const y = sparkHeight - ((point.percentage - minValue) / range) * sparkHeight;
                          const prevX = ((idx - 1) / Math.max(dataPoints.length - 1, 1)) * sparkWidth;
                          const prevY = sparkHeight - ((prevPoint.percentage - minValue) / range) * sparkHeight;
                          return (
                            <line
                              key={idx}
                              x1={prevX}
                              y1={prevY}
                              x2={x}
                              y2={y}
                              stroke={realtimeWaitRateTrend.direction === 'down' ? '#4cec8c' : realtimeWaitRateTrend.direction === 'up' ? '#fd8789' : '#999'}
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          );
                        })}
                      </svg>
                    </div>
                  );
                })()}
              </div>
              {responseTimeTrendData.length > 0 && (
                <div>
                  <div className={`kpi-trend ${realtimeWaitRateTrend.direction}`}>
                    {realtimeWaitRateTrend.direction === 'up' ? '↓' : realtimeWaitRateTrend.direction === 'down' ? '↑' : '→'}
                    {realtimeWaitRateTrend.change > 0 && ` ${realtimeWaitRateTrend.change.toFixed(1)}%`}
                  </div>
                  <div style={{ fontSize: '11px', color: isDarkMode ? '#999' : '#666', marginTop: '4px' }}>
                    vs yesterday ({realtimeWaitRateTrend.yesterdayValue}%)
                  </div>
                </div>
              )}
              
              {/* On Track % Section */}
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}` }}>
                <div className="kpi-content-with-viz">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '20px', fontWeight: 700 }}>{metrics.onTrackOverall || 0}%</span>
                      <span style={{ fontSize: '12px', color: isDarkMode ? '#999' : '#666' }}>On Track</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: isDarkMode ? '#999' : '#666', marginTop: '4px' }}>
                      <span>Open: {metrics.onTrackOpenOnly || 0}%</span>
                      <span>Snoozed: {metrics.onTrackSnoozedOnly || 0}%</span>
                    </div>
                  </div>
                  {onTrackTrendData.length >= 2 && (() => {
                    const dataPoints = onTrackTrendData.slice(-7);
                    const maxValue = Math.max(...dataPoints.map(p => p.onTrack), 1);
                    const minValue = Math.min(...dataPoints.map(p => p.onTrack), 0);
                    const range = maxValue - minValue || 1;
                    const sparkWidth = 140;
                    const sparkHeight = 30;
                    
                    return (
                      <div className="kpi-sparkline-container">
                        <svg className="kpi-sparkline" viewBox={`0 0 ${sparkWidth} ${sparkHeight}`} width={sparkWidth} height={sparkHeight}>
                          {dataPoints.map((point, idx) => {
                            if (idx === 0) return null;
                            const prevPoint = dataPoints[idx - 1];
                            const x = (idx / Math.max(dataPoints.length - 1, 1)) * sparkWidth;
                            const y = sparkHeight - ((point.onTrack - minValue) / range) * sparkHeight;
                            const prevX = ((idx - 1) / Math.max(dataPoints.length - 1, 1)) * sparkWidth;
                            const prevY = sparkHeight - ((prevPoint.onTrack - minValue) / range) * sparkHeight;
                            return (
                              <line
                                key={idx}
                                x1={prevX}
                                y1={prevY}
                                x2={x}
                                y2={y}
                                stroke={onTrackTrend.direction === 'up' ? '#4cec8c' : onTrackTrend.direction === 'down' ? '#fd8789' : '#999'}
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            );
                          })}
                        </svg>
                      </div>
                    );
                  })()}
                </div>
                {onTrackTrendData.length >= 2 && (
                  <div>
                    <div className={`kpi-trend ${onTrackTrend.direction}`}>
                      {onTrackTrend.direction === 'up' ? '↑' : onTrackTrend.direction === 'down' ? '↓' : '→'}
                      {onTrackTrend.change > 0 && ` ${onTrackTrend.change.toFixed(1)}%`}
                    </div>
                    <div style={{ fontSize: '11px', color: isDarkMode ? '#999' : '#666', marginTop: '4px' }}>
                      vs yesterday ({onTrackTrendData[onTrackTrendData.length - 2]?.onTrack || 0}%)
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="kpi-card primary">
              <img 
                src="https://res.cloudinary.com/doznvxtja/image/upload/v1768981418/3_150_x_150_px_20_tqz16p.svg"
                alt="Real-time Intercom Metrics indicator"
                className="wait-rate-kpi-gif"
              />
              <div className="kpi-label">
                Real-time Intercom Metrics
                <InfoIcon 
                  content={
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>Real-time Intercom Metrics (Today)</div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Avg Initial Response:</strong> Average time to first admin reply.
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          <li>Calculated from conversations created today (2am-6pm PT)</li>
                          <li>Trend compares last 7 days vs previous 7 days</li>
                        </ul>
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Open Chats:</strong> Total count of active, non-snoozed conversations.
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          <li>Shows age breakdown: 0-2h, 2-4h, 4-8h, 8h+</li>
                        </ul>
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Unassigned Conversations:</strong> Conversations without an assigned TSE.
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          <li>Color-coded: Green (≤5), Yellow (6-10), Red (11+)</li>
                          <li>Shows median wait time for unassigned</li>
                        </ul>
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Close Rate % (Today):</strong> Percentage of conversations created today that were closed.
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          <li>Calculated from all conversations created today (PT timezone)</li>
                          <li>Click to see list of same-day closures</li>
                        </ul>
                      </div>
                    </div>
                  }
                  isDarkMode={isDarkMode}
                  position="right"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                {/* Avg Initial Response */}
                <div>
                  <div style={{ fontSize: '12px', color: isDarkMode ? '#999' : '#666', marginBottom: '4px' }}>Avg Initial Response (Today)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 600 }}>{avgInitialResponseMinutes} min</span>
                    {avgInitialResponseTrend.change > 0 && (
                      <span className={`kpi-trend ${avgInitialResponseTrend.direction}`} style={{ fontSize: '12px' }}>
                        {avgInitialResponseTrend.direction === 'up' ? '↓' : avgInitialResponseTrend.direction === 'down' ? '↑' : '→'}
                        {avgInitialResponseTrend.change > 0 && ` ${avgInitialResponseTrend.change.toFixed(1)} min`}
                      </span>
                    )}
                  </div>
                </div>

                {/* OPEN CHATS */}
                <div>
                  <div style={{ fontSize: '12px', color: isDarkMode ? '#999' : '#666', marginBottom: '4px' }}>Open Chats</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 600 }}>{metrics.totalOpen}</span>
                    {recentPerformanceComparison?.openChats && (
                      <span className="kpi-trend" style={{ color: isDarkMode ? '#999' : '#666', fontSize: '12px' }}>
                        {recentPerformanceComparison.openChats.direction === 'up' ? '↑' : recentPerformanceComparison.openChats.direction === 'down' ? '↓' : '→'}
                        {recentPerformanceComparison.openChats.change !== 0 && ` ${Math.abs(recentPerformanceComparison.openChats.change)}`}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px', fontSize: '10px', color: isDarkMode ? '#999' : '#666' }}>
                    <div>0-2h: {openChatsAgeBreakdown['0-2h']} • 2-4h: {openChatsAgeBreakdown['2-4h']} • 4-8h: {openChatsAgeBreakdown['4-8h']} • 8h+: {openChatsAgeBreakdown['8h+']}</div>
                  </div>
                </div>

                {/* Unassigned Conversations */}
                {metrics.unassignedConversations && (
                  <div>
                    <div style={{ fontSize: '12px', color: isDarkMode ? '#999' : '#666', marginBottom: '4px' }}>Unassigned Conversations</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px', fontWeight: 600, color: metrics.unassignedConversations.total > 5 ? '#fd8789' : '#ffc107' }}>
                        {metrics.unassignedConversations.total}
                      </span>
                      {metrics.unassignedConversations.medianWaitTime > 0 && (
                        <span style={{ fontSize: '11px', color: isDarkMode ? '#999' : '#666' }}>
                          Median: {metrics.unassignedConversations.medianWaitTime.toFixed(1)}h
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Same-Day Close %} */}
                <div 
                  onClick={() => setIsSameDayCloseModalOpen(true)}
                  style={{ cursor: 'pointer', padding: '8px', margin: '-8px', borderRadius: '8px', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontSize: '12px', color: isDarkMode ? '#999' : '#666', marginBottom: '4px' }}>Close Rate % (Today)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 600 }}>{sameDayClosePct}%</span>
                    {sameDayCloseTrend.change > 0 && (
                      <span className={`kpi-trend ${sameDayCloseTrend.direction}`} style={{ fontSize: '12px' }}>
                        {sameDayCloseTrend.direction === 'up' ? '↑' : sameDayCloseTrend.direction === 'down' ? '↓' : '→'}
                        {sameDayCloseTrend.change > 0 && ` ${sameDayCloseTrend.change.toFixed(1)}%`}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: isDarkMode ? '#666' : '#999', marginTop: '4px' }}>
                    {sameDayCloseData.totalClosed} of {sameDayCloseData.totalCreated} created today
                  </div>
                </div>
              </div>
            </div>



            <div 
              className="kpi-card kpi-card-clickable"
              onClick={() => onNavigateToConversations && onNavigateToConversations([
                "waitingontse",
                "waitingoncustomer",
                "waitingoncustomer-resolved",
                "waitingoncustomer-unresolved"
              ])}
              style={{ cursor: onNavigateToConversations ? 'pointer' : 'default' }}
            >
              <img 
                src="https://res.cloudinary.com/doznvxtja/image/upload/v1768981418/3_150_x_150_px_20_tqz16p.svg"
                alt="Snoozed indicator"
                className="wait-rate-kpi-gif"
              />
              <div className="kpi-label" style={{ marginBottom: '8px' }}>
                SNOOZED
                <InfoIcon 
                  content="Breakdown of snoozed conversations: Waiting on TSE (actionable), Waiting on Customer - Resolved, and Waiting on Customer - Unresolved. Shows trends vs yesterday."
                  isDarkMode={isDarkMode}
                  position="left"
                />
              </div>
              {(() => {
                const waitingOnTSECount = metrics.waitingOnTSE.length;
                const waitingOnCustomerResolved = metrics.waitingOnCustomer ? metrics.waitingOnCustomer.filter(conv => {
                  const tags = Array.isArray(conv.tags) ? conv.tags : [];
                  return tags.some(t => 
                    (t.name && t.name.toLowerCase() === "snooze.waiting-on-customer-resolved") || 
                    (typeof t === "string" && t.toLowerCase() === "snooze.waiting-on-customer-resolved")
                  );
                }).length : 0;
                const waitingOnCustomerUnresolved = metrics.waitingOnCustomer ? metrics.waitingOnCustomer.filter(conv => {
                  const tags = Array.isArray(conv.tags) ? conv.tags : [];
                  return tags.some(t => 
                    (t.name && t.name.toLowerCase() === "snooze.waiting-on-customer-unresolved") || 
                    (typeof t === "string" && t.toLowerCase() === "snooze.waiting-on-customer-unresolved")
                  );
                }).length : 0;
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                    <div className="tse-metric-with-viz">
                      <div className="tse-metric">
                        <span className="metric-label">Waiting on TSE:</span>
                        <span className="metric-value">{waitingOnTSECount}</span>
                        {snoozedTrends.waitingOnTSE && snoozedTrends.waitingOnTSE.change !== 0 && (
                          <span className={`kpi-trend ${snoozedTrends.waitingOnTSE.direction}`} style={{ fontSize: '11px', marginLeft: '6px' }}>
                            {snoozedTrends.waitingOnTSE.direction === 'up' ? '↑' : '↓'} {Math.abs(snoozedTrends.waitingOnTSE.change)}
                          </span>
                        )}
                      </div>
                      <div className="kpi-mini-bar">
                        <div 
                          className="kpi-mini-bar-fill" 
                          style={{ 
                            width: `${Math.min((waitingOnTSECount / 10) * 100, 100)}%`,
                            backgroundColor: waitingOnTSECount <= 5 ? '#4cec8c' : waitingOnTSECount <= 7 ? '#ffc107' : '#fd8789'
                          }}
                        />
                      </div>
                    </div>
                    <div className="tse-metric-with-viz">
                      <div className="tse-metric">
                        <span className="metric-label">Waiting On Customer - Resolved:</span>
                        <span className="metric-value">{waitingOnCustomerResolved}</span>
                        {snoozedTrends.waitingOnCustomerResolved && snoozedTrends.waitingOnCustomerResolved.change !== 0 && (
                          <span className={`kpi-trend ${snoozedTrends.waitingOnCustomerResolved.direction}`} style={{ fontSize: '11px', marginLeft: '6px' }}>
                            {snoozedTrends.waitingOnCustomerResolved.direction === 'up' ? '↑' : '↓'} {Math.abs(snoozedTrends.waitingOnCustomerResolved.change)}
                          </span>
                        )}
                      </div>
                      <div className="kpi-mini-bar">
                        <div 
                          className="kpi-mini-bar-fill" 
                          style={{ 
                            width: `${Math.min((waitingOnCustomerResolved / 20) * 100, 100)}%`,
                            backgroundColor: '#35a1b4'
                          }}
                        />
                      </div>
                    </div>
                    <div className="tse-metric-with-viz">
                      <div className="tse-metric">
                        <span className="metric-label">Waiting On Customer - Unresolved:</span>
                        <span className="metric-value">{waitingOnCustomerUnresolved}</span>
                        {snoozedTrends.waitingOnCustomerUnresolved && snoozedTrends.waitingOnCustomerUnresolved.change !== 0 && (
                          <span className={`kpi-trend ${snoozedTrends.waitingOnCustomerUnresolved.direction}`} style={{ fontSize: '11px', marginLeft: '6px' }}>
                            {snoozedTrends.waitingOnCustomerUnresolved.direction === 'up' ? '↑' : '↓'} {Math.abs(snoozedTrends.waitingOnCustomerUnresolved.change)}
                          </span>
                        )}
                      </div>
                      <div className="kpi-mini-bar">
                        <div 
                          className="kpi-mini-bar-fill" 
                          style={{ 
                            width: `${Math.min((waitingOnCustomerUnresolved / 20) * 100, 100)}%`,
                            backgroundColor: '#9333ea'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Secondary Metrics Section */}
        <div className="kpi-section">
          <h3 className="kpi-section-title">Secondary Metrics</h3>
          <div className="kpi-section-cards">
            {/* Region Performance Summary */}
            {regionPerformance.length > 0 && (
              <div className="kpi-card">
                <div className="kpi-label">
                  Region Performance
                  <InfoIcon 
                    content="On-track percentage by region (UK, NY, SF, Other). Shows how many TSEs in each region are meeting both thresholds (open and waiting-on-TSE)."
                    isDarkMode={isDarkMode}
                    position="right"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {regionPerformance.map((region) => {
                    const iconUrl = region.region === 'NY' && isDarkMode 
                      ? 'https://res.cloudinary.com/doznvxtja/image/upload/v1768716963/3_150_x_150_px_16_ozl21j.svg'
                      : region.icon;
                    return (
                      <div key={region.region} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        {iconUrl && (
                          <img src={iconUrl} alt={region.region} style={{ width: '20px', height: '20px' }} />
                        )}
                      <span style={{ flex: 1, color: isDarkMode ? '#e5e5e5' : '#292929' }}>{region.region}:</span>
                      <span style={{ 
                        fontWeight: 600, 
                        color: region.onTrackPct >= 80 ? '#4cec8c' : region.onTrackPct >= 60 ? '#ffc107' : '#fd8789' 
                      }}>
                        {region.onTrackPct}%
                      </span>
                      <span style={{ fontSize: '11px', color: isDarkMode ? '#999' : '#666' }}>
                        ({region.onTrack}/{region.total})
                      </span>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Alert Summary Card */}
            <div 
              className="kpi-card kpi-card-clickable"
              onClick={() => onNavigateToTSEView && onNavigateToTSEView()}
              style={{ cursor: onNavigateToTSEView ? 'pointer' : 'default' }}
            >
              <img 
                src="https://res.cloudinary.com/doznvxtja/image/upload/v1768981418/3_150_x_150_px_20_tqz16p.svg"
                alt="Alert Summary indicator"
                className="wait-rate-kpi-gif"
              />
              <div className="kpi-label">
                Alert Summary
                <InfoIcon 
                  content="Total count of threshold violations: Open Threshold (≥6 open chats) and Waiting on TSE (≥7 conversations). Shows breakdown by severity (High/Medium). Click to view TSE view with alerts."
                  isDarkMode={isDarkMode}
                  position="right"
                />
              </div>
              <div className="kpi-content-with-viz">
                <div className="kpi-value" style={{ color: alertSummary.total > 0 ? '#fd8789' : '#4cec8c' }}>
                  {alertSummary.total}
                </div>
              </div>
              {alertSummary.total > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', fontSize: '11px', color: isDarkMode ? '#999' : '#666' }}>
                  <div>Open Threshold: {alertSummary.byType.open_threshold || 0}</div>
                  <div>Waiting on TSE: {alertSummary.byType.waiting_on_tse_threshold || 0}</div>
                  <div style={{ marginTop: '4px' }}>
                    High: {alertSummary.bySeverity.high || 0} | Medium: {alertSummary.bySeverity.medium || 0}
                  </div>
                </div>
              )}
              <div className="kpi-subtitle">{alertSummary.total === 0 ? 'No alerts' : 'Active alerts'}</div>
            </div>


            {/* Improvement Potential */}
            {improvementPotential && (
              <div className="kpi-card">
                <div className="kpi-label">
                  Improvement Potential
                  <InfoIcon 
                    content={
                      <div style={{ textAlign: 'left' }}>
                        <p><strong>What this shows:</strong> The potential reduction in wait time rates if all days matched High (80-100%) on-track performance.</p>
                        <p><strong>Calculation:</strong> Compares the current average wait rate with the average wait rate observed on days when on-track performance was High (80-100%).</p>
                        <p><strong>Interpretation:</strong></p>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          <li><strong>Positive reduction (green):</strong> Indicates potential improvement - wait rates would decrease</li>
                          <li><strong>Negative reduction (red):</strong> Indicates potential increase - wait rates would increase (concerning)</li>
                        </ul>
                        <p style={{ marginTop: '8px' }}><strong>Based on:</strong> {improvementPotential.totalDays} days analyzed ({improvementPotential.highRangeDays} High performance days)</p>
                      </div>
                    }
                    isDarkMode={isDarkMode}
                    position="left"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: isDarkMode ? '#999' : '#666', marginBottom: '4px' }}>5-10 Min Waits</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 600, color: improvementPotential.improvement5to10 > 0 ? '#4cec8c' : '#fd8789' }}>
                        {improvementPotential.improvement5to10 > 0 ? '-' : '+'}{Math.abs(improvementPotential.improvement5to10).toFixed(2)}%
                      </span>
                      <span style={{ fontSize: '11px', color: isDarkMode ? '#999' : '#666' }}>
                        (current: {improvementPotential.currentAvg5to10.toFixed(2)}% → high: {improvementPotential.highAvg5to10.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: isDarkMode ? '#999' : '#666', marginBottom: '4px' }}>10+ Min Waits</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 600, color: improvementPotential.improvement10Plus > 0 ? '#4cec8c' : '#fd8789' }}>
                        {improvementPotential.improvement10Plus > 0 ? '-' : '+'}{Math.abs(improvementPotential.improvement10Plus).toFixed(2)}%
                      </span>
                      <span style={{ fontSize: '11px', color: isDarkMode ? '#999' : '#666' }}>
                        (current: {improvementPotential.currentAvg10Plus.toFixed(2)}% → high: {improvementPotential.highAvg10Plus.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="kpi-subtitle">If all days matched High (80-100%) on-track</div>
              </div>
            )}
          </div>
        </div>

        {/* Additional Insights Section */}
        <div className="kpi-section">
          <h3 className="kpi-section-title">Additional Insights</h3>
          <div className="kpi-section-cards">
            {/* Response Time Distribution */}
            <div className="kpi-card">
              <div className="kpi-label">
                Response Time Distribution
                <InfoIcon 
                  content="Distribution of initial response times across all conversations. Shows how many conversations fall into each time bucket."
                  isDarkMode={isDarkMode}
                  position="right"
                />
              </div>
              <div style={{ marginTop: '12px' }}>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={[
                    { name: '0-2min', value: responseTimeDistribution['0-2min'], fill: '#4cec8c' },
                    { name: '2-5min', value: responseTimeDistribution['2-5min'], fill: '#ffc107' },
                    { name: '5-10min', value: responseTimeDistribution['5-10min'], fill: '#ff9a74' },
                    { name: '10+min', value: responseTimeDistribution['10+min'], fill: '#fd8789' }
                  ]} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                    <XAxis 
                      dataKey="name" 
                      stroke={isDarkMode ? '#ffffff' : '#666'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#666', fontSize: 10 }}
                    />
                    <YAxis 
                      stroke={isDarkMode ? '#ffffff' : '#666'}
                      tick={{ fill: isDarkMode ? '#ffffff' : '#666', fontSize: 10 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                        border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                        borderRadius: '4px',
                        color: isDarkMode ? '#e5e5e5' : '#292929'
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Trend Charts */}
      <div className="overview-charts">
        <div className="trend-card">
          <div className="trend-header">
            <h4>
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
                    <div>
                      <strong>How to read:</strong> Values above the 80% target line indicate good performance. The moving average lines help smooth out daily fluctuations to show the underlying trend.
                    </div>
                  </div>
                }
                position="right"
              />
            </h4>
            <span className="trend-period">7 days</span>
          </div>
          {onTrackChartDataWithMovingAvg.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={onTrackChartDataWithMovingAvg} margin={{ top: 70, right: 80, left: 20, bottom: 5 }}>
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
                    if (name.includes('Moving Avg') || name.includes('3-Day Avg')) return [`${value.toFixed(1)}%`, name];
                    return [`${value}%`, name];
                  }}
                />
                <ReferenceLine 
                  y={80} 
                  stroke="#999" 
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  label={{ value: "Target (80%)", position: "top", fill: isDarkMode ? '#999' : '#666', fontSize: 11, offset: 10 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="overallOnTrack" 
                  stroke="#4cec8c" 
                  strokeWidth={3}
                  dot={{ fill: '#4cec8c', r: 4 }}
                  name="Overall On Track"
                  label={(props) => {
                    const holidayLabel = createHolidayLabel(onTrackChartDataWithMovingAvg, false);
                    return holidayLabel ? holidayLabel(props) : null;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="movingAvgOverall" 
                  stroke="#4cec8c" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Overall 3-Day Avg"
                />
                <Line 
                  type="monotone" 
                  dataKey="openOnTrack" 
                  stroke="#35a1b4" 
                  strokeWidth={2}
                  dot={{ fill: '#35a1b4', r: 3 }}
                  name="Open On Track"
                />
                <Line 
                  type="monotone" 
                  dataKey="movingAvgOpen" 
                  stroke="#35a1b4" 
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Open 3-Day Avg"
                />
                <Line 
                  type="monotone" 
                  dataKey="snoozedOnTrack" 
                  stroke="#ff9a74" 
                  strokeWidth={2}
                  dot={{ fill: '#ff9a74', r: 3 }}
                  name="Snoozed On Track"
                />
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
          ) : (
            <div className="chart-placeholder">
              <p>No on-track data available</p>
              <span>Snapshots are captured daily at 10pm ET</span>
            </div>
          )}
        </div>

        <div className="trend-card">
          <div className="trend-header">
            <h4>
              Percentage of Conversations with Wait Time
              <InfoIcon 
                isDarkMode={isDarkMode} 
                position="right"
                content={
                  <div style={{ textAlign: 'left' }}>
                    <p><strong>What this shows:</strong> Daily percentage of conversations that waited 5+ minutes for a first response, broken down by wait time buckets.</p>
                    <p><strong>Lines:</strong></p>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      <li><strong>5+ Min Wait %</strong> (orange, solid): Total percentage of conversations waiting 5+ minutes</li>
                      <li><strong>5-10 Min Wait %</strong> (blue, dashed): Percentage waiting 5-10 minutes</li>
                      <li><strong>10+ Min Wait %</strong> (red, dashed): Percentage waiting 10+ minutes</li>
                    </ul>
                    <p><strong>Reference Lines:</strong> The red dashed line at {WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}% represents the target threshold for 10+ Min Waits ({WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}%). The orange dashed line at {WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}% represents the target threshold for 5-10 Min Waits (≤{WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}%). Values at or below these lines indicate good performance.</p>
                    <p><strong>How to use:</strong> Hover over data points to see exact values.</p>
                  </div>
                }
              />
            </h4>
            <span className="trend-period">7 days</span>
          </div>
          
          {/* Target Definitions - Above Graph */}
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
            borderRadius: '8px',
            border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`
          }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: isDarkMode ? '#ffffff' : '#292929',
              marginBottom: '8px'
            }}>
              Target Definitions:
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '12px',
              color: isDarkMode ? '#e5e5e5' : '#666'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="24" height="4" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="2" x2="24" y2="2" stroke="#fd8789" strokeWidth="2" strokeDasharray="2 2" />
                </svg>
                <span><strong>10+ Min Waits:</strong> Target is {WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="24" height="4" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="2" x2="24" y2="2" stroke="#ff9a74" strokeWidth="2" strokeDasharray="2 2" />
                </svg>
                <span><strong>5-10 Min Waits:</strong> Target is ≤{WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}%</span>
              </div>
            </div>
          </div>
          
          {responseTimeChartData.length > 0 ? (() => {
            // Calculate dynamic Y-axis domain based on data
            const maxValue = Math.max(
              ...responseTimeChartData.map(d => Math.max(
                d.percentage5PlusMin || 0,
                d.percentage5to10Min || 0,
                d.percentage10PlusMin || 0
              ))
            );
            // Use max value + 20% padding, but cap at 20% for readability
            const yAxisMax = Math.min(Math.ceil(maxValue * 1.2), 20);
            
            return (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={responseTimeChartData} margin={{ top: 70, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                  <XAxis 
                    dataKey="displayLabel" 
                    stroke={isDarkMode ? '#ffffff' : '#292929'}
                    tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    stroke={isDarkMode ? '#ffffff' : '#292929'}
                    tick={{ fill: isDarkMode ? '#ffffff' : '#292929', fontSize: 12 }}
                    domain={[0, yAxisMax]}
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
                  />
                  <ReferenceLine
                  y={WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN} 
                  stroke="#ff9a74" 
                  strokeDasharray="2 2" 
                  strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="percentage5PlusMin"
                  stroke="#ffa500" 
                  strokeWidth={2}
                  name="5+ Min Wait %"
                  dot={{ r: 4, fill: '#ffa500' }}
                  label={createHolidayLabel(responseTimeChartData, false)}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="percentage5to10Min"
                  stroke="#2196f3" 
                  strokeWidth={3}
                  name="5-10 Min Wait %"
                  dot={{ r: 5, fill: '#2196f3' }}
                  strokeDasharray="5 5"
                  activeDot={{ r: 7 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="percentage10PlusMin"
                  stroke="#f44336" 
                  strokeWidth={3}
                  name="10+ Min Wait %"
                  dot={{ r: 5, fill: '#f44336' }}
                  strokeDasharray="5 5"
                  activeDot={{ r: 7 }}
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
            );
          })() : (
            <div className="chart-placeholder">
              <p>No response time data available</p>
              <span>Metrics are captured daily at midnight UTC</span>
            </div>
          )}
        </div>

      </div>

      <div className="trend-card aging-card">
        <div className="trend-header">
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Conversation Aging (Open + Snoozed)
            <InfoIcon 
              content="Shows the distribution of open and snoozed conversations by age bucket. Stacked bars display Open conversations (teal), Waiting on Customer - Resolved (green), Waiting on Customer - Unresolved (purple), and Waiting on TSE - Deep Dive (yellow). Hover over bars to see detailed counts."
              isDarkMode={isDarkMode}
              position="right"
            />
          </h4>
          <span className="trend-period">Current backlog</span>
        </div>
        {agingChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={agingChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
              <XAxis dataKey="bucket" stroke={isDarkMode ? '#ffffff' : '#666'} tick={{ fontSize: 11, fill: isDarkMode ? '#ffffff' : '#666' }} />
              <YAxis allowDecimals={false} stroke={isDarkMode ? '#ffffff' : '#666'} tick={{ fontSize: 11, fill: isDarkMode ? '#ffffff' : '#666' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDarkMode ? '#1e1e1e' : 'white', 
                  border: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`, 
                  borderRadius: '4px',
                  color: isDarkMode ? '#e5e5e5' : '#292929'
                }}
              />
              <Legend wrapperStyle={{ color: isDarkMode ? '#ffffff' : '#292929' }} />
              <Bar dataKey="open" stackId="aging" fill="#35a1b4" name="Open" />
              <Bar dataKey="waitingOnCustomerResolved" stackId="aging" fill="#4cec8c" name="Waiting on Customer - Resolved" />
              <Bar dataKey="waitingOnCustomerUnresolved" stackId="aging" fill="#9333ea" name="Waiting on Customer - Unresolved" />
              <Bar dataKey="waitingOnTse" stackId="aging" fill="#fbbf24" name="Waiting on TSE - Deep Dive" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="chart-placeholder">
            <p>No active conversations available</p>
            <span>Open and snoozed chats will appear here</span>
          </div>
        )}
      </div>

      {isWaitRateModalOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsWaitRateModalOpen(false);
          setSelectedHour(null); // Reset filter when closing modal
          setShowAllResponders(false); // Reset show all states
          setShowAllWaits(false);
        }}>
          <div className="modal-content wait-rate-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header wait-rate-modal-header">
              <div>
                <h3>Wait Rate Drilldown</h3>
                <span className="modal-subtitle">5+ min waits • Most recent day</span>
              </div>
              <button className="modal-close-button" onClick={() => setIsWaitRateModalOpen(false)}>×</button>
            </div>
            <div className="modal-body wait-rate-modal-body">
              {waitRateDrilldown.conversations.length === 0 ? (
                <div className="modal-empty-state">No 5+ minute wait conversations available.</div>
              ) : (() => {
                // Filter conversations by selected hour
                const filteredConversations = selectedHour !== null
                  ? waitRateDrilldown.conversations.filter(conv => conv.hour === selectedHour)
                  : waitRateDrilldown.conversations;

                // Recalculate assignees based on filtered conversations
                const filteredAssigneeCounts = {};
                filteredConversations.forEach(conv => {
                  filteredAssigneeCounts[conv.assigneeName] = (filteredAssigneeCounts[conv.assigneeName] || 0) + 1;
                });
                const filteredAssignees = Object.entries(filteredAssigneeCounts)
                  .map(([name, count]) => ({ name, count }))
                  .sort((a, b) => b.count - a.count);

                // Group conversations by responder for filtered view
                const conversationsByResponder = {};
                filteredConversations.forEach(conv => {
                  if (!conversationsByResponder[conv.assigneeName]) {
                    conversationsByResponder[conv.assigneeName] = [];
                  }
                  conversationsByResponder[conv.assigneeName].push(conv);
                });

                // Sort conversations within each responder group by wait time
                Object.keys(conversationsByResponder).forEach(responder => {
                  conversationsByResponder[responder].sort((a, b) => b.waitTimeMinutes - a.waitTimeMinutes);
                });

                const selectedHourLabel = selectedHour !== null 
                  ? waitRateDrilldown.hourly.find(h => h.hour === selectedHour)?.label || `${selectedHour}h`
                  : null;

                return (
                  <>
                    {selectedHour !== null && (
                      <div style={{ marginBottom: '16px', padding: '12px', background: isDarkMode ? 'rgba(53, 161, 180, 0.1)' : 'rgba(53, 161, 180, 0.05)', borderRadius: '8px', border: `1px solid ${isDarkMode ? 'rgba(53, 161, 180, 0.3)' : 'rgba(53, 161, 180, 0.2)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: isDarkMode ? '#ffffff' : '#292929', fontWeight: 600 }}>
                            Filtered to {selectedHourLabel} ({filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''})
                          </span>
                          <button 
                            onClick={() => setSelectedHour(null)}
                            style={{
                              padding: '6px 12px',
                              background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#f0f0f0',
                              border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : '#ddd'}`,
                              borderRadius: '4px',
                              color: isDarkMode ? '#ffffff' : '#292929',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Clear Filter
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="wait-rate-summary">
                      <div className="wait-rate-summary-item">
                        <div className="summary-label">Total 5+ min waits</div>
                        <div className="summary-value">{filteredConversations.length}</div>
                      </div>
                      <div className="wait-rate-summary-item">
                        <div className="summary-label">Avg wait (minutes)</div>
                        <div className="summary-value">
                          {filteredConversations.length > 0 ? Math.round(
                            (filteredConversations.reduce((sum, conv) => sum + (conv.waitTimeMinutes || 0), 0) /
                              filteredConversations.length) * 10
                          ) / 10 : 0}
                        </div>
                      </div>
                    </div>

                    <div className="wait-rate-chart">
                      <h4>Waits by Hour (PT)</h4>
                      <p style={{ 
                        fontSize: '13px', 
                        color: isDarkMode ? '#b0b0b0' : '#666', 
                        marginTop: '4px', 
                        marginBottom: '12px',
                        fontStyle: 'italic'
                      }}>
                        Click on any hour bar below to filter conversations by that hour
                      </p>
                      <ResponsiveContainer width="100%" height={220}>
                      <BarChart 
                        data={waitRateDrilldown.hourly}
                        onClick={(data) => {
                          if (data && data.activeLabel) {
                            const clickedHourData = waitRateDrilldown.hourly.find(h => h.label === data.activeLabel);
                            if (clickedHourData) {
                              setSelectedHour(clickedHourData.hour === selectedHour ? null : clickedHourData.hour);
                            }
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                        <XAxis 
                          dataKey="label" 
                          tick={{ fontSize: 11, fill: isDarkMode ? '#ffffff' : '#666' }} 
                        />
                        <YAxis 
                          allowDecimals={false} 
                          tick={{ fontSize: 11, fill: isDarkMode ? '#ffffff' : '#666' }} 
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: isDarkMode ? '#1e1e1e' : 'white',
                            border: `1px solid ${isDarkMode ? '#35a1b4' : '#35a1b4'}`,
                            borderRadius: '4px',
                            color: isDarkMode ? '#e5e5e5' : '#292929'
                          }}
                        />
                        <Bar 
                          dataKey="count" 
                          fill="#35a1b4" 
                          radius={[4, 4, 0, 0]}
                          style={{ cursor: 'pointer' }}
                        />
                      </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {selectedHour !== null ? (
                      // Show grouped by responder when filtered
                      <div className="wait-rate-columns" style={{ gridTemplateColumns: '1fr' }}>
                        <div className="wait-rate-column">
                          <h4>Conversations by Responder ({selectedHourLabel})</h4>
                          {filteredAssignees.length === 0 ? (
                            <p style={{ color: isDarkMode ? '#b0b0b0' : '#666', fontSize: '14px', margin: '16px 0' }}>No conversations found for this hour.</p>
                          ) : (
                            filteredAssignees.map(responder => (
                              <div key={responder.name} style={{ marginBottom: '24px' }}>
                                <h5 style={{ 
                                  margin: '0 0 12px 0', 
                                  fontSize: '14px', 
                                  fontWeight: 600,
                                  color: isDarkMode ? '#ffffff' : '#292929',
                                  paddingBottom: '8px',
                                  borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#e0e0e0'}`
                                }}>
                                  {responder.name} ({responder.count})
                                </h5>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                  {conversationsByResponder[responder.name].map(item => (
                                    <li key={item.id} style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '8px 10px',
                                      borderRadius: '6px',
                                      background: isDarkMode ? 'var(--bg-card)' : '#f9f9f9',
                                      border: `1px solid ${isDarkMode ? 'var(--border-primary)' : '#e0e0e0'}`,
                                      fontSize: '12px',
                                      color: isDarkMode ? '#ffffff' : '#292929',
                                      marginBottom: '6px'
                                    }}>
                                      <a 
                                        href={`${INTERCOM_BASE_URL}${item.id}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        style={{
                                          color: '#35a1b4',
                                          textDecoration: 'none',
                                          fontWeight: 600
                                        }}
                                        onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                        onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                                      >
                                        {item.id}
                                      </a>
                                      <span>{item.waitTimeMinutes} min</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : (
                      // Show original view when not filtered
                      <div className="wait-rate-columns">
                        <div className="wait-rate-column">
                          <h4>Top Responders</h4>
                          <ul>
                            {(showAllResponders ? waitRateDrilldown.assignees : waitRateDrilldown.assignees.slice(0, 5)).map(item => (
                              <li key={item.name}>
                                <span>{item.name}</span>
                                <span>{item.count}</span>
                              </li>
                            ))}
                          </ul>
                          {waitRateDrilldown.assignees.length > 5 && !showAllResponders && (
                            <button
                              onClick={() => setShowAllResponders(true)}
                              style={{
                                marginTop: '12px',
                                padding: '8px 16px',
                                background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#f0f0f0',
                                border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : '#ddd'}`,
                                borderRadius: '4px',
                                color: isDarkMode ? '#ffffff' : '#292929',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 500,
                                width: '100%'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.background = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : '#e0e0e0';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.background = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#f0f0f0';
                              }}
                            >
                              Load More ({waitRateDrilldown.assignees.length - 5} more)
                            </button>
                          )}
                        </div>
                        <div className="wait-rate-column">
                          <h4>Longest Waits</h4>
                          <ul>
                            {(showAllWaits ? waitRateDrilldown.conversations : waitRateDrilldown.conversations.slice(0, 5)).map(item => (
                              <li key={item.id}>
                                <a href={`${INTERCOM_BASE_URL}${item.id}`} target="_blank" rel="noopener noreferrer">
                                  {item.id}
                                </a>
                                <span>{item.waitTimeMinutes} min</span>
                              </li>
                            ))}
                          </ul>
                          {waitRateDrilldown.conversations.length > 5 && !showAllWaits && (
                            <button
                              onClick={() => setShowAllWaits(true)}
                              style={{
                                marginTop: '12px',
                                padding: '8px 16px',
                                background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#f0f0f0',
                                border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : '#ddd'}`,
                                borderRadius: '4px',
                                color: isDarkMode ? '#ffffff' : '#292929',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 500,
                                width: '100%'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.background = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : '#e0e0e0';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.background = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#f0f0f0';
                              }}
                            >
                              Load More ({waitRateDrilldown.conversations.length - 5} more)
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Same-Day Close Modal */}
      {isSameDayCloseModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSameDayCloseModalOpen(false)}>
          <div className="modal-content wait-rate-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header wait-rate-modal-header">
              <div>
                <h3>Today's Close Rate</h3>
                <span className="modal-subtitle">Percentage of conversations created today that were closed</span>
              </div>
              <button className="modal-close-button" onClick={() => setIsSameDayCloseModalOpen(false)}>×</button>
            </div>
            <div className="modal-body wait-rate-modal-body">
              {sameDayCloseData.conversations.length === 0 ? (
                <div className="modal-empty-state">No closed conversations available for conversations created today.</div>
              ) : (
                <>
                  <div className="wait-rate-summary">
                    <div className="wait-rate-summary-item">
                      <div className="summary-label">Closed Today</div>
                      <div className="summary-value">{sameDayCloseData.totalClosed}</div>
                    </div>
                    <div className="wait-rate-summary-item">
                      <div className="summary-label">Created Today</div>
                      <div className="summary-value">{sameDayCloseData.totalCreated}</div>
                    </div>
                    <div className="wait-rate-summary-item">
                      <div className="summary-label">Close Rate</div>
                      <div className="summary-value">{sameDayCloseData.pct}%</div>
                    </div>
                    <div className="wait-rate-summary-item">
                      <div className="summary-label">Avg Time to Close</div>
                      <div className="summary-value">
                        {sameDayCloseData.conversations.length > 0 
                          ? (() => {
                              const avgMinutes = sameDayCloseData.conversations.reduce((sum, c) => sum + (c.timeToCloseMinutes || 0), 0) / sameDayCloseData.conversations.length;
                              if (avgMinutes < 60) return `${Math.round(avgMinutes)} min`;
                              const hours = Math.floor(avgMinutes / 60);
                              const mins = Math.round(avgMinutes % 60);
                              return `${hours}h ${mins}m`;
                            })()
                          : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="wait-rate-columns" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="wait-rate-column">
                      <h4>Closed Conversations ({sameDayCloseData.conversations.length})</h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {sameDayCloseData.conversations.map(conv => (
                          <li key={conv.id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            background: isDarkMode ? 'var(--bg-card)' : '#f9f9f9',
                            border: `1px solid ${isDarkMode ? 'var(--border-primary)' : '#e0e0e0'}`,
                            fontSize: '13px',
                            color: isDarkMode ? '#ffffff' : '#292929',
                            marginBottom: '8px'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <a 
                                href={`${INTERCOM_BASE_URL}${conv.id}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{
                                  color: '#35a1b4',
                                  textDecoration: 'none',
                                  fontWeight: 600
                                }}
                                onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                              >
                                {conv.id}
                              </a>
                              <span style={{ fontSize: '11px', color: isDarkMode ? '#888' : '#666' }}>
                                Closed by: {conv.assigneeName}
                              </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 600 }}>
                                {conv.timeToCloseMinutes !== null 
                                  ? conv.timeToCloseMinutes < 60 
                                    ? `${conv.timeToCloseMinutes} min`
                                    : `${Math.floor(conv.timeToCloseMinutes / 60)}h ${conv.timeToCloseMinutes % 60}m`
                                  : '—'}
                              </div>
                              <div style={{ fontSize: '10px', color: isDarkMode ? '#888' : '#666' }}>
                                time to close
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function MetricCard({ title, value, target, status = "info" }) {
  return (
    <div className={`metric-card metric-${status}`}>
      <div className="metric-title">{title}</div>
      <div className="metric-value-large">{value}</div>
      {target !== undefined && (
        <div className="metric-target">Target: {target}</div>
      )}
    </div>
  );
}

// TSE Details Modal Component
function TSEDetailsModal({ tse, conversations, historicalSnapshots = [], responseTimeMetrics = [], onClose }) {
  const { isDarkMode } = useTheme();
  const [clickedTooltip, setClickedTooltip] = useState(null);
  const { open, waitingOnTSE, waitingOnCustomer, totalSnoozed } = conversations;
  const avatarUrl = getTSEAvatar(tse.name);
  const region = getTSERegion(tse.name);
  const regionLabels = {
    'UK': { text: 'UK' },
    'NY': { text: 'New York' },
    'SF': { text: 'San Francisco' },
    'Other': { text: 'Other' }
  };
  const regionLabel = regionLabels[region] || regionLabels['Other'];
  // Use dark mode icon for NY when in dark mode
  let regionIconUrl = REGION_ICONS[region];
  if (region === 'NY' && isDarkMode) {
    regionIconUrl = 'https://res.cloudinary.com/doznvxtja/image/upload/v1768716963/3_150_x_150_px_16_ozl21j.svg';
  }
  const INTERCOM_BASE_URL = "https://app.intercom.com/a/inbox/gu1e0q0t/inbox/admin/9110812/conversation/";
  
  // Calculate status for the modal
  const totalOpenCount = open.length;
  const totalWaitingOnTSECount = waitingOnTSE.length;
  const totalWaitingOnCustomerCount = waitingOnCustomer.length;
  const totalSnoozedCount = totalSnoozed.length;
  
  // Determine status - prioritize critical issues (error) over warnings
  let status;
  // Outstanding: 0 open and 0 waiting on TSE
  if (totalOpenCount === 0 && totalWaitingOnTSECount === 0) {
    status = "exceeding";
  }
  // Over Limit - Needs Attention: either >5 open OR >5 waiting on TSE
  // Check this BEFORE warning to prioritize critical issues
  else if (totalOpenCount > THRESHOLDS.MAX_OPEN_SOFT || totalWaitingOnTSECount > THRESHOLDS.MAX_WAITING_ON_TSE_SOFT) {
    status = "error";
  }
  // On Track: ≤5 open AND ≤5 waiting on TSE
  else if (totalOpenCount <= THRESHOLDS.MAX_OPEN_SOFT && totalWaitingOnTSECount <= THRESHOLDS.MAX_WAITING_ON_TSE_SOFT) {
    // Check for warning condition: Total Snoozed > Waiting On TSE + Waiting On Customer
    // This indicates snoozed conversations without proper tags
    if (totalSnoozedCount > (totalWaitingOnTSECount + totalWaitingOnCustomerCount)) {
      status = "warning";
    } else {
      status = "success";
    }
  }
  // Fallback (shouldn't reach here, but just in case)
  else {
    status = "error";
  }

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (clickedTooltip && !event.target.closest('.tooltip-popup') && !event.target.closest('.clickable-status-icon')) {
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

  // Use shared date formatting utility
  const formatDate = formatDateTimeUTC;

  // Calculate TSE historical metrics and trends
  const tseMetrics = useMemo(() => {
    if (!historicalSnapshots || historicalSnapshots.length === 0) {
      return null;
    }

    const tseId = String(tse.id);
    const tseName = tse.name;
    
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

    if (tseHistory.length === 0) return null;

    // Calculate averages
    const avgOpen = tseHistory.reduce((sum, d) => sum + d.open, 0) / tseHistory.length;
    const avgWaitingOnTSE = tseHistory.reduce((sum, d) => sum + d.waitingOnTSE, 0) / tseHistory.length;
    const avgTotalSnoozed = tseHistory.reduce((sum, d) => sum + d.totalSnoozed, 0) / tseHistory.length;
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
        direction: change > 2 ? 'improving' : change < -2 ? 'worsening' : 'stable',
        last7AvgOpen: last7.reduce((sum, d) => sum + d.open, 0) / 7,
        previous7AvgOpen: previous7.reduce((sum, d) => sum + d.open, 0) / 7,
        last7AvgWaiting: last7.reduce((sum, d) => sum + d.waitingOnTSE, 0) / 7,
        previous7AvgWaiting: previous7.reduce((sum, d) => sum + d.waitingOnTSE, 0) / 7
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
        direction: change > 2 ? 'improving' : change < -2 ? 'worsening' : 'stable',
        lastHalfAvgOpen: lastHalf.reduce((sum, d) => sum + d.open, 0) / lastHalf.length,
        firstHalfAvgOpen: firstHalf.reduce((sum, d) => sum + d.open, 0) / firstHalf.length,
        lastHalfAvgWaiting: lastHalf.reduce((sum, d) => sum + d.waitingOnTSE, 0) / lastHalf.length,
        firstHalfAvgWaiting: firstHalf.reduce((sum, d) => sum + d.waitingOnTSE, 0) / firstHalf.length
      };
    } else {
      trend = {
        period: 'Insufficient data',
        change: 0,
        direction: 'stable',
        lastHalfAvgOpen: avgOpen,
        firstHalfAvgOpen: avgOpen,
        lastHalfAvgWaiting: avgWaitingOnTSE,
        firstHalfAvgWaiting: avgWaitingOnTSE
      };
    }

    // Generate key insights
    const insights = [];
    
    if (onTrackPercentage >= 80) {
      insights.push({
        type: 'positive',
        text: `Excellent performance: ${onTrackPercentage.toFixed(0)}% on-track over ${tseHistory.length} days`
      });
    } else if (onTrackPercentage < 60) {
      insights.push({
        type: 'warning',
        text: `Only ${onTrackPercentage.toFixed(0)}% on-track over ${tseHistory.length} days`
      });
    }

    if (avgOpen > THRESHOLDS.MAX_OPEN_SOFT) {
      insights.push({
        type: 'warning',
        text: `Average open chats (${avgOpen.toFixed(1)}) exceeds target (≤${THRESHOLDS.MAX_OPEN_SOFT})`
      });
    }

    if (avgWaitingOnTSE > THRESHOLDS.MAX_WAITING_ON_TSE_SOFT) {
      insights.push({
        type: 'warning',
        text: `Average waiting on TSE (${avgWaitingOnTSE.toFixed(1)}) exceeds target (≤${THRESHOLDS.MAX_WAITING_ON_TSE_SOFT})`
      });
    }

    if (trend.direction === 'improving') {
      insights.push({
        type: 'positive',
        text: `Performance improving: ${trend.change > 0 ? '+' : ''}${trend.change.toFixed(1)}% on-track ${trend.period}`
      });
    } else if (trend.direction === 'worsening') {
      insights.push({
        type: 'warning',
        text: `${trend.change.toFixed(1)}% on-track ${trend.period}`
      });
    }

    // Best and worst days
    const bestDay = tseHistory.reduce((best, current) => 
      (current.open + current.waitingOnTSE) < (best.open + best.waitingOnTSE) ? current : best
    );
    const worstDay = tseHistory.reduce((worst, current) => 
      (current.open + current.waitingOnTSE) > (worst.open + worst.waitingOnTSE) ? current : worst
    );

    return {
      totalDays: tseHistory.length,
      onTrackPercentage: Math.round(onTrackPercentage),
      avgOpen: Math.round(avgOpen * 10) / 10,
      avgWaitingOnTSE: Math.round(avgWaitingOnTSE * 10) / 10,
      avgTotalSnoozed: Math.round(avgTotalSnoozed * 10) / 10,
      trend,
      insights,
      history: tseHistory,
      bestDay,
      worstDay
    };
  }, [historicalSnapshots, tse.id, tse.name]);

  const getAuthorEmail = (conv) => {
    return conv.source?.author?.email || 
           conv.source?.email || 
           conv.author?.email ||
           conv.conversation_message?.author?.email ||
           "-";
  };

  const renderConversationList = (convs, category) => {
    if (!convs || convs.length === 0) {
      return <div className="modal-empty-state">No conversations</div>;
    }

    return (
      <div className="modal-conversation-list">
        {convs.map((conv, idx) => {
          const convId = conv.id || conv.cid || conv.conversation_id;
          const authorEmail = getAuthorEmail(conv);
          const created = formatDate(conv.created_at || conv.createdAt || conv.first_opened_at);
          
          return (
            <div key={convId || idx} className="modal-conversation-item">
              <img 
                src={isDarkMode 
                  ? "https://res.cloudinary.com/doznvxtja/image/upload/v1768727228/3_150_x_150_px_17_btkr0t.svg"
                  : "https://res.cloudinary.com/doznvxtja/image/upload/v1767370490/Untitled_design_14_wkkhe3.svg"
                }
                alt="Intercom"
                className="modal-conv-icon"
              />
              <div className="modal-conv-content">
                <div className="modal-conv-header">
                  <a 
                    href={`${INTERCOM_BASE_URL}${convId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="modal-conv-id-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {convId}
                  </a>
                  <span className="modal-conv-date">{created}</span>
                </div>
                <div className="modal-conv-email">{authorEmail}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-avatar-container">
              {avatarUrl && (
                <img 
                  src={avatarUrl} 
                  alt={tse.name}
                  className="modal-avatar"
                />
              )}
              {tse.awayModeEnabled ? (
                <span className="modal-avatar-away-indicator" title="Away mode enabled">
                  🌙
                </span>
              ) : (
                <span className="modal-avatar-available-indicator" title="Available">
                </span>
              )}
            </div>
            <div className="modal-header-info">
              <h2 className="modal-title">
                {tse.name}
                <span style={{ position: 'relative', display: 'inline-block' }}>
                  {status === "exceeding" && (
                    <span 
                      className="tse-status-icon tse-exceeding-star clickable-status-icon"
                      title={`Outstanding - ${totalOpenCount} open, ${totalWaitingOnTSECount} waiting on TSE`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setClickedTooltip(clickedTooltip === 'status' ? null : 'status');
                      }}
                    >
                      ⭐
                    </span>
                  )}
                  {status === "success" && (
                    <span 
                      className="tse-status-icon tse-success-checkmark clickable-status-icon"
                      title={`On Track - ${totalOpenCount} open, ${totalWaitingOnTSECount} waiting on TSE (target: ≤${THRESHOLDS.MAX_OPEN_SOFT} open, ≤${THRESHOLDS.MAX_WAITING_ON_TSE_SOFT} waiting)`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setClickedTooltip(clickedTooltip === 'status' ? null : 'status');
                      }}
                    >
                      ✓
                    </span>
                  )}
                  {status === "warning" && (
                    <span 
                      className="tse-status-icon tse-warning-exclamation clickable-status-icon"
                      title={`Missing Snooze Tags - ${totalSnoozedCount} total snoozed, but only ${totalWaitingOnTSECount + totalWaitingOnCustomerCount} have proper tags. Please tag snoozed conversations with one of: Waiting On TSE, Waiting On Customer - Resolved, or Waiting On Customer - Unresolved.`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setClickedTooltip(clickedTooltip === 'status' ? null : 'status');
                      }}
                    >
                      ⚠
                    </span>
                  )}
                  {status === "error" && (
                    <span 
                      className="tse-status-icon tse-error-x clickable-status-icon"
                      title={`Over Limit - Needs Attention - ${totalOpenCount} open, ${totalWaitingOnTSECount} waiting on TSE (target: ≤${THRESHOLDS.MAX_OPEN_SOFT} open, ≤${THRESHOLDS.MAX_WAITING_ON_TSE_SOFT} waiting)`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setClickedTooltip(clickedTooltip === 'status' ? null : 'status');
                      }}
                    >
                      ✗
                    </span>
                  )}
                  {clickedTooltip === 'status' && (
                    <div className="tooltip-popup">
                      <div className="tooltip-content">
                        <div className="tooltip-header">
                          <span className="tooltip-title">
                            {status === "warning" ? "Missing Snooze Tags" : status === "exceeding" ? "Outstanding" : status === "success" ? "On Track" : "Over Limit - Needs Attention"}
                          </span>
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
                          {status === "warning" ? (
                            <>
                              <div className="tooltip-metric">
                                <strong>Total Snoozed:</strong> {totalSnoozedCount}
                              </div>
                              <div className="tooltip-metric">
                                <strong>Waiting On TSE:</strong> {totalWaitingOnTSECount}
                              </div>
                              <div className="tooltip-metric">
                                <strong>Waiting On Customer:</strong> {totalWaitingOnCustomerCount}
                              </div>
                              <div className="tooltip-metric">
                                <strong>Missing Tags:</strong> {totalSnoozedCount - (totalWaitingOnTSECount + totalWaitingOnCustomerCount)}
                              </div>
                              <div className="tooltip-note" style={{ marginTop: '8px', padding: '8px', backgroundColor: isDarkMode ? '#3a3a3a' : '#fff9e6', borderRadius: '4px', fontSize: '12px', color: isDarkMode ? '#fbbf24' : '#856404' }}>
                                Please tag all snoozed conversations with one of: Waiting On TSE, Waiting On Customer - Resolved, or Waiting On Customer - Unresolved.
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="tooltip-metric">
                                <strong>Open:</strong> {totalOpenCount} (target: ≤{THRESHOLDS.MAX_OPEN_SOFT})
                              </div>
                              <div className="tooltip-metric">
                                <strong>Waiting on TSE:</strong> {totalWaitingOnTSECount} (target: ≤{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT})
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </span>
              </h2>
              <div className="modal-region">
                {regionIconUrl && (
                  <img 
                    src={regionIconUrl} 
                    alt={region} 
                    className="modal-region-icon"
                  />
                )}
                <span className="modal-region-text">{regionLabel.text}</span>
              </div>
            </div>
          </div>
          <div className="modal-header-right">
            <div className={`modal-status-badge status-${status}`}>
              {status === "warning" && <span>⚠ Missing Snooze Tags</span>}
              {status === "exceeding" && <span>⭐ Outstanding</span>}
              {status === "success" && <span>✓ On Track</span>}
              {status === "error" && <span>✗ Over Limit - Needs Attention</span>}
            </div>
            <button className="modal-close-button" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <div className="modal-body">
          {/* TSE Scorecard Section */}
          {tseMetrics && (
            <div className="modal-scorecard-section">
              <h3 className="modal-scorecard-title">Performance Scorecard</h3>
              
              {/* Key Metrics Grid */}
              <div className="modal-scorecard-metrics">
                <div className="modal-scorecard-metric">
                  <div className="modal-scorecard-metric-label">On-Track %</div>
                  <div className="modal-scorecard-metric-value" style={{ 
                    color: tseMetrics.onTrackPercentage >= 80 ? '#4cec8c' : tseMetrics.onTrackPercentage < 60 ? '#fd8789' : '#ffc107'
                  }}>
                    {tseMetrics.onTrackPercentage}%
                  </div>
                  <div className="modal-scorecard-metric-subtext">
                    {tseMetrics.totalDays} days tracked
                  </div>
                </div>
                
                <div className="modal-scorecard-metric">
                  <div className="modal-scorecard-metric-label">Avg Open Chats</div>
                  <div className="modal-scorecard-metric-value" style={{ 
                    color: tseMetrics.avgOpen <= THRESHOLDS.MAX_OPEN_SOFT ? '#4cec8c' : '#fd8789'
                  }}>
                    {tseMetrics.avgOpen.toFixed(1)}
                  </div>
                  <div className="modal-scorecard-metric-subtext">
                    Target: ≤{THRESHOLDS.MAX_OPEN_SOFT}
                  </div>
                </div>
                
                <div className="modal-scorecard-metric">
                  <div className="modal-scorecard-metric-label">Avg Waiting on TSE</div>
                  <div className="modal-scorecard-metric-value" style={{ 
                    color: tseMetrics.avgWaitingOnTSE <= THRESHOLDS.MAX_WAITING_ON_TSE_SOFT ? '#4cec8c' : '#fd8789'
                  }}>
                    {tseMetrics.avgWaitingOnTSE.toFixed(1)}
                  </div>
                  <div className="modal-scorecard-metric-subtext">
                    Target: ≤{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT}
                  </div>
                </div>
                
                <div className="modal-scorecard-metric">
                  <div className="modal-scorecard-metric-label">Trend</div>
                  <div className="modal-scorecard-metric-value" style={{ 
                    color: tseMetrics.trend.direction === 'improving' ? '#4cec8c' : tseMetrics.trend.direction === 'worsening' ? '#fd8789' : '#999'
                  }}>
                    {tseMetrics.trend.direction === 'improving' ? '↑' : tseMetrics.trend.direction === 'worsening' ? '↓' : '→'}
                    {tseMetrics.trend.change !== 0 && ` ${tseMetrics.trend.change > 0 ? '+' : ''}${tseMetrics.trend.change.toFixed(1)}%`}
                  </div>
                  <div className="modal-scorecard-metric-subtext">
                    {tseMetrics.trend.period}
                  </div>
                </div>
              </div>

              {/* Performance Trend Chart */}
              {tseMetrics.history.length > 1 && (
                <div className="modal-scorecard-chart">
                  <h4 className="modal-scorecard-chart-title">Performance Over Time</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart 
                      data={tseMetrics.history.map(d => ({
                        date: d.date,
                        displayLabel: formatDateForChart(d.date),
                        open: d.open,
                        waitingOnTSE: d.waitingOnTSE,
                        onTrack: d.isOnTrack ? 1 : 0
                      }))}
                      margin={{ top: 5, right: 30, bottom: 20, left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#333' : '#e0e0e0'} />
                      <XAxis 
                        dataKey="displayLabel" 
                        tick={{ fontSize: 10, fill: isDarkMode ? '#999' : '#666' }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: isDarkMode ? '#999' : '#666' }}
                        label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fill: isDarkMode ? '#999' : '#666' } }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                          border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                          borderRadius: '4px'
                        }}
                        labelFormatter={(label) => formatDateForTooltip(label)}
                      />
                      <ReferenceLine 
                        y={THRESHOLDS.MAX_OPEN_SOFT} 
                        stroke="#ffc107" 
                        strokeDasharray="3 3" 
                      />
                      <ReferenceLine 
                        y={THRESHOLDS.MAX_WAITING_ON_TSE_SOFT} 
                        stroke="#ffc107" 
                        strokeDasharray="3 3" 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="open" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Open Chats"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="waitingOnTSE" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Waiting on TSE"
                      />
                      <Legend 
                        content={({ payload }) => (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px', marginBottom: '0px', flexWrap: 'wrap' }}>
                            {payload && payload.map((entry, index) => (
                              <div key={`legend-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isDarkMode ? '#999' : '#666' }}>
                                <div style={{ 
                                  width: '16px', 
                                  height: '2px', 
                                  backgroundColor: entry.color,
                                  border: 'none'
                                }} />
                                <span>{entry.value}</span>
                              </div>
                            ))}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isDarkMode ? '#999' : '#666' }}>
                              <div style={{ 
                                width: '16px', 
                                height: '2px', 
                                backgroundColor: '#ffc107',
                                border: 'none',
                                backgroundImage: 'repeating-linear-gradient(to right, #ffc107 0px, #ffc107 3px, transparent 3px, transparent 6px)'
                              }} />
                              <span>Open Target</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isDarkMode ? '#999' : '#666' }}>
                              <div style={{ 
                                width: '16px', 
                                height: '2px', 
                                backgroundColor: '#ffc107',
                                border: 'none',
                                backgroundImage: 'repeating-linear-gradient(to right, #ffc107 0px, #ffc107 3px, transparent 3px, transparent 6px)'
                              }} />
                              <span>Waiting Target</span>
                            </div>
                          </div>
                        )}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Key Insights */}
              {tseMetrics.insights.length > 0 && (
                <div className="modal-scorecard-insights">
                  <h4 className="modal-scorecard-insights-title">Key Insights</h4>
                  <div className="modal-scorecard-insights-list">
                    {tseMetrics.insights.map((insight, idx) => (
                      <div 
                        key={idx} 
                        className="modal-scorecard-insight"
                        style={{
                          backgroundColor: insight.type === 'positive' 
                            ? (isDarkMode ? '#1a3a2a' : '#d4edda')
                            : (isDarkMode ? '#3a2a1a' : '#fff3cd'),
                          color: insight.type === 'positive'
                            ? (isDarkMode ? '#4cec8c' : '#155724')
                            : (isDarkMode ? '#ffc107' : '#856404'),
                          padding: '8px 12px',
                          borderRadius: '4px',
                          marginBottom: '8px',
                          fontSize: '13px'
                        }}
                      >
                        {insight.type === 'positive' ? '✓' : '⚠'} {insight.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Best/Worst Days */}
              {tseMetrics.bestDay && tseMetrics.worstDay && (
                <div className="modal-scorecard-extremes">
                  <div className="modal-scorecard-extreme">
                    <span className="modal-scorecard-extreme-label">Best Day:</span>
                    <span className="modal-scorecard-extreme-value" style={{ color: '#4cec8c' }}>
                      {formatDateForChart(tseMetrics.bestDay.date)} ({tseMetrics.bestDay.open} open, {tseMetrics.bestDay.waitingOnTSE} waiting)
                    </span>
                  </div>
                  <div className="modal-scorecard-extreme">
                    <span className="modal-scorecard-extreme-label">Worst Day:</span>
                    <span className="modal-scorecard-extreme-value" style={{ color: '#fd8789' }}>
                      {formatDateForChart(tseMetrics.worstDay.date)} ({tseMetrics.worstDay.open} open, {tseMetrics.worstDay.waitingOnTSE} waiting)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Open Conversations */}
          <div className="modal-section">
            <h3 className="modal-section-title">
              Open Conversations
              <span className="modal-section-count">({open.length})</span>
            </h3>
            {renderConversationList(open, 'open')}
          </div>

          {/* Snoozed - Waiting On TSE */}
          <div className="modal-section">
            <h3 className="modal-section-title">
              Snoozed - Waiting On TSE
              <span className="modal-section-count">({waitingOnTSE.length})</span>
            </h3>
            {renderConversationList(waitingOnTSE, 'waitingOnTSE')}
          </div>

          {/* Snoozed - Waiting On Customer */}
          <div className="modal-section">
            <h3 className="modal-section-title">
              Snoozed - Waiting On Customer
              <span className="modal-section-count">({waitingOnCustomer.length})</span>
            </h3>
            {renderConversationList(waitingOnCustomer, 'waitingOnCustomer')}
          </div>

          {/* Total Snoozed */}
          <div className="modal-section">
            <h3 className="modal-section-title">
              Total Snoozed
              <span className="modal-section-count">({totalSnoozed.length})</span>
            </h3>
            {renderConversationList(totalSnoozed, 'totalSnoozed')}
          </div>
        </div>
      </div>

    </div>
  );
}

function ConversationTable({ conversations }) {
  const { isDarkMode } = useTheme();
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [columnWidths, setColumnWidths] = useState({
    row: 60,
    id: 150,
    created: 180,
    updated: 180,
    assigned: 150,
    author: 200,
    state: 250,
    tags: 200,
    email: 200
  });
  const [isResizing, setIsResizing] = useState(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, width: 0 });

  const handleMouseDown = (e, column) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeStart({
      x: e.clientX,
      width: columnWidths[column]
    });
    setIsResizing(column);
  };

  const handleMouseUp = () => {
    setIsResizing(null);
  };

  useEffect(() => {
    if (isResizing) {
      const handleMouseMoveGlobal = (e) => {
        const deltaX = e.clientX - resizeStart.x;
        const newWidth = Math.max(50, resizeStart.width + deltaX);
        setColumnWidths(prev => ({
          ...prev,
          [isResizing]: newWidth
        }));
      };
      
      document.addEventListener('mousemove', handleMouseMoveGlobal);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMoveGlobal);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, resizeStart]);

  if (!conversations || !Array.isArray(conversations) || conversations.length === 0) {
    return (
      <div className="table-container">
        <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
          No conversations found
        </div>
      </div>
    );
  }

  const INTERCOM_BASE_URL = "https://app.intercom.com/a/inbox/gu1e0q0t/inbox/admin/9110812/conversation/";

  // Prepare data with timestamps for sorting and additional fields
  const conversationsWithTimestamps = conversations.map((conv) => {
    const id = conv.id || conv.cid || conv.conversation_id;
    const created = conv.created_at || conv.createdAt || conv.first_opened_at;
    const updated = conv.updated_at || conv.last_contacted_at;
    
    // Extract author email
    const authorEmail = conv.source?.author?.email || 
                       conv.source?.email || 
                       conv.author?.email ||
                       conv.conversation_message?.author?.email ||
                       "-";
    
    // Get state
    const state = conv.state || "open";
    
    // Get snoozed until timestamp
    const snoozedUntil = conv.snoozed_until || null;
    const snoozedUntilDate = snoozedUntil ? (typeof snoozedUntil === "number" ? new Date(snoozedUntil * 1000) : new Date(snoozedUntil)) : null;
    
    return {
      ...conv,
      id,
      authorEmail,
      state,
      snoozedUntilDate,
      createdTimestamp: created ? (typeof created === "number" ? created : new Date(created).getTime()) : 0,
      updatedTimestamp: updated ? (typeof updated === "number" ? updated * 1000 : new Date(updated).getTime()) : 0,
    };
  });

  // Sort conversations
  const sortedConversations = [...conversationsWithTimestamps].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let aVal, bVal;
    if (sortColumn === 'created') {
      aVal = a.createdTimestamp;
      bVal = b.createdTimestamp;
    } else if (sortColumn === 'updated') {
      aVal = a.updatedTimestamp;
      bVal = b.updatedTimestamp;
    } else if (sortColumn === 'assigned') {
      const aAssignee = a.admin_assignee?.name || 
                       (typeof a.admin_assignee === "string" ? a.admin_assignee : null) ||
                       "Unassigned";
      const bAssignee = b.admin_assignee?.name || 
                       (typeof b.admin_assignee === "string" ? b.admin_assignee : null) ||
                       "Unassigned";
      aVal = aAssignee.toLowerCase();
      bVal = bAssignee.toLowerCase();
    } else if (sortColumn === 'state') {
      aVal = (a.state || "open").toLowerCase();
      bVal = (b.state || "open").toLowerCase();
    } else {
      return 0;
    }
    
    if (aVal === bVal) return 0;
    const comparison = aVal > bVal ? 1 : -1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  return (
    <div className="table-container">
      <table className="conversations-table">
        <thead>
          <tr>
            <th style={{ width: columnWidths.row, position: 'relative', minWidth: '50px' }}>
              #
              <div 
                className="column-resizer"
                onMouseDown={(e) => handleMouseDown(e, 'row')}
              />
            </th>
            <th style={{ width: columnWidths.id, position: 'relative' }}>
              ID
              <div 
                className="column-resizer"
                onMouseDown={(e) => handleMouseDown(e, 'id')}
              />
            </th>
            <th 
              style={{ width: columnWidths.created, position: 'relative', cursor: 'pointer', minWidth: '50px' }}
              onClick={() => handleSort('created')}
              className="sortable-header"
            >
              Created At (UTC)
              {sortColumn === 'created' && (
                <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
              <div 
                className="column-resizer"
                onMouseDown={(e) => handleMouseDown(e, 'created')}
              />
            </th>
            <th 
              style={{ width: columnWidths.updated, position: 'relative', cursor: 'pointer', minWidth: '50px' }}
              onClick={() => handleSort('updated')}
              className="sortable-header"
            >
              Last Updated (UTC)
              {sortColumn === 'updated' && (
                <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
              <div 
                className="column-resizer"
                onMouseDown={(e) => handleMouseDown(e, 'updated')}
              />
            </th>
            <th 
              style={{ width: columnWidths.assigned, position: 'relative', minWidth: '50px', cursor: 'pointer' }}
              onClick={() => handleSort('assigned')}
              className="sortable-header"
            >
              Assigned To
              {sortColumn === 'assigned' && (
                <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
              <div 
                className="column-resizer"
                onMouseDown={(e) => handleMouseDown(e, 'assigned')}
              />
            </th>
            <th 
              style={{ width: columnWidths.state, position: 'relative', minWidth: '50px', cursor: 'pointer' }}
              onClick={() => handleSort('state')}
              className="sortable-header"
            >
              State
              {sortColumn === 'state' && (
                <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
              <div 
                className="column-resizer"
                onMouseDown={(e) => handleMouseDown(e, 'state')}
              />
            </th>
            <th style={{ width: columnWidths.tags, position: 'relative', minWidth: '50px' }}>
              Active Snooze Workflow
              <div 
                className="column-resizer"
                onMouseDown={(e) => handleMouseDown(e, 'tags')}
              />
            </th>
            <th style={{ width: columnWidths.email, position: 'relative', minWidth: '50px' }}>
              Email
              <div 
                className="column-resizer"
                onMouseDown={(e) => handleMouseDown(e, 'email')}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedConversations.map((conv, index) => {
            const id = conv.id;
            const rowNumber = index + 1;
            
            // Helper function to determine status and workflow for closed conversations
            const getClosedConversationStatus = () => {
              const isClosed = (conv.state || "").toLowerCase() === "closed";
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
            const isClosed = (conv.state || "").toLowerCase() === "closed";
            
            // Check state first - if "Open" or "Closed", always show "--"
            const convState = (conv.state || "open").toLowerCase();
            const isOpen = convState === "open";
            const isSnoozed = convState === "snoozed" || conv.snoozed_until;
            
            // Map the tag to its display name (case-insensitive lookup)
            let displayTag = "--";
            let displayStatus = conv.state || "open";
            
            if (isClosed && closedStatusInfo) {
              // Use closed conversation logic for status
              displayStatus = closedStatusInfo.status;
              // For closed conversations, always show "--" for workflow
              displayTag = "--";
            } else if (isOpen) {
              // If state is "Open", ALWAYS show "--"
              displayTag = "--";
            } else if (isSnoozed) {
              // If state is "Snoozed", use "Last Snooze Workflow Used" custom attribute
              const customAttributes = conv.custom_attributes || {};
              const lastSnoozeWorkflow = customAttributes["Last Snooze Workflow Used"];
              
              if (lastSnoozeWorkflow) {
                displayTag = String(lastSnoozeWorkflow);
              } else {
                // Fallback to "--" if not set
                displayTag = "--";
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
              } else if (conv.state === 'snoozed' && conv.snoozedUntilDate) {
                return <SnoozeCountdownTimer targetDate={conv.snoozedUntilDate} />;
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
            const renderWorkflowBadge = (tag) => {
              if (tag === "N/A" || tag === "--" || tag === "No Active Snooze Workflows") {
                return <span style={{ color: isDarkMode ? '#999' : '#999' }}>—</span>;
              }
              
              let backgroundColor, color;
              if (tag === "Waiting On TSE - Deep Dive") {
                backgroundColor = isDarkMode ? '#5A4A1F' : '#FFFACD';
                color = isDarkMode ? '#D4AF37' : '#B8860B';
              } else if (tag === "Waiting On Customer - Unresolved") {
                backgroundColor = isDarkMode ? '#5A2A2A' : '#FFDDDD';
                color = isDarkMode ? '#FF6B6B' : '#D84C4C';
              } else if (tag === "Waiting On Customer - Resolved") {
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
                  {tag}
                </span>
              );
            };
            
            const created = conv.created_at || conv.createdAt || conv.first_opened_at;
            const createdDateUTC = created ? formatTimestampUTC(created) : null;
            
            const updated = conv.updated_at || conv.last_contacted_at;
            const updatedDateUTC = updated ? formatTimestampUTC(updated) : null;
            
            const assigneeName = conv.admin_assignee?.name || 
                                (typeof conv.admin_assignee === "string" ? conv.admin_assignee : null) ||
                                "Unassigned";

            return (
              <tr key={id}>
                <td style={{ width: columnWidths.row, textAlign: 'center', color: isDarkMode ? '#999' : '#666' }}>
                  {rowNumber}
                </td>
                <td className="id-cell" style={{ width: columnWidths.id }}>
                  <a 
                    href={`${INTERCOM_BASE_URL}${id}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="id-link"
                  >
                    {id}
                  </a>
                </td>
                <td className="date-cell" style={{ width: columnWidths.created }}>
                  {createdDateUTC || "-"}
                </td>
                <td className="date-cell" style={{ width: columnWidths.updated }}>
                  {updatedDateUTC || "-"}
                </td>
                <td style={{ width: columnWidths.assigned }}>{assigneeName}</td>
                <td className="state-cell" style={{ width: columnWidths.state }}>
                  {renderStatusBadge(displayStatus)}
                </td>
                <td className="tags-cell" style={{ width: columnWidths.tags }}>
                  {renderWorkflowBadge(displayTag)}
                </td>
                <td style={{ width: columnWidths.email }}>{conv.authorEmail || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Help Modal Component
function HelpModal({ onClose }) {
  const { isDarkMode } = useTheme();
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const modalBody = element.closest('.help-modal-body');
      if (modalBody) {
        const offset = 20;
        const elementPosition = element.getBoundingClientRect().top;
        const modalBodyPosition = modalBody.getBoundingClientRect().top;
        const offsetPosition = elementPosition + modalBody.scrollTop - modalBodyPosition - offset;
        
        modalBody.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  };

  const scrollToTop = () => {
    const modalBody = document.querySelector('.help-modal-body');
    if (modalBody) {
      modalBody.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content help-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header help-modal-header">
          <div className="help-header-content">
            <span className="help-header-icon">📚</span>
            <h2>User Guide</h2>
          </div>
          <button className="modal-close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body help-modal-body">
          {/* Table of Contents */}
          <div className="help-toc">
            <h3 className="help-toc-title">📑 Table of Contents</h3>
            <div className="help-toc-links">
              {/* General Section */}
              <div className="help-toc-section">
                <div className="help-toc-section-title">General</div>
                <button onClick={() => scrollToSection('status-thresholds')} className="help-toc-link">📏 Status Thresholds</button>
                <button onClick={() => scrollToSection('alerts-system')} className="help-toc-link">🔔 Alerts System</button>
              </div>
              
              {/* Dashboard Section */}
              <div className="help-toc-section">
                <div className="help-toc-section-title">Dashboard</div>
                <button onClick={() => scrollToSection('overview-dashboard')} className="help-toc-link">📊 Overview Dashboard</button>
              </div>
              
              {/* TSE Queue Health Section */}
              <div className="help-toc-section">
                <div className="help-toc-section-title">TSE Queue Health</div>
                <button onClick={() => scrollToSection('tse-view')} className="help-toc-link">👥 TSE View</button>
                <button onClick={() => scrollToSection('tse-details-modal')} className="help-toc-link">🔍 TSE Details Modal</button>
              </div>
              
              {/* Intercom Data Section */}
              <div className="help-toc-section">
                <div className="help-toc-section-title">Intercom Data</div>
                <button onClick={() => scrollToSection('conversations-view')} className="help-toc-link">💬 Conversations</button>
              </div>
              
              {/* Analytics Section */}
              <div className="help-toc-section">
                <div className="help-toc-section-title">Analytics</div>
                <button onClick={() => scrollToSection('daily-on-track-trends')} className="help-toc-link">📊 Daily On Track Trends</button>
                <button onClick={() => scrollToSection('response-time-metrics')} className="help-toc-link">⏱️ Response Time Metrics</button>
                <button onClick={() => scrollToSection('impact')} className="help-toc-link">🔗 Impact</button>
              </div>
            </div>
          </div>

          {/* General Section */}
          <div className="help-section-divider">
            <h2 className="help-section-divider-title">General</h2>
          </div>

          {/* Status Thresholds Section */}
          <div id="status-thresholds" className="help-section">
            <div className="help-section-header">
              <span className="help-section-icon">📏</span>
              <h3>Status Thresholds & On-Track Targets</h3>
            </div>
            <p className="help-intro">The application uses standardized thresholds to determine TSE queue health status. Understanding these thresholds is essential for interpreting all metrics throughout the application.</p>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">🎯</span>
                <strong>On-Track Target: 80%+</strong>
              </div>
              <p><strong>Team Goal:</strong> The target is for 80% or more of TSEs to be "on track" at any given time. This ensures optimal queue health and customer experience.</p>
              <p><strong>Why 80%:</strong> This target accounts for normal variations in workload, temporary spikes, and allows for some TSEs to be temporarily over limits while maintaining overall team performance.</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">✅</span>
                <strong>On-Track Calculation</strong>
              </div>
              <p><strong>Definition:</strong> A TSE is considered "on track" if they meet BOTH of the following thresholds simultaneously:</p>
              <ul>
                <li><strong>Open Conversations:</strong> ≤ {THRESHOLDS.MAX_OPEN_SOFT} active, non-snoozed conversations</li>
                <li><strong>Waiting on TSE:</strong> ≤ {THRESHOLDS.MAX_WAITING_ON_TSE_SOFT} conversations snoozed with the "snooze.waiting-on-tse" tag</li>
              </ul>
              <p><strong>Important Notes:</strong></p>
              <ul>
                <li>Both conditions must be met - if either threshold is exceeded, the TSE is not on track</li>
                <li>"Waiting on TSE" specifically refers to conversations with the "snooze.waiting-on-tse" tag, not all snoozed conversations</li>
                <li>Conversations waiting on customer (with "snooze.waiting-on-customer" tags) do not count toward the waiting-on-TSE threshold</li>
              </ul>
              <p><strong>Calculation Formula:</strong> For any group of TSEs, On-Track % = (Number of TSEs meeting both thresholds / Total TSEs) × 100</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">⭐</span>
                <strong>Status Levels</strong>
              </div>
              <p><strong>Four distinct status levels:</strong></p>
              <div className="help-status-grid">
                <div className="help-status-item">
                  <span className="help-status-badge status-exceeding">⭐️</span>
                  <div>
                    <strong>Outstanding</strong>
                    <p>0 open AND 0 waiting on TSE</p>
                    <p className="help-status-detail">Perfect performance - no active workload. TSE has completed all assigned work and has no pending items.</p>
                  </div>
                </div>
                <div className="help-status-item">
                  <span className="help-status-badge status-success">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" fill="#4eec8d"/>
                      <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <div>
                    <strong>On Track</strong>
                    <p>≤{THRESHOLDS.MAX_OPEN_SOFT} open AND ≤{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT} waiting</p>
                    <p className="help-status-detail">Within acceptable limits. TSE is managing their queue effectively and meeting performance standards.</p>
                  </div>
                </div>
                <div className="help-status-item">
                  <span className="help-status-badge status-error">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" fill="#fd8789"/>
                      <path d="M8 8L16 16M16 8L8 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <div>
                    <strong>Over Limit - Needs Attention</strong>
                    <p>&gt;{THRESHOLDS.MAX_OPEN_SOFT} open OR &gt;{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT} waiting</p>
                    <p className="help-status-detail">Exceeds thresholds and requires attention. May need workload redistribution or support.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">🚨</span>
                <strong>Alert Thresholds vs. Soft Limits</strong>
              </div>
              <p><strong>Two-Tier System:</strong> The application uses two sets of thresholds for different purposes:</p>
              <ul>
                <li><strong>Soft Limits (On-Track Thresholds):</strong>
                  <ul>
                    <li>Open Chats: ≤ {THRESHOLDS.MAX_OPEN_SOFT}</li>
                    <li>Waiting on TSE: ≤ {THRESHOLDS.MAX_WAITING_ON_TSE_SOFT}</li>
                  </ul>
                  <p style={{ marginTop: '8px', fontStyle: 'italic' }}>Used to determine "On Track" status. TSEs meeting these limits are considered compliant.</p>
                </li>
                <li><strong>Alert Thresholds:</strong>
                  <ul>
                    <li>Open Chats Alert: {THRESHOLDS.MAX_OPEN_ALERT}+ conversations</li>
                    <li>Waiting on TSE Alert: {THRESHOLDS.MAX_WAITING_ON_TSE_ALERT}+ conversations</li>
                  </ul>
                  <p style={{ marginTop: '8px', fontStyle: 'italic' }}>Trigger notifications when exceeded. These are higher thresholds that indicate a TSE needs immediate attention.</p>
                </li>
              </ul>
              <p><strong>Why Different:</strong> Soft limits define acceptable performance, while alert thresholds identify situations requiring immediate intervention. This two-tier system prevents alert fatigue while maintaining clear performance standards.</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">📊</span>
                <strong>Threshold Values</strong>
              </div>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                marginTop: '12px',
                backgroundColor: isDarkMode ? '#1a1a1a' : 'transparent',
                color: isDarkMode ? '#ffffff' : '#292929'
              }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${isDarkMode ? '#444' : '#e0e0e0'}` }}>
                    <th style={{ 
                      padding: '8px', 
                      textAlign: 'left',
                      color: isDarkMode ? '#ffffff' : '#292929',
                      fontWeight: 600,
                      backgroundColor: isDarkMode ? '#1a1a1a' : 'transparent'
                    }}>Metric</th>
                    <th style={{ 
                      padding: '8px', 
                      textAlign: 'left',
                      color: isDarkMode ? '#ffffff' : '#292929',
                      fontWeight: 600,
                      backgroundColor: isDarkMode ? '#1a1a1a' : 'transparent'
                    }}>Soft Limit (On-Track)</th>
                    <th style={{ 
                      padding: '8px', 
                      textAlign: 'left',
                      color: isDarkMode ? '#ffffff' : '#292929',
                      fontWeight: 600,
                      backgroundColor: isDarkMode ? '#1a1a1a' : 'transparent'
                    }}>Alert Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: `1px solid ${isDarkMode ? '#444' : '#e0e0e0'}` }}>
                    <td style={{ 
                      padding: '8px',
                      color: isDarkMode ? '#ffffff' : '#292929',
                      backgroundColor: isDarkMode ? '#1a1a1a' : 'transparent'
                    }}>Open Conversations</td>
                    <td style={{ 
                      padding: '8px',
                      color: isDarkMode ? '#ffffff' : '#292929',
                      backgroundColor: isDarkMode ? '#1a1a1a' : 'transparent'
                    }}>≤ {THRESHOLDS.MAX_OPEN_SOFT}</td>
                    <td style={{ 
                      padding: '8px',
                      color: isDarkMode ? '#ffffff' : '#292929',
                      backgroundColor: isDarkMode ? '#1a1a1a' : 'transparent'
                    }}>≥ {THRESHOLDS.MAX_OPEN_ALERT}</td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${isDarkMode ? '#444' : '#e0e0e0'}` }}>
                    <td style={{ 
                      padding: '8px',
                      color: isDarkMode ? '#ffffff' : '#292929',
                      backgroundColor: isDarkMode ? '#1a1a1a' : 'transparent'
                    }}>Waiting on TSE</td>
                    <td style={{ 
                      padding: '8px',
                      color: isDarkMode ? '#ffffff' : '#292929',
                      backgroundColor: isDarkMode ? '#1a1a1a' : 'transparent'
                    }}>≤ {THRESHOLDS.MAX_WAITING_ON_TSE_SOFT}</td>
                    <td style={{ 
                      padding: '8px',
                      color: isDarkMode ? '#ffffff' : '#292929',
                      backgroundColor: isDarkMode ? '#1a1a1a' : 'transparent'
                    }}>≥ {THRESHOLDS.MAX_WAITING_ON_TSE_ALERT}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Alerts Section */}
          <div id="alerts-system" className="help-section">
            <div className="help-section-header">
              <span className="help-section-icon">🔔</span>
              <h3>Alerts System</h3>
            </div>
            <p className="help-intro">The alerts system proactively identifies TSEs who need immediate attention, helping managers quickly address queue health issues before they impact customer experience.</p>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">🔔</span>
                <strong>Alert Dropdown</strong>
              </div>
              <p><strong>Access:</strong> Click the bell icon (🔔) in the top navigation header. The icon displays a badge with the total count of active alerts.</p>
              <p><strong>What It Shows:</strong> A dropdown menu listing all TSEs currently exceeding alert thresholds, organized by alert type.</p>
              <p><strong>Features:</strong></p>
              <ul>
                <li>Total alert count displayed as a badge on the bell icon</li>
                <li>Alerts grouped by type (Open Chats vs. Waiting on TSE)</li>
                <li>Each alert shows TSE name, alert type, and severity</li>
                <li>Click any TSE name to navigate directly to their TSE card</li>
                <li>"View All" button filters the TSE View to show only TSEs with alerts</li>
                <li>"View Chats" button navigates to Conversations View filtered to that TSE's conversations</li>
              </ul>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">⚠️</span>
                <strong>Alert Types & Severity</strong>
              </div>
              <p><strong>Two Alert Types:</strong></p>
              <ul>
                <li><strong>Open Chat Alerts:</strong> Triggered when a TSE has {THRESHOLDS.MAX_OPEN_ALERT} or more open conversations</li>
                <li><strong>Waiting On TSE Alerts:</strong> Triggered when a TSE has {THRESHOLDS.MAX_WAITING_ON_TSE_ALERT} or more conversations waiting on them (tagged "snooze.waiting-on-tse")</li>
              </ul>
              <p><strong>Severity Levels:</strong> Alerts are automatically assigned severity based on how far over the threshold:</p>
              <ul>
                <li><strong>High Severity (🔴):</strong> TSE exceeds threshold by 3+ conversations
                  <ul>
                    <li>Open Chats: {THRESHOLDS.MAX_OPEN_ALERT + 3}+ conversations</li>
                    <li>Waiting on TSE: {THRESHOLDS.MAX_WAITING_ON_TSE_ALERT + 3}+ conversations</li>
                  </ul>
                </li>
                <li><strong>Medium Severity (🟡):</strong> TSE exceeds threshold but by less than 3 conversations
                  <ul>
                    <li>Open Chats: {THRESHOLDS.MAX_OPEN_ALERT} to {THRESHOLDS.MAX_OPEN_ALERT + 2} conversations</li>
                    <li>Waiting on TSE: {THRESHOLDS.MAX_WAITING_ON_TSE_ALERT} to {THRESHOLDS.MAX_WAITING_ON_TSE_ALERT + 2} conversations</li>
                  </ul>
                </li>
              </ul>
              <p><strong>Real-Time Updates:</strong> Alerts update automatically as conversation counts change, ensuring you always have current information.</p>
            </div>
          </div>

          {/* Dashboard Section */}
          <div className="help-section-divider">
            <h2 className="help-section-divider-title">Dashboard</h2>
          </div>

          {/* Overview Dashboard Section */}
          <div id="overview-dashboard" className="help-section">
            <div className="help-section-header">
              <span className="help-section-icon">📊</span>
              <h3>Overview Dashboard</h3>
            </div>
            <p className="help-intro">The Overview Dashboard provides a comprehensive real-time snapshot of queue health, performance metrics, and key insights. It combines current status with historical trends to give you a complete picture of team performance.</p>
            
            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">💡</span>
                <strong>Key Insights Section</strong>
              </div>
              <p><strong>Location:</strong> Top of the Overview Dashboard</p>
              <p><strong>What It Shows:</strong> Dynamically generated insights highlighting important performance indicators, trends, and areas needing attention.</p>
              <p><strong>Insight Types:</strong></p>
              <ul>
                <li><strong>On-Track Performance:</strong> Current percentage of TSEs meeting targets, with status indicators (Strong ≥80%, Needs Attention &lt;60%)</li>
                <li><strong>Response Time Status:</strong> Current percentage of conversations with 10+ minute wait times, compared to target ({WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}%), and 5-10 minute wait times, compared to target (≤{WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}%)</li>
                <li><strong>Trend Indicators:</strong> Shows improving or declining trends for both on-track and wait rate metrics</li>
                <li><strong>Impact Insights:</strong> Correlation analysis and improvement potential from the Impact tab</li>
              </ul>
              <p><strong>Color Coding:</strong> Green borders indicate positive insights, red/orange borders indicate areas needing attention.</p>
              <p><strong>Why It Matters:</strong> Provides immediate context about what's important right now, helping prioritize attention and actions.</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">📈</span>
                <strong>Performance Metrics vs Yesterday</strong>
              </div>
              <p><strong>Location:</strong> Primary KPI card in "Today / Realtime Metrics" section</p>
              <p><strong>What It Shows:</strong> A comprehensive comparison card displaying both Wait Rate and On-Track metrics with day-over-day trends.</p>
              <p><strong>Wait Rate Section:</strong></p>
              <ul>
                <li><strong>Current Value:</strong> Most recent day's percentage of conversations with 5+ minute wait times</li>
                <li><strong>Breakdown:</strong> Shows three categories:
                  <ul>
                    <li><strong>5+ Min Wait %:</strong> Total percentage of conversations waiting 5+ minutes</li>
                    <li><strong>5-10 Min Wait %:</strong> Percentage waiting 5-10 minutes (subset of 5+)</li>
                    <li><strong>10+ Min Wait %:</strong> Percentage waiting 10+ minutes (subset of 5+)</li>
                  </ul>
                </li>
                <li><strong>Sparkline:</strong> Mini line graph showing the last 7 days of wait rate percentages</li>
                <li><strong>Trend Indicator:</strong> Shows change vs yesterday (↑ improving, ↓ worsening, → stable) with percentage change</li>
              </ul>
              <p><strong>On-Track Section:</strong></p>
              <ul>
                <li><strong>Current Value:</strong> Real-time on-track percentage (calculated from current conversation data)</li>
                <li><strong>Breakdown:</strong> Shows three metrics:
                  <ul>
                    <li><strong>Overall:</strong> Percentage meeting both thresholds</li>
                    <li><strong>Open:</strong> Percentage meeting open chats threshold only</li>
                    <li><strong>Snoozed:</strong> Percentage meeting waiting-on-TSE threshold only</li>
                  </ul>
                </li>
                <li><strong>Sparkline:</strong> Mini line graph showing the last 7 days of overall on-track percentages</li>
                <li><strong>Trend Indicator:</strong> Shows change vs yesterday with percentage change</li>
              </ul>
              <p><strong>Interaction:</strong> Click the card to open a detailed modal showing historical wait rate breakdowns and trends.</p>
              <p><strong>Calculation:</strong> Wait Rate uses the most recent response time metric (collected nightly). On-Track uses real-time conversation data.</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">⚡</span>
                <strong>Real-time Intercom Metrics</strong>
              </div>
              <p><strong>Location:</strong> "Today / Realtime Metrics" section</p>
              <p><strong>What It Shows:</strong> A combined card displaying four key real-time metrics from Intercom:</p>
              <ul>
                <li><strong>Avg Initial Response:</strong> Average time to first admin reply (in minutes)
                  <ul>
                    <li>Calculated from conversations created today during business hours</li>
                    <li>Trend compares last 7 days vs previous 7 days</li>
                  </ul>
                </li>
                <li><strong>Open Chats:</strong> Total count of active, non-snoozed conversations
                  <ul>
                    <li>Shows age breakdown: &lt;1h, 1-4h, 4-8h, 8h+</li>
                    <li>Includes hourly line graph showing conversations received per hour over the last 24 hours</li>
                  </ul>
                </li>
                <li><strong>Unassigned Conversations:</strong> Count of conversations without an assigned TSE
                  <ul>
                    <li>Color-coded: Green (≤5), Yellow (6-10), Red (11+)</li>
                    <li>Shows median wait time for unassigned conversations</li>
                  </ul>
                </li>
                <li><strong>Close Rate %:</strong> Percentage of conversations created today that were closed
                  <ul>
                    <li>Calculated from all conversations created today (PT timezone)</li>
                    <li>Trend compares last 7 days vs previous 7 days</li>
                    <li>Shows trend indicator (↑ improving, ↓ declining)</li>
                  </ul>
                </li>
              </ul>
              <p><strong>Data Source:</strong> All metrics calculated from real-time Intercom conversation data</p>
              <p><strong>Why It Matters:</strong> Provides immediate visibility into current operational status and customer experience metrics.</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">👥</span>
                <strong>Clickable Navigation Cards</strong>
              </div>
              <p><strong>SNOOZED Card:</strong></p>
              <ul>
                <li><strong>What:</strong> Shows total snoozed conversations with breakdown by type</li>
                <li><strong>Breakdown:</strong>
                  <ul>
                    <li><strong>Waiting on TSE:</strong> Conversations with "snooze.waiting-on-tse" tag</li>
                    <li><strong>Waiting On Customer - Resolved:</strong> Resolved conversations with "snooze.waiting-on-customer-resolved" tag</li>
                    <li><strong>Waiting On Customer - Unresolved:</strong> Unresolved conversations with "snooze.waiting-on-customer-unresolved" tag</li>
                  </ul>
                </li>
                <li><strong>Click Action:</strong> Navigates to Conversations View with all snoozed filters selected</li>
                <li><strong>Visual Indicator:</strong> Hover icon shows it's clickable</li>
              </ul>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">🌍</span>
                <strong>Region Performance Summary</strong>
              </div>
              <p><strong>Location:</strong> Secondary metrics section</p>
              <p><strong>What It Shows:</strong> On-track percentages by region (UK, NY, SF) with region-specific icons and color coding.</p>
              <p><strong>Calculation:</strong> For each region, calculates:</p>
              <ul>
                <li>Counts TSEs meeting both thresholds: ≤{THRESHOLDS.MAX_OPEN_SOFT} open chats AND ≤{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT} waiting on TSE</li>
                <li>On Track % = (On Track TSEs / Total TSEs in Region) × 100</li>
                <li>Uses the most recent historical snapshot data</li>
              </ul>
              <p><strong>Color Coding:</strong></p>
              <ul>
                <li><strong>Green (≥80%):</strong> Region meeting target performance</li>
                <li><strong>Yellow (60-79%):</strong> Region below target but acceptable</li>
                <li><strong>Red (&lt;60%):</strong> Region needs attention</li>
              </ul>
              <p><strong>Why It Matters:</strong> Identifies regional performance patterns and helps allocate resources or support where needed.</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">📊</span>
                <strong>Secondary Metrics Section</strong>
              </div>
              <p><strong>Additional Cards:</strong> The Overview Dashboard includes several secondary metric cards:</p>
              <ul>
                <li><strong>Conversation Aging:</strong> Breakdown of open conversations by age buckets (&lt;1h, 1-4h, 4-8h, 8h+)</li>
                <li><strong>Response Time Distribution:</strong> Mini chart showing distribution of response times</li>
                <li><strong>Improvement Potential:</strong> Shows potential wait time reduction if team maintains high (80-100%) on-track performance</li>
              </ul>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">📈</span>
                <strong>Trend Charts</strong>
              </div>
              <p><strong>Layout:</strong> Two main trend charts displayed side-by-side, each taking 50% of the width.</p>
              <p><strong>Team Daily On Track Percentage Trends:</strong></p>
              <ul>
                <li><strong>What:</strong> Multi-line chart showing three on-track metrics over the last 7 days</li>
                <li><strong>Lines:</strong>
                  <ul>
                    <li><strong>Overall On Track:</strong> Green line with solid stroke - percentage meeting both thresholds</li>
                    <li><strong>Open On Track:</strong> Blue line with solid stroke - percentage meeting open chats threshold</li>
                    <li><strong>Snoozed On Track:</strong> Orange line with solid stroke - percentage meeting waiting-on-TSE threshold</li>
                    <li><strong>Moving Averages:</strong> Dashed lines for each metric showing 3-day moving average</li>
                  </ul>
                </li>
                <li><strong>Target Line:</strong> Horizontal dashed line at 80% indicating the team target</li>
                <li><strong>Holiday Indicators:</strong> Icons mark holidays that may affect metrics</li>
                <li><strong>Data Source:</strong> Historical snapshots from the last 7 days</li>
              </ul>
              <p><strong>Percentage of Conversations with Wait Time:</strong></p>
              <ul>
                <li><strong>What:</strong> Multi-line chart showing wait time percentages over the last 7 days</li>
                <li><strong>Lines:</strong>
                  <ul>
                    <li><strong>5+ Min Wait %:</strong> Orange line - total percentage waiting 5+ minutes</li>
                    <li><strong>5-10 Min Wait %:</strong> Blue line - percentage waiting 5-10 minutes</li>
                    <li><strong>10+ Min Wait %:</strong> Red line - percentage waiting 10+ minutes</li>
                  </ul>
                </li>
                <li><strong>Target Lines:</strong> Horizontal dashed lines indicating targets: red line at {WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}% for 10+ Min Waits ({WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}%), orange line at {WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}% for 5-10 Min Waits (≤{WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}%)</li>
                <li><strong>Y-Axis:</strong> Scales dynamically up to 20% to ensure readability</li>
                <li><strong>Data Source:</strong> Response time metrics collected nightly</li>
              </ul>
              <p><strong>Why Both Charts:</strong> The side-by-side layout allows you to compare queue health (on-track) with customer experience (wait times) simultaneously, helping identify correlations.</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">ℹ️</span>
                <strong>Info Icons & Tooltips</strong>
              </div>
              <p><strong>What:</strong> Most KPI cards include an info icon (ℹ️) that provides detailed explanations when hovered or clicked.</p>
              <p><strong>Content:</strong> Tooltips explain what the metric measures, how it's calculated, and why it matters.</p>
              <p><strong>Positioning:</strong> Tooltips automatically position themselves to avoid being cut off (left, right, or top as needed).</p>
              <p><strong>Why:</strong> Helps users understand metrics without needing to reference documentation.</p>
            </div>
          </div>

          {/* TSE Queue Health Section */}
          <div className="help-section-divider">
            <h2 className="help-section-divider-title">TSE Queue Health</h2>
          </div>

          {/* TSE View Section */}
          <div id="tse-view" className="help-section">
            <div className="help-section-header">
              <span className="help-section-icon">👥</span>
              <h3>TSE View</h3>
            </div>
            <p className="help-intro">Monitor individual TSE performance with detailed metrics and filtering options.</p>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">⭐</span>
                <strong>TSE Status Indicators</strong>
              </div>
              <p><strong>Status Levels:</strong></p>
              <ul>
                <li>
                  <strong>
                    <span className="help-status-icon-inline status-exceeding">⭐️</span>
                    Outstanding
                  </strong> - 0 open chats AND 0 waiting on TSE. Purple badge with gold star icon.
                </li>
                <li>
                  <strong>
                    <span className="help-status-icon-inline status-success">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" fill="#4eec8d"/>
                        <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    On Track
                  </strong> - ≤{THRESHOLDS.MAX_OPEN_SOFT} open chats AND ≤{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT} waiting on TSE. Green badge with checkmark.
                </li>
                <li>
                  <strong>
                    <span className="help-status-icon-inline status-error">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" fill="#fd8789"/>
                        <path d="M8 8L16 16M16 8L8 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    Over Limit - Needs Attention
                  </strong> - &gt;{THRESHOLDS.MAX_OPEN_SOFT} open chats OR &gt;{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT} waiting on TSE. Red badge with X icon.
                </li>
              </ul>
              <p><strong>Tooltips:</strong> Hover or click status icons to see detailed counts and thresholds.</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">🎴</span>
                <strong>TSE Cards</strong>
              </div>
              <p><strong>What:</strong> Individual cards for each TSE showing their current status and metrics.</p>
              <p><strong>Contains:</strong></p>
              <ul>
                <li>TSE name with status icon</li>
                <li>Avatar (if available)</li>
                <li>Away mode indicator (🌙) if enabled</li>
                <li>Open chats count</li>
                <li>Waiting on TSE count</li>
                <li>Waiting on Customer count</li>
                <li>Total snoozed count</li>
              </ul>
              <p><strong>Interaction:</strong> Click any TSE card to open detailed modal with conversation breakdown.</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">🔍</span>
                <strong>Filters</strong>
              </div>
              <p><strong>Region Filters:</strong> Checkboxes to filter by 
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', margin: '0 4px' }}>
                  <img src={REGION_ICONS['UK']} alt="UK" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }} />
                  UK
                </span>, 
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', margin: '0 4px' }}>
                  <img 
                    src={isDarkMode ? 'https://res.cloudinary.com/doznvxtja/image/upload/v1768716963/3_150_x_150_px_16_ozl21j.svg' : REGION_ICONS['NY']} 
                    alt="NY" 
                    style={{ width: '16px', height: '16px', verticalAlign: 'middle' }} 
                  />
                  NY
                </span>, 
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', margin: '0 4px' }}>
                  <img src={REGION_ICONS['SF']} alt="SF" style={{ width: '16px', height: '16px', verticalAlign: 'middle' }} />
                  SF
                </span>, or Other. Click region icons to select/deselect.</p>
              <p><strong>Status Filters:</strong> Color-coded buttons to filter by status (Outstanding, On Track, Over Limit).</p>
              <p><strong>How:</strong> Filters combine - selected regions AND selected statuses.</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">🔥</span>
                <strong>Outstanding Performance Streaks</strong>
              </div>
              <p><strong>What:</strong> TSEs with 3+ consecutive days of Outstanding status (0 open, 0 waiting on TSE).</p>
              <p><strong>How:</strong> Analyzes historical snapshots to find consecutive Outstanding days. Streaks are calculated backwards from the most recent date. Tiebreakers: (1) Longer streaks, (2) Total outstanding days in history.</p>
              <p><strong>Why:</strong> Recognizes consistent excellence and motivates continued performance. Click any TSE avatar to view their details.</p>
              <p><strong>Filtering:</strong> Use region buttons (All Regions, UK, NY, SF) to filter by location.</p>
            </div>
          </div>

          {/* TSE Details Modal Section */}
          <div id="tse-details-modal" className="help-section">
            <div className="help-section-header">
              <span className="help-section-icon">🔍</span>
              <h3>TSE Details Modal & Performance Scorecard</h3>
            </div>
            <p className="help-intro">A comprehensive performance scorecard providing detailed insights into a TSE's current status, historical trends, and conversation breakdown. Accessed by clicking on any TSE card in the TSE View.</p>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">👤</span>
                <strong>Header Information</strong>
              </div>
              <p><strong>Contains:</strong></p>
              <ul>
                <li>TSE name with status icon (Outstanding ⭐, On Track ✓, Over Limit ✗)</li>
                <li>Region indicator with region-specific icon (UK, NY, SF)</li>
                <li>Status badge showing current status level</li>
                <li>Away mode indicator (🌙) if enabled</li>
                <li>TSE avatar/profile picture</li>
              </ul>
              <p><strong>Status Tooltip:</strong> Click the status icon to see a detailed breakdown showing:</p>
              <ul>
                <li>Current counts (open, waiting on TSE)</li>
                <li>Thresholds (target values)</li>
                <li>Whether each threshold is being met</li>
              </ul>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">📊</span>
                <strong>Performance Scorecard</strong>
              </div>
              <p><strong>Location:</strong> Top section of the modal, before conversation breakdown</p>
              <p><strong>What It Shows:</strong> Comprehensive performance metrics calculated from historical snapshots:</p>
              <ul>
                <li><strong>On-Track %:</strong> Percentage of tracked days the TSE met both thresholds
                  <ul>
                    <li>Color-coded: Green (≥80%), Yellow (60-79%), Red (&lt;60%)</li>
                    <li>Shows total days tracked</li>
                  </ul>
                </li>
                <li><strong>Avg Open Chats:</strong> Average number of open conversations over tracked period
                  <ul>
                    <li>Color-coded: Green (≤{THRESHOLDS.MAX_OPEN_SOFT}), Red (&gt;{THRESHOLDS.MAX_OPEN_SOFT})</li>
                    <li>Shows target threshold</li>
                  </ul>
                </li>
                <li><strong>Avg Waiting on TSE:</strong> Average number of conversations waiting on TSE over tracked period
                  <ul>
                    <li>Color-coded: Green (≤{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT}), Red (&gt;{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT})</li>
                    <li>Shows target threshold</li>
                  </ul>
                </li>
                <li><strong>Trend:</strong> Performance trend indicator
                  <ul>
                    <li>Shows improving (↑), worsening (↓), or stable (→)</li>
                    <li>Displays percentage change</li>
                    <li>Compares last 7 days vs previous 7 days (if 14+ days of data), or recent half vs earlier half</li>
                  </ul>
                </li>
              </ul>
              <p><strong>Performance Over Time Chart:</strong></p>
              <ul>
                <li>Line chart showing daily open chats and waiting-on-TSE counts</li>
                <li>Two data series: "Open Chats" (blue) and "Waiting on TSE" (red)</li>
                <li>Reference lines show target thresholds (dashed yellow lines)</li>
                <li>Legend includes both data lines and target lines</li>
                <li>Tooltips show exact values for each day</li>
                <li>X-axis shows dates, Y-axis shows counts</li>
              </ul>
              <p><strong>Key Insights:</strong> Automatically generated insights highlighting:</p>
              <ul>
                <li>Performance status (excellent, needs attention)</li>
                <li>Threshold violations (if averages exceed targets)</li>
                <li>Trend direction (improving or declining)</li>
              </ul>
              <p><strong>Best/Worst Days:</strong> Highlights the day with lowest combined workload (best) and highest combined workload (worst), showing exact counts.</p>
              <p><strong>Data Source:</strong> Calculated from all available historical snapshots containing this TSE. Requires at least one historical snapshot to display.</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">💬</span>
                <strong>Conversation Breakdown</strong>
              </div>
              <p><strong>Location:</strong> Bottom section of the modal</p>
              <p><strong>Sections:</strong> Four separate sections showing different conversation categories:</p>
              <ul>
                <li><strong>Open Conversations:</strong> Active, non-snoozed conversations assigned to this TSE
                  <ul>
                    <li>Shows conversation ID (clickable to open in Intercom)</li>
                    <li>Shows author email</li>
                    <li>Shows creation date/time</li>
                  </ul>
                </li>
                <li><strong>Snoozed - Waiting On TSE:</strong> Conversations snoozed with "snooze.waiting-on-tse" tag
                  <ul>
                    <li>These count toward the waiting-on-TSE threshold</li>
                    <li>Indicates conversations where the TSE needs to take action</li>
                  </ul>
                </li>
                <li><strong>Snoozed - Waiting On Customer:</strong> Conversations snoozed with "snooze.waiting-on-customer" tags
                  <ul>
                    <li>Includes both resolved and unresolved customer-wait conversations</li>
                    <li>These do NOT count toward the waiting-on-TSE threshold</li>
                  </ul>
                </li>
                <li><strong>Total Snoozed:</strong> All snoozed conversations regardless of tag
                  <ul>
                    <li>Includes conversations that may not have proper tags</li>
                    <li>Useful for identifying tagging issues</li>
                  </ul>
                </li>
              </ul>
              <p><strong>Interaction:</strong> Click any conversation ID to open it directly in Intercom in a new tab.</p>
              <p><strong>Empty States:</strong> If a category has no conversations, displays "No conversations" message.</p>
            </div>
          </div>

          {/* Intercom Data Section */}
          <div className="help-section-divider">
            <h2 className="help-section-divider-title">Intercom Data</h2>
          </div>

          {/* Conversations View Section */}
          <div id="conversations-view" className="help-section">
            <div className="help-section-header">
              <span className="help-section-icon">💬</span>
              <h3>Conversations View</h3>
            </div>
            <p className="help-intro">Browse, search, and filter all Intercom conversations with advanced filtering options. This view provides direct access to conversation details and enables quick navigation to specific conversations in Intercom.</p>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">🔽</span>
                <strong>Snooze Type Filter</strong>
              </div>
              <p><strong>Purpose:</strong> Filter conversations by their snooze status and tags, helping you focus on specific workflow states.</p>
              <p><strong>Filter Options:</strong></p>
              <ul>
                <li><strong>All Conversations:</strong> Shows all open and snoozed conversations (default view)</li>
                <li><strong>All Snoozed:</strong> All snoozed conversations regardless of tag - useful for identifying untagged snoozed conversations</li>
                <li><strong>Snoozed - Waiting On TSE:</strong> Conversations with "snooze.waiting-on-tse" tag - these count toward the waiting-on-TSE threshold</li>
                <li><strong>Snoozed - Waiting On Customer:</strong> All conversations with any "snooze.waiting-on-customer" tag (includes both resolved and unresolved)</li>
                <li><strong>Waiting On Customer - Resolved:</strong> Resolved conversations with "snooze.waiting-on-customer-resolved" tag</li>
                <li><strong>Waiting On Customer - Unresolved:</strong> Unresolved conversations with "snooze.waiting-on-customer-unresolved" tag</li>
              </ul>
              <p><strong>Tag Importance:</strong> Proper tagging is critical for accurate metrics. Conversations without proper tags won't be counted correctly in threshold calculations.</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">👤</span>
                <strong>TSE Filter</strong>
              </div>
              <p><strong>Purpose:</strong> Filter conversations by assigned TSE or show unassigned conversations.</p>
              <p><strong>Filter Options:</strong></p>
              <ul>
                <li><strong>All TSEs:</strong> Shows conversations assigned to any TSE (default)</li>
                <li><strong>Unassigned:</strong> Shows only conversations without an assigned TSE - critical for identifying workload distribution issues</li>
                <li><strong>Specific TSE:</strong> Filter by individual TSE, organized by region (UK, NY, SF, Other)
                  <ul>
                    <li>Expandable checkboxes grouped by region</li>
                    <li>Select multiple TSEs to see combined conversations</li>
                  </ul>
                </li>
              </ul>
              <p><strong>Use Cases:</strong></p>
              <ul>
                <li>Review a specific TSE's workload</li>
                <li>Identify unassigned conversations needing assignment</li>
                <li>Compare conversations across multiple TSEs</li>
              </ul>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">🔎</span>
                <strong>Search by Conversation ID</strong>
              </div>
              <p><strong>What:</strong> Text input field to search for specific conversation IDs</p>
              <p><strong>How:</strong> Enter a conversation ID (partial or full) to filter the table to matching conversations</p>
              <p><strong>Use Case:</strong> Quickly locate a specific conversation when you have the ID from another source</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">📋</span>
                <strong>Conversation Table</strong>
              </div>
              <p><strong>Columns:</strong></p>
              <ul>
                <li><strong>Conversation ID:</strong> Unique identifier, clickable to open in Intercom</li>
                <li><strong>Assignee:</strong> TSE name assigned to the conversation, or "Unassigned"</li>
                <li><strong>State:</strong> Conversation state (open, snoozed, closed)</li>
                <li><strong>Tags:</strong> All tags applied to the conversation, including snooze tags</li>
                <li><strong>Last Updated:</strong> Timestamp of last activity</li>
                <li><strong>Created:</strong> Timestamp when conversation was created</li>
                <li><strong>Author:</strong> Customer email who initiated the conversation</li>
              </ul>
              <p><strong>Interactions:</strong></p>
              <ul>
                <li><strong>Click Conversation ID:</strong> Opens the conversation directly in Intercom in a new tab</li>
                <li><strong>Sorting:</strong> Click column headers to sort ascending/descending</li>
                <li><strong>Resizable Columns:</strong> Drag column borders to adjust widths</li>
              </ul>
              <p><strong>Empty State:</strong> If no conversations match filters, displays "No conversations found" message</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">⚡</span>
                <strong>Quick Filter Buttons</strong>
              </div>
              <p><strong>Purpose:</strong> One-click shortcuts to common filter combinations</p>
              <p><strong>Buttons:</strong></p>
              <ul>
                <li><strong>Show Unassigned:</strong> Instantly filters to show only unassigned conversations</li>
                <li><strong>Show Snoozed:</strong> Filters to show all snoozed conversations</li>
                <li><strong>Show Open:</strong> Filters to show only open (non-snoozed) conversations</li>
                <li><strong>Clear:</strong> Resets all filters to default (All Conversations, All TSEs)</li>
              </ul>
              <p><strong>Filter Combination:</strong> Quick filter buttons work with other filters - they set the snooze/TSE filter but don't clear other selections</p>
            </div>

            <div className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">🔄</span>
                <strong>Navigation from Other Views</strong>
              </div>
              <p><strong>From Overview Dashboard:</strong></p>
              <ul>
                <li>Click "OPEN CHATS" card → Navigates to Conversations View filtered to open conversations</li>
                <li>Click "SNOOZED" card → Navigates to Conversations View filtered to all snoozed conversations</li>
              </ul>
              <p><strong>From TSE View:</strong></p>
              <ul>
                <li>Click any TSE card → Opens TSE Details Modal (not Conversations View)</li>
                <li>Use TSE filter in Conversations View to see a specific TSE's conversations</li>
              </ul>
            </div>
          </div>

          {/* Analytics Section */}
          <div className="help-section-divider">
            <h2 className="help-section-divider-title">TRENDS & INSIGHTS</h2>
          </div>

          {/* Historical View Section */}
          <div id="historical-view" className="help-section">
            <div className="help-section-header">
              <span className="help-section-icon">📈</span>
              <h3>ANALYTICS</h3>
            </div>
            <p className="help-intro">Analyze trends, patterns, and correlations over time with three specialized tabs.</p>

            <div id="daily-on-track-trends" className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">📊</span>
                <strong>Daily On Track Trends Tab</strong>
              </div>
              <p><strong>Purpose:</strong> Comprehensive analysis of on-track performance trends over time, helping identify patterns, trends, and areas for improvement.</p>
              
              <p><strong>Date Range Selector:</strong> Choose from preset ranges or select a custom date range:</p>
              <ul>
                <li><strong>Yesterday:</strong> Most recent completed day</li>
                <li><strong>Last 7 Weekdays:</strong> Last 7 business days (excludes weekends)</li>
                <li><strong>Last 30 Days:</strong> Last 30 calendar days</li>
                <li><strong>Last 90 Days:</strong> Last 90 calendar days</li>
                <li><strong>Custom Range:</strong> Select any start and end date</li>
              </ul>
              <p><strong>Note:</strong> Date range affects all charts, tables, and calculations on this tab.</p>

              <p><strong>TSE Filter:</strong> Select specific TSEs to analyze:</p>
              <ul>
                <li>Expandable checkboxes organized by region (UK, NY, SF, Other)</li>
                <li>"Select All" and "Unselect All" buttons for quick selection</li>
                <li>Filters apply to all visualizations and calculations</li>
                <li>If no TSEs selected, shows data for all TSEs (excluding admins)</li>
              </ul>

              <p><strong>Summary Cards:</strong> Three KPI cards at the top showing averages over the selected period:</p>
              <ul>
                <li><strong>Overall On Track:</strong> Average percentage of TSEs meeting both thresholds</li>
                <li><strong>Open On Track:</strong> Average percentage of TSEs meeting the open chats threshold (≤{THRESHOLDS.MAX_OPEN_SOFT})</li>
                <li><strong>Snoozed On Track:</strong> Average percentage of TSEs meeting the waiting-on-TSE threshold (≤{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT})</li>
              </ul>
              <p><strong>Calculation:</strong> Each card shows the average of daily percentages across all days in the selected range.</p>

              <p><strong>Team Daily On Track Percentage Trends Chart:</strong></p>
              <ul>
                <li><strong>Type:</strong> Multi-line chart with moving averages</li>
                <li><strong>Lines:</strong>
                  <ul>
                    <li><strong>Overall On Track:</strong> Green solid line - percentage meeting both thresholds</li>
                    <li><strong>Moving Avg (Overall):</strong> Green dashed line - 3-day moving average</li>
                    <li><strong>Open On Track:</strong> Blue solid line - percentage meeting open threshold</li>
                    <li><strong>Moving Avg (Open):</strong> Blue dashed line - 3-day moving average</li>
                    <li><strong>Snoozed On Track:</strong> Orange solid line - percentage meeting waiting-on-TSE threshold</li>
                    <li><strong>Moving Avg (Snoozed):</strong> Orange dashed line - 3-day moving average</li>
                  </ul>
                </li>
                <li><strong>Target Line:</strong> Horizontal dashed line at 80% indicating team target</li>
                <li><strong>Y-Axis:</strong> 0-100% scale</li>
                <li><strong>Holiday Indicators:</strong> Icons mark holidays that may affect metrics</li>
                <li><strong>Tooltips:</strong> Show exact percentages for each metric on each day</li>
              </ul>

              <p><strong>On-Track Calculation Details:</strong></p>
              <ul>
                <li><strong>For Each Day:</strong>
                  <ul>
                    <li>Counts TSEs meeting both thresholds: ≤{THRESHOLDS.MAX_OPEN_SOFT} open AND ≤{THRESHOLDS.MAX_WAITING_ON_TSE_SOFT} waiting on TSE</li>
                    <li>Overall On Track % = (TSEs meeting both / Total TSEs) × 100</li>
                    <li>Open On Track % = (TSEs meeting open threshold / Total TSEs) × 100</li>
                    <li>Snoozed On Track % = (TSEs meeting waiting-on-TSE threshold / Total TSEs) × 100</li>
                  </ul>
                </li>
                <li><strong>Moving Average:</strong> Calculated as the average of the current day and the two previous days (3-day window)</li>
                <li><strong>Exclusions:</strong> Admin TSEs (Prerit Sachdeva, Stephen Skalamera) are excluded from calculations</li>
              </ul>

              <p><strong>Insights Section:</strong></p>
              <ul>
                <li><strong>Trend Analysis Card:</strong>
                  <ul>
                    <li>Compares first half vs second half of selected period</li>
                    <li>Shows trend indicator: Improving (↑), Declining (↓), or Stable (→)</li>
                    <li>Displays percentage change between halves</li>
                    <li>Shows volatility metric (standard deviation) indicating consistency</li>
                    <li>Color-coded: Green for improving, Red for declining</li>
                  </ul>
                </li>
                <li><strong>Best/Worst Days Card:</strong>
                  <ul>
                    <li>Highlights the day with highest overall on-track percentage (best)</li>
                    <li>Highlights the day with lowest overall on-track percentage (worst)</li>
                    <li>Shows breakdown by Open On Track and Snoozed On Track for each day</li>
                    <li>Displays exact percentages and counts</li>
                  </ul>
                </li>
              </ul>

              <p><strong>Day-of-Week Analysis:</strong></p>
              <ul>
                <li><strong>Type:</strong> Bar chart showing average on-track percentages by weekday</li>
                <li><strong>Days:</strong> Monday through Friday (weekends excluded)</li>
                <li><strong>Metrics:</strong> Shows Overall, Open, and Snoozed on-track averages for each weekday</li>
                <li><strong>Purpose:</strong> Identifies if certain days of the week consistently perform better or worse</li>
              </ul>

              <p><strong>Region Comparison:</strong></p>
              <ul>
                <li><strong>Type:</strong> Bar chart comparing average on-track across regions</li>
                <li><strong>Regions:</strong> UK, NY, SF (with region-specific icons)</li>
                <li><strong>Metrics:</strong> Shows Overall, Open, and Snoozed on-track averages per region</li>
                <li><strong>Purpose:</strong> Identifies regional performance differences</li>
              </ul>

              <p><strong>TSE Average On Track:</strong></p>
              <ul>
                <li><strong>Type:</strong> Horizontal bar chart</li>
                <li><strong>What:</strong> Shows individual TSE average on-track percentage over the selected period</li>
                <li><strong>Sorting:</strong> Sorted by performance (highest to lowest)</li>
                <li><strong>Color Coding:</strong> Green bars for high performers, red for low performers</li>
                <li><strong>Purpose:</strong> Identifies top and bottom performers for targeted coaching</li>
              </ul>

              <p><strong>Detailed Table:</strong></p>
              <ul>
                <li><strong>Columns:</strong> Date, Overall On Track %, Open On Track %, Snoozed On Track %, Total TSEs, Avg Open, Avg Waiting on TSE</li>
                <li><strong>Sorting:</strong> Click column headers to sort ascending/descending</li>
                <li><strong>Expandable Rows:</strong> Click any row to expand and see:
                  <ul>
                    <li>Individual TSE performance for that day</li>
                    <li>Each TSE's open count, waiting-on-TSE count, and on-track status</li>
                  </ul>
                </li>
                <li><strong>Holiday Indicators:</strong> Icons mark holidays in the date column</li>
              </ul>

              <p><strong>Why This Tab Matters:</strong> Provides deep insights into performance patterns, helping identify trends, day-of-week effects, regional differences, and individual TSE performance. Essential for data-driven decision making and performance improvement.</p>
            </div>

            <div id="response-time-metrics" className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">⏱️</span>
                <strong>Response Time Metrics Tab</strong>
              </div>
              <p><strong>Purpose:</strong> Comprehensive analysis of first response times, focusing on customer experience quality by tracking conversations with extended wait times before the first admin reply.</p>
              
              <p><strong>Targets:</strong> The goal is to keep the percentage of conversations with 10+ minute wait times at {WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}% and 5-10 minute wait times at or below {WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}%.</p>

              <p><strong>Date Range & TSE Filter:</strong> Same as Daily On Track Trends tab - select date range and TSEs to analyze. Filters apply to all visualizations.</p>

              <p><strong>Data Collection:</strong></p>
              <ul>
                <li><strong>When:</strong> Metrics are automatically collected nightly after all shifts have completed (via scheduled cron jobs)</li>
                <li><strong>What:</strong> Analyzes conversations from the most recently completed business day</li>
                <li><strong>Data Source:</strong> Intercom conversation data, specifically first admin reply timestamps</li>
                <li><strong>Banner:</strong> Information banner at the top explains the data collection process</li>
              </ul>

              <p><strong>Wait Time Categories:</strong></p>
              <ul>
                <li><strong>5+ Min Wait:</strong> Conversations with first response time ≥5 minutes (total)</li>
                <li><strong>5-10 Min Wait:</strong> Conversations waiting 5-10 minutes (subset of 5+)</li>
                <li><strong>10+ Min Wait:</strong> Conversations waiting ≥10 minutes (subset of 5+)</li>
              </ul>
              <p><strong>Note:</strong> 5-10 Min and 10+ Min are mutually exclusive categories that together equal 5+ Min.</p>

              <p><strong>Summary KPI Cards:</strong> Four cards showing key metrics:</p>
              <ul>
                <li><strong>TOTAL CONVERSATIONS:</strong> Sum of all conversations across selected date range</li>
                <li><strong>TOTAL WAITS:</strong> Total count of conversations with 5+ minute wait times</li>
                <li><strong>RECENT TREND:</strong> Shows change vs yesterday with trend indicator (improving ↓, worsening ↑)</li>
                <li><strong>WORST DAY (HIGHEST %):</strong> The day with highest percentage of slow responses, showing exact percentage and counts</li>
              </ul>

              <p><strong>Percentage of Conversations with Wait Time Chart:</strong></p>
              <ul>
                <li><strong>Type:</strong> Multi-line chart showing three wait time categories</li>
                <li><strong>Lines:</strong>
                  <ul>
                    <li><strong>5+ Min Wait %:</strong> Orange line - total percentage waiting 5+ minutes</li>
                    <li><strong>5-10 Min Wait %:</strong> Blue line - percentage waiting 5-10 minutes</li>
                    <li><strong>10+ Min Wait %:</strong> Red line - percentage waiting 10+ minutes</li>
                  </ul>
                </li>
                <li><strong>Target Lines:</strong> Horizontal dashed lines indicating targets: red line at {WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}% for 10+ Min Waits ({WAIT_TIME_TARGETS.TARGET_10_PLUS_MIN}%), orange line at {WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}% for 5-10 Min Waits (≤{WAIT_TIME_TARGETS.TARGET_5_TO_10_MIN}%)</li>
                <li><strong>Y-Axis:</strong> Scales dynamically up to 20% (or higher if needed) to ensure readability</li>
                <li><strong>Legend:</strong> Ordered to show 5+ Min first, then 5-10 Min, then 10+ Min</li>
                <li><strong>Holiday Indicators:</strong> Icons mark holidays</li>
                <li><strong>Tooltips:</strong> Show exact percentages and counts for each category</li>
              </ul>

              <p><strong>Calculation Formula:</strong></p>
              <ul>
                <li>For each day: Wait Time % = (Conversations with wait time ≥5 min / Total conversations with responses) × 100</li>
                <li>Only conversations with a first admin reply are included in calculations</li>
                <li>Wait time = Time between conversation creation and first admin reply</li>
              </ul>

              <p><strong>Insights Section:</strong></p>
              <ul>
                <li><strong>Trend Analysis:</strong>
                  <ul>
                    <li>Compares first half vs second half of selected period</li>
                    <li>Shows trend indicator: Improving (↓), Declining (↑), or Stable (→)</li>
                    <li>Displays percentage change between halves</li>
                    <li>Shows volatility metric (standard deviation)</li>
                    <li>Includes 7-day moving average for smoothing</li>
                  </ul>
                </li>
                <li><strong>Period Comparison:</strong>
                  <ul>
                    <li>Compares Previous 7 Days vs Current 7 Days</li>
                    <li>Shows all-time average for context</li>
                    <li>Indicates if current period is above or below all-time average</li>
                  </ul>
                </li>
                <li><strong>Best/Worst Days:</strong>
                  <ul>
                    <li>Best Day: Lowest percentage of slow responses</li>
                    <li>Worst Day: Highest percentage of slow responses</li>
                    <li>Shows breakdown: slow count vs total conversations for each day</li>
                  </ul>
                </li>
              </ul>

              <p><strong>Day-of-Week Analysis:</strong></p>
              <ul>
                <li><strong>Type:</strong> Dual-axis bar chart</li>
                <li><strong>Left Y-Axis:</strong> Average percentage of slow conversations</li>
                <li><strong>Right Y-Axis:</strong> Average count of slow conversations</li>
                <li><strong>Days:</strong> Monday through Friday</li>
                <li><strong>Purpose:</strong> Identifies if certain weekdays consistently have better or worse response times</li>
              </ul>

              <p><strong>Volume vs Performance Correlation:</strong></p>
              <ul>
                <li><strong>Type:</strong> Scatter plot</li>
                <li><strong>X-Axis:</strong> Total conversation volume (count)</li>
                <li><strong>Y-Axis:</strong> Slow response percentage</li>
                <li><strong>Each Point:</strong> Represents one day's data</li>
                <li><strong>Correlation Coefficient:</strong> Shows strength (Weak &lt;0.3, Moderate 0.3-0.7, Strong &gt;0.7) and direction (Positive/Negative)</li>
                <li><strong>Interpretation:</strong> Helps understand if higher volume correlates with slower response times</li>
              </ul>

              <p><strong>Detailed Table:</strong></p>
              <ul>
                <li><strong>Columns:</strong> Date, Total Conversations, 5+ Min Waits (count), 5+ Min %, 5-10 Min Waits (count), 5-10 Min %, 10+ Min Waits (count), 10+ Min %</li>
                <li><strong>Sorting:</strong> Click column headers to sort</li>
                <li><strong>Expandable Rows:</strong> Click any row to see:
                  <ul>
                    <li>Individual conversation IDs with 5+ minute wait times</li>
                    <li>Exact wait time for each conversation (in minutes)</li>
                    <li>Conversation creation and first reply timestamps</li>
                    <li>Assigned TSE information</li>
                  </ul>
                </li>
              </ul>

              <p><strong>Why This Tab Matters:</strong> Response time directly impacts customer satisfaction. This tab helps identify patterns, volume impacts, and trends in response time performance, enabling data-driven improvements to customer experience.</p>
            </div>

            <div id="impact" className="help-feature">
              <div className="help-feature-title">
                <span className="help-feature-icon">🔗</span>
                <strong>Impact Tab</strong>
              </div>
              <p><strong>Purpose:</strong> Analyzes the correlation between queue health (on-track status) and customer experience (response times), answering the critical question: "Does maintaining on-track status improve or worsen response times?"</p>
              
              <p><strong>Key Question:</strong> Is there a relationship between how well TSEs manage their queues (on-track %) and how quickly customers receive responses?</p>

              <p><strong>Date Range & TSE Filter:</strong> Shared with other Analytics tabs. Select date range and TSEs to analyze.</p>

              <p><strong>Correlation KPI Cards:</strong> Four cards showing correlation metrics:</p>
              <ul>
                <li><strong>5+ Min Wait Correlation:</strong> Correlation between on-track % and 5+ minute wait rate
                  <ul>
                    <li>Shows correlation coefficient (-1 to +1)</li>
                    <li>Strength: Weak (&lt;0.3), Moderate (0.3-0.7), Strong (&gt;0.7)</li>
                    <li>Direction: Positive or Negative</li>
                    <li>Color-coded: Green for negative correlation (desired), Red for positive correlation (concerning)</li>
                  </ul>
                </li>
                <li><strong>5-10 Min Wait Correlation:</strong> Same analysis for 5-10 minute wait category</li>
                <li><strong>10+ Min Wait Correlation:</strong> Same analysis for 10+ minute wait category</li>
                <li><strong>Improvement Potential:</strong> Shows potential wait time reduction if team maintains high (80-100%) on-track performance
                  <ul>
                    <li>Displays potential reduction for 5-10 min and 10+ min categories</li>
                    <li>Color-coded: Green for reductions (positive), Red for increases (negative/concerning)</li>
                    <li>Based on comparing current averages vs high-performance-day averages</li>
                  </ul>
                </li>
              </ul>

              <p><strong>Correlation Interpretation:</strong></p>
              <ul>
                <li><strong>Negative Correlation (Desired):</strong> Higher on-track % → Lower wait times
                  <ul>
                    <li>Indicates that better queue management leads to faster customer responses</li>
                    <li>Validates that on-track efforts improve customer experience</li>
                    <li>Shown in green</li>
                  </ul>
                </li>
                <li><strong>Positive Correlation (Concerning):</strong> Higher on-track % → Higher wait times
                  <ul>
                    <li>Would suggest that on-track efforts might be slowing down responses</li>
                    <li>Would indicate a need to review processes</li>
                    <li>Shown in red</li>
                  </ul>
                </li>
                <li><strong>Weak Correlation:</strong> Little to no relationship between metrics</li>
              </ul>

              <p><strong>Scatter Plot:</strong></p>
              <ul>
                <li><strong>Type:</strong> Scatter plot visualization</li>
                <li><strong>X-Axis:</strong> On-track percentage (0-100%)</li>
                <li><strong>Y-Axis:</strong> Slow response rate percentage (5+ minute waits)</li>
                <li><strong>Each Point:</strong> Represents one day's data</li>
                <li><strong>Purpose:</strong> Visual identification of patterns, trends, and outliers</li>
                <li><strong>Trend Line:</strong> Shows the overall relationship direction</li>
              </ul>

              <p><strong>Performance by On-Track Range:</strong></p>
              <ul>
                <li><strong>What:</strong> Three cards grouping days by on-track performance level</li>
                <li><strong>Ranges:</strong>
                  <ul>
                    <li><strong>High (80-100%):</strong> Days when 80%+ of TSEs were on-track</li>
                    <li><strong>Medium (60-79%):</strong> Days when 60-79% of TSEs were on-track</li>
                    <li><strong>Low (0-59%):</strong> Days when less than 60% of TSEs were on-track</li>
                  </ul>
                </li>
                <li><strong>Each Card Shows:</strong>
                  <ul>
                    <li>Number of days in that range</li>
                    <li>Average on-track percentage for those days</li>
                    <li>Average slow response rate percentage</li>
                    <li>Total slow responses and total conversations</li>
                  </ul>
                </li>
                <li><strong>Color Coding:</strong> Green border (High), Yellow border (Medium), Red border (Low)</li>
                <li><strong>Purpose:</strong> Compare response time performance across different on-track performance levels</li>
              </ul>

              <p><strong>Trend Over Time Chart:</strong></p>
              <ul>
                <li><strong>Type:</strong> Dual-axis line chart</li>
                <li><strong>Left Y-Axis:</strong> On-track percentage (green line)</li>
                <li><strong>Right Y-Axis:</strong> Slow response rate percentage (red line)</li>
                <li><strong>Purpose:</strong> Visualize how both metrics change together over time</li>
                <li><strong>Interpretation:</strong> When lines move in opposite directions (green up, red down), it indicates negative correlation - desired outcome</li>
              </ul>

              <p><strong>Correlation Calculation:</strong></p>
              <ul>
                <li><strong>Method:</strong> Pearson correlation coefficient</li>
                <li><strong>Formula:</strong> Measures linear relationship between two variables</li>
                <li><strong>Data Points:</strong> Requires at least 3 days of matching data (on-track snapshot + response time metric for same date)</li>
                <li><strong>Result Range:</strong> -1 (perfect negative correlation) to +1 (perfect positive correlation)</li>
                <li><strong>Zero:</strong> No correlation</li>
              </ul>

              <p><strong>Improvement Potential Calculation:</strong></p>
              <ul>
                <li><strong>Method:</strong> Compares current average wait rates vs wait rates on high-performance days (80-100% on-track)</li>
                <li><strong>Formula:</strong> Improvement = Current Average - High-Performance Average</li>
                <li><strong>Positive Value:</strong> Indicates potential reduction (green) - maintaining high on-track could reduce wait times</li>
                <li><strong>Negative Value:</strong> Indicates potential increase (red) - concerning, suggests high on-track days had worse wait times</li>
                <li><strong>Requires:</strong> At least one day with 80%+ on-track performance in the selected range</li>
              </ul>

              <p><strong>What If Scenario:</strong></p>
              <ul>
                <li><strong>Visualization:</strong> Chart showing potential impact of maintaining high on-track performance</li>
                <li><strong>Shows:</strong> Current vs projected wait time percentages</li>
                <li><strong>Purpose:</strong> Quantifies the potential customer experience improvement from better queue management</li>
              </ul>

              <p><strong>Why This Tab Matters:</strong> Validates whether queue management efforts (maintaining on-track status) actually improve customer experience. A negative correlation proves that better queue health leads to faster responses, justifying the focus on on-track metrics. This data-driven approach helps prioritize initiatives and measure impact.</p>
            </div>
          </div>

          {/* Back to Top Button */}
          <button className="help-back-to-top" onClick={scrollToTop} aria-label="Back to top">
            ↑ Back to Top
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

