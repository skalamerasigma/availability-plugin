export function Legend() {
  const items = [
    { ringColor: 'green', label: 'Available' },
    { ringColor: 'yellow', label: 'On a break' },
    { ringColor: 'orange', label: 'Status unclear' },
    { ringColor: 'red', label: 'Off Chat' },
    { ringColor: 'zoom', label: 'On a zoom' },
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
