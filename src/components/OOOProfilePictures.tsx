import { useMemo } from 'react'
import { TEAM_MEMBERS } from '../data/teamMembers'

interface OOOProfilePicturesProps {
  oooData: Record<string, unknown> | null | undefined
  oooTSEColumn: string | undefined
  oooStatusColumn: string | undefined
}

interface OOOTSE {
  name: string
  avatar: string
}

export function OOOProfilePictures({
  oooData,
  oooTSEColumn,
  oooStatusColumn,
}: OOOProfilePicturesProps) {
  const oooTSEs = useMemo(() => {
    if (!oooData || !oooTSEColumn) {
      return []
    }

    const tseNames = oooData[oooTSEColumn] as string[] | undefined
    const statuses = oooStatusColumn
      ? (oooData[oooStatusColumn] as string[] | undefined)
      : undefined

    if (!tseNames || tseNames.length === 0) {
      return []
    }

    const result: OOOTSE[] = []
    const seenNames = new Set<string>()

    tseNames.forEach((name, index) => {
      if (!name || !name.trim()) return

      const cleanName = name.trim()
      
      // Check status if status column exists
      if (statuses) {
        const status = statuses[index]?.toString().toLowerCase()
        if (status !== 'yes' && status !== 'true' && status !== '1') {
          return // Skip if not marked as OOO
        }
      }

      // Avoid duplicates
      const nameKey = cleanName.toLowerCase()
      if (seenNames.has(nameKey)) {
        return
      }
      seenNames.add(nameKey)

      // Find matching team member
      const teamMember = TEAM_MEMBERS.find((member) => {
        const memberNameLower = member.name.toLowerCase()
        const cleanNameLower = cleanName.toLowerCase()

        // Exact match
        if (memberNameLower === cleanNameLower) return true

        // Match first name only
        const firstName = cleanNameLower.split(' ')[0]
        if (memberNameLower === firstName) return true

        // Handle cases like "Nathan S" matching "Nathan"
        if (cleanNameLower.startsWith(memberNameLower + ' ')) return true
        if (memberNameLower.startsWith(cleanNameLower + ' ')) return true

        return false
      })

      if (teamMember) {
        result.push({
          name: cleanName,
          avatar: teamMember.avatar,
        })
      } else {
        // Fallback: use a default avatar if team member not found
        result.push({
          name: cleanName,
          avatar: `https://i.pravatar.cc/40?u=${cleanName}`,
        })
      }
    })

    // Sort alphabetically by name
    return result.sort((a, b) => a.name.localeCompare(b.name))
  }, [oooData, oooTSEColumn, oooStatusColumn])

  if (oooTSEs.length === 0) {
    return null
  }

  return (
    <div className="ooo-profile-pictures">
      <h3 className="ooo-profile-pictures-title">
        Out of Office Today
      </h3>
      <div className="ooo-profile-pictures-grid">
        {oooTSEs.map((tse) => (
          <div key={tse.name} className="ooo-profile-picture-item">
            <img
              src={tse.avatar}
              alt={tse.name}
              className="ooo-profile-picture"
              onError={(e) => {
                // Fallback to default avatar on error
                const target = e.target as HTMLImageElement
                target.src = `https://i.pravatar.cc/40?u=${tse.name}`
              }}
            />
            <span className="ooo-profile-picture-name">{tse.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
