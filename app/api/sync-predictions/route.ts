import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const LEAGUE_IDS = [39, 40]
const SEASON = 2025

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const categories = [
  { key: 'shots_on_target', col: 'shots_on' },
  { key: 'shots',           col: 'shots_total' },
  { key: 'bookings',        col: 'yellow_cards' },
  { key: 'fouls_committed', col: 'fouls_committed' },
  { key: 'fouls_won',       col: 'fouls_drawn' },
]

async function syncPredictions(leagueId: number) {
  const { data: upcomingMatches } = await supabase
    .from('matches')
    .select('fixture_id, home_team_id, away_team_id, league_id')
    .eq('league_id', leagueId)
    .eq('season', SEASON)
    .is('goals_h', null)
    .is('goals_a', null)

  if (!upcomingMatches || upcomingMatches.length === 0) return 0

  const { data: players } = await supabase
    .from('players')
    .select('player_id, name, team_id, team_name, minutes, shots_on, shots_total, yellow_cards, fouls_committed, fouls_drawn')
    .eq('league_id', leagueId)
    .eq('season', SEASON)
    .gt('minutes', 0)

  if (!players || players.length === 0) return 0

  let count = 0

  for (const match of upcomingMatches) {
    const { data: lineupRows } = await supabase
      .from('lineups')
      .select('player_id')
      .eq('fixture_id', match.fixture_id)
      .eq('is_substitute', false)

    const lineupsConfirmed = lineupRows && lineupRows.length > 0
    const starterIds = lineupsConfirmed
      ? new Set(lineupRows.map((l: any) => l.player_id))
      : null

    const matchPlayers = players.filter(p =>
      p.team_id === match.home_team_id || p.team_id === match.away_team_id
    )

    await supabase.from('player_predictions').delete().eq('fixture_id', match.fixture_id)

    const rows: any[] = []

    for (const cat of categories) {
      const ranked = (matchPlayers as any[])
        .map(p => ({ ...p, per90: p.minutes > 0 ? (p[cat.col] / p.minutes) * 90 : 0 }))
        .filter(p => p[cat.col] > 0)
        .sort((a, b) => b.per90 - a.per90)

      ranked.forEach((p, i) => {
        rows.push({
          fixture_id:        match.fixture_id,
          category:          cat.key,
          rank:              i + 1,
          player_id:         p.player_id,
          player_name:       p.name,
          team_id:           p.team_id,
          team_name:         p.team_name,
          stat_value:        p[cat.col],
          per90_value:       Math.round(p.per90 * 100) / 100,
          lineups_confirmed: lineupsConfirmed,
          in_lineup:         starterIds ? starterIds.has(p.player_id) : null,
        })
      })
    }

    if (rows.length > 0) {
      await supabase.from('player_predictions').insert(rows)
      count += rows.length
    }
  }

  return count
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results: Record<string, any> = {}
    for (const leagueId of LEAGUE_IDS) {
      results[leagueId] = await syncPredictions(leagueId)
    }
    return NextResponse.json({ message: 'Predictions synced', results })
  } catch (err) {
    console.error('sync-predictions error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}