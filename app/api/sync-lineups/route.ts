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

async function syncUpcomingFixtures() {
  const now = new Date()
  const from = now.toISOString().split('T')[0]
  const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const data = await apiFetch(`fixtures?league=${LEAGUE_ID}&season=${SEASON}&from=${from}&to=${to}&status=NS`)
  const fixtures = data.response ?? []

  if (fixtures.length === 0) return 0

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
    }, { onConflict: 'fixture_id', ignoreDuplicates: false })
  ))

  return fixtures.length
}

async function syncLineup(fixtureId: number): Promise<boolean> {
  const data = await apiFetch(`fixtures/lineups?fixture=${fixtureId}`)
  const lineups = data.response ?? []

  if (lineups.length === 0) return false

  await supabase.from('lineups').delete().eq('fixture_id', fixtureId)

  const rows: any[] = []

  for (const team of lineups) {
    for (const p of team.startXI ?? []) {
      rows.push({
        fixture_id:    fixtureId,
        team_id:       team.team.id,
        team_name:     team.team.name,
        formation:     team.formation ?? null,
        player_id:     p.player.id,
        player_name:   p.player.name,
        player_number: p.player.number,
        player_pos:    p.player.pos ?? null,
        grid:          p.player.grid ?? null,
        is_substitute: false,
      })
    }

    for (const p of team.substitutes ?? []) {
      rows.push({
        fixture_id:    fixtureId,
        team_id:       team.team.id,
        team_name:     team.team.name,
        formation:     team.formation ?? null,
        player_id:     p.player.id,
        player_name:   p.player.name,
        player_number: p.player.number,
        player_pos:    p.player.pos ?? null,
        grid:          p.player.grid ?? null,
        is_substitute: true,
      })
    }
  }

  if (rows.length > 0) {
    await supabase.from('lineups').insert(rows)
  }

  return true
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    const upcomingCount = await syncUpcomingFixtures()

    const { data: todayMatches } = await supabase
      .from('matches')
      .select('fixture_id, datetime, status_short')
      .eq('league_id', LEAGUE_ID)
      .eq('season', SEASON)
      .eq('status_short', 'NS')
      .gte('datetime', `${today}T00:00:00`)
      .lte('datetime', `${today}T23:59:59`)

    const lineupTargets = (todayMatches ?? []).filter(m => {
      const kickoff = new Date(m.datetime)
      const hoursUntil = (kickoff.getTime() - now.getTime()) / (1000 * 60 * 60)
      return hoursUntil >= 0 && hoursUntil <= 2
    })

    let lineupsConfirmed = 0
    let lineupsPending = 0

    for (const match of lineupTargets) {
      const confirmed = await syncLineup(match.fixture_id)

      await supabase
        .from('player_predictions')
        .update({ lineups_confirmed: confirmed })
        .eq('fixture_id', match.fixture_id)

      if (confirmed) lineupsConfirmed++
      else lineupsPending++
    }

    return NextResponse.json({
      message:          'Lineups synced',
      upcomingFixtures: upcomingCount,
      lineupsChecked:   lineupTargets.length,
      lineupsConfirmed,
      lineupsPending,
    })

  } catch (err) {
    console.error('sync-lineups error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}