import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const API_KEY = process.env.API_FOOTBALL_KEY!
const LEAGUE_ID = 39
const SEASON = 2025
const IN_PLAY_STATUSES = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT', 'LIVE']
const FINISHED_STATUSES = ['FT', 'AET', 'PEN']

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

async function syncFixtures() {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const data = await apiFetch(`fixtures?league=${LEAGUE_ID}&season=${SEASON}&from=${today}&to=${today}`)
  const fixtures = data.response ?? []

  for (const f of fixtures) {
    const fixture = f.fixture
    const teams = f.teams
    const goals = f.goals
    const score = f.score

    await supabase.from('matches').upsert({
      fixture_id: fixture.id,
      season: SEASON,
      round: f.league.round,
      datetime: fixture.date,
      status_short: fixture.status.short,
      status_elapsed: fixture.status.elapsed,
      venue_name: fixture.venue?.name ?? null,
      referee: fixture.referee ?? null,
      home_team_name: teams.home.name,
      away_team_name: teams.away.name,
      goals_h: goals.home,
      goals_a: goals.away,
      ht_goals_h: score.halftime.home,
      ht_goals_a: score.halftime.away,
    }, { onConflict: 'fixture_id' })
  }

  return fixtures.length
}

async function syncUpcomingFixtures() {
  const now = new Date()
  const from = now.toISOString().split('T')[0]
  const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const data = await apiFetch(`fixtures?league=${LEAGUE_ID}&season=${SEASON}&from=${from}&to=${to}&status=NS`)
  const fixtures = data.response ?? []

  for (const f of fixtures) {
    const fixture = f.fixture
    const teams = f.teams

    await supabase.from('matches').upsert({
      fixture_id: fixture.id,
      season: SEASON,
      round: f.league.round,
      datetime: fixture.date,
      status_short: fixture.status.short,
      status_elapsed: fixture.status.elapsed,
      venue_name: fixture.venue?.name ?? null,
      referee: fixture.referee ?? null,
      home_team_name: teams.home.name,
      away_team_name: teams.away.name,
    }, { onConflict: 'fixture_id' })
  }

  return fixtures.length
}

async function syncMatchStats(fixtureId: number) {
  const data = await apiFetch(`fixtures/statistics?fixture=${fixtureId}`)
  const stats = data.response ?? []

  const home = stats[0]?.statistics ?? []
  const away = stats[1]?.statistics ?? []

  const getStat = (arr: any[], label: string) =>
    arr.find((s: any) => s.type === label)?.value ?? null

  await supabase.from('matches').update({
    home_shots_on: getStat(home, 'Shots on Goal'),
    home_shots_total: getStat(home, 'Total Shots'),
    home_corners: getStat(home, 'Corner Kicks'),
    home_fouls: getStat(home, 'Fouls'),
    home_yellow_cards: getStat(home, 'Yellow Cards'),
    home_red_cards: getStat(home, 'Red Cards'),
    home_saves: getStat(home, 'Goalkeeper Saves'),
    home_xg: getStat(home, 'expected_goals'),
    away_shots_on: getStat(away, 'Shots on Goal'),
    away_shots_total: getStat(away, 'Total Shots'),
    away_corners: getStat(away, 'Corner Kicks'),
    away_fouls: getStat(away, 'Fouls'),
    away_yellow_cards: getStat(away, 'Yellow Cards'),
    away_red_cards: getStat(away, 'Red Cards'),
    away_saves: getStat(away, 'Goalkeeper Saves'),
    away_xg: getStat(away, 'expected_goals'),
  }).eq('fixture_id', fixtureId)
}

async function syncMatchEvents(fixtureId: number) {
  const data = await apiFetch(`fixtures/events?fixture=${fixtureId}`)
  const events = data.response ?? []

  await supabase.from('match_events').delete().eq('fixture_id', fixtureId)

  for (const e of events) {
    await supabase.from('match_events').insert({
      fixture_id: fixtureId,
      elapsed: e.time.elapsed,
      elapsed_extra: e.time.extra ?? null,
      team_name: e.team.name,
      player_name: e.player.name ?? null,
      assist_name: e.assist.name ?? null,
      event_type: e.type,
      event_detail: e.detail,
    })
  }
}

async function syncLineups(fixtureId: number) {
  const data = await apiFetch(`fixtures/lineups?fixture=${fixtureId}`)
  const lineups = data.response ?? []

  if (lineups.length === 0) return

  await supabase.from('lineups').delete().eq('fixture_id', fixtureId)

  for (const team of lineups) {
    const teamName = team.team.name
    const formation = team.formation ?? null

    for (const p of team.startXI ?? []) {
      await supabase.from('lineups').insert({
        fixture_id: fixtureId,
        team_name: teamName,
        formation,
        player_id: p.player.id,
        player_name: p.player.name,
        player_number: p.player.number,
        is_substitute: false,
      })
    }

    for (const p of team.substitutes ?? []) {
      await supabase.from('lineups').insert({
        fixture_id: fixtureId,
        team_name: teamName,
        formation,
        player_id: p.player.id,
        player_name: p.player.name,
        player_number: p.player.number,
        is_substitute: true,
      })
    }
  }
}

async function syncPlayerStats(fixtureId: number) {
  const data = await apiFetch(`fixtures/players?fixture=${fixtureId}`)
  const teams = data.response ?? []

  for (const team of teams) {
    for (const p of team.players ?? []) {
      const s = p.statistics?.[0]
      if (!s) continue

      await supabase.from('players').upsert({
        player_id: p.player.id,
        season: SEASON,
        name: p.player.name,
        team_name: team.team.name,
        games: (s.games?.appearences ?? 0),
        minutes: (s.games?.minutes ?? 0),
        goals: (s.goals?.total ?? 0),
        assists: (s.goals?.assists ?? 0),
        shots_on: (s.shots?.on ?? 0),
        shots_total: (s.shots?.total ?? 0),
        fouls_committed: (s.fouls?.committed ?? 0),
        fouls_drawn: (s.fouls?.drawn ?? 0),
        yellow_cards: (s.cards?.yellow ?? 0),
        tackles_total: (s.tackles?.total ?? 0),
      }, { onConflict: 'player_id,season' })
    }
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Always sync today's fixtures for live score/status updates
    const todayCount = await syncFixtures()

    // Sync upcoming fixtures for referee/venue data
    const upcomingCount = await syncUpcomingFixtures()

    // Find today's matches to process stats/events/lineups
    const { data: todayMatches } = await supabase
      .from('matches')
      .select('fixture_id, status_short, datetime')
      .gte('datetime', `${today}T00:00:00`)
      .lte('datetime', `${today}T23:59:59`)

    let statsCount = 0
    let eventsCount = 0
    let lineupsCount = 0

    for (const match of todayMatches ?? []) {
      const isInPlay = IN_PLAY_STATUSES.includes(match.status_short ?? '')
      const isFinished = FINISHED_STATUSES.includes(match.status_short ?? '')
      const matchTime = new Date(match.datetime ?? '')
      const hoursUntil = (matchTime.getTime() - now.getTime()) / (1000 * 60 * 60)

      if (isInPlay || isFinished) {
        await syncMatchStats(match.fixture_id)
        await syncMatchEvents(match.fixture_id)
        statsCount++
        eventsCount++
      }

      if (isFinished) {
        await syncPlayerStats(match.fixture_id)
        await syncLineups(match.fixture_id)
        lineupsCount++
      }

      // Check lineups for upcoming matches within 48 hours
      if (!isInPlay && !isFinished && hoursUntil <= 48 && hoursUntil >= 0) {
        await syncLineups(match.fixture_id)
        lineupsCount++
      }

      await new Promise(r => setTimeout(r, 500))
    }

    return NextResponse.json({
      message: 'Sync complete',
      today: todayCount,
      upcoming: upcomingCount,
      stats: statsCount,
      events: eventsCount,
      lineups: lineupsCount,
    })

  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}