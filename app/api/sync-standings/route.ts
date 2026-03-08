import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const API_KEY = process.env.API_FOOTBALL_KEY!
const LEAGUE_IDS = [39, 40]
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

async function syncStandings(leagueId: number) {
  const data = await apiFetch(`standings?league=${leagueId}&season=${SEASON}`)
  const standings = data.response?.[0]?.league?.standings?.[0] ?? []
  if (standings.length === 0) return 0

  await supabase.from('standings').delete().match({ league_id: leagueId, season: SEASON })

  for (const s of standings) {
    await supabase.from('standings').upsert({
      league_id:          leagueId,
      season:             SEASON,
      team_id:            s.team.id,
      team_name:          s.team.name,
      rank:               s.rank,
      points:             s.points,
      goals_diff:         s.goalsDiff,
      group_name:         s.group ?? null,
      form:               s.form ?? null,
      status:             s.status ?? null,
      description:        s.description ?? null,
      played:             s.all?.played ?? 0,
      win:                s.all?.win ?? 0,
      draw:               s.all?.draw ?? 0,
      lose:               s.all?.lose ?? 0,
      goals_for:          s.all?.goals?.for ?? 0,
      goals_against:      s.all?.goals?.against ?? 0,
      home_played:        s.home?.played ?? 0,
      home_win:           s.home?.win ?? 0,
      home_draw:          s.home?.draw ?? 0,
      home_lose:          s.home?.lose ?? 0,
      home_goals_for:     s.home?.goals?.for ?? 0,
      home_goals_against: s.home?.goals?.against ?? 0,
      away_played:        s.away?.played ?? 0,
      away_win:           s.away?.win ?? 0,
      away_draw:          s.away?.draw ?? 0,
      away_lose:          s.away?.lose ?? 0,
      away_goals_for:     s.away?.goals?.for ?? 0,
      away_goals_against: s.away?.goals?.against ?? 0,
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'league_id,season,team_id' })
  }

  return standings.length
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results: Record<string, any> = {}
    for (const leagueId of LEAGUE_IDS) {
      results[leagueId] = await syncStandings(leagueId)
    }
    return NextResponse.json({ message: 'Standings synced', results })
  } catch (err) {
    console.error('sync-standings error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}