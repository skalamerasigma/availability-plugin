interface IntensitySliderProps {
  value: number
  onChange: (value: number) => void
}

export function IntensitySlider({ value, onChange }: IntensitySliderProps) {
  // Calculate the color preview (same logic as in the parent)
  const v = Math.max(0, Math.min(100, value))
  let hue: number
  if (v <= 50) {
    hue = 120 - (v / 50) * 60 // green to yellow
  } else {
    hue = 60 - ((v - 50) / 50) * 60 // yellow to red
  }
  const previewColor = `hsl(${hue} 70% 45%)`

  return (
    <div className="intensity-slider-horizontal">
      <div className="intensity-labels">
        <span>Low</span>
        <span>High</span>
      </div>
      <div className="intensity-track-wrapper">
        <div 
          className="intensity-color-preview" 
          style={{ backgroundColor: previewColor }}
        />
        <input
          id="intensity"
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="intensity-input"
        />
      </div>
    </div>
  )
}

