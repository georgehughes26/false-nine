import { supabase } from '@/lib/supabase'
import GWFilterPage from './GWFilterPage'

function parseGW(round: string | null): number {
  if (!round) return 0
  const m = round.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

export default async function Home() {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .order('datetime', { ascending: true })

  if (error) return <div>Error loading fixtures</div>
  if (!matches) return <div>No fixtures found</div>

  const grouped: Record<string, any[]> = matches.reduce((acc: Record<string, any[]>, match: any) => {
    const gw = match.round ?? 'Unknown'
    if (!acc[gw]) acc[gw] = []
    acc[gw].push(match)
    return acc
  }, {})

  const gwNumbers = [...new Set(matches.map(m => parseGW(m.round)).filter(Boolean))].sort((a, b) => a - b)

  const currentGW = gwNumbers.find(gw => {
    const gwKey = Object.keys(grouped).find(k => parseGW(k) === gw)
    const gwMatches = gwKey ? grouped[gwKey] : []
    return gwMatches.some(m => m.goals_h === null || m.goals_a === null)
  }) ?? gwNumbers[gwNumbers.length - 1]

  const visibleGWs = gwNumbers.filter(gw => gw >= currentGW)

  return (
    <GWFilterPage
      matches={matches}
      nextGW={currentGW}
      upcomingGWs={visibleGWs}
      grouped={grouped}
    />
  )
}