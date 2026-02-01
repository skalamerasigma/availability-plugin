interface AudioToggleProps {
  isAudioEnabled: boolean
  onToggle: () => void
}

export function AudioToggle({ isAudioEnabled, onToggle }: AudioToggleProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '80px', // Positioned to the left of dark mode toggle
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
      aria-label={isAudioEnabled ? 'Disable audio alerts' : 'Enable audio alerts'}
      title={isAudioEnabled ? 'Disable audio alerts' : 'Enable audio alerts'}
    >
      {isAudioEnabled ? '🔊' : '🔇'}
    </button>
  )
}
