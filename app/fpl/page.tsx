import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import FPLFixtureDifficulty from './FPLFixtureDifficulty'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CaptainPick {
  rank: number
  playerName: string
  teamName: string
  teamCode: string
  position: string
  opponent: string
  opponentCode: string
  isHome: boolean
  difficulty: number
  xP: number
  fplPrice: string | null
  fplOwnership: string | null
  fplForm: string | null
  fplTotalPoints: number | null
  pointsPerCost: string | null
  xGPer90: string
  xAPer90: string
  defConPerGame: string
  isPenaltyTaker: boolean
  isSetPieceTaker: boolean
  status: string
  chanceOfPlaying: number | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
}

function xgdToRating(xgd: number): number {
  if (xgd > 1.0) return 1
  if (xgd > 0.3) return 2
  if (xgd > -0.3) return 3
  if (xgd > -1.0) return 4
  return 5
}

function cleanSheetProbability(oppExpectedGoals: number): number {
  return Math.round(Math.exp(-oppExpectedGoals) * 100)
}

function csToRating(csPct: number): number {
  if (csPct >= 40) return 1
  if (csPct >= 20) return 3
  return 5
}

function parseForm(form: string | null): number {
  if (!form) return 0.5
  const results = form.split('').slice(-5)
  const points = results.reduce((acc, r) => {
    if (r === 'W') return acc + 1
    if (r === 'D') return acc + 0.4
    return acc
  }, 0)
  return points / results.length
}

function fmt2(val: string | number): string {
  const n = parseFloat(String(val))
  return isNaN(n) ? '0.00' : n.toFixed(2)
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val))
}

function goalPoints(position: string): number {
  if (position === 'Defender') return 6
  if (position === 'Midfielder') return 5
  return 4
}

function csPoints(position: string): number {
  if (position === 'Defender') return 4
  if (position === 'Midfielder') return 1
  return 0
}

const POSITION_MAP: Record<number, string> = {
  1: 'Goalkeeper',
  2: 'Defender',
  3: 'Midfielder',
  4: 'Attacker',
}

// ─── xP Formula ──────────────────────────────────────────────────────────────
//
// defConRaw from FPL is a season total, not a true per-90.
// We correct: truDefConPer90 = defConRaw / (minutes / 90)

function computeXP({
  position,
  minutes,
  starts,
  availability,
  goalsScored,
  xGPer90,
  assistsTotal,
  xAPer90,
  xGCPer90,
  csPer90,
  defConRaw,
  isPenaltyTaker,
  isSetPieceTaker,
  opponentXgA,
  opponentXgF,
  leagueAvgXgA,
  leagueAvgXgF,
}: {
  position: string
  minutes: number
  starts: number
  availability: number
  goalsScored: number
  xGPer90: number
  assistsTotal: number
  xAPer90: number
  xGCPer90: number
  csPer90: number
  defConRaw: number
  isPenaltyTaker: boolean
  isSetPieceTaker: boolean
  opponentXgA: number
  opponentXgF: number
  leagueAvgXgA: number
  leagueAvgXgF: number
}): number {
  const avgMins   = minutes / Math.max(starts, 1)
  const minsRatio = avgMins / 90
  const mins90    = minutes / 90

  // ── Appearance ────────────────────────────────────────────────────────────
  const p60           = clamp((avgMins - 45) / 30, 0, 1)
  const appearance_xP = (p60 * 2 + (1 - p60) * 1) * availability

  // ── Fixture multiplier ────────────────────────────────────────────────────
  const oppDefRatio = leagueAvgXgA > 0 ? opponentXgA / leagueAvgXgA : 1
  const fixtureMult = clamp(0.85 + (oppDefRatio * 0.30), 0.85, 1.15)

  // ── Goals ─────────────────────────────────────────────────────────────────
  const actualGoalsPer90 = mins90 > 0 ? goalsScored / mins90 : 0
  const blendedXGPer90   = (xGPer90 * 0.7) + (actualGoalsPer90 * 0.3)
  const xGPerGame        = blendedXGPer90 * minsRatio * fixtureMult
  const goal_xP          = xGPerGame * goalPoints(position)

  // ── Assists ───────────────────────────────────────────────────────────────
  const actualAssistsPer90 = mins90 > 0 ? assistsTotal / mins90 : 0
  const blendedXAPer90     = (xAPer90 * 0.7) + (actualAssistsPer90 * 0.3)
  const xAPerGame          = blendedXAPer90 * minsRatio * fixtureMult
  const assist_xP          = xAPerGame * 3

  // ── Clean sheet ───────────────────────────────────────────────────────────
  const csPts = csPoints(position)
  let cs_xP = 0
  if (csPts > 0) {
    const xGCPerGame    = xGCPer90 * minsRatio
    const oppAttRatio   = leagueAvgXgF > 0 ? opponentXgF / leagueAvgXgF : 1
    const adjustedXGC   = xGCPerGame * oppAttRatio
    const poissonCS     = Math.exp(-adjustedXGC)
    const historicalCS  = csPer90 * minsRatio
    const csProbability = clamp((poissonCS * 0.6) + (historicalCS * 0.4), 0, 1)
    cs_xP = csProbability * csPts
  }

  // ── Defensive contribution ────────────────────────────────────────────────
  const truDefConPer90 = mins90 > 0 ? defConRaw / mins90 : 0
  const defConPerGame  = truDefConPer90 * minsRatio
  let def_xP = 0
  if (position === 'Defender') {
    def_xP = (defConPerGame / 10) * 2
  } else if (position === 'Midfielder') {
    def_xP = (defConPerGame / 12) * 2
  }

  // ── Penalty taker bonus ───────────────────────────────────────────────────
  const pen_xP = isPenaltyTaker
    ? 0.76 * goalPoints(position) * 0.25 * fixtureMult
    : 0

  // ── Set piece taker bonus ─────────────────────────────────────────────────
  const set_xP = isSetPieceTaker
    ? 0.10 * 3 * fixtureMult
    : 0

  const total = appearance_xP + goal_xP + assist_xP + cs_xP + def_xP + pen_xP + set_xP
  return Math.max(0, parseFloat(total.toFixed(1)))
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function FPLPage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const [
    { data: standings },
    { data: allMatches },
    { data: teams },
    { data: xgMatches },
    fplBootstrap,
  ] = await Promise.all([
    supabase.from('standings').select('*').eq('league_id', 39).eq('season', 2025).order('rank', { ascending: true }),
    supabase.from('matches').select('fixture_id, round, datetime, home_team_id, home_team_name, away_team_id, away_team_name, goals_h, goals_a, home_xg, away_xg').eq('league_id', 39).order('datetime', { ascending: true }),
    supabase.from('teams').select('team_id, code').eq('league_id', 39).eq('season', 2025),
    supabase.from('matches').select('home_team_id, away_team_id, home_xg, away_xg').eq('league_id', 39).eq('season', 2025).not('home_xg', 'is', null),
    fetch('https://fantasy.premierleague.com/api/bootstrap-static/').then(r => r.json()).catch(() => null),
  ])

  if (!standings || !allMatches || !fplBootstrap) return <div>Error loading data</div>

  // ── FPL team maps ─────────────────────────────────────────────────────────

  const fplTeamMap = new Map<number, { name: string; shortName: string }>()
  fplBootstrap.teams?.forEach((t: any) => {
    fplTeamMap.set(t.id, { name: t.name, shortName: t.short_name })
  })

  const fplTeamShortMap = new Map<string, string>()
  fplBootstrap.teams?.forEach((t: any) => {
    fplTeamShortMap.set(normalizeName(t.name), t.short_name)
  })

  const teamCodeMap: Record<number, string> = {}
  teams?.forEach((t: any) => { teamCodeMap[t.team_id] = t.code })

  function getTeamCode(teamId: number, teamName: string): string {
    return fplTeamShortMap.get(normalizeName(teamName))
      ?? teamCodeMap[teamId]
      ?? teamName.substring(0, 3).toUpperCase()
  }

  // ── GW map ────────────────────────────────────────────────────────────────

  const gwMap: Record<number, any[]> = {}
  allMatches.forEach((m: any) => {
    const gw = parseInt(m.round?.match(/(\d+)/)?.[1] ?? '0')
    if (!gw) return
    if (!gwMap[gw]) gwMap[gw] = []
    gwMap[gw].push(m)
  })

  const upcomingGWs = Object.entries(gwMap)
    .filter(([, matches]) => matches.some((m: any) => m.goals_h === null))
    .map(([gw]) => parseInt(gw))
    .sort((a, b) => a - b)
    .slice(0, 6)

  // Advance past any GW already underway
  const firstGW           = upcomingGWs[0]
  const firstGWIsUnderway = (gwMap[firstGW] ?? []).some((m: any) => m.goals_h !== null)
  const nextGW            = firstGWIsUnderway ? (upcomingGWs[1] ?? firstGW) : firstGW
  
  // Trim upcomingGWs to start from nextGW so FDR table also advances
  const trimmedGWs = upcomingGWs.filter(gw => gw >= nextGW).slice(0, 5)

  // ── xG stats ─────────────────────────────────────────────────────────────

  const xgForMap: Record<number, { total: number; games: number }> = {}
  const xgAgainstMap: Record<number, { total: number; games: number }> = {}

  xgMatches?.forEach((m: any) => {
    if (!xgForMap[m.home_team_id]) xgForMap[m.home_team_id] = { total: 0, games: 0 }
    if (!xgForMap[m.away_team_id]) xgForMap[m.away_team_id] = { total: 0, games: 0 }
    if (!xgAgainstMap[m.home_team_id]) xgAgainstMap[m.home_team_id] = { total: 0, games: 0 }
    if (!xgAgainstMap[m.away_team_id]) xgAgainstMap[m.away_team_id] = { total: 0, games: 0 }
    xgForMap[m.home_team_id].total += m.home_xg ?? 0
    xgForMap[m.home_team_id].games++
    xgForMap[m.away_team_id].total += m.away_xg ?? 0
    xgForMap[m.away_team_id].games++
    xgAgainstMap[m.home_team_id].total += m.away_xg ?? 0
    xgAgainstMap[m.home_team_id].games++
    xgAgainstMap[m.away_team_id].total += m.home_xg ?? 0
    xgAgainstMap[m.away_team_id].games++
  })

  const homeSplits: Record<number, { gf: number; ga: number; games: number }> = {}
  const awaySplits: Record<number, { gf: number; ga: number; games: number }> = {}

  allMatches
    .filter((m: any) => m.goals_h !== null && m.goals_a !== null)
    .forEach((m: any) => {
      if (!homeSplits[m.home_team_id]) homeSplits[m.home_team_id] = { gf: 0, ga: 0, games: 0 }
      if (!awaySplits[m.away_team_id]) awaySplits[m.away_team_id] = { gf: 0, ga: 0, games: 0 }
      homeSplits[m.home_team_id].gf += m.goals_h
      homeSplits[m.home_team_id].ga += m.goals_a
      homeSplits[m.home_team_id].games++
      awaySplits[m.away_team_id].gf += m.goals_a
      awaySplits[m.away_team_id].ga += m.goals_h
      awaySplits[m.away_team_id].games++
    })

  const teamStatsMap: Record<number, any> = {}

  standings.forEach((s: any) => {
    const id        = s.team_id
    const played    = s.played || 1
    const home      = homeSplits[id] ?? { gf: 0, ga: 0, games: 1 }
    const away      = awaySplits[id] ?? { gf: 0, ga: 0, games: 1 }
    const hGames    = home.games || 1
    const aGames    = away.games || 1
    const xgFor     = xgForMap[id]
    const xgAgainst = xgAgainstMap[id]

    teamStatsMap[id] = {
      teamName:                s.team_name,
      teamCode:                getTeamCode(id, s.team_name),
      rank:                    s.rank,
      goalsForPerGame:         s.goals_for     / played,
      goalsAgainstPerGame:     s.goals_against / played,
      homeGoalsForPerGame:     home.gf / hGames,
      homeGoalsAgainstPerGame: home.ga / hGames,
      awayGoalsForPerGame:     away.gf / aGames,
      awayGoalsAgainstPerGame: away.ga / aGames,
      xgForPerGame:     xgFor?.games     > 0 ? xgFor.total     / xgFor.games     : s.goals_for     / played,
      xgAgainstPerGame: xgAgainst?.games > 0 ? xgAgainst.total / xgAgainst.games : s.goals_against / played,
      formScore:        parseForm(s.form),
    }
  })

  const allStats     = Object.values(teamStatsMap)
  const leagueAvgGF  = allStats.reduce((a, t) => a + t.goalsForPerGame,     0) / allStats.length
  const leagueAvgGA  = allStats.reduce((a, t) => a + t.goalsAgainstPerGame, 0) / allStats.length
  const leagueAvgXgF = allStats.reduce((a, t) => a + t.xgForPerGame,        0) / allStats.length
  const leagueAvgXgA = allStats.reduce((a, t) => a + t.xgAgainstPerGame,    0) / allStats.length

  function computeFixtureXG(homeTeamId: number, awayTeamId: number) {
    const h = teamStatsMap[homeTeamId]
    const a = teamStatsMap[awayTeamId]
    if (!h || !a) return { homeExpected: 1.2, awayExpected: 1.0 }

    const homeAttack = h.homeGoalsForPerGame     * 0.5 + h.xgForPerGame     * 0.5
    const homeDef    = h.homeGoalsAgainstPerGame * 0.5 + h.xgAgainstPerGame * 0.5
    const awayAttack = a.awayGoalsForPerGame     * 0.5 + a.xgForPerGame     * 0.5
    const awayDef    = a.awayGoalsAgainstPerGame * 0.5 + a.xgAgainstPerGame * 0.5

    const homeXG = (homeAttack / leagueAvgGF) * (awayDef / leagueAvgGA) * leagueAvgGF * 1.1
    const awayXG = (awayAttack / leagueAvgGF) * (homeDef / leagueAvgGA) * leagueAvgGF

    return {
      homeExpected: homeXG * (0.7 + h.formScore * 0.3),
      awayExpected: awayXG * (0.7 + a.formScore * 0.3),
    }
  }

  // ── FDR table ─────────────────────────────────────────────────────────────

  const teamFixtures: Record<number, {
    teamName: string
    teamCode: string
    rank: number
    fixtures: Array<{
      gw: number
      opponent: string
      opponentCode: string
      isHome: boolean
      difficulty: number
      csChance: number
      csRating: number
      datetime: string
    }>
  }> = {}

  standings.forEach((s: any) => {
    const stats = teamStatsMap[s.team_id]
    if (!stats) return
    teamFixtures[s.team_id] = {
      teamName: stats.teamName,
      teamCode: stats.teamCode,
      rank:     stats.rank,
      fixtures: [],
    }
  })

  upcomingGWs.forEach(gw => {
    const gwMatches = gwMap[gw]?.filter((m: any) => m.goals_h === null) ?? []
    gwMatches.forEach((m: any) => {
      const homeStats = teamStatsMap[m.home_team_id]
      const awayStats = teamStatsMap[m.away_team_id]
      if (!homeStats || !awayStats) return

      const { homeExpected, awayExpected } = computeFixtureXG(m.home_team_id, m.away_team_id)
      const homeCSChance = cleanSheetProbability(awayExpected)
      const awayCSChance = cleanSheetProbability(homeExpected)

      if (teamFixtures[m.home_team_id]) {
        teamFixtures[m.home_team_id].fixtures.push({
          gw,
          opponent:     m.away_team_name,
          opponentCode: getTeamCode(m.away_team_id, m.away_team_name),
          isHome:     true,
          difficulty: xgdToRating(homeExpected - awayExpected),
          csChance:   homeCSChance,
          csRating:   csToRating(homeCSChance),
          datetime:   m.datetime,
        })
      }
      if (teamFixtures[m.away_team_id]) {
        teamFixtures[m.away_team_id].fixtures.push({
          gw,
          opponent:     m.home_team_name,
          opponentCode: getTeamCode(m.home_team_id, m.home_team_name),
          isHome:     false,
          difficulty: xgdToRating(awayExpected - homeExpected),
          csChance:   awayCSChance,
          csRating:   csToRating(awayCSChance),
          datetime:   m.datetime,
        })
      }
    })
  })

  const teamList = Object.values(teamFixtures)
    .filter(t => t.fixtures.length > 0)
    .sort((a, b) => a.rank - b.rank)

  // ── Captain picks ─────────────────────────────────────────────────────────

  const fplFixtures: any[] = await fetch(
    `https://fantasy.premierleague.com/api/fixtures/?event=${nextGW}`
  ).then(r => r.json()).catch(() => [])

  const fixtureContext: Record<number, {
    opponentCode: string
    isHome: boolean
    difficulty: number
    opponentXgA: number
    opponentXgF: number
  }> = {}

  fplFixtures.forEach((fixture: any) => {
    const homeTeam = fplTeamMap.get(fixture.team_h)
    const awayTeam = fplTeamMap.get(fixture.team_a)
    if (!homeTeam || !awayTeam) return

    const homeSupabaseStats = Object.values(teamStatsMap).find(
      t => normalizeName(t.teamName) === normalizeName(homeTeam.name)
    )
    const awaySupabaseStats = Object.values(teamStatsMap).find(
      t => normalizeName(t.teamName) === normalizeName(awayTeam.name)
    )

    const homeXgA = homeSupabaseStats?.xgAgainstPerGame ?? leagueAvgXgA
    const homeXgF = homeSupabaseStats?.xgForPerGame     ?? leagueAvgXgF
    const awayXgA = awaySupabaseStats?.xgAgainstPerGame ?? leagueAvgXgA
    const awayXgF = awaySupabaseStats?.xgForPerGame     ?? leagueAvgXgF

    fixtureContext[fixture.team_h] = {
      opponentCode: awayTeam.shortName,
      isHome:       true,
      difficulty:   fixture.team_h_difficulty,
      opponentXgA:  awayXgA,
      opponentXgF:  awayXgF,
    }
    fixtureContext[fixture.team_a] = {
      opponentCode: homeTeam.shortName,
      isHome:       false,
      difficulty:   fixture.team_a_difficulty,
      opponentXgA:  homeXgA,
      opponentXgF:  homeXgF,
    }
  })

  const captainPicks: CaptainPick[] = []

  fplBootstrap.elements?.forEach((el: any) => {
    // ── Filters ───────────────────────────────────────────────────────────
    if (el.element_type === 1) return
    if (el.status === 'u') return
    const news = (el.news ?? '').toLowerCase()
    if (news.includes('transferred') || news.includes('left')) return

    const ctx = fixtureContext[el.team]
    if (!ctx) return

    const starts  = el.starts  ?? 0
    const minutes = el.minutes ?? 0
    if (starts < 10) return
    if ((minutes / starts) < 60) return
    if (parseFloat(el.form) <= 3) return

    // ── Compute xP ────────────────────────────────────────────────────────
    const nowCost  = el.now_cost ?? 1
    const fplTeam  = fplTeamMap.get(el.team)
    const position = POSITION_MAP[el.element_type] ?? 'Attacker'

    const availability = el.chance_of_playing_next_round != null
      ? el.chance_of_playing_next_round / 100
      : 1.0

    const defConRaw = parseFloat(el.defensive_contribution_per_90) || 0

    const ourXP = computeXP({
      position,
      minutes,
      starts,
      availability,
      goalsScored:    el.goals_scored ?? 0,
      xGPer90:        parseFloat(el.expected_goals_per_90)         || 0,
      assistsTotal:   el.assists      ?? 0,
      xAPer90:        parseFloat(el.expected_assists_per_90)        || 0,
      xGCPer90:       parseFloat(el.expected_goals_conceded_per_90) || 0,
      csPer90:        parseFloat(el.clean_sheets_per_90)            || 0,
      defConRaw,
      isPenaltyTaker:  el.penalties_order === 1,
      isSetPieceTaker: el.corners_and_indirect_freekicks_order === 1,
      opponentXgA:    ctx.opponentXgA,
      opponentXgF:    ctx.opponentXgF,
      leagueAvgXgA,
      leagueAvgXgF,
    })

    // 50/50 blend with FPL's own ep_next
    const epNext   = parseFloat(el.ep_next) || 0
    const blendedXP = parseFloat(((ourXP * 0.6) + (epNext * 0.4)).toFixed(1))

    // ── Display stats ─────────────────────────────────────────────────────
    const costInM    = nowCost / 10
    const totalPts   = el.total_points ?? 0
    const ptsPerCost = costInM > 0 ? (totalPts / costInM).toFixed(1) : '—'

    const mins90         = minutes / 90
    const truDefConPer90 = mins90 > 0 ? defConRaw / mins90 : 0
    const avgMins        = minutes / Math.max(starts, 1)
    const defConPerGame  = truDefConPer90 * (avgMins / 90)

    captainPicks.push({
      rank:           0,
      playerName:     el.web_name,
      teamName:       fplTeam?.name      ?? 'Unknown',
      teamCode:       fplTeam?.shortName ?? 'UNK',
      position,
      opponent:       ctx.opponentCode,
      opponentCode:   ctx.opponentCode,
      isHome:         ctx.isHome,
      difficulty:     ctx.difficulty,
      xP:             blendedXP,
      fplPrice:       `£${costInM.toFixed(1)}m`,
      fplOwnership:   `${el.selected_by_percent}%`,
      fplForm:        el.form,
      fplTotalPoints: el.total_points,
      pointsPerCost:  ptsPerCost,
      xGPer90:        fmt2(el.expected_goals_per_90),
      xAPer90:        fmt2(el.expected_assists_per_90),
      defConPerGame:  fmt2(defConPerGame),
      isPenaltyTaker:  el.penalties_order === 1,
      isSetPieceTaker: el.corners_and_indirect_freekicks_order === 1,
      status:          el.status ?? 'a',
      chanceOfPlaying: el.chance_of_playing_next_round ?? null,
    })
  })

  const top10 = captainPicks
    .sort((a, b) => b.xP - a.xP)
    .slice(0, 20)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  return (
    <FPLFixtureDifficulty
      teams={teamList}
      upcomingGWs={trimmedGWs}
      captainPicks={top10}
      nextGW={nextGW}
    />
  )
}