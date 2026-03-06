import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SEASON = 2025
const LEAGUE_IDS = [39, 40]

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const categories = [
  { key: 'shots_on_target', stat: 'shots_on' },
  { key: 'shots',           stat: 'shots_total' },
  { key: 'bookings',        stat: 'yellow_cards' },
  { key: 'fouls_committed', stat: 'fouls_committed' },
  { key: 'fouls_won',       stat: 'fouls_drawn' },
]

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: upcomingMatches } = await supabase
      .from('matches')
      .select('fixture_id, league_id, home_team_id, away_team_id, home_team_name, away_team_name')
      .is('goals_h', null)
      .is('goals_a', null)
      .in('league_id', LEAGUE_IDS)

    if (!upcomingMatches || upcomingMatches.length === 0) {
      return NextResponse.json({ message: 'No upcoming matches', synced: 0 })
    }

    let synced = 0

    for (const match of upcomingMatches) {

      // Fetch full squad — everyone with minutes this season
      const { data: players } = await supabase
        .from('players')
        .select('player_id, name, team_id, team_name, minutes, shots_on, shots_total, yellow_cards, fouls_committed, fouls_drawn')
        .in('team_id', [match.home_team_id, match.away_team_id])
        .eq('league_id', match.league_id)
        .eq('season', SEASON)
        .gt('minutes', 0)

      if (!players || players.length === 0) continue

      // Check if confirmed lineups exist
      const { data: lineupRows } = await supabase
        .from('lineups')
        .select('player_id')
        .eq('fixture_id', match.fixture_id)
        .eq('is_substitute', false)

      const lineupsConfirmed = lineupRows && lineupRows.length > 0
      const starterIds = lineupsConfirmed
        ? new Set(lineupRows.map((l: any) => l.player_id))
        : null

      await supabase
        .from('player_predictions')
        .delete()
        .eq('fixture_id', match.fixture_id)

      const rows: any[] = []

      for (const cat of categories) {
        const ranked = players
          .map((p: any) => ({
            ...p,
            per90: p.minutes > 0 ? (p[cat.stat] / p.minutes) * 90 : 0,
          }))
          .filter((p: any) => p[cat.stat] > 0)
          .sort((a: any, b: any) => b.per90 - a.per90)

        ranked.forEach((p: any, i: number) => {
          rows.push({
            fixture_id:        match.fixture_id,
            category:          cat.key,
            rank:              i + 1, // rank across full squad
            player_id:         p.player_id,
            player_name:       p.name,
            team_id:           p.team_id,
            team_name:         p.team_name,
            stat_value:        p[cat.stat],
            per90_value:       Math.round(p.per90 * 100) / 100,
            lineups_confirmed: lineupsConfirmed,
            in_lineup:         starterIds ? starterIds.has(p.player_id) : null,
          })
        })
      }

      if (rows.length > 0) {
        const { error } = await supabase
          .from('player_predictions')
          .insert(rows)
        if (error) console.error(`Predictions error (${match.fixture_id}):`, error.message)
        else synced++
      }
    }

    return NextResponse.json({
      message: 'Predictions sync complete',
      total:   upcomingMatches.length,
      synced,
    })

  } catch (err) {
    console.error('sync-predictions error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}