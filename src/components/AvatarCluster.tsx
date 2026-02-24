import { useState } from 'react'

interface AvatarClusterProps {
  groupAdmins: any[]
  borderColor: string
  emojiBadge?: string
  formatTime: (mins: number | null | undefined) => string
}

export function AvatarCluster({ groupAdmins, borderColor, emojiBadge, formatTime }: AvatarClusterProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  
  const MAX_PER_ROW = 4
  const rows: any[][] = []
  for (let i = 0; i < groupAdmins.length; i += MAX_PER_ROW) {
    rows.push(groupAdmins.slice(i, i + MAX_PER_ROW))
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center',
      padding: '16px 8px 24px 8px' 
    }}>
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} style={{ 
          display: 'flex', 
          justifyContent: 'center',
          marginTop: rowIdx > 0 ? '-24px' : '0px',
          // To ensure hovering over a bottom row can overlap a top row, 
          // we must dynamically change the zIndex of the entire row.
          zIndex: rows.some(r => r.some((a: any) => a.id === hoveredId)) && row.some((a: any) => a.id === hoveredId) ? 100 : 10 - rowIdx 
        }}>
          {row.map((admin, adminIdx) => {
            const isHovered = hoveredId === admin.id
            return (
              <div key={admin.id} 
                style={{ 
                  position: 'relative', 
                  display: 'inline-block',
                  margin: '0 -10px',
                  zIndex: isHovered ? 1000 : 50 - adminIdx,
                  transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), z-index 0s',
                }} 
                onMouseEnter={() => setHoveredId(admin.id)}
                onMouseLeave={() => setHoveredId(null)}
                title={`${admin.name}${admin.calculatedReason ? ` - ${admin.calculatedReason}` : ''}`}
              >
                <div style={{
                  width: '76px', 
                  height: '76px', 
                  borderRadius: '50%',
                  border: `3px solid ${borderColor}`,
                  padding: '2px',
                  background: 'var(--bg-card)',
                  boxShadow: '0 0 0 3px var(--bg-card), 0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  {admin.avatar?.image_url ? (
                    <img src={admin.avatar.image_url} alt={admin.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(148,163,184,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {admin.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                
                {emojiBadge && (
                  <div style={{
                    position: 'absolute', 
                    top: '0px', 
                    right: '-4px',
                    background: '#fff', 
                    borderRadius: '50%', 
                    width: '30px', 
                    height: '30px',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '16px',
                    boxShadow: '0 0 0 2px var(--bg-card), 0 2px 4px rgba(0,0,0,0.1)',
                    zIndex: 2
                  }}>
                    {emojiBadge}
                  </div>
                )}

                {admin.calculatedMinsAway != null ? (
                  <div style={{
                    position: 'absolute', 
                    bottom: '-6px', 
                    left: '50%', 
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.75)', 
                    color: 'white', 
                    fontSize: '11px', 
                    fontWeight: 700,
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    whiteSpace: 'nowrap',
                    border: '2px solid var(--bg-card)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    zIndex: 3
                  }}>
                    {formatTime(admin.calculatedMinsAway)}
                  </div>
                ) : !admin.calculatedAvailable ? (
                  <div style={{
                    position: 'absolute', 
                    bottom: '-12px', 
                    left: '50%', 
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3
                  }}>
                    <img 
                      src="https://res.cloudinary.com/doznvxtja/image/upload/v1771579123/It_s_been_84_years..._1_qgpvqv.svg" 
                      alt="84 years" 
                      style={{ height: '32px', marginBottom: '-6px', zIndex: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} 
                    />
                    <div style={{
                      background: 'rgba(0,0,0,0.85)', 
                      color: 'white', 
                      fontSize: '10px', 
                      fontWeight: 700,
                      padding: '1px 6px', 
                      borderRadius: '12px', 
                      whiteSpace: 'nowrap',
                      border: '2px solid var(--bg-card)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      zIndex: 2
                    }}>
                      It's Been 84 Years...
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
