interface ZoomIndicatorProps {
  chatsRowCount: number
}

const ZOOM_ALLOWED_SVG = 'https://res.cloudinary.com/doznvxtja/image/upload/v1765838396/1996_Nintendo_21_fedxnn.svg'
const ZOOM_BLOCKED_SVG = 'https://res.cloudinary.com/doznvxtja/image/upload/v1765838396/1996_Nintendo_20_mqzxcs.svg'

export function ZoomIndicator({ chatsRowCount }: ZoomIndicatorProps) {
  // "under 5" is allowed, "5 or more" is blocked
  const isZoomAllowed = chatsRowCount < 3
  const svgUrl = isZoomAllowed ? ZOOM_ALLOWED_SVG : ZOOM_BLOCKED_SVG
  const titleColor = isZoomAllowed ? '#0FAD1A' : '#6C7280'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      marginTop: '4px'
    }}>
      <h3 style={{
        fontSize: '13px',
        fontWeight: 500,
        color: titleColor,
        margin: 0,
        textAlign: 'center'
      }}>
        Zoom Availability
      </h3>
      <img 
        src={svgUrl} 
        alt={isZoomAllowed ? 'Zoom allowed' : 'Zoom blocked'} 
        style={{ 
          width: '48px', 
          height: '48px', 
          objectFit: 'contain'
        }}
      />
    </div>
  )
}
