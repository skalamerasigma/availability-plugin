import { useMemo } from 'react'
import type { AgentData, City } from '../types'
import { TEAM_MEMBERS } from '../data/teamMembers'

interface FallbackGaugeProps {
  cities: City[]
  agentsByCity: Map<string, AgentData[]>
  scheduleData: Record<string, unknown> | null | undefined
  scheduleTSE: string | undefined
  scheduleOOO: string | undefined
}

interface RegionStats {
  region: string
  totalTSEs: number
  oooCount: number
  threshold: number
  percentage: number
  isAtRisk: boolean
}

// Map timezones to regions
// SF and NY are separate regions (not combined as NAMER)
const TIMEZONE_TO_REGION: Record<string, string> = {
  'America/New_York': 'NY',
  'America/Los_Angeles': 'SF',
  'Europe/London': 'UK',
  // Add more mappings as needed
}

// Baseline OOO predictions per region (for hedging/planning)
// Based on capacity planning: assumes 2 TSEs are out by default per day (US specific)
// UK has lower baseline due to smaller team size
const REGION_BASELINE_OOO: Record<string, number> = {
  NY: 2,   // 2 predicted OOO for NY region
  SF: 2,   // 2 predicted OOO for SF region
  UK: 1,   // 1 predicted OOO for UK region
}

function mapTimezoneToRegion(timezone: string): string {
  // Direct mapping
  if (TIMEZONE_TO_REGION[timezone]) {
    return TIMEZONE_TO_REGION[timezone]
  }
  
  // Fallback: check if timezone contains region keywords
  const tzLower = timezone.toLowerCase()
  if (tzLower.includes('new_york') || tzLower.includes('eastern')) {
    return 'NY'
  }
  if (tzLower.includes('los_angeles') || tzLower.includes('pacific')) {
    return 'SF'
  }
  if (tzLower.includes('europe') || tzLower.includes('london')) {
    return 'UK'
  }
  
  return 'UNKNOWN'
}

export function FallbackGauge({ 
  cities, 
  agentsByCity, 
  scheduleData,
  scheduleTSE,
  scheduleOOO 
}: FallbackGaugeProps) {
  console.log('[FallbackGauge] Component rendered')
  console.log('[FallbackGauge] Props:', {
    citiesCount: cities.length,
    agentsByCitySize: agentsByCity.size,
    hasScheduleData: !!scheduleData,
    scheduleTSE,
    scheduleOOO
  })
  
  const regionStats = useMemo(() => {
    console.group('[FallbackGauge] Starting calculation...')
    console.log('[FallbackGauge] Cities:', cities.map(c => ({ name: c.name, timezone: c.timezone })))
    console.log('[FallbackGauge] Schedule data available:', !!scheduleData)
    console.log('[FallbackGauge] Schedule TSE column:', scheduleTSE)
    console.log('[FallbackGauge] Schedule OOO column:', scheduleOOO)
    
    const statsMap = new Map<string, RegionStats>()
    
    // Initialize regions
    const regions = new Set<string>()
    cities.forEach(city => {
      const region = mapTimezoneToRegion(city.timezone)
      console.log(`[FallbackGauge] City "${city.name}" (${city.timezone}) → Region: ${region}`)
      if (region !== 'UNKNOWN') {
        regions.add(region)
      }
    })
    
    console.log('[FallbackGauge] Regions found:', Array.from(regions))
    
    // Calculate stats per region
    regions.forEach(region => {
      console.log(`\n[FallbackGauge] === Calculating stats for ${region} ===`)
      
      // Get all agents in this region
      const regionAgents: AgentData[] = []
      cities.forEach(city => {
        if (mapTimezoneToRegion(city.timezone) === region) {
          const cityAgents = agentsByCity.get(city.timezone) || []
          console.log(`[FallbackGauge] ${region}: Found ${cityAgents.length} agents in ${city.name} (${city.timezone})`)
          regionAgents.push(...cityAgents)
        }
      })
      
      console.log(`[FallbackGauge] ${region}: Total displayed agents: ${regionAgents.length}`)
      
      // Get total TSE count from schedule data (more accurate than displayed agents)
      let totalTSEs = regionAgents.length
      let oooCount = 0
      const regionTSEs: string[] = []
      const oooTSEs: string[] = []
      
      if (scheduleData && scheduleTSE && scheduleOOO) {
        const tseData = scheduleData[scheduleTSE] as string[] | undefined
        const oooData = scheduleData[scheduleOOO] as string[] | undefined
        
        console.log(`[FallbackGauge] ${region}: Schedule data - TSE count: ${tseData?.length || 0}, OOO count: ${oooData?.length || 0}`)
        
        if (tseData && oooData) {
          console.log(`[FallbackGauge] ${region}: Processing ${tseData.length} TSEs from schedule data...`)
          // Count TSEs and OOO in this region
          tseData.forEach((name, idx) => {
            if (!name) return
            
            const cleanName = name.trim()
            const teamMember = TEAM_MEMBERS.find(m => {
              const memberNameLower = m.name.toLowerCase()
              const cleanNameLower = cleanName.toLowerCase()
              
              // Exact match
              if (memberNameLower === cleanNameLower) return true
              
              // Handle "Nathan S" matching to "Nathan"
              if (cleanNameLower === 'nathan s' && memberNameLower === 'nathan') return true
              
              // Handle names with initials
              const cleanNameFirst = cleanNameLower.split(' ')[0]
              if (memberNameLower === cleanNameFirst) return true
              
              return false
            })
            
            if (teamMember) {
              const memberRegion = mapTimezoneToRegion(teamMember.timezone)
              const isOOO = oooData[idx]?.toLowerCase() === 'yes'
              
              if (memberRegion === region) {
                regionTSEs.push(cleanName)
                if (isOOO) {
                  oooCount++
                  oooTSEs.push(cleanName)
                  console.log(`[FallbackGauge] ${region}: ✓ OOO TSE: "${cleanName}" (timezone: ${teamMember.timezone})`)
                } else {
                  console.log(`[FallbackGauge] ${region}: • Active TSE: "${cleanName}" (timezone: ${teamMember.timezone})`)
                }
              } else {
                // Only log skips if verbose debugging is needed
                // console.log(`[FallbackGauge] ${region}: Skipping "${cleanName}" - belongs to ${memberRegion} (timezone: ${teamMember.timezone})`)
              }
            } else {
              console.log(`[FallbackGauge] ${region}: ⚠️ Could not find team member for "${cleanName}"`)
            }
          })
          
          totalTSEs = regionTSEs.length
          console.log(`\n[FallbackGauge] ${region}: === SUMMARY ===`)
          console.log(`[FallbackGauge] ${region}: Total TSEs from schedule: ${totalTSEs}`)
          console.log(`[FallbackGauge] ${region}: All TSEs in ${region}:`, JSON.parse(JSON.stringify(regionTSEs)))
          console.log(`[FallbackGauge] ${region}: OOO TSEs: ${oooCount}`)
          const activeTSEs = regionTSEs.filter(name => !oooTSEs.includes(name))
          
          console.log(`[FallbackGauge] ${region}: OOO TSE list:`, JSON.stringify(oooTSEs, null, 2))
          console.log(`[FallbackGauge] ${region}: Active TSEs (${activeTSEs.length}):`, JSON.stringify(activeTSEs, null, 2))
        } else {
          console.log(`[FallbackGauge] ${region}: Missing TSE or OOO data`)
        }
      } else {
        console.log(`[FallbackGauge] ${region}: No schedule data available, using displayed agents`)
        // Fallback: count OOO from displayed agents
        oooCount = regionAgents.filter(agent => agent.status === 'away' && agent.statusLabel === 'Out of office').length
        console.log(`[FallbackGauge] ${region}: OOO count from displayed agents: ${oooCount}`)
      }
      
      // Calculate threshold: 20% of total TSEs + predicted OOO baseline
      // Formula: Threshold = 20% of total TSEs + predicted OOO (baseline)
      // This accounts for both predicted absences (for hedging) and actual OOO
      const baseline = REGION_BASELINE_OOO[region] || 0
      const twentyPercent = Math.ceil(totalTSEs * 0.2)
      const threshold = twentyPercent + baseline
      const percentage = totalTSEs > 0 ? (oooCount / threshold) * 100 : 0
      const isAtRisk = oooCount >= threshold
      
      console.log(`[FallbackGauge] ${region}: Calculation:`)
      console.log(`  - Total TSEs: ${totalTSEs}`)
      console.log(`  - 20% of total: ${twentyPercent}`)
      console.log(`  - Predicted OOO baseline: ${baseline}`)
      console.log(`  - Threshold (20% + baseline): ${threshold}`)
      console.log(`  - Current OOO count: ${oooCount}`)
      console.log(`  - Percentage of threshold: ${percentage.toFixed(1)}%`)
      console.log(`  - At risk: ${isAtRisk ? 'YES ⚠️' : 'NO ✓'}`)
      
      statsMap.set(region, {
        region,
        totalTSEs,
        oooCount,
        threshold,
        percentage: Math.min(percentage, 150), // Cap at 150% for display
        isAtRisk,
      })
    })
    
    const finalStats = Array.from(statsMap.values())
    console.log('[FallbackGauge] === FINAL STATS SUMMARY ===')
    finalStats.forEach((stat, idx) => {
      console.log(`[FallbackGauge] Region ${idx + 1} (${stat.region}):`)
      console.log(`  - Total TSEs: ${stat.totalTSEs}`)
      console.log(`  - OOO Count: ${stat.oooCount}`)
      console.log(`  - Threshold (20% + baseline): ${stat.threshold} (20% = ${Math.ceil(stat.totalTSEs * 0.2)}, baseline = ${REGION_BASELINE_OOO[stat.region] || 0})`)
      console.log(`  - Percentage: ${stat.percentage.toFixed(1)}%`)
      console.log(`  - At Risk: ${stat.isAtRisk ? 'YES ⚠️' : 'NO ✓'}`)
    })
    console.groupEnd()
    return finalStats
  }, [cities, agentsByCity, scheduleData, scheduleTSE, scheduleOOO])
  
  console.log('[FallbackGauge] Calculated regionStats:', JSON.parse(JSON.stringify(regionStats)))
  regionStats.forEach((stat, idx) => {
    console.log(`[FallbackGauge] === Region ${idx + 1}: ${stat.region} ===`)
    console.log(`  Total TSEs: ${stat.totalTSEs}`)
    console.log(`  OOO Count: ${stat.oooCount}`)
    console.log(`  Threshold (20% + baseline): ${stat.threshold}`)
    console.log(`  Percentage: ${stat.percentage.toFixed(1)}%`)
    console.log(`  At Risk: ${stat.isAtRisk ? 'YES ⚠️' : 'NO ✓'}`)
  })
  
  if (regionStats.length === 0) {
    console.log('[FallbackGauge] No regions found, returning null')
    return null
  }
  
  console.log('[FallbackGauge] Rendering gauge with', regionStats.length, 'regions')
  
  return (
    <div className="fallback-gauges">
      <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)', textAlign: 'center' }}>
        Fallback Schedule Risk
      </h3>
      {regionStats.map((stats) => (
        <div key={stats.region} className="fallback-gauge">
          <div className="fallback-gauge-header">
            <span className="fallback-gauge-region">{stats.region}</span>
            <span className={`fallback-gauge-status ${stats.isAtRisk ? 'at-risk' : ''}`}>
              {stats.isAtRisk ? '⚠️ At Risk' : '✓ OK'}
            </span>
          </div>
          <div className="fallback-gauge-bar-container">
            <div 
              className={`fallback-gauge-bar ${stats.isAtRisk ? 'at-risk' : ''}`}
              style={{ width: `${Math.min(stats.percentage, 100)}%` }}
            />
            {stats.percentage > 100 && (
              <div className="fallback-gauge-bar-overflow" />
            )}
          </div>
          <div className="fallback-gauge-stats">
            <span className="fallback-gauge-label">
              {stats.oooCount} / {stats.threshold} OOO
            </span>
            <span className="fallback-gauge-detail">
              {stats.totalTSEs} total TSEs, {Math.ceil(stats.totalTSEs * 0.2)} + {REGION_BASELINE_OOO[stats.region] || 0} baseline
            </span>
          </div>
          {stats.isAtRisk && (
            <div className="fallback-gauge-warning">
              {stats.oooCount - stats.threshold} over limit
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
