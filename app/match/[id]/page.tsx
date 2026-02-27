import { supabase } from '@/lib/supabase'
import SquadView from './SquadView'
import Predictions from './Predictions'
import { createSupabaseServer } from '@/lib/supabase-server'

async function getRefereeStats(refereeName: string | null) {
  if (!refereeName) return null

  const { data: matches } = await supabase
    .from('matches')
    .select('home_yellow_cards, away_yellow_cards, home_red_cards, away_red_cards, home_fouls, away_fouls')
    .eq('referee', refereeName)
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

  const goals = hm.reduce((s, m) => s + (m.goals_h ?? 0), 0) + am.reduce((s, m) => s + (m.goals_a ?? 0), 0)
  const conceded = hm.reduce((s, m) => s + (m.goals_a ?? 0), 0) + am.reduce((s, m) => s + (m.goals_h ?? 0), 0)
  const sot = hm.reduce((s, m) => s + (m.home_shots_on ?? 0), 0) + am.reduce((s, m) => s + (m.away_shots_on ?? 0), 0)
  const shots = hm.reduce((s, m) => s + (m.home_shots_total ?? 0), 0) + am.reduce((s, m) => s + (m.away_shots_total ?? 0), 0)
  const corners = hm.reduce((s, m) => s + (m.home_corners ?? 0), 0) + am.reduce((s, m) => s + (m.away_corners ?? 0), 0)
  const fouls = hm.reduce((s, m) => s + (m.home_fouls ?? 0), 0) + am.reduce((s, m) => s + (m.away_fouls ?? 0), 0)
  const yellows = hm.reduce((s, m) => s + (m.home_yellow_cards ?? 0), 0) + am.reduce((s, m) => s + (m.away_yellow_cards ?? 0), 0)
  const reds = hm.reduce((s, m) => s + (m.home_red_cards ?? 0), 0) + am.reduce((s, m) => s + (m.away_red_cards ?? 0), 0)
  const saves = hm.reduce((s, m) => s + (m.home_saves ?? 0), 0) + am.reduce((s, m) => s + (m.away_saves ?? 0), 0)

  return {
    games,
    goals,
    conceded,
    sot,
    shots,
    corners,
    fouls,
    yellows,
    reds,
    saves,
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
  const bttsCount = [
    ...hm.filter(m => m.goals_h > 0 && m.goals_a > 0),
    ...am.filter(m => m.goals_a > 0 && m.goals_h > 0),
  ].length
  const cleanSheets = [
    ...hm.filter(m => m.goals_a === 0),
    ...am.filter(m => m.goals_h === 0),
  ].length
  const wins = hm.filter(m => m.goals_h > m.goals_a).length + am.filter(m => m.goals_a > m.goals_h).length
  const draws = hm.filter(m => m.goals_h === m.goals_a).length + am.filter(m => m.goals_h === m.goals_a).length
  const losses = games - wins - draws

  return {
    games,
    scored,
    conceded,
    bttsCount,
    cleanSheets,
    wins,
    draws,
    losses,
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




export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const matchId = Number(id)

  const supabaseServer = await createSupabaseServer()
const { data: { user } } = await supabaseServer.auth.getUser()
const { data: profile } = await supabaseServer.from('profiles').select('is_pro').eq('id', user?.id).single()
const isPro = profile?.is_pro ?? false

  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('fixture_id', matchId)
    .single()

  if (!match) return <div style={{ color: 'white', padding: '20px' }}>Match not found</div>

  const [homePlayers, awayPlayers, homeForm, awayForm, h2h, refStats, homeTeamStats, awayTeamStats, homeSeasonStats, awaySeasonStats] = await Promise.all([
    supabase.from('players').select('*').eq('team_name', match.home_team_name).order('games', { ascending: false }).then(r => r.data),
    supabase.from('players').select('*').eq('team_name', match.away_team_name).order('games', { ascending: false }).then(r => r.data),
    getTeamForm(match.home_team_name),
    getTeamForm(match.away_team_name),
    getH2H(match.home_team_name, match.away_team_name),
    getRefereeStats(match.referee),
    getTeamStats(match.home_team_name),
    getTeamStats(match.away_team_name),
    getTeamSeasonStats(match.home_team_name),
    getTeamSeasonStats(match.away_team_name),
  ])

  const time = new Date(match.datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const date = new Date(match.datetime).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const h2hDate = h2h ? new Date(h2h.datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null

  const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
    width: '22px', height: '22px', borderRadius: '5px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '10px', fontWeight: 700, background: bg, color, flexShrink: 0,
  })

  const formBg = (r: string) => r === 'W' ? 'rgba(0,200,100,0.15)' : r === 'D' ? 'rgba(255,200,0,0.15)' : 'rgba(255,80,80,0.15)'
  const formColor = (r: string) => r === 'W' ? '#00c864' : r === 'D' ? '#ffc800' : '#ff5050'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        .app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #080c10; padding-bottom: 40px; }
        .back-bar { padding: 56px 24px 0; }
        .back-btn { font-size: 13px; color: #00c864; text-decoration: none; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
        .match-hero { padding: 24px; position: relative; }
        .match-hero::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 200px; background: radial-gradient(ellipse at 50% 0%, rgba(0, 200, 100, 0.12) 0%, transparent 70%); pointer-events: none; }
        .match-date { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #00c864; margin-bottom: 16px; font-weight: 600; }

        .teams-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 12px;
        }

        .team-block {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .team-block.away {
          align-items: center;
        }

        .team-name {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 24px;
          letter-spacing: 1px;
          line-height: 1.1;
          color: #ffffff;
          margin-bottom: 4px;
          text-align: center;
          width: 100%;
          min-height: 54px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        .stat-row {
          display: flex;
          align-items: center;
          gap: 4px;
          width: 100%;
          justify-content: flex-start;
        }

        .team-block.away .stat-row {
          flex-direction: row-reverse;
        }

        .stat-row-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #4a5568;
          width: 28px;
          flex-shrink: 0;
          text-align: left;
        }

        .team-block.away .stat-row-label { text-align: right; }
        .badges { display: flex; gap: 3px; }
        .form-arrow { font-size: 10px; color: #2a3545; flex-shrink: 0; }

        .score-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 4px;
          flex-shrink: 0;
          padding-top: 36px;
        }

        .score-main {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 36px;
          color: #00c864;
          letter-spacing: 4px;
          line-height: 1;
        }

        .score-label {
          font-size: 10px;
          color: #4a5568;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .h2h-card {
          background: #0e1318;
          border: 1px solid #1a2030;
          border-radius: 10px;
          padding: 10px 14px;
          margin-bottom: 12px;
        }

        .h2h-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid #1a2030;
        }

        .h2h-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #4a5568;
        }

        .h2h-date {
          font-size: 10px;
          color: #4a5568;
        }

        .h2h-score-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .h2h-team {
          font-size: 12px;
          font-weight: 600;
          color: #e8edf2;
          flex: 1;
        }

        .h2h-team.away { text-align: right; }

        .h2h-result {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 24px;
          color: #00c864;
          letter-spacing: 3px;
          flex-shrink: 0;
        }

        .ref-card {
          background: #0e1318;
          border: 1px solid #1a2030;
          border-radius: 10px;
          padding: 8px 14px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .ref-left {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }

        .ref-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #4a5568;
          flex-shrink: 0;
        }

        .ref-name {
          font-size: 12px;
          font-weight: 600;
          color: #e8edf2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ref-stats {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .ref-stat {
          display: flex;
          align-items: baseline;
          gap: 3px;
        }

        .ref-stat-value {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 16px;
          color: #e8edf2;
          letter-spacing: 0.5px;
          line-height: 1;
        }

        .ref-stat-value.yellow { color: #ffc800; }
        .ref-stat-value.red { color: #ff5050; }

        .ref-stat-label {
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #4a5568;
        }
      `}</style>

      <div className="app">
        <div className="back-bar">
          <a href="/" className="back-btn">← Results</a>
        </div>

        <div className="match-hero">
          <div className="match-date">{date} · {time}</div>

          <div className="teams-row">
            {/* Home */}
            <div className="team-block">
              <div className="team-name">{match.home_team_name}</div>
              <div className="stat-row">
                <span className="stat-row-label">Form</span>
                <div className="badges">
                  {homeForm.map((f, i) => (
                    <div key={i} style={badgeStyle(formBg(f.result), formColor(f.result))}>{f.result}</div>
                  ))}
                </div>
                <span className="form-arrow">→</span>
              </div>
              <div className="stat-row">
                <span className="stat-row-label">BTTS</span>
                <div className="badges">
                  {homeForm.map((f, i) => (
                    <div key={i} style={badgeStyle(f.btts ? 'rgba(0,200,100,0.15)' : 'rgba(255,80,80,0.15)', f.btts ? '#00c864' : '#ff5050')}>●</div>
                  ))}
                </div>
                <span className="form-arrow">→</span>
              </div>
            </div>

            {/* Score */}
            <div className="score-block">
              <span className="score-main">{match.goals_h} - {match.goals_a}</span>
              <span className="score-label">Full Time</span>
            </div>

            {/* Away */}
            <div className="team-block away">
              <div className="team-name">{match.away_team_name}</div>
              <div className="stat-row">
                <span className="stat-row-label">Form</span>
                <div className="badges">
                  {awayForm.map((f, i) => (
                    <div key={i} style={badgeStyle(formBg(f.result), formColor(f.result))}>{f.result}</div>
                  ))}
                </div>
                <span className="form-arrow">←</span>
              </div>
              <div className="stat-row">
                <span className="stat-row-label">BTTS</span>
                <div className="badges">
                  {awayForm.map((f, i) => (
                    <div key={i} style={badgeStyle(f.btts ? 'rgba(0,200,100,0.15)' : 'rgba(255,80,80,0.15)', f.btts ? '#00c864' : '#ff5050')}>●</div>
                  ))}
                </div>
                <span className="form-arrow">←</span>
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

          {match.referee && refStats && (
            <div className="ref-card">
              <div className="ref-left">
                <span className="ref-label">Ref</span>
                <span className="ref-name">{match.referee}</span>
              </div>
              <div className="ref-stats">
                <div className="ref-stat">
                  <span className="ref-stat-value yellow">{refStats.yellowsPerGame.toFixed(1)}</span>
                  <span className="ref-stat-label">YC</span>
                </div>
                <div className="ref-stat">
                  <span className="ref-stat-value red">{refStats.redsPerGame.toFixed(2)}</span>
                  <span className="ref-stat-label">RC</span>
                </div>
                <div className="ref-stat">
                  <span className="ref-stat-value">{refStats.foulsPerGame.toFixed(1)}</span>
                  <span className="ref-stat-label">Fouls</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <Predictions
          match={match}
          homePlayers={homePlayers ?? []}
          awayPlayers={awayPlayers ?? []}
          homeSeasonStats={homeSeasonStats}
          awaySeasonStats={awaySeasonStats}
          isPro={isPro}
        />

        <SquadView
          match={match}
          homePlayers={homePlayers ?? []}
          awayPlayers={awayPlayers ?? []}
          homeTeamStats={homeTeamStats}
          awayTeamStats={awayTeamStats}
          isPro={isPro}
        />
      </div>
    </>
  )
}
