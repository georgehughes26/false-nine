import { supabase } from '@/lib/supabase'
import GWFilterPage from '@/app/GWFilterPage'
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

  const now = new Date()
  const upcomingMatches = matches.filter(m => new Date(m.datetime) > now)
  const nextGW = upcomingMatches.length > 0 ? parseGW(upcomingMatches[0].round) : 1

  const upcomingGWs = [...new Set(
    upcomingMatches.map(m => parseGW(m.round)).filter(Boolean)
  )].sort((a, b) => a - b)

  const grouped: Record<string, any[]> = matches.reduce((acc: Record<string, any[]>, match: any) => {
    const gw = match.round ?? 'Unknown'
    if (!acc[gw]) acc[gw] = []
    acc[gw].push(match)
    return acc
  }, {})

  return (
    <GWFilterPage
      matches={matches}
      nextGW={nextGW}
      upcomingGWs={upcomingGWs}
      grouped={grouped}
    />
  )
}