import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import FPLFixtureDifficulty from './FPLFixtureDifficulty'

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function goalPoints(position: string): number {
  if (position === 'Goalkeeper' || position === 'Defender') return 6
  if (position === 'Midfielder') return 5
  return 4
}

function csPoints(position: string): number {
  if (position === 'Goalkeeper' || position === 'Defender') return 4
  if (position === 'Midfielder') return 1
  return 0
}

function normalizeName(name: string): string {
  return name
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
}

function matchFPLPlayer(playerName: string, fplMap: Map<string, any>): any | null {
  const normalized = normalizeName(playerName)
  if (fplMap.has(normalized)) return fplMap.get(normalized)
  const surname = normalized.split(' ').slice(-1)[0]
  for (const [key, fpl] of fplMap) {
    if (key.includes(surname)) return fpl
  }
  return null
}

// ─── xP Model ───────────────────────────────────────────────────────────────

function computeXP(
  player: any,
  fpl: any | null,
  teamExpectedGoals: number,
  oppExpectedGoals: number,
  isHome: boolean,
  leagueAvgGF: number,
  leagueAvgGA: number,
) {
  const games = player.games || 1
  const minutes = player.minutes || 0
  const position = player.position ?? 'Attacker'
  const avgMins = Math.min(minutes / games, 90)
  if (avgMins < 60) return null

  if (fpl) {
    if (fpl.status === 'i' || fpl.status === 'u') return null
    const chanceOfPlaying = fpl.chance_of_playing_next_round
    if (chanceOfPlaying !== null && chanceOfPlaying < 50) return null
    if (parseFloat(fpl.ep_next) < 1.9) return null
  }

  const minutesScalar = avgMins / 90
  const appearancePts = 2

  // xG
  let fixtureXG: number
  if (fpl && parseFloat(fpl.expected_goals_per_90) > 0) {
    const fplXGPer90 = parseFloat(fpl.expected_goals_per_90)
    const fixtureScalar = teamExpectedGoals / Math.max(leagueAvgGF, 0.5)
    fixtureXG = fplXGPer90 * fixtureScalar * minutesScalar * (isHome ? 1.1 : 1.0)
  } else {
    const sotPerGame = (player.shots_on || 0) / games
    const historicalConversion = player.shots_on > 0 ? (player.goals || 0) / player.shots_on : 0.1
    const xgPerGame = sotPerGame * Math.max(historicalConversion, 0.08)
    const teamXgScalar = teamExpectedGoals / Math.max(leagueAvgGF, 0.5)
    fixtureXG = xgPerGame * teamXgScalar * (isHome ? 1.1 : 1.0)
  }
  const xGoalPts = fixtureXG * goalPoints(position)

  // xA
  let fixtureXA: number
  if (fpl && parseFloat(fpl.expected_assists_per_90) > 0) {
    const fplXAPer90 = parseFloat(fpl.expected_assists_per_90)
    const fixtureScalar = teamExpectedGoals / Math.max(leagueAvgGF, 0.5)
    fixtureXA = fplXAPer90 * fixtureScalar * minutesScalar * (isHome ? 1.1 : 1.0)
  } else {
    const keyPassesPerGame = (player.passes_key || 0) / games
    fixtureXA = keyPassesPerGame * 0.2
  }
  const xAssistPts = fixtureXA * 3

  // Clean sheet
  const poissonCS = cleanSheetProbability(oppExpectedGoals) / 100
  let blendedCS = poissonCS
  if (fpl && parseFloat(fpl.clean_sheets_per_90) > 0) {
    const fplCSPer90 = parseFloat(fpl.clean_sheets_per_90)
    blendedCS = (poissonCS * 0.6) + (fplCSPer90 * 0.4)
  }
  const xCSPts = blendedCS * csPoints(position)

  // Goals conceded (GK/DEF)
  let xGCPts = 0
  if (position === 'Goalkeeper' || position === 'Defender') {
    if (fpl && parseFloat(fpl.expected_goals_conceded_per_90) > 0) {
      const fplXGCPer90 = parseFloat(fpl.expected_goals_conceded_per_90)
      const fixtureScalar = oppExpectedGoals / Math.max(leagueAvgGA, 0.5)
      xGCPts = -((fplXGCPer90 * fixtureScalar * minutesScalar) / 2)
    } else {
      xGCPts = -(oppExpectedGoals / 2)
    }
  }

  // Saves (GK)
  let xSavePts = 0
  if (position === 'Goalkeeper') {
    const savesBase = fpl && parseFloat(fpl.saves_per_90) > 0
      ? parseFloat(fpl.saves_per_90)
      : (player.saves || 0) / games
    const fixtureScalar = oppExpectedGoals / Math.max(leagueAvgGA, 0.5)
    xSavePts = (savesBase * fixtureScalar * minutesScalar) / 3
  }

  // Set piece bonus
  let setPiecePts = 0
  if (fpl) {
    if (fpl.penalties_order === 1) {
      setPiecePts += (teamExpectedGoals * 0.15) * goalPoints(position)
    }
    if (fpl.corners_and_indirect_freekicks_order === 1) {
      setPiecePts += fixtureXA * 0.15
    }
  }

  // Yellow/red cards
  const yellowPerGame = (player.yellow_cards || 0) / games
  const xYellowPts = yellowPerGame * -1
  const redPerGame = (player.red_cards || 0) / games
  const xRedPts = redPerGame * -3

  // Defensive contribution — all outfield, not GK
  // No fixtureScalar — defensive contributions happen regardless of opponent strength
  let xDefPts = 0
  let xDefCon = 0
  if (position !== 'Goalkeeper') {
    const threshold = position === 'Defender' ? 10 : 12
    if (fpl && parseFloat(fpl.defensive_contribution_per_90) > 0) {
      const fplDefPer90 = parseFloat(fpl.defensive_contribution_per_90)
      const expectedDefContrib = fplDefPer90 * minutesScalar
      xDefPts = expectedDefContrib / threshold
      xDefCon = parseFloat(expectedDefContrib.toFixed(2))
    } else {
      const tacklesPerGame = (player.tackles_total || 0) / games
      xDefPts = tacklesPerGame / threshold
      xDefCon = parseFloat(tacklesPerGame.toFixed(2))
    }
  }

  // FPL form boost
  let formBoost = 0
  if (fpl && parseFloat(fpl.form) > 0) {
    formBoost = (parseFloat(fpl.form) / 10) * 0.2
  }

  // ICT tiebreaker
  let ictBoost = 0
  if (fpl && parseFloat(fpl.ict_index) > 0) {
    ictBoost = (parseFloat(fpl.ict_index) / 100) * 0.1
  }

  // Availability scalar
  let availabilityScalar = 1.0
  if (fpl?.chance_of_playing_next_round != null) {
    availabilityScalar = fpl.chance_of_playing_next_round / 100
  }

  const total = (
    appearancePts + xGoalPts + xAssistPts + xCSPts + xGCPts +
    xSavePts + setPiecePts + xYellowPts + xRedPts + xDefPts +
    formBoost + ictBoost
  ) * availabilityScalar

  const tacklesPerGame = (player.tackles_total || 0) / games

  return {
    xP: Math.max(0, parseFloat(total.toFixed(1))),
    fixtureXG: parseFloat(fixtureXG.toFixed(2)),
    xAssistRate: parseFloat(fixtureXA.toFixed(2)),
    xDefCon,
    sotPerGame: parseFloat(((player.shots_on || 0) / games).toFixed(2)),
    shotsPerGame: parseFloat(((player.shots_total || 0) / games).toFixed(2)),
    savesPerGame: parseFloat(((player.saves || 0) / games).toFixed(2)),
    tacklesPerGame: parseFloat(tacklesPerGame.toFixed(2)),
    keyPassesPerGame: parseFloat(((player.passes_key || 0) / games).toFixed(2)),
    yellowRisk: parseFloat(yellowPerGame.toFixed(2)),
    avgMins: Math.round(avgMins),
    fplPrice: fpl ? `£${(fpl.now_cost / 10).toFixed(1)}m` : null,
    fplOwnership: fpl ? `${fpl.selected_by_percent}%` : null,
    fplForm: fpl ? fpl.form : null,
    fplTotalPoints: fpl ? fpl.total_points : null,
    isPenaltyTaker: fpl?.penalties_order === 1,
    isSetPieceTaker: fpl?.corners_and_indirect_freekicks_order === 1,
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface TeamStats {
  teamName: string
  teamCode: string
  rank: number
  goalsForPerGame: number
  goalsAgainstPerGame: number
  homeGoalsForPerGame: number
  homeGoalsAgainstPerGame: number
  awayGoalsForPerGame: number
  awayGoalsAgainstPerGame: number
  xgForPerGame: number
  xgAgainstPerGame: number
  formScore: number
}

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
  xG: number
  xA: number
  xDefCon: number
  csChance: number
  sotPerGame: number
  shotsPerGame: number
  savesPerGame: number
  tacklesPerGame: number
  keyPassesPerGame: number
  yellowRisk: number
  avgMins: number
  fplPrice: string | null
  fplOwnership: string | null
  fplForm: string | null
  fplTotalPoints: number | null
  isPenaltyTaker: boolean
  isSetPieceTaker: boolean
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
    { data: players },
    fplBootstrap,
  ] = await Promise.all([
    supabase.from('standings').select('*').eq('league_id', 39).eq('season', 2025).order('rank', { ascending: true }),
    supabase.from('matches').select('fixture_id, round, datetime, home_team_id, home_team_name, away_team_id, away_team_name, goals_h, goals_a, home_xg, away_xg').eq('league_id', 39).order('datetime', { ascending: true }),
    supabase.from('teams').select('team_id, code').eq('league_id', 39).eq('season', 2025),
    supabase.from('matches').select('home_team_id, away_team_id, home_xg, away_xg').eq('league_id', 39).eq('season', 2025).not('home_xg', 'is', null),
    supabase.from('players').select('*').eq('league_id', 39).eq('season', 2025).gt('minutes', 540).gt('games', 5),
    fetch('https://fantasy.premierleague.com/api/bootstrap-static/').then(r => r.json()).catch(() => null),
  ])

  if (!standings || !allMatches) return <div>Error loading data</div>

  const fplPlayerMap = new Map<string, any>()
  if (fplBootstrap?.elements) {
    for (const el of fplBootstrap.elements) {
      fplPlayerMap.set(normalizeName(`${el.first_name} ${el.second_name}`), el)
      fplPlayerMap.set(normalizeName(el.web_name), el)
    }
  }

  const fplTeamShortMap = new Map<string, string>()
  if (fplBootstrap?.teams) {
    for (const t of fplBootstrap.teams) {
      fplTeamShortMap.set(normalizeName(t.name), t.short_name)
    }
  }

  const teamCodeMap: Record<number, string> = {}
  teams?.forEach((t: any) => { teamCodeMap[t.team_id] = t.code })

  function getTeamCode(teamId: number, teamName: string): string {
    return fplTeamShortMap.get(normalizeName(teamName))
      ?? teamCodeMap[teamId]
      ?? teamName.substring(0, 3).toUpperCase()
  }

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
    .slice(0, 5)

  const nextGW = upcomingGWs[0]

  const xgForMap: Record<number, { total: number, games: number }> = {}
  const xgAgainstMap: Record<number, { total: number, games: number }> = {}

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

  const homeSplits: Record<number, { gf: number, ga: number, games: number }> = {}
  const awaySplits: Record<number, { gf: number, ga: number, games: number }> = {}

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

  const teamStatsMap: Record<number, TeamStats> = {}

  standings.forEach((s: any) => {
    const id = s.team_id
    const played = s.played || 1
    const home = homeSplits[id] ?? { gf: 0, ga: 0, games: 1 }
    const away = awaySplits[id] ?? { gf: 0, ga: 0, games: 1 }
    const hGames = home.games || 1
    const aGames = away.games || 1
    const xgFor = xgForMap[id]
    const xgAgainst = xgAgainstMap[id]
    const xgForPer = xgFor && xgFor.games > 0 ? xgFor.total / xgFor.games : s.goals_for / played
    const xgAgainstPer = xgAgainst && xgAgainst.games > 0 ? xgAgainst.total / xgAgainst.games : s.goals_against / played

    teamStatsMap[id] = {
      teamName: s.team_name,
      teamCode: getTeamCode(id, s.team_name),
      rank: s.rank,
      goalsForPerGame: s.goals_for / played,
      goalsAgainstPerGame: s.goals_against / played,
      homeGoalsForPerGame: home.gf / hGames,
      homeGoalsAgainstPerGame: home.ga / hGames,
      awayGoalsForPerGame: away.gf / aGames,
      awayGoalsAgainstPerGame: away.ga / aGames,
      xgForPerGame: xgForPer,
      xgAgainstPerGame: xgAgainstPer,
      formScore: parseForm(s.form),
    }
  })

  const allStats = Object.values(teamStatsMap)
  const leagueAvgGF = allStats.reduce((a, t) => a + t.goalsForPerGame, 0) / allStats.length
  const leagueAvgGA = allStats.reduce((a, t) => a + t.goalsAgainstPerGame, 0) / allStats.length

  function computeFixtureXG(homeTeamId: number, awayTeamId: number) {
    const homeStats = teamStatsMap[homeTeamId]
    const awayStats = teamStatsMap[awayTeamId]
    if (!homeStats || !awayStats) return { homeExpected: 1.2, awayExpected: 1.0 }

    const homeAttack = homeStats.homeGoalsForPerGame * 0.5 + homeStats.xgForPerGame * 0.5
    const homeDef = homeStats.homeGoalsAgainstPerGame * 0.5 + homeStats.xgAgainstPerGame * 0.5
    const awayAttack = awayStats.awayGoalsForPerGame * 0.5 + awayStats.xgForPerGame * 0.5
    const awayDef = awayStats.awayGoalsAgainstPerGame * 0.5 + awayStats.xgAgainstPerGame * 0.5

    const homeXG = (homeAttack / leagueAvgGF) * (awayDef / leagueAvgGA) * leagueAvgGF * 1.1
    const awayXG = (awayAttack / leagueAvgGF) * (homeDef / leagueAvgGA) * leagueAvgGF

    const homeFormBoost = homeStats.formScore * 0.3
    const awayFormBoost = awayStats.formScore * 0.3

    return {
      homeExpected: homeXG * (0.7 + homeFormBoost),
      awayExpected: awayXG * (0.7 + awayFormBoost),
    }
  }

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
      rank: stats.rank,
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
          gw, opponent: m.away_team_name,
          opponentCode: getTeamCode(m.away_team_id, m.away_team_name),
          isHome: true, difficulty: xgdToRating(homeExpected - awayExpected),
          csChance: homeCSChance, csRating: csToRating(homeCSChance), datetime: m.datetime,
        })
      }
      if (teamFixtures[m.away_team_id]) {
        teamFixtures[m.away_team_id].fixtures.push({
          gw, opponent: m.home_team_name,
          opponentCode: getTeamCode(m.home_team_id, m.home_team_name),
          isHome: false, difficulty: xgdToRating(awayExpected - homeExpected),
          csChance: awayCSChance, csRating: csToRating(awayCSChance), datetime: m.datetime,
        })
      }
    })
  })

  const teamList = Object.values(teamFixtures)
    .filter(t => t.fixtures.length > 0)
    .sort((a, b) => a.rank - b.rank)

  const nextGWMatches = gwMap[nextGW]?.filter((m: any) => m.goals_h === null) ?? []

  const teamFixtureContext: Record<number, {
    opponent: string
    opponentCode: string
    isHome: boolean
    teamExpectedGoals: number
    oppExpectedGoals: number
    csChance: number
    difficulty: number
  }> = {}

  nextGWMatches.forEach((m: any) => {
    const { homeExpected, awayExpected } = computeFixtureXG(m.home_team_id, m.away_team_id)
    const homeStats = teamStatsMap[m.home_team_id]
    const awayStats = teamStatsMap[m.away_team_id]
    if (!homeStats || !awayStats) return

    teamFixtureContext[m.home_team_id] = {
      opponent: m.away_team_name, opponentCode: getTeamCode(m.away_team_id, m.away_team_name),
      isHome: true, teamExpectedGoals: homeExpected, oppExpectedGoals: awayExpected,
      csChance: cleanSheetProbability(awayExpected),
      difficulty: xgdToRating(homeExpected - awayExpected),
    }
    teamFixtureContext[m.away_team_id] = {
      opponent: m.home_team_name, opponentCode: getTeamCode(m.home_team_id, m.home_team_name),
      isHome: false, teamExpectedGoals: awayExpected, oppExpectedGoals: homeExpected,
      csChance: cleanSheetProbability(homeExpected),
      difficulty: xgdToRating(awayExpected - homeExpected),
    }
  })

  const captainPicks: CaptainPick[] = []

  players?.forEach((player: any) => {
    const ctx = teamFixtureContext[player.team_id]
    if (!ctx) return

    const fplPlayer = matchFPLPlayer(player.name, fplPlayerMap)

    const result = computeXP(
      player, fplPlayer,
      ctx.teamExpectedGoals, ctx.oppExpectedGoals,
      ctx.isHome, leagueAvgGF, leagueAvgGA,
    )
    if (!result) return

    captainPicks.push({
      rank: 0,
      playerName: player.name,
      teamName: player.team_name,
      teamCode: getTeamCode(player.team_id, player.team_name),
      position: player.position ?? 'Attacker',
      opponent: ctx.opponent,
      opponentCode: ctx.opponentCode,
      isHome: ctx.isHome,
      difficulty: ctx.difficulty,
      xP: result.xP,
      xG: result.fixtureXG,
      xA: result.xAssistRate,
      xDefCon: result.xDefCon,
      csChance: ctx.csChance,
      sotPerGame: result.sotPerGame,
      shotsPerGame: result.shotsPerGame,
      savesPerGame: result.savesPerGame,
      tacklesPerGame: result.tacklesPerGame,
      keyPassesPerGame: result.keyPassesPerGame,
      yellowRisk: result.yellowRisk,
      avgMins: result.avgMins,
      fplPrice: result.fplPrice,
      fplOwnership: result.fplOwnership,
      fplForm: result.fplForm,
      fplTotalPoints: result.fplTotalPoints,
      isPenaltyTaker: result.isPenaltyTaker,
      isSetPieceTaker: result.isSetPieceTaker,
    })
  })

  const unmapped = players?.filter((player: any) => {
    const ctx = teamFixtureContext[player.team_id]
    if (!ctx) return false
    const avgMins = (player.minutes || 0) / (player.games || 1)
    if (avgMins < 60) return false
    return !matchFPLPlayer(player.name, fplPlayerMap)
  }) ?? []

  if (unmapped.length > 0) {
    console.log('⚠️ Unmapped FPL players:')
    unmapped.forEach((p: any) => console.log(`  - ${p.name} (${p.team_name})`))
  }

  const top10 = captainPicks
    .sort((a, b) => b.xP - a.xP)
    .slice(0, 20)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  return (
    <FPLFixtureDifficulty
      teams={teamList}
      upcomingGWs={upcomingGWs}
      captainPicks={top10}
      nextGW={nextGW}
    />
  )
}