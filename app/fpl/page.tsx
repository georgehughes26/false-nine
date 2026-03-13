import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import FPLFixtureDifficulty from './FPLFixtureDifficulty'

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

function fullName(player: any): string {
  if (player.firstname && player.lastname) {
    const first = player.firstname.split(' ')[0]
    return `${first} ${player.lastname}`
  }
  return player.name ?? 'Unknown'
}

function computeXP(player: any, teamExpectedGoals: number, oppExpectedGoals: number, isHome: boolean) {
  const games = player.games || 1
  const minutes = player.minutes || 0
  const position = player.position ?? 'Attacker'
  const avgMins = minutes / games
  if (avgMins < 60) return null

  const appearancePts = avgMins >= 60 ? 2 : 1

  const sotPerGame = (player.shots_on || 0) / games
  const historicalConversion = player.shots_on > 0 ? (player.goals || 0) / player.shots_on : 0.1
  const xgPerGame = sotPerGame * Math.max(historicalConversion, 0.08)
  const teamXgScalar = teamExpectedGoals / Math.max(teamExpectedGoals, 0.5)
  const fixtureXG = xgPerGame * teamXgScalar * (isHome ? 1.1 : 1.0)
  const xGoalPts = fixtureXG * goalPoints(position)

  const keyPassesPerGame = (player.passes_key || 0) / games
  const xAssistRate = keyPassesPerGame * 0.2
  const xAssistPts = xAssistRate * 3

  const csPct = cleanSheetProbability(oppExpectedGoals) / 100
  const xCSPts = csPct * csPoints(position)

  const xGCPts = (position === 'Goalkeeper' || position === 'Defender')
    ? -(oppExpectedGoals / 2) * 1 : 0

  const yellowPerGame = (player.yellow_cards || 0) / games
  const xYellowPts = yellowPerGame * -1

  const redPerGame = (player.red_cards || 0) / games
  const xRedPts = redPerGame * -3

  const savesPerGame = (player.saves || 0) / games
  const xSavePts = position === 'Goalkeeper' ? savesPerGame / 3 : 0

  const tacklesPerGame = (player.tackles_total || 0) / games
  const xDefPts = (position === 'Goalkeeper' || position === 'Defender')
    ? tacklesPerGame * 0.15 : 0

  const penScoredPerGame = (player.penalty_scored || 0) / games
  const penMissedPerGame = (player.penalty_missed || 0) / games
  const xPenPts = (penScoredPerGame * goalPoints(position)) + (penMissedPerGame * -2)

  const total = appearancePts + xGoalPts + xAssistPts + xCSPts + xGCPts +
    xYellowPts + xRedPts + xSavePts + xDefPts + xPenPts

  return {
    xP: Math.max(0, parseFloat(total.toFixed(1))),
    fixtureXG: parseFloat(fixtureXG.toFixed(2)),
    xAssistRate: parseFloat(xAssistRate.toFixed(2)),
    sotPerGame: parseFloat(sotPerGame.toFixed(2)),
    shotsPerGame: parseFloat(((player.shots_total || 0) / games).toFixed(2)),
    savesPerGame: parseFloat(savesPerGame.toFixed(2)),
    tacklesPerGame: parseFloat(tacklesPerGame.toFixed(2)),
    keyPassesPerGame: parseFloat(keyPassesPerGame.toFixed(2)),
    yellowRisk: parseFloat(yellowPerGame.toFixed(2)),
    avgMins: Math.round(avgMins),
  }
}

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
  csChance: number
  // position-specific stats
  sotPerGame: number
  shotsPerGame: number
  savesPerGame: number
  tacklesPerGame: number
  keyPassesPerGame: number
  yellowRisk: number
  avgMins: number
}

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
  ] = await Promise.all([
    supabase.from('standings').select('*').eq('league_id', 39).eq('season', 2025).order('rank', { ascending: true }),
    supabase.from('matches').select('fixture_id, round, datetime, home_team_id, home_team_name, away_team_id, away_team_name, goals_h, goals_a, home_xg, away_xg').eq('league_id', 39).order('datetime', { ascending: true }),
    supabase.from('teams').select('team_id, code').eq('league_id', 39).eq('season', 2025),
    supabase.from('matches').select('home_team_id, away_team_id, home_xg, away_xg').eq('league_id', 39).eq('season', 2025).not('home_xg', 'is', null),
    supabase.from('players').select('*').eq('league_id', 39).eq('season', 2025).gt('minutes', 540).gt('games', 5),
  ])

  if (!standings || !allMatches) return <div>Error loading data</div>

  const teamCodeMap: Record<number, string> = {}
  teams?.forEach((t: any) => { teamCodeMap[t.team_id] = t.code })

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
      teamCode: teamCodeMap[id] ?? s.team_name.substring(0, 3).toUpperCase(),
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

  // Build FDR fixture list
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
          gw, opponent: m.away_team_name, opponentCode: awayStats.teamCode,
          isHome: true, difficulty: xgdToRating(homeExpected - awayExpected),
          csChance: homeCSChance, csRating: csToRating(homeCSChance), datetime: m.datetime,
        })
      }
      if (teamFixtures[m.away_team_id]) {
        teamFixtures[m.away_team_id].fixtures.push({
          gw, opponent: m.home_team_name, opponentCode: homeStats.teamCode,
          isHome: false, difficulty: xgdToRating(awayExpected - homeExpected),
          csChance: awayCSChance, csRating: csToRating(awayCSChance), datetime: m.datetime,
        })
      }
    })
  })

  const teamList = Object.values(teamFixtures)
    .filter(t => t.fixtures.length > 0)
    .sort((a, b) => a.rank - b.rank)

  // Build captain picks for next GW
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
      opponent: m.away_team_name, opponentCode: awayStats.teamCode,
      isHome: true, teamExpectedGoals: homeExpected, oppExpectedGoals: awayExpected,
      csChance: cleanSheetProbability(awayExpected),
      difficulty: xgdToRating(homeExpected - awayExpected),
    }
    teamFixtureContext[m.away_team_id] = {
      opponent: m.home_team_name, opponentCode: homeStats.teamCode,
      isHome: false, teamExpectedGoals: awayExpected, oppExpectedGoals: homeExpected,
      csChance: cleanSheetProbability(homeExpected),
      difficulty: xgdToRating(awayExpected - homeExpected),
    }
  })

  const captainPicks: CaptainPick[] = []

  players?.forEach((player: any) => {
    const ctx = teamFixtureContext[player.team_id]
    if (!ctx) return

    const result = computeXP(player, ctx.teamExpectedGoals, ctx.oppExpectedGoals, ctx.isHome)
    if (!result) return

    captainPicks.push({
      rank: 0,
      playerName: fullName(player),
      teamName: player.team_name,
      teamCode: teamCodeMap[player.team_id] ?? player.team_name.substring(0, 3).toUpperCase(),
      position: player.position ?? 'Attacker',
      opponent: ctx.opponent,
      opponentCode: ctx.opponentCode,
      isHome: ctx.isHome,
      difficulty: ctx.difficulty,
      xP: result.xP,
      xG: result.fixtureXG,
      xA: result.xAssistRate,
      csChance: ctx.csChance,
      sotPerGame: result.sotPerGame,
      shotsPerGame: result.shotsPerGame,
      savesPerGame: result.savesPerGame,
      tacklesPerGame: result.tacklesPerGame,
      keyPassesPerGame: result.keyPassesPerGame,
      yellowRisk: result.yellowRisk,
      avgMins: result.avgMins,
    })
  })

  const top10 = captainPicks
    .sort((a, b) => b.xP - a.xP)
    .slice(0, 10)
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