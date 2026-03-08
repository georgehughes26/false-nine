import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const LEAGUE_IDS = [39, 40]
const SEASON = 2025

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  const now = new Date().toISOString()
  const rows: any[] = []

  for (const stat of statKeys) {
    const sorted = Object.entries(teamStats).sort(
      (a, b) => (b[1][stat] / teamGames[b[0]]) - (a[1][stat] / teamGames[a[0]])
    )
    for (const [rank, [team, stats]] of sorted.entries()) {
      const games = teamGames[team]
      rows.push({
        team_name:      team,
        league_id:      leagueId,
        season:         SEASON,
        stat,
        total_value:    stats[stat],
        per_game_value: Math.round((stats[stat] / games) * 100) / 100,
        total_rank:     rank + 1,
        per_game_rank:  rank + 1,
        updated_at:     now,
      })
    }
  }

  await supabase.from('team_rankings').delete().match({ league_id: leagueId, season: SEASON })
  if (rows.length > 0) await supabase.from('team_rankings').insert(rows)

  return rows.length
}

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

  const now = new Date().toISOString()
  const rows: any[] = []

  for (const { key, col } of statKeys) {
    const sorted = (players as any[])
      .filter(p => p[col] > 0 && p.minutes > 0)
      .map(p => ({ ...p, per90: (p[col] / p.minutes) * 90 }))
      .sort((a, b) => b.per90 - a.per90)

    for (const [rank, p] of sorted.entries()) {
      rows.push({
        player_id:   p.player_id,
        player_name: p.name,
        team_name:   p.team_name,
        league_id:   leagueId,
        season:      SEASON,
        stat:        key,
        per90_value: Math.round(p.per90 * 100) / 100,
        per90_rank:  rank + 1,
        updated_at:  now,
      })
    }
  }

  await supabase.from('player_rankings').delete().match({ league_id: leagueId, season: SEASON })
  if (rows.length > 0) await supabase.from('player_rankings').insert(rows)

  return rows.length
}

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

  const now = new Date().toISOString()
  const rows: any[] = []

  for (const stat of ['yellows', 'reds', 'fouls'] as const) {
    const sorted = Object.entries(refStats).sort(
      (a, b) => (b[1][stat] / b[1].games) - (a[1][stat] / a[1].games)
    )
    for (const [rank, [name, stats]] of sorted.entries()) {
      rows.push({
        referee_name:   name,
        league_id:      leagueId,
        season:         SEASON,
        stat,
        per_game_value: Math.round((stats[stat] / stats.games) * 100) / 100,
        per_game_rank:  rank + 1,
        updated_at:     now,
      })
    }
  }

  await supabase.from('referee_rankings').delete().match({ league_id: leagueId, season: SEASON })
  if (rows.length > 0) await supabase.from('referee_rankings').insert(rows)

  return rows.length
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results: Record<string, any> = {}
    for (const leagueId of LEAGUE_IDS) {
      const teamRankings   = await syncTeamRankings(leagueId)
      const playerRankings = await syncPlayerRankings(leagueId)
      const refRankings    = await syncRefereeRankings(leagueId)
      results[leagueId] = { teamRankings, playerRankings, refRankings }
    }
    return NextResponse.json({ message: 'Rankings synced', results })
  } catch (err) {
    console.error('sync-rankings error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}