import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const LEAGUE_IDS = [39, 40]
const SEASON = 2025
const MIN_GAMES = 10

const TEAM_STATS = [
  'goals', 'conceded', 'sot', 'shots', 'corners', 'fouls', 'yellows', 'reds', 'saves'
]

const PLAYER_STATS = [
  { key: 'goals',           col: 'goals' },
  { key: 'assists',         col: 'assists' },
  { key: 'shots_on',        col: 'shots_on' },
  { key: 'shots_total',     col: 'shots_total' },
  { key: 'fouls_committed', col: 'fouls_committed' },
  { key: 'fouls_drawn',     col: 'fouls_drawn' },
  { key: 'yellow_cards',    col: 'yellow_cards' },
  { key: 'tackles',         col: 'tackles_total' },
]

const REF_STATS = ['yellows', 'reds', 'fouls']

function rank(items: { name: string, value: number }[]): { name: string, value: number, rank: number }[] {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  return sorted.map((item, i) => ({ ...item, rank: i + 1 }))
}

async function syncLeagueRankings(leagueId: number) {
  // ── 1. Team rankings ───────────────────────────────────────────────────
  const { data: homeMatches } = await supabase
    .from('matches')
    .select('home_team_name, goals_h, goals_a, home_shots_on, home_shots_total, home_corners, home_fouls, home_yellow_cards, home_red_cards, home_saves')
    .eq('league_id', leagueId)
    .eq('season', SEASON)
    .not('goals_h', 'is', null)

  const { data: awayMatches } = await supabase
    .from('matches')
    .select('away_team_name, goals_h, goals_a, away_shots_on, away_shots_total, away_corners, away_fouls, away_yellow_cards, away_red_cards, away_saves')
    .eq('league_id', leagueId)
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
    t.goals    += m.goals_h ?? 0
    t.conceded += m.goals_a ?? 0
    t.sot      += m.home_shots_on ?? 0
    t.shots    += m.home_shots_total ?? 0
    t.corners  += m.home_corners ?? 0
    t.fouls    += m.home_fouls ?? 0
    t.yellows  += m.home_yellow_cards ?? 0
    t.reds     += m.home_red_cards ?? 0
    t.saves    += m.home_saves ?? 0
  }

  for (const m of am) {
    ensureTeam(m.away_team_name)
    const t = teamMap[m.away_team_name]
    t.games++
    t.goals    += m.goals_a ?? 0
    t.conceded += m.goals_h ?? 0
    t.sot      += m.away_shots_on ?? 0
    t.shots    += m.away_shots_total ?? 0
    t.corners  += m.away_corners ?? 0
    t.fouls    += m.away_fouls ?? 0
    t.yellows  += m.away_yellow_cards ?? 0
    t.reds     += m.away_red_cards ?? 0
    t.saves    += m.away_saves ?? 0
  }

  const teamRankingRows: any[] = []

  for (const stat of TEAM_STATS) {
    const items = Object.entries(teamMap).map(([name, data]) => ({
      name,
      perGameValue: data.games > 0 ? data[stat] / data.games : 0,
    }))

    const perGameRanked = rank(items.map(i => ({ name: i.name, value: i.perGameValue })))

    for (const item of items) {
      const pgr = perGameRanked.find(r => r.name === item.name)
      teamRankingRows.push({
        team_name:      item.name,
        league_id:      leagueId,
        season:         SEASON,
        stat,
        per_game_value: Math.round(item.perGameValue * 100) / 100,
        per_game_rank:  pgr?.rank ?? null,
        updated_at:     new Date().toISOString(),
      })
    }
  }

  if (teamRankingRows.length > 0) {
    await supabase.from('team_rankings').upsert(teamRankingRows, {
      onConflict: 'team_name,league_id,season,stat'
    })
  }

  // ── 2. Player rankings ─────────────────────────────────────────────────
  const { data: players } = await supabase
    .from('players')
    .select('player_id, name, team_name, games, minutes, goals, assists, shots_on, shots_total, fouls_committed, fouls_drawn, yellow_cards, tackles_total')
    .eq('league_id', leagueId)
    .eq('season', SEASON)
    .gte('games', MIN_GAMES)
    .gt('minutes', 90)

  const playerRankingRows: any[] = []

  for (const ps of PLAYER_STATS) {
    const allItems = (players ?? []).map(p => ({
      player_id:   p.player_id,
      player_name: p.name,
      team_name:   p.team_name,
      rawValue:    p[ps.col as keyof typeof p] as number | null,
      value:       p.minutes > 0 ? ((p[ps.col as keyof typeof p] as number ?? 0) / p.minutes) * 90 : 0,
    }))

    const rankableItems = allItems.filter(i => i.rawValue !== null && i.rawValue > 0)
    const ranked = rank(rankableItems.map(i => ({ name: String(i.player_id), value: i.value })))

    for (const item of rankableItems) {
      const r = ranked.find(r => r.name === String(item.player_id))
      playerRankingRows.push({
        player_id:   item.player_id,
        player_name: item.player_name,
        team_name:   item.team_name,
        league_id:   leagueId,
        season:      SEASON,
        stat:        ps.key,
        per90_value: Math.round(item.value * 100) / 100,
        per90_rank:  r?.rank ?? null,
        updated_at:  new Date().toISOString(),
      })
    }
  }

  if (playerRankingRows.length > 0) {
    await supabase.from('player_rankings').upsert(playerRankingRows, {
      onConflict: 'player_id,league_id,season,stat'
    })
  }

  // ── 3. Referee rankings ────────────────────────────────────────────────
  const { data: allMatches } = await supabase
    .from('matches')
    .select('referee, home_yellow_cards, away_yellow_cards, home_red_cards, away_red_cards, home_fouls, away_fouls')
    .eq('league_id', leagueId)
    .eq('season', SEASON)
    .not('goals_h', 'is', null)
    .not('referee', 'is', null)

  const refMap: Record<string, { games: number, yellows: number, reds: number, fouls: number, fullName: string }> = {}

  for (const m of allMatches ?? []) {
    const raw = m.referee.split(',')[0].trim()
    const lastName = raw.split(' ').pop() ?? raw
    if (!refMap[lastName]) {
      refMap[lastName] = { games: 0, yellows: 0, reds: 0, fouls: 0, fullName: raw }
    }
    const r = refMap[lastName]
    if (raw.length > r.fullName.length) r.fullName = raw
    r.games++
    r.yellows += (m.home_yellow_cards ?? 0) + (m.away_yellow_cards ?? 0)
    r.reds    += (m.home_red_cards ?? 0) + (m.away_red_cards ?? 0)
    r.fouls   += (m.home_fouls ?? 0) + (m.away_fouls ?? 0)
  }

  const qualifiedRefs = Object.entries(refMap)
  const refRankingRows: any[] = []

  for (const stat of REF_STATS) {
    const items = qualifiedRefs.map(([, data]) => ({
      name:         data.fullName,
      perGameValue: (data[stat as keyof typeof data] as number) / data.games,
    }))

    const perGameRanked = rank(items.map(i => ({ name: i.name, value: i.perGameValue })))

    for (const item of items) {
      const pgr = perGameRanked.find(r => r.name === item.name)
      refRankingRows.push({
        referee_name:   item.name,
        league_id:      leagueId,
        season:         SEASON,
        stat,
        per_game_value: Math.round(item.perGameValue * 100) / 100,
        per_game_rank:  pgr?.rank ?? null,
        updated_at:     new Date().toISOString(),
      })
    }
  }

  if (refRankingRows.length > 0) {
    await supabase.from('referee_rankings').upsert(refRankingRows, {
      onConflict: 'referee_name,league_id,season,stat'
    })
  }

  return {
    teams: Object.keys(teamMap).length,
    players: (players ?? []).length,
    referees: qualifiedRefs.length,
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results: Record<number, any> = {}

    for (const leagueId of LEAGUE_IDS) {
      results[leagueId] = await syncLeagueRankings(leagueId)
    }

    return NextResponse.json({
      message: 'Rankings sync complete',
      results,
    })

  } catch (err) {
    console.error('sync-rankings error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}