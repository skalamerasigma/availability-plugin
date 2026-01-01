interface IntensitySliderProps {
  value: number
  onChange?: (value: number) => void
  rowCount?: number
  readOnly?: boolean
}

// SVG thumb images based on row count
const THUMB_SVGS: Record<number, string> = {
  0: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765347697/1996_Nintendo_5_ejqate.svg',
  1: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765347697/1996_Nintendo_6_wgteaq.svg',
  2: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765347697/1996_Nintendo_7_v7l4md.svg',
  3: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765347697/1996_Nintendo_8_mvyaz1.svg',
  4: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765347696/1996_Nintendo_9_gszxvo.svg',
  5: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765347697/1996_Nintendo_4_nbuqwj.svg',
  6: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765347695/1996_Nintendo_10_ni0ofj.svg',
  7: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765347695/1996_Nintendo_11_jczfyk.svg',
  8: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765347695/1996_Nintendo_12_l2heik.svg',
  9: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765347695/1996_Nintendo_13_icpwuj.svg',
  10: 'https://res.cloudinary.com/doznvxtja/image/upload/v1765347694/1996_Nintendo_14_ipkkx8.svg',
}
const THUMB_SVG_MAX = 'https://res.cloudinary.com/doznvxtja/image/upload/v1765347694/1996_Nintendo_15_xqkoxq.svg'

function getThumbSvg(count: number): string {
  if (count >= 11) return THUMB_SVG_MAX
  return THUMB_SVGS[count] ?? THUMB_SVGS[0]
}

export function IntensitySlider({ value, onChange, rowCount = 0, readOnly = false }: IntensitySliderProps) {
  // Calculate thumb position as percentage
  const thumbPosition = ((value - 0) / (100 - 0)) * 100
  
  // Get the appropriate SVG for the row count
  const thumbSvgUrl = getThumbSvg(rowCount)

  return (
    <div className="intensity-slider-horizontal">
      <div className="intensity-track-wrapper">
        <div className="intensity-slider-container">
          <input
            id="intensity"
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(e) => !readOnly && onChange && onChange(Number(e.target.value))}
            className="intensity-input"
            disabled={readOnly}
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
          />
          <div 
            className="intensity-svg-thumb"
            style={{ left: `calc(${thumbPosition}% - 34px)` }}
          >
            <img src={thumbSvgUrl} alt={`Count: ${rowCount}`} className="intensity-thumb-img" />
          </div>
        </div>
      </div>
    </div>
  )
}

