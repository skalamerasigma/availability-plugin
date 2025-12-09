interface IntensitySliderProps {
  value: number
  onChange: (value: number) => void
}

export function IntensitySlider({ value, onChange }: IntensitySliderProps) {
  return (
    <>
      <label htmlFor="intensity" className="slider-label">
        <span>Intensity</span>
        <span className="labels">
          <em>Low</em>
          <em>Mid</em>
          <em>High</em>
        </span>
      </label>
      <input
        id="intensity"
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        // Note: orient="vertical" is non-standard, we handle vertical styling in CSS
      />
    </>
  )
}

