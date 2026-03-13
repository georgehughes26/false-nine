import { supabase } from '@/lib/supabase'
import SquadView from './SquadView'
import Predictions from './Predictions'
import MatchEvents from './MatchEvents'
import MatchRefresher from './MatchRefresher'
import { createSupabaseServer } from '@/lib/supabase-server'
import React from 'react'
import type { Metadata } from 'next'

const SEASON = 2025
const IN_PLAY_STATUSES = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT', 'LIVE']
const FINISHED_STATUSES = ['FT', 'AET', 'PEN']

interface LineupPlayer {
  team_name: string
  formation: string | null
  player_id: number
  player_name: string
  player_number: number
  is_substitute: boolean
}

function LineupColumn({ players, subs, formation, side }: {
  players: LineupPlayer[]
  subs: LineupPlayer[]
  formation: string | null
  side: 'home' | 'away'
}) {
  const isAway = side === 'away'
  return (
    <div style={{ flex: 1 }}>
      {formation && (
        <div style={{
          fontSize: '11px', fontWeight: 700, color: '#00c864',
          letterSpacing: '1px', marginBottom: '8px',
          textAlign: isAway ? 'right' : 'left',
        }}>
          {formation}
        </div>
      )}
      <div style={{ marginBottom: '12px' }}>
        {players.map((p, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            marginBottom: '4px', flexDirection: isAway ? 'row-reverse' : 'row',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#4a5568', width: '16px', textAlign: 'center', flexShrink: 0 }}>
              {p.player_number}
            </span>
            <span style={{ fontSize: '11px', color: '#e8edf2', fontWeight: 500, textAlign: isAway ? 'right' : 'left', lineHeight: 1.2 }}>
              {p.player_name}
            </span>
          </div>
        ))}
      </div>
      {subs.length > 0 && (
        <>
          <div style={{
            fontSize: '8px', fontWeight: 600, letterSpacing: '2px',
            textTransform: 'uppercase' as const, color: '#4a5568',
            marginBottom: '6px', textAlign: isAway ? 'right' : 'left',
          }}>Subs</div>
          {subs.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              marginBottom: '4px', flexDirection: isAway ? 'row-reverse' : 'row',
            }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#4a5568', width: '16px', textAlign: 'center', flexShrink: 0 }}>
                {p.player_number}
              </span>
              <span style={{ fontSize: '11px', color: '#8896a8', textAlign: isAway ? 'right' : 'left', lineHeight: 1.2 }}>
                {p.player_name}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

async function getRefereeStats(refereeName: string | null) {
  if (!refereeName) return null
  const parts = refereeName.split(',')[0].trim().split(' ')
  const lastName = parts[parts.length - 1]
  const { data: matches } = await supabase
    .from('matches')
    .select('home_yellow_cards, away_yellow_cards, home_red_cards, away_red_cards, home_fouls, away_fouls')
    .ilike('referee', `%${lastName}%`)
    .not('goals_h', 'is', null)
  if (!matches || matches.length === 0) return null
  const games = matches.length
  const yellows = matches.reduce((s, m) => s + (m.home_yellow_cards ?? 0) + (m.away_yellow_cards ?? 0), 0)
  const reds = matches.reduce((s, m) => s + (m.home_red_cards ?? 0) + (m.away_red_cards ?? 0), 0)
  const fouls = matches.reduce((s, m) => s + (m.home_fouls ?? 0) + (m.away_fouls ?? 0), 0)
  return {
    games,
    yellowsPerGame: yellows / games,
    redsPerGame: reds / games,
    foulsPerGame: fouls / games,
  }
}

async function getTeamForm(teamName: string) {
  const { data: homeMatches } = await supabase
    .from('matches')
    .select('goals_h, goals_a, home_team_name, away_team_name, datetime')
    .eq('home_team_name', teamName)
    .not('goals_h', 'is', null)
    .not('goals_a', 'is', null)
    .order('datetime', { ascending: false })
    .limit(5)
  const { data: awayMatches } = await supabase
    .from('matches')
    .select('goals_h, goals_a, home_team_name, away_team_name, datetime')
    .eq('away_team_name', teamName)
    .not('goals_h', 'is', null)
    .not('goals_a', 'is', null)
    .order('datetime', { ascending: false })
    .limit(5)
  const all = [
    ...(homeMatches ?? []).map(m => ({ ...m, side: 'home' as const })),
    ...(awayMatches ?? []).map(m => ({ ...m, side: 'away' as const })),
  ]
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    .slice(0, 5)
  return all.map(m => {
    const isHome = m.side === 'home'
    const scored = isHome ? m.goals_h : m.goals_a
    const conceded = isHome ? m.goals_a : m.goals_h
    const btts = scored > 0 && conceded > 0
    let result: 'W' | 'D' | 'L'
    if (scored > conceded) result = 'W'
    else if (scored === conceded) result = 'D'
    else result = 'L'
    return { result, btts }
  })
}

async function getTeamStats(teamName: string) {
  const { data: homeMatches } = await supabase
    .from('matches')
    .select('goals_h, goals_a, home_shots_on, home_shots_total, home_corners, home_fouls, home_yellow_cards, home_red_cards, home_saves')
    .eq('home_team_name', teamName)
    .not('goals_h', 'is', null)
  const { data: awayMatches } = await supabase
    .from('matches')
    .select('goals_h, goals_a, away_shots_on, away_shots_total, away_corners, away_fouls, away_yellow_cards, away_red_cards, away_saves')
    .eq('away_team_name', teamName)
    .not('goals_h', 'is', null)
  const hm = homeMatches ?? []
  const am = awayMatches ?? []
  const games = hm.length + am.length
  if (games === 0) return null
  return {
    games,
    goals: hm.reduce((s, m) => s + (m.goals_h ?? 0), 0) + am.reduce((s, m) => s + (m.goals_a ?? 0), 0),
    conceded: hm.reduce((s, m) => s + (m.goals_a ?? 0), 0) + am.reduce((s, m) => s + (m.goals_h ?? 0), 0),
    sot: hm.reduce((s, m) => s + (m.home_shots_on ?? 0), 0) + am.reduce((s, m) => s + (m.away_shots_on ?? 0), 0),
    shots: hm.reduce((s, m) => s + (m.home_shots_total ?? 0), 0) + am.reduce((s, m) => s + (m.away_shots_total ?? 0), 0),
    corners: hm.reduce((s, m) => s + (m.home_corners ?? 0), 0) + am.reduce((s, m) => s + (m.away_corners ?? 0), 0),
    fouls: hm.reduce((s, m) => s + (m.home_fouls ?? 0), 0) + am.reduce((s, m) => s + (m.away_fouls ?? 0), 0),
    yellows: hm.reduce((s, m) => s + (m.home_yellow_cards ?? 0), 0) + am.reduce((s, m) => s + (m.away_yellow_cards ?? 0), 0),
    reds: hm.reduce((s, m) => s + (m.home_red_cards ?? 0), 0) + am.reduce((s, m) => s + (m.away_red_cards ?? 0), 0),
    saves: hm.reduce((s, m) => s + (m.home_saves ?? 0), 0) + am.reduce((s, m) => s + (m.away_saves ?? 0), 0),
  }
}

async function getTeamSeasonStats(teamName: string) {
  const { data: homeMatches } = await supabase
    .from('matches')
    .select('goals_h, goals_a')
    .eq('home_team_name', teamName)
    .not('goals_h', 'is', null)
  const { data: awayMatches } = await supabase
    .from('matches')
    .select('goals_h, goals_a')
    .eq('away_team_name', teamName)
    .not('goals_h', 'is', null)
  const hm = homeMatches ?? []
  const am = awayMatches ?? []
  const games = hm.length + am.length
  if (games === 0) return null
  const scored = hm.reduce((s, m) => s + (m.goals_h ?? 0), 0) + am.reduce((s, m) => s + (m.goals_a ?? 0), 0)
  const conceded = hm.reduce((s, m) => s + (m.goals_a ?? 0), 0) + am.reduce((s, m) => s + (m.goals_h ?? 0), 0)
  const bttsCount = [...hm.filter(m => m.goals_h > 0 && m.goals_a > 0), ...am.filter(m => m.goals_a > 0 && m.goals_h > 0)].length
  const cleanSheets = [...hm.filter(m => m.goals_a === 0), ...am.filter(m => m.goals_h === 0)].length
  const wins = hm.filter(m => m.goals_h > m.goals_a).length + am.filter(m => m.goals_a > m.goals_h).length
  const draws = hm.filter(m => m.goals_h === m.goals_a).length + am.filter(m => m.goals_h === m.goals_a).length
  return {
    games, scored, conceded, bttsCount, cleanSheets, wins, draws,
    losses: games - wins - draws,
    scoredPerGame: scored / games,
    concededPerGame: conceded / games,
    bttsRate: bttsCount / games,
    cleanSheetRate: cleanSheets / games,
  }
}

async function getH2H(homeTeam: string, awayTeam: string) {
  const { data } = await supabase
    .from('matches')
    .select('home_team_name, away_team_name, goals_h, goals_a, datetime')
    .not('goals_h', 'is', null)
    .not('goals_a', 'is', null)
    .or(`and(home_team_name.eq.${homeTeam},away_team_name.eq.${awayTeam}),and(home_team_name.eq.${awayTeam},away_team_name.eq.${homeTeam})`)
    .order('datetime', { ascending: false })
    .limit(1)
  return data?.[0] ?? null
}

async function getHomeStats(teamName: string) {
  const { data } = await supabase
    .from('matches')
    .select('goals_h, goals_a, home_xg, away_xg')
    .eq('home_team_name', teamName)
    .not('goals_h', 'is', null)
    .order('datetime', { ascending: false })
    .limit(20)
  return data ?? []
}

async function getAwayStats(teamName: string) {
  const { data } = await supabase
    .from('matches')
    .select('goals_h, goals_a, home_xg, away_xg')
    .eq('away_team_name', teamName)
    .not('goals_h', 'is', null)
    .order('datetime', { ascending: false })
    .limit(20)
  return data ?? []
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const { data: match } = await supabase
    .from('matches')
    .select('home_team_name, away_team_name, datetime, league_id')
    .eq('fixture_id', Number(id))
    .single()

  if (!match) return { title: 'Match | False Nine' }

  const league = match.league_id === 39 ? 'Premier League' : match.league_id === 40 ? 'Championship' : 'FA Cup'
  const date = new Date(match.datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const title = `${match.home_team_name} vs ${match.away_team_name} — Predictions & Stats`
  const description = `${league} match predictions, xG analysis and player picks for ${match.home_team_name} vs ${match.away_team_name} on ${date}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://falsenineapp.com/match/${id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const matchId = Number(id)

  const supabaseServer = await createSupabaseServer()
  const { data: { user } } = await supabaseServer.auth.getUser()

  let isPro = false
  if (user) {
    const { data: profile } = await supabaseServer.from('profiles').select('is_pro').eq('id', user.id).single()
    isPro = profile?.is_pro ?? false
  }
  const isLoggedIn = !!user

  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('fixture_id', matchId)
    .single()

  if (!match) return <div style={{ color: 'white', padding: '20px' }}>Match not found</div>

  const isInPlay = match.status_short !== null && IN_PLAY_STATUSES.includes(match.status_short)
  const isFinished = match.status_short !== null && FINISHED_STATUSES.includes(match.status_short)
  const isPlayed = isInPlay || isFinished

  const refLastName = match.referee
    ? match.referee.split(',')[0].trim().split(' ').pop() ?? null
    : null

  const [
    homePlayers, awayPlayers, homeForm, awayForm, h2h, refStats,
    homeTeamStats, awayTeamStats, homeSeasonStats, awaySeasonStats,
    playerPredictions, matchEvents, lineups, homeTeamData, awayTeamData,
    homeMatchStats, awayMatchStats, homeTeamRankings, awayTeamRankings,
    playerRankings, refRankings
  ] = await Promise.all([
    supabase.from('players').select('*').eq('team_name', match.home_team_name).eq('league_id', match.league_id).eq('season', SEASON).order('games', { ascending: false }).then(r => r.data),
    supabase.from('players').select('*').eq('team_name', match.away_team_name).eq('league_id', match.league_id).eq('season', SEASON).order('games', { ascending: false }).then(r => r.data),
    getTeamForm(match.home_team_name),
    getTeamForm(match.away_team_name),
    getH2H(match.home_team_name, match.away_team_name),
    getRefereeStats(match.referee),
    getTeamStats(match.home_team_name),
    getTeamStats(match.away_team_name),
    getTeamSeasonStats(match.home_team_name),
    getTeamSeasonStats(match.away_team_name),
    supabase.from('player_predictions').select('*').eq('fixture_id', matchId).then(r => r.data),
    isPlayed
      ? supabase.from('match_events').select('*').eq('fixture_id', matchId).order('elapsed', { ascending: true }).then(r => r.data)
      : Promise.resolve([]),
    supabase.from('lineups').select('*').eq('fixture_id', matchId).then(r => r.data),
    supabase.from('teams').select('logo').eq('name', match.home_team_name).single().then(r => r.data),
    supabase.from('teams').select('logo').eq('name', match.away_team_name).single().then(r => r.data),
    getHomeStats(match.home_team_name),
    getAwayStats(match.away_team_name),
    supabase.from('team_rankings').select('*').eq('team_name', match.home_team_name).eq('league_id', match.league_id).eq('season', SEASON).then(r => r.data),
    supabase.from('team_rankings').select('*').eq('team_name', match.away_team_name).eq('league_id', match.league_id).eq('season', SEASON).then(r => r.data),
    supabase.from('player_rankings').select('*').eq('season', SEASON).eq('league_id', match.league_id).in('team_name', [match.home_team_name, match.away_team_name]).then(r => r.data),
    refLastName
      ? supabase.from('referee_rankings').select('*').ilike('referee_name', `%${refLastName}%`).eq('season', SEASON).then(r => r.data)
      : Promise.resolve([]),
  ])

  const homeLogo = homeTeamData?.logo ?? null
  const awayLogo = awayTeamData?.logo ?? null

  const lineupsConfirmed = !isPlayed
    ? ((lineups ?? []).filter(l => !l.is_substitute).length > 0)
    : false

  const refRank = (stat: string): number | null => {
    const r = (refRankings ?? []).find((r: any) => r.stat === stat)
    return r?.per_game_rank ?? null
  }

  const refRankColor = (rank: number | null): string => {
    if (rank === null) return '#8896a8'
    if (rank <= 3) return '#00c864'
    if (rank <= 10) return '#ffc800'
    return '#8896a8'
  }

  const time = new Date(match.datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const date = new Date(match.datetime).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const h2hDate = h2h ? new Date(h2h.datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null

  const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
    width: '18px', height: '18px', borderRadius: '4px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '9px', fontWeight: 700, background: bg, color, flexShrink: 0,
  })

  const formBg = (r: string) => r === 'W' ? 'rgba(0,200,100,0.15)' : r === 'D' ? 'rgba(255,200,0,0.15)' : 'rgba(255,80,80,0.15)'
  const formColor = (r: string) => r === 'W' ? '#00c864' : r === 'D' ? '#ffc800' : '#ff5050'

  const logoStyle: React.CSSProperties = { width: '48px', height: '48px', objectFit: 'contain' }
  const logoPlaceholder = <div style={{ width: '48px', height: '48px' }} />

  const scoreLabel = isInPlay
    ? match.status_short === 'HT' ? 'Half Time' : `${match.status_elapsed ?? ''}'`
    : 'Full Time'

  const badgeRow = (items: { bg: string, color: string, label: string }[]) => (
    <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
      {items.map((item, i) => (
        <div key={i} style={badgeStyle(item.bg, item.color)}>{item.label}</div>
      ))}
    </div>
  )

  const upcomingLineups = !isPlayed ? (lineups ?? []) : []
  const hasUpcomingLineups = upcomingLineups.length > 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
.app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #080c10; padding-bottom: 100px; }
.nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: rgba(8,12,16,0.95); backdrop-filter: blur(20px); border-top: 1px solid #1a2030; display: flex; padding: 10px 0 24px; z-index: 50; }
.nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; opacity: 0.4; transition: opacity 0.2s; text-decoration: none; color: inherit; }
.nav-item.active { opacity: 1; }
.nav-icon { font-size: 18px; }
.nav-label { font-size: 9px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #00c864; }
.nav-item:not(.active) .nav-label { color: #8896a8; }
        .back-bar { padding: 56px 24px 0; }
        .back-btn { font-size: 13px; color: #00c864; text-decoration: none; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
        .match-hero { padding: 24px; position: relative; }
        .match-hero::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 200px; background: radial-gradient(ellipse at 50% 0%, rgba(0,200,100,0.12) 0%, transparent 70%); pointer-events: none; }
        .match-date { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #00c864; margin-bottom: 20px; font-weight: 600; text-align: center; }
        .teams-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
        .team-block { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .team-name { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; color: #8896a8; text-align: center; line-height: 1.3; }
        .stat-group { display: flex; flex-direction: column; align-items: center; gap: 3px; width: 100%; }
        .stat-group-label { font-size: 8px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #8896a8; text-align: center; }
        .vs-block { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; flex-shrink: 0; width: 36px; padding-top: 60px; gap: 38px; }
        .live-dot { width: 6px; height: 6px; border-radius: 50%; background: #ff4d4d; animation: pulse 1.2s ease-in-out infinite; display: inline-block; margin-right: 4px; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
        .h2h-card { background: #0e1318; border: 1px solid #1a2030; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; }
        .h2h-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #1a2030; }
        .h2h-label { font-size: 9px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #8896a8; }
        .h2h-date { font-size: 10px; color: #8896a8; }
        .h2h-score-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .h2h-team { font-size: 12px; font-weight: 600; color: #e8edf2; flex: 1; }
        .h2h-team.away { text-align: right; }
        .h2h-result { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #00c864; letter-spacing: 3px; flex-shrink: 0; }
        .ref-card { background: #0e1318; border: 1px solid #1a2030; border-radius: 10px; padding: 8px 14px; margin-bottom: 12px; }
        .ref-top { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #1a2030; min-width: 0; }
        .ref-label { font-size: 9px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #8896a8; flex-shrink: 0; }
        .ref-name { font-size: 12px; font-weight: 600; color: #e8edf2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ref-stats { display: flex; align-items: flex-start; gap: 0; }
        .ref-stat { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 0 4px; }
        .ref-stat + .ref-stat { border-left: 1px solid #1a2030; }
        .ref-stat-value { font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: #e8edf2; letter-spacing: 0.5px; line-height: 1; }
        .ref-stat-value.yellow { color: #ffc800; }
        .ref-stat-value.red { color: #ff5050; }
        .ref-stat-label { font-size: 8px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #8896a8; margin-top: 2px; }
        .ref-stat-rank { font-size: 8px; font-weight: 700; margin-top: 2px; line-height: 1; }
      `}</style>

      <div className="app">
        <MatchRefresher statusShort={match.status_short} />

        <div className="back-bar">
          <a href="/" className="back-btn">← Fixtures</a>
        </div>

        {isPlayed ? (
          <div className="match-hero">
            <div className="match-date">{date}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                {homeLogo ? <img src={homeLogo} alt={match.home_team_name} style={logoStyle} /> : logoPlaceholder}
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#8896a8', textAlign: 'center', letterSpacing: '0.5px' }}>
                  {match.home_team_name}
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '44px', color: '#00c864', letterSpacing: '8px', lineHeight: 1 }}>
                  {match.goals_h ?? 0} - {match.goals_a ?? 0}
                </div>
                {match.ht_goals_h !== null && (
                  <div style={{ fontSize: '10px', color: '#4a5568', marginTop: '2px' }}>
                    HT {match.ht_goals_h} - {match.ht_goals_a}
                  </div>
                )}
                <div style={{ fontSize: '10px', color: isInPlay ? '#ff4d4d' : '#8896a8', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isInPlay && <span className="live-dot" />}
                  {scoreLabel}
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                {awayLogo ? <img src={awayLogo} alt={match.away_team_name} style={logoStyle} /> : logoPlaceholder}
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#8896a8', textAlign: 'center', letterSpacing: '0.5px' }}>
                  {match.away_team_name}
                </div>
              </div>
            </div>
            {match.venue_name && (
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#4a5568', marginBottom: '6px' }}>
                📍 {match.venue_name}
              </div>
            )}
            {match.referee && (
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#4a5568' }}>
                🏁 {match.referee}
              </div>
            )}
          </div>
        ) : (
          <div className="match-hero">
            <div className="match-date">{date} · {time}</div>

            <div className="teams-row">
              <div className="team-block">
                {homeLogo ? <img src={homeLogo} alt={match.home_team_name} style={logoStyle} /> : logoPlaceholder}
                <div className="team-name">{match.home_team_name}</div>
                <div className="stat-group">
                  <div className="stat-group-label">Form</div>
                  {badgeRow(homeForm.map(f => ({ bg: formBg(f.result), color: formColor(f.result), label: f.result })))}
                </div>
                <div className="stat-group">
                  <div className="stat-group-label">BTTS</div>
                  {badgeRow(homeForm.map(f => ({ bg: f.btts ? 'rgba(0,200,100,0.15)' : 'rgba(255,80,80,0.15)', color: f.btts ? '#00c864' : '#ff5050', label: '●' })))}
                </div>
              </div>

              <div className="vs-block">
                <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '18px', color: '#4a5568', letterSpacing: '1px' }}>VS</span>
              </div>

              <div className="team-block">
                {awayLogo ? <img src={awayLogo} alt={match.away_team_name} style={logoStyle} /> : logoPlaceholder}
                <div className="team-name">{match.away_team_name}</div>
                <div className="stat-group">
                  <div className="stat-group-label">Form</div>
                  {badgeRow(awayForm.map(f => ({ bg: formBg(f.result), color: formColor(f.result), label: f.result })))}
                </div>
                <div className="stat-group">
                  <div className="stat-group-label">BTTS</div>
                  {badgeRow(awayForm.map(f => ({ bg: f.btts ? 'rgba(0,200,100,0.15)' : 'rgba(255,80,80,0.15)', color: f.btts ? '#00c864' : '#ff5050', label: '●' })))}
                </div>
              </div>
            </div>

            {h2h && (
              <div className="h2h-card">
                <div className="h2h-top">
                  <span className="h2h-label">Last H2H</span>
                  <span className="h2h-date">{h2hDate}</span>
                </div>
                <div className="h2h-score-row">
                  <span className="h2h-team">{h2h.home_team_name}</span>
                  <span className="h2h-result">{h2h.goals_h} - {h2h.goals_a}</span>
                  <span className="h2h-team away">{h2h.away_team_name}</span>
                </div>
              </div>
            )}

            {match.referee && refStats && isPro && (
              <div className="ref-card">
                <div className="ref-top">
                  <span className="ref-label">Ref</span>
                  <span className="ref-name">
                    {(refRankings ?? []).length > 0 ? (refRankings as any[])[0].referee_name : match.referee?.split(',')[0].trim()}
                  </span>
                </div>
                <div className="ref-stats">
                  <div className="ref-stat">
                    <div className="ref-stat-value yellow">{refStats.yellowsPerGame.toFixed(1)}</div>
                    <div className="ref-stat-label">Yellow Cards</div>
                    <div className="ref-stat-rank" style={{ color: refRankColor(refRank('yellows')) }}>
                      {refRank('yellows') !== null ? `#${refRank('yellows')}` : ''}
                    </div>
                  </div>
                  <div className="ref-stat">
                    <div className="ref-stat-value red">{refStats.redsPerGame.toFixed(2)}</div>
                    <div className="ref-stat-label">Red Cards</div>
                    <div className="ref-stat-rank" style={{ color: refRankColor(refRank('reds')) }}>
                      {refRank('reds') !== null ? `#${refRank('reds')}` : ''}
                    </div>
                  </div>
                  <div className="ref-stat">
                    <div className="ref-stat-value">{refStats.foulsPerGame.toFixed(1)}</div>
                    <div className="ref-stat-label">Fouls</div>
                    <div className="ref-stat-rank" style={{ color: refRankColor(refRank('fouls')) }}>
                      {refRank('fouls') !== null ? `#${refRank('fouls')}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {isPlayed && (
          <MatchEvents match={match} events={matchEvents ?? []} lineups={lineups ?? []} />
        )}

        {!isPlayed && (
          <Predictions
            playerPredictions={playerPredictions ?? []}
            homeSeasonStats={homeSeasonStats}
            awaySeasonStats={awaySeasonStats}
            homeForm={homeForm}
            awayForm={awayForm}
            homeMatchStats={homeMatchStats}
            awayMatchStats={awayMatchStats}
            lineupsConfirmed={lineupsConfirmed}
            isPro={isPro}
            isLoggedIn={isLoggedIn}
          />
        )}

        {!isPlayed && hasUpcomingLineups && (
          <div style={{ padding: '0 24px', marginBottom: '8px' }}>
            <div style={{
              fontSize: '11px', fontWeight: 600, letterSpacing: '3px',
              textTransform: 'uppercase', color: '#00c864',
              marginBottom: '12px', paddingBottom: '8px',
              borderBottom: '1px solid rgba(0,200,100,0.15)',
            }}>Lineups</div>
            <div style={{ display: 'flex', gap: '1px', background: '#1a2030', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ flex: 1, background: '#0e1318', padding: '14px 12px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' }}>
                  {match.home_team_name}
                </div>
                <LineupColumn
                  players={upcomingLineups.filter(p => p.team_name === match.home_team_name && !p.is_substitute)}
                  subs={upcomingLineups.filter(p => p.team_name === match.home_team_name && p.is_substitute)}
                  formation={upcomingLineups.find(p => p.team_name === match.home_team_name)?.formation ?? null}
                  side="home"
                />
              </div>
              <div style={{ flex: 1, background: '#0e1318', padding: '14px 12px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', letterSpacing: '1px', marginBottom: '8px', textAlign: 'right', textTransform: 'uppercase' }}>
                  {match.away_team_name}
                </div>
                <LineupColumn
                  players={upcomingLineups.filter(p => p.team_name === match.away_team_name && !p.is_substitute)}
                  subs={upcomingLineups.filter(p => p.team_name === match.away_team_name && p.is_substitute)}
                  formation={upcomingLineups.find(p => p.team_name === match.away_team_name)?.formation ?? null}
                  side="away"
                />
              </div>
            </div>
          </div>
        )}

        {!isPlayed && (
          <SquadView
            match={match}
            homePlayers={homePlayers ?? []}
            awayPlayers={awayPlayers ?? []}
            homeTeamStats={homeTeamStats}
            awayTeamStats={awayTeamStats}
            homeTeamRankings={homeTeamRankings ?? []}
            awayTeamRankings={awayTeamRankings ?? []}
            playerRankings={playerRankings ?? []}
            lineups={lineups ?? []}
            isPro={isPro}
            isLoggedIn={isLoggedIn}
          />
        )}
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: `${match.home_team_name} vs ${match.away_team_name}`,
      startDate: match.datetime,
      location: match.venue_name ? {
        '@type': 'Place',
        name: match.venue_name,
      } : undefined,
      homeTeam: {
        '@type': 'SportsTeam',
        name: match.home_team_name,
      },
      awayTeam: {
        '@type': 'SportsTeam',
        name: match.away_team_name,
      },
      sport: 'Football',
      url: `https://falsenineapp.com/match/${match.fixture_id}`,
      organizer: {
        '@type': 'Organization',
        name: 'False Nine',
        url: 'https://falsenineapp.com',
      },
    })
  }}
/>
<nav className="nav">
  <a href="/" className="nav-item">
    <span className="nav-icon">⚽</span>
    <span className="nav-label">Fixtures</span>
  </a>
  <a href="/lms" className="nav-item">
    <span className="nav-icon">🏆</span>
    <span className="nav-label">LMS</span>
  </a>
  <a href="/fpl" className="nav-item">
    <span className="nav-icon">📋</span>
    <span className="nav-label">FPL</span>
  </a>
  <a href="/super-six" className="nav-item">
    <span className="nav-icon">6️⃣</span>
    <span className="nav-label">Super Six</span>
  </a>
  <a href="/account" className="nav-item">
    <span className="nav-icon">👤</span>
    <span className="nav-label">Account</span>
  </a>
</nav>

      </div>
    </>
  )
}