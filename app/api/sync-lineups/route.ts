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

async function syncUpcomingFixtures(leagueId: number) {
  const now = new Date()
  const from = now.toISOString().split('T')[0]
  const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const data = await apiFetch(`fixtures?league=${leagueId}&season=${SEASON}&from=${from}&to=${to}&status=NS`)
  const fixtures = data.response ?? []

  if (fixtures.length === 0) return 0

  await Promise.all(fixtures.map((f: any) =>
    supabase.from('matches').upsert({
      fixture_id:     f.fixture.id,
      league_id:      leagueId,
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

async function syncLineup(fixtureId: number): Promise<Set<number> | null> {
  const data = await apiFetch(`fixtures/lineups?fixture=${fixtureId}`)
  const lineups = data.response ?? []

  if (lineups.length === 0) return null

  await supabase.from('lineups').delete().eq('fixture_id', fixtureId)

  const rows: any[] = []
  const starterIds = new Set<number>()

  for (const team of lineups) {
    for (const p of team.startXI ?? []) {
      starterIds.add(p.player.id)
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

  return starterIds
}

async function updatePredictionsWithLineup(fixtureId: number, starterIds: Set<number>) {
  // Fetch all player_predictions for this fixture
  const { data: predictions } = await supabase
    .from('player_predictions')
    .select('id, player_id')
    .eq('fixture_id', fixtureId)

  if (!predictions || predictions.length === 0) return

  // Batch update in_lineup and lineups_confirmed for each row
  await Promise.all(
    predictions.map(p =>
      supabase
        .from('player_predictions')
        .update({
          in_lineup: starterIds.has(p.player_id),
          lineups_confirmed: true,
        })
        .eq('id', p.id)
    )
  )
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    let upcomingCount = 0
    for (const leagueId of LEAGUE_IDS) {
      upcomingCount += await syncUpcomingFixtures(leagueId)
    }

    // Include NS and any match within 2hrs — catches late lineup confirms
    const { data: todayMatches } = await supabase
      .from('matches')
      .select('fixture_id, datetime, status_short')
      .in('league_id', LEAGUE_IDS)
      .eq('season', SEASON)
      .in('status_short', ['NS', '1H', 'HT'])
      .gte('datetime', `${today}T00:00:00`)
      .lte('datetime', `${today}T23:59:59`)

    const lineupTargets = (todayMatches ?? []).filter(m => {
      const kickoff = new Date(m.datetime)
      const hoursUntil = (kickoff.getTime() - now.getTime()) / (1000 * 60 * 60)
      // NS: within 2hr window. In-play: always attempt (lineups may not have been confirmed pre-kick)
      return m.status_short !== 'NS' || (hoursUntil >= 0 && hoursUntil <= 2)
    })

    let lineupsConfirmed = 0
    let lineupsPending = 0

    for (const match of lineupTargets) {
      const starterIds = await syncLineup(match.fixture_id)

      if (starterIds) {
        await updatePredictionsWithLineup(match.fixture_id, starterIds)
        lineupsConfirmed++
      } else {
        // Mark predictions as not yet confirmed
        await supabase
          .from('player_predictions')
          .update({ lineups_confirmed: false })
          .eq('fixture_id', match.fixture_id)
        lineupsPending++
      }
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