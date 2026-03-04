import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const API_KEY = process.env.API_FOOTBALL_KEY!
const LEAGUE_ID = 39
const SEASON = 2025

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function apiFetch(path: string) {
  const res = await fetch(`https://v3.football.api-sports.io/${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  })
  return res.json()
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const data = await apiFetch(`fixtures?league=${LEAGUE_ID}&season=${SEASON}&date=${today}`)
    const fixtures = data.response ?? []

    if (fixtures.length === 0) {
      return NextResponse.json({ message: 'No fixtures today', synced: 0 })
    }

    await Promise.all(fixtures.map((f: any) =>
      supabase.from('matches').upsert({
        fixture_id:     f.fixture.id,
        league_id:      LEAGUE_ID,
        season:         SEASON,
        round:          f.league.round,
        datetime:       f.fixture.date,
        status_short:   f.fixture.status.short,
        status_elapsed: f.fixture.status.elapsed,
        venue_name:     f.fixture.venue?.name ?? null,
        referee:        f.fixture.referee ?? null,
        home_team_id:   f.teams.home.id,
        home_team_name: f.teams.home.name,
        home_team_logo: f.teams.home.logo ?? null,
        away_team_id:   f.teams.away.id,
        away_team_name: f.teams.away.name,
        away_team_logo: f.teams.away.logo ?? null,
        goals_h:        f.goals.home,
        goals_a:        f.goals.away,
        ht_goals_h:     f.score.halftime.home,
        ht_goals_a:     f.score.halftime.away,
        ft_goals_h:     f.score.fulltime.home,
        ft_goals_a:     f.score.fulltime.away,
        et_goals_h:     f.score.extratime.home,
        et_goals_a:     f.score.extratime.away,
        pen_goals_h:    f.score.penalty.home,
        pen_goals_a:    f.score.penalty.away,
      }, { onConflict: 'fixture_id', ignoreDuplicates: false })
    ))

    return NextResponse.json({ message: 'Scores synced', synced: fixtures.length })

  } catch (err) {
    console.error('sync-scores error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}