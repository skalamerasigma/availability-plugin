export function Legend() {
  const items = [
    { emoji: '🟢', label: 'Available' },
    { emoji: '🚫', label: 'Off Chat' },
    { emoji: '☕', label: 'On a break' },
    { emoji: '🎯', label: 'Focus Time' },
    { emoji: '🏡', label: 'Done for day' },
    { emoji: '🤒', label: 'Out sick' },
    { emoji: '🌴', label: 'Out of office' },
  ]

  return (
    <div className="legend">
      {items.map((item) => (
        <span key={item.emoji} className="legend-item">
          <span className="legend-emoji">{item.emoji}</span> {item.label}
        </span>
      ))}
    </div>
  )
}
