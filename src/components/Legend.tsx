export function Legend() {
  const items = [
    { ringColor: 'green', label: 'Available' },
    { ringColor: 'yellow', label: 'Away' },
    { ringColor: 'red', label: 'Scheduled but Away' },
    { ringColor: 'zoom', label: 'Zoom' },
    { ringColor: 'meeting', label: 'In a meeting' },
    { ringColor: 'purple', label: 'Not scheduled' },
  ]

  return (
    <div className="legend">
      {items.map((item) => (
        <span key={item.ringColor} className="legend-item">
          <span className={`legend-ring ring-${item.ringColor}`}></span> {item.label}
        </span>
      ))}
    </div>
  )
}
