interface DarkModeToggleProps {
  isDarkMode: boolean
  onToggle: () => void
}

export function DarkModeToggle({ isDarkMode, onToggle }: DarkModeToggleProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: `2px solid var(--border-color)`,
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        boxShadow: 'var(--shadow-md)',
        transition: 'all 0.3s ease',
        zIndex: 1000,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)'
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
      }}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDarkMode ? '☀️' : '🌙'}
    </button>
  )
}
