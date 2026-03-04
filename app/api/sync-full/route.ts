import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const API_KEY = process.env.API_FOOTBALL_KEY!
const LEAGUE_ID = 39
const SEASON = 2025
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

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Teams ────────────────────────────────────────────────────────────────────
async function syncTeams() {
  const data = await apiFetch(`teams?league=${LEAGUE_ID}&season=${SEASON}`)
  const teams = data.response ?? []

  await Promise.all(teams.map((t: any) =>
    supabase.from('teams').upsert({
      team_id:         t.team.id,
      league_id:       LEAGUE_ID,
      season:          SEASON,
      name:            t.team.name,
      code:            t.team.code ?? null,
      country:         t.team.country ?? null,
      founded:         t.team.founded ?? null,
      logo:            t.team.logo ?? null,
      venue_name:      t.venue.name ?? null,
      venue_city:      t.venue.city ?? null,
      venue_capacity:  t.venue.capacity ?? null,
      venue_surface:   t.venue.surface ?? null,
    }, { onConflict: 'team_id,season' })
  ))

  return teams.length
}

// ── Standings ────────────────────────────────────────────────────────────────
async function syncStandings() {
  const data = await apiFetch(`standings?league=${LEAGUE_ID}&season=${SEASON}`)
  const standings = data.response?.[0]?.league?.standings?.[0] ?? []

  await Promise.all(standings.map((s: any) =>
    supabase.from('standings').upsert({
      league_id:           LEAGUE_ID,
      season:              SEASON,
      team_id:             s.team.id,
      team_name:           s.team.name,
      rank:                s.rank,
      points:              s.points,
      goals_diff:          s.goalsDiff,
      form:                s.form ?? null,
      status:              s.status ?? null,
      description:         s.description ?? null,
      played:              s.all.played,
      win:                 s.all.win,
      draw:                s.all.draw,
      lose:                s.all.lose,
      goals_for:           s.all.goals.for,
      goals_against:       s.all.goals.against,
      home_played:         s.home.played,
      home_win:            s.home.win,
      home_draw:           s.home.draw,
      home_lose:           s.home.lose,
      home_goals_for:      s.home.goals.for,
      home_goals_against:  s.home.goals.against,
      away_played:         s.away.played,
      away_win:            s.away.win,
      away_draw:           s.away.draw,
      away_lose:           s.away.lose,
      away_goals_for:      s.away.goals.for,
      away_goals_against:  s.away.goals.against,
      updated_at:          new Date().toISOString(),
    }, { onConflict: 'league_id,season,team_id' })
  ))

  return standings.length
}

// ── All season fixtures ───────────────────────────────────────────────────────
async function syncAllFixtures() {
  const data = await apiFetch(`fixtures?league=${LEAGUE_ID}&season=${SEASON}`)
  const fixtures = data.response ?? []

  // Batch upserts in chunks of 50
  for (let i = 0; i < fixtures.length; i += 50) {
    const chunk = fixtures.slice(i, i + 50)
    await Promise.all(chunk.map((f: any) =>
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
  }

  return fixtures.length
}

// ── Match stats ───────────────────────────────────────────────────────────────
async function syncMatchStats(fixtureId: number) {
  const data = await apiFetch(`fixtures/statistics?fixture=${fixtureId}`)
  const stats = data.response ?? []

  const home = stats[0]?.statistics ?? []
  const away = stats[1]?.statistics ?? []

  const getStat = (arr: any[], label: string) =>
    arr.find((s: any) => s.type === label)?.value ?? null

  await supabase.from('matches').update({
    home_shots_total:     getStat(home, 'Total Shots'),
    home_shots_on:        getStat(home, 'Shots on Goal'),
    home_shots_off:       getStat(home, 'Shots off Goal'),
    home_shots_blocked:   getStat(home, 'Blocked Shots'),
    home_shots_box:       getStat(home, 'Shots insidebox'),
    home_shots_outside:   getStat(home, 'Shots outsidebox'),
    home_possession:      parseInt(getStat(home, 'Ball Possession') ?? '0'),
    home_passes_total:    getStat(home, 'Total passes'),
    home_passes_accurate: getStat(home, 'Passes accurate'),
    home_passes_pct:      parseInt(getStat(home, 'Passes %') ?? '0'),
    home_fouls:           getStat(home, 'Fouls'),
    home_corners:         getStat(home, 'Corner Kicks'),
    home_offsides:        getStat(home, 'Offsides'),
    home_yellow_cards:    getStat(home, 'Yellow Cards'),
    home_red_cards:       getStat(home, 'Red Cards'),
    home_saves:           getStat(home, 'Goalkeeper Saves'),
    home_xg:              getStat(home, 'expected_goals'),
    away_shots_total:     getStat(away, 'Total Shots'),
    away_shots_on:        getStat(away, 'Shots on Goal'),
    away_shots_off:       getStat(away, 'Shots off Goal'),
    away_shots_blocked:   getStat(away, 'Blocked Shots'),
    away_shots_box:       getStat(away, 'Shots insidebox'),
    away_shots_outside:   getStat(away, 'Shots outsidebox'),
    away_possession:      parseInt(getStat(away, 'Ball Possession') ?? '0'),
    away_passes_total:    getStat(away, 'Total passes'),
    away_passes_accurate: getStat(away, 'Passes accurate'),
    away_passes_pct:      parseInt(getStat(away, 'Passes %') ?? '0'),
    away_fouls:           getStat(away, 'Fouls'),
    away_corners:         getStat(away, 'Corner Kicks'),
    away_offsides:        getStat(away, 'Offsides'),
    away_yellow_cards:    getStat(away, 'Yellow Cards'),
    away_red_cards:       getStat(away, 'Red Cards'),
    away_saves:           getStat(away, 'Goalkeeper Saves'),
    away_xg:              getStat(away, 'expected_goals'),
  }).eq('fixture_id', fixtureId)
}

// ── Match events ──────────────────────────────────────────────────────────────
async function syncMatchEvents(fixtureId: number) {
  const data = await apiFetch(`fixtures/events?fixture=${fixtureId}`)
  const events = data.response ?? []

  await supabase.from('match_events').delete().eq('fixture_id', fixtureId)

  if (events.length === 0) return

  await supabase.from('match_events').insert(
    events.map((e: any) => ({
      fixture_id:    fixtureId,
      elapsed:       e.time.elapsed,
      elapsed_extra: e.time.extra ?? null,
      team_id:       e.team.id ?? null,
      team_name:     e.team.name,
      player_id:     e.player.id ?? null,
      player_name:   e.player.name ?? null,
      assist_id:     e.assist.id ?? null,
      assist_name:   e.assist.name ?? null,
      event_type:    e.type,
      event_detail:  e.detail,
      comments:      e.comments ?? null,
    }))
  )
}

// ── Player stats ──────────────────────────────────────────────────────────────
async function syncPlayerStats(fixtureId: number) {
  const data = await apiFetch(`fixtures/players?fixture=${fixtureId}`)
  const teams = data.response ?? []

  for (const team of teams) {
    for (const p of team.players ?? []) {
      const s = p.statistics?.[0]
      if (!s) continue

      await supabase.from('players').upsert({
        player_id:       p.player.id,
        league_id:       LEAGUE_ID,
        team_id:         team.team.id,
        team_name:       team.team.name,
        season:          SEASON,
        name:            p.player.name,
        games:           s.games?.appearences ?? 0,
        minutes:         s.games?.minutes ?? 0,
        goals:           s.goals?.total ?? 0,
        assists:         s.goals?.assists ?? 0,
        shots_on:        s.shots?.on ?? 0,
        shots_total:     s.shots?.total ?? 0,
        fouls_committed: s.fouls?.committed ?? 0,
        fouls_drawn:     s.fouls?.drawn ?? 0,
        yellow_cards:    s.cards?.yellow ?? 0,
        tackles_total:   s.tackles?.total ?? 0,
        rating:          parseFloat(s.games?.rating ?? '0') || null,
        position:        s.games?.position ?? null,
      }, { onConflict: 'player_id,season' })
    }
  }
}

// ── Lineups ───────────────────────────────────────────────────────────────────
async function syncLineups(fixtureId: number) {
  const data = await apiFetch(`fixtures/lineups?fixture=${fixtureId}`)
  const lineups = data.response ?? []

  if (lineups.length === 0) return

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
}

// ── Rankings (reuse logic inline) ─────────────────────────────────────────────
async function syncRankings() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sync-rankings`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  return res.ok
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Teams
    const teamsCount = await syncTeams()
    await delay(200)

    // 2. Standings
    const standingsCount = await syncStandings()
    await delay(200)

    // 3. All season fixtures
    const fixturesCount = await syncAllFixtures()
    await delay(200)

    // 4. Per-match data for all finished matches
    const { data: finishedMatches } = await supabase
      .from('matches')
      .select('fixture_id')
      .eq('league_id', LEAGUE_ID)
      .eq('season', SEASON)
      .in('status_short', FINISHED_STATUSES)

    const finished = finishedMatches ?? []
    let statsCount = 0
    let eventsCount = 0
    let playerStatsCount = 0
    let lineupsCount = 0

    for (const match of finished) {
      await syncMatchStats(match.fixture_id)
      statsCount++

      await syncMatchEvents(match.fixture_id)
      eventsCount++

      await syncPlayerStats(match.fixture_id)
      playerStatsCount++

      await syncLineups(match.fixture_id)
      lineupsCount++

      await delay(200)
    }

    // 5. Rankings
    await syncRankings()

    return NextResponse.json({
      message:      'Full sync complete',
      teams:        teamsCount,
      standings:    standingsCount,
      fixtures:     fixturesCount,
      stats:        statsCount,
      events:       eventsCount,
      playerStats:  playerStatsCount,
      lineups:      lineupsCount,
    })

  } catch (err) {
    console.error('sync-full error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
