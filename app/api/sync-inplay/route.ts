import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const API_KEY = process.env.API_FOOTBALL_KEY!
const API_HOST = 'v3.football.api-sports.io'
const LEAGUE_ID = 39
const SEASON = 2025

async function apiCall(endpoint: string) {
  const res = await fetch(`https://${API_HOST}/${endpoint}`, {
    headers: { 'x-apisports-key': API_KEY }
  })
  const data = await res.json()
  return data.response ?? []
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check for any in-play matches — 1 Supabase request, 0 API calls if none
    const { data: inPlayMatches } = await supabase
      .from('matches')
      .select('fixture_id')
      .in('status_short', ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT', 'LIVE'])

    if (!inPlayMatches || inPlayMatches.length === 0) {
      return NextResponse.json({ message: 'No in-play matches, skipping' })
    }

    // Sync each in-play match
    let synced = 0
    for (const match of inPlayMatches) {
      const data = await apiCall(`fixtures?id=${match.fixture_id}`)
      if (!data || data.length === 0) continue
      const f = data[0]

      await supabase.from('matches').upsert({
        fixture_id: f.fixture.id,
        league_id: LEAGUE_ID,
        season: SEASON,
        round: f.league.round,
        datetime: f.fixture.date,
        status_long: f.fixture.status?.long,
        status_short: f.fixture.status?.short,
        status_elapsed: f.fixture.status?.elapsed,
        referee: f.fixture.referee,
        home_team_id: f.teams.home.id,
        home_team_name: f.teams.home.name,
        away_team_id: f.teams.away.id,
        away_team_name: f.teams.away.name,
        goals_h: f.goals.home,
        goals_a: f.goals.away,
        ht_goals_h: f.score.halftime.home,
        ht_goals_a: f.score.halftime.away,
        ft_goals_h: f.score.fulltime.home,
        ft_goals_a: f.score.fulltime.away,
      }, { onConflict: 'fixture_id' })

      await new Promise(r => setTimeout(r, 100))
      synced++
    }

    return NextResponse.json({
      message: 'In-play sync complete',
      synced,
    })

  } catch (err) {
    console.error('In-play sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}