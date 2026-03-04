import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SEASON = 2025
const MIN_GAMES = 10

const TEAM_STATS = [
  'goals', 'conceded', 'sot', 'shots', 'corners', 'fouls', 'yellows', 'reds', 'saves'
]

const PLAYER_STATS = [
  { key: 'goals',            col: 'goals' },
  { key: 'assists',          col: 'assists' },
  { key: 'shots_on',        col: 'shots_on' },
  { key: 'shots_total',     col: 'shots_total' },
  { key: 'fouls_committed', col: 'fouls_committed' },
  { key: 'fouls_drawn',     col: 'fouls_drawn' },
  { key: 'yellow_cards',    col: 'yellow_cards' },
  { key: 'tackles',         col: 'tackles_total' },
]

function rank(items: { name: string, value: number }[], ascending = false): { name: string, value: number, rank: number }[] {
  const sorted = [...items].sort((a, b) => ascending ? a.value - b.value : b.value - a.value)
  return sorted.map((item, i) => ({ ...item, rank: i + 1 }))
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── 1. Team rankings ───────────────────────────────────────────────────
    const { data: homeMatches } = await supabase
      .from('matches')
      .select('home_team_name, goals_h, goals_a, home_shots_on, home_shots_total, home_corners, home_fouls, home_yellow_cards, home_red_cards, home_saves')
      .eq('season', SEASON)
      .not('goals_h', 'is', null)

    const { data: awayMatches } = await supabase
      .from('matches')
      .select('away_team_name, goals_h, goals_a, away_shots_on, away_shots_total, away_corners, away_fouls, away_yellow_cards, away_red_cards, away_saves')
      .eq('season', SEASON)
      .not('goals_h', 'is', null)

    const hm = homeMatches ?? []
    const am = awayMatches ?? []

    const teamMap: Record<string, Record<string, number>> = {}

    const ensureTeam = (name: string) => {
      if (!teamMap[name]) {
        teamMap[name] = { games: 0, goals: 0, conceded: 0, sot: 0, shots: 0, corners: 0, fouls: 0, yellows: 0, reds: 0, saves: 0 }
      }
    }

    for (const m of hm) {
      ensureTeam(m.home_team_name)
      const t = teamMap[m.home_team_name]
      t.games++
      t.goals     += m.goals_h ?? 0
      t.conceded  += m.goals_a ?? 0
      t.sot       += m.home_shots_on ?? 0
      t.shots     += m.home_shots_total ?? 0
      t.corners   += m.home_corners ?? 0
      t.fouls     += m.home_fouls ?? 0
      t.yellows   += m.home_yellow_cards ?? 0
      t.reds      += m.home_red_cards ?? 0
      t.saves     += m.home_saves ?? 0
    }

    for (const m of am) {
      ensureTeam(m.away_team_name)
      const t = teamMap[m.away_team_name]
      t.games++
      t.goals     += m.goals_a ?? 0
      t.conceded  += m.goals_h ?? 0
      t.sot       += m.away_shots_on ?? 0
      t.shots     += m.away_shots_total ?? 0
      t.corners   += m.away_corners ?? 0
      t.fouls     += m.away_fouls ?? 0
      t.yellows   += m.away_yellow_cards ?? 0
      t.reds      += m.away_red_cards ?? 0
      t.saves     += m.away_saves ?? 0
    }

    const ascendingStats = new Set(['conceded', 'fouls', 'yellows', 'reds'])

    const teamRankingRows: any[] = []

    for (const stat of TEAM_STATS) {
      const items = Object.entries(teamMap).map(([name, data]) => ({
        name,
        perGameValue: data.games > 0 ? data[stat] / data.games : 0,
      }))

      const ascending = ascendingStats.has(stat)
      const perGameRanked = rank(items.map(i => ({ name: i.name, value: i.perGameValue })), ascending)

      for (const item of items) {
        const pgr = perGameRanked.find(r => r.name === item.name)
        teamRankingRows.push({
          team_name: item.name,
          season: SEASON,
          stat,
          per_game_value: Math.round(item.perGameValue * 100) / 100,
          per_game_rank: pgr?.rank ?? null,
          updated_at: new Date().toISOString(),
        })
      }
    }

    if (teamRankingRows.length > 0) {
      await supabase.from('team_rankings').upsert(teamRankingRows, {
        onConflict: 'team_name,season,stat'
      })
    }

    // ── 2. Player rankings ─────────────────────────────────────────────────
    const { data: players } = await supabase
      .from('players')
      .select('player_id, name, team_name, games, minutes, goals, assists, shots_on, shots_total, fouls_committed, fouls_drawn, yellow_cards, tackles_total')
      .eq('season', SEASON)
      .gte('games', MIN_GAMES)
      .gt('minutes', 90)

    const playerRankingRows: any[] = []

    for (const ps of PLAYER_STATS) {
      const items = (players ?? []).map(p => ({
        player_id: p.player_id,
        player_name: p.name,
        team_name: p.team_name,
        value: p.minutes > 0 ? ((p[ps.col as keyof typeof p] as number ?? 0) / p.minutes) * 90 : 0,
      }))

      const ascending = ps.key === 'yellow_cards' || ps.key === 'fouls_committed'
      const ranked = rank(items.map(i => ({ name: String(i.player_id), value: i.value })), ascending)

      for (const item of items) {
        const r = ranked.find(r => r.name === String(item.player_id))
        playerRankingRows.push({
          player_id: item.player_id,
          player_name: item.player_name,
          team_name: item.team_name,
          season: SEASON,
          stat: ps.key,
          per90_value: Math.round(item.value * 100) / 100,
          per90_rank: r?.rank ?? null,
          updated_at: new Date().toISOString(),
        })
      }
    }

    if (playerRankingRows.length > 0) {
      await supabase.from('player_rankings').upsert(playerRankingRows, {
        onConflict: 'player_id,season,stat'
      })
    }

    return NextResponse.json({
      message: 'Rankings sync complete',
      teamsProcessed: Object.keys(teamMap).length,
      playersProcessed: (players ?? []).length,
    })

  } catch (err) {
    console.error('Rankings sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}