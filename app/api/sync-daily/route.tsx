// app/api/sync-daily/route.ts
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

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// --- Standings ---
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

// --- Team Rankings ---
async function syncTeamRankings(leagueId: number) {
  const { data: matches } = await supabase
    .from('matches')
    .select('home_team_name, away_team_name, goals_h, goals_a, home_shots_on, away_shots_on, home_shots_total, away_shots_total, home_corners, away_corners, home_fouls, away_fouls, home_yellow_cards, away_yellow_cards, home_red_cards, away_red_cards, home_saves, away_saves')
    .eq('league_id', leagueId)
    .eq('season', SEASON)
    .not('goals_h', 'is', null)

  if (!matches || matches.length === 0) return 0

  const teamStats: Record<string, Record<string, number>> = {}
  const teamGames: Record<string, number> = {}

  const statKeys = ['goals', 'conceded', 'shots_on', 'shots_total', 'corners', 'fouls', 'yellow_cards', 'red_cards', 'saves']

  for (const m of matches) {
    for (const [team, side] of [[m.home_team_name, 'home'], [m.away_team_name, 'away']] as [string, string][]) {
      if (!teamStats[team]) {
        teamStats[team] = Object.fromEntries(statKeys.map(k => [k, 0]))
        teamGames[team] = 0
      }
      teamGames[team]++
      teamStats[team].goals        += side === 'home' ? (m.goals_h ?? 0) : (m.goals_a ?? 0)
      teamStats[team].conceded     += side === 'home' ? (m.goals_a ?? 0) : (m.goals_h ?? 0)
      teamStats[team].shots_on     += side === 'home' ? (m.home_shots_on ?? 0) : (m.away_shots_on ?? 0)
      teamStats[team].shots_total  += side === 'home' ? (m.home_shots_total ?? 0) : (m.away_shots_total ?? 0)
      teamStats[team].corners      += side === 'home' ? (m.home_corners ?? 0) : (m.away_corners ?? 0)
      teamStats[team].fouls        += side === 'home' ? (m.home_fouls ?? 0) : (m.away_fouls ?? 0)
      teamStats[team].yellow_cards += side === 'home' ? (m.home_yellow_cards ?? 0) : (m.away_yellow_cards ?? 0)
      teamStats[team].red_cards    += side === 'home' ? (m.home_red_cards ?? 0) : (m.away_red_cards ?? 0)
      teamStats[team].saves        += side === 'home' ? (m.home_saves ?? 0) : (m.away_saves ?? 0)
    }
  }

  await supabase.from('team_rankings').delete().match({ league_id: leagueId, season: SEASON })

  const now = new Date().toISOString()
  let count = 0

  for (const stat of statKeys) {
    const sorted = Object.entries(teamStats).sort(
      (a, b) => (b[1][stat] / teamGames[b[0]]) - (a[1][stat] / teamGames[a[0]])
    )
    for (const [rank, [team, stats]] of sorted.entries()) {
      const games = teamGames[team]
      await supabase.from('team_rankings').upsert({
        team_name:      team,
        league_id:      leagueId,
        season:         SEASON,
        stat,
        total_value:    stats[stat],
        per_game_value: Math.round((stats[stat] / games) * 100) / 100,
        total_rank:     rank + 1,
        per_game_rank:  rank + 1,
        updated_at:     now,
      }, { onConflict: 'team_name,league_id,season,stat' })
      count++
    }
  }

  return count
}

// --- Player Rankings ---
async function syncPlayerRankings(leagueId: number) {
  const { data: players } = await supabase
    .from('players')
    .select('player_id, name, team_name, minutes, shots_on, shots_total, yellow_cards, fouls_committed, fouls_drawn, goals, assists, tackles_total')
    .eq('league_id', leagueId)
    .eq('season', SEASON)
    .gt('minutes', 90)

  if (!players || players.length === 0) return 0

  const statKeys = [
    { key: 'shots_on_target', col: 'shots_on' },
    { key: 'shots',           col: 'shots_total' },
    { key: 'bookings',        col: 'yellow_cards' },
    { key: 'fouls_committed', col: 'fouls_committed' },
    { key: 'fouls_won',       col: 'fouls_drawn' },
    { key: 'goals',           col: 'goals' },
    { key: 'assists',         col: 'assists' },
    { key: 'tackles',         col: 'tackles_total' },
  ]

  await supabase.from('player_rankings').delete().match({ league_id: leagueId, season: SEASON })

  const now = new Date().toISOString()
  let count = 0

  for (const { key, col } of statKeys) {
    const sorted = players
      .filter(p => (p as any)[col] > 0 && p.minutes > 0)
      .map(p => ({
        ...p,
        per90: ((p as any)[col] / p.minutes) * 90,
      }))
      .sort((a, b) => b.per90 - a.per90)

    for (const [rank, p] of sorted.entries()) {
      await supabase.from('player_rankings').upsert({
        player_id:    p.player_id,
        player_name:  p.name,
        team_name:    p.team_name,
        league_id:    leagueId,
        season:       SEASON,
        stat:         key,
        per90_value:  Math.round(p.per90 * 100) / 100,
        per90_rank:   rank + 1,
        updated_at:   now,
      }, { onConflict: 'player_id,league_id,season,stat' })
      count++
    }
  }

  return count
}

// --- Referee Rankings ---
async function syncRefereeRankings(leagueId: number) {
  const { data: matches } = await supabase
    .from('matches')
    .select('referee, home_yellow_cards, away_yellow_cards, home_red_cards, away_red_cards, home_fouls, away_fouls')
    .eq('league_id', leagueId)
    .eq('season', SEASON)
    .not('goals_h', 'is', null)
    .not('referee', 'is', null)

  if (!matches || matches.length === 0) return 0

  const refStats: Record<string, { yellows: number, reds: number, fouls: number, games: number }> = {}

  for (const m of matches) {
    if (!m.referee) continue
    const name = m.referee.split(',')[0].trim()
    if (!refStats[name]) refStats[name] = { yellows: 0, reds: 0, fouls: 0, games: 0 }
    refStats[name].games++
    refStats[name].yellows += (m.home_yellow_cards ?? 0) + (m.away_yellow_cards ?? 0)
    refStats[name].reds    += (m.home_red_cards ?? 0) + (m.away_red_cards ?? 0)
    refStats[name].fouls   += (m.home_fouls ?? 0) + (m.away_fouls ?? 0)
  }

  await supabase.from('referee_rankings').delete().match({ league_id: leagueId, season: SEASON })

  const now = new Date().toISOString()
  let count = 0

  for (const stat of ['yellows', 'reds', 'fouls'] as const) {
    const sorted = Object.entries(refStats).sort(
      (a, b) => (b[1][stat] / b[1].games) - (a[1][stat] / a[1].games)
    )
    for (const [rank, [name, stats]] of sorted.entries()) {
      await supabase.from('referee_rankings').upsert({
        referee_name:  name,
        league_id:     leagueId,
        season:        SEASON,
        stat,
        per_game_value: Math.round((stats[stat] / stats.games) * 100) / 100,
        per_game_rank:  rank + 1,
        updated_at:     now,
      }, { onConflict: 'referee_name,league_id,season,stat' })
      count++
    }
  }

  return count
}

// --- Player Predictions ---
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

  const categories = [
    { key: 'shots_on_target', col: 'shots_on' },
    { key: 'shots',           col: 'shots_total' },
    { key: 'bookings',        col: 'yellow_cards' },
    { key: 'fouls_committed', col: 'fouls_committed' },
    { key: 'fouls_won',       col: 'fouls_drawn' },
  ]

  let count = 0

  for (const match of upcomingMatches) {
    // Check if lineups confirmed
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
      const ranked = matchPlayers
        .map((p: any) => ({
          ...p,
          per90: p.minutes > 0 ? (p[cat.col] / p.minutes) * 90 : 0,
        }))
        .filter((p: any) => p[cat.col] > 0)
        .sort((a: any, b: any) => b.per90 - a.per90)

      ranked.forEach((p: any, i: number) => {
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
      const standings    = await syncStandings(leagueId)
      await delay(300)
      const teamRankings = await syncTeamRankings(leagueId)
      await delay(300)
      const playerRankings = await syncPlayerRankings(leagueId)
      await delay(300)
      const refRankings  = await syncRefereeRankings(leagueId)
      await delay(300)
      const predictions  = await syncPredictions(leagueId)
      await delay(300)

      results[leagueId] = { standings, teamRankings, playerRankings, refRankings, predictions }
    }

    return NextResponse.json({ message: 'Daily sync complete', results })

  } catch (err) {
    console.error('sync-daily error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}