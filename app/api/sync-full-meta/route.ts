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

async function syncTeams() {
  const data = await apiFetch(`teams?league=${LEAGUE_ID}&season=${SEASON}`)
  const teams = data.response ?? []

  await Promise.all(teams.map((t: any) =>
    supabase.from('teams').upsert({
      team_id:        t.team.id,
      league_id:      LEAGUE_ID,
      season:         SEASON,
      name:           t.team.name,
      code:           t.team.code ?? null,
      country:        t.team.country ?? null,
      founded:        t.team.founded ?? null,
      logo:           t.team.logo ?? null,
      venue_name:     t.venue.name ?? null,
      venue_city:     t.venue.city ?? null,
      venue_capacity: t.venue.capacity ?? null,
      venue_surface:  t.venue.surface ?? null,
    }, { onConflict: 'team_id,season' })
  ))

  return teams.length
}

async function syncStandings() {
  const data = await apiFetch(`standings?league=${LEAGUE_ID}&season=${SEASON}`)
  const standings = data.response?.[0]?.league?.standings?.[0] ?? []

  await Promise.all(standings.map((s: any) =>
    supabase.from('standings').upsert({
      league_id:          LEAGUE_ID,
      season:             SEASON,
      team_id:            s.team.id,
      team_name:          s.team.name,
      rank:               s.rank,
      points:             s.points,
      goals_diff:         s.goalsDiff,
      form:               s.form ?? null,
      status:             s.status ?? null,
      description:        s.description ?? null,
      played:             s.all.played,
      win:                s.all.win,
      draw:               s.all.draw,
      lose:               s.all.lose,
      goals_for:          s.all.goals.for,
      goals_against:      s.all.goals.against,
      home_played:        s.home.played,
      home_win:           s.home.win,
      home_draw:          s.home.draw,
      home_lose:          s.home.lose,
      home_goals_for:     s.home.goals.for,
      home_goals_against: s.home.goals.against,
      away_played:        s.away.played,
      away_win:           s.away.win,
      away_draw:          s.away.draw,
      away_lose:          s.away.lose,
      away_goals_for:     s.away.goals.for,
      away_goals_against: s.away.goals.against,
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'league_id,season,team_id' })
  ))

  return standings.length
}

async function syncAllFixtures() {
  const data = await apiFetch(`fixtures?league=${LEAGUE_ID}&season=${SEASON}`)
  const fixtures = data.response ?? []

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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const teamsCount = await syncTeams()
    const standingsCount = await syncStandings()
    const fixturesCount = await syncAllFixtures()

    return NextResponse.json({
      message:   'Meta sync complete',
      teams:     teamsCount,
      standings: standingsCount,
      fixtures:  fixturesCount,
    })

  } catch (err) {
    console.error('sync-full-meta error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}