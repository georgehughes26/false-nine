import { supabase } from '@/lib/supabase'
import SquadView from './SquadView'
import Predictions from './Predictions'

async function getTeamForm(teamTitle: string) {
  const { data: homeMatches } = await supabase
    .from('matches')
    .select('goals_h, goals_a, h_title, a_title, datetime')
    .eq('h_title', teamTitle)
    .not('goals_h', 'is', null)
    .not('goals_a', 'is', null)
    .order('datetime', { ascending: false })
    .limit(5)

  const { data: awayMatches } = await supabase
    .from('matches')
    .select('goals_h, goals_a, h_title, a_title, datetime')
    .eq('a_title', teamTitle)
    .not('goals_h', 'is', null)
    .not('goals_a', 'is', null)
    .order('datetime', { ascending: false })
    .limit(5)

  const all = [
    ...(homeMatches ?? []).map(m => ({ ...m, side: 'home' })),
    ...(awayMatches ?? []).map(m => ({ ...m, side: 'away' })),
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

async function getH2H(homeTeam: string, awayTeam: string) {
  const { data } = await supabase
    .from('matches')
    .select('h_title, a_title, goals_h, goals_a, datetime')
    .not('goals_h', 'is', null)
    .not('goals_a', 'is', null)
    .or(`and(h_title.eq.${homeTeam},a_title.eq.${awayTeam}),and(h_title.eq.${awayTeam},a_title.eq.${homeTeam})`)
    .order('datetime', { ascending: false })
    .limit(1)
  return data?.[0] ?? null
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const matchId = Number(id)

  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('match_id', matchId)
    .single()

  if (!match) return <div style={{ color: 'white', padding: '20px' }}>Match not found</div>

  const [homePlayers, awayPlayers, homeForm, awayForm, h2h] = await Promise.all([
    supabase.from('player_data').select('*').eq('team_title', match.h_title).order('games', { ascending: false }).then(r => r.data),
    supabase.from('player_data').select('*').eq('team_title', match.a_title).order('games', { ascending: false }).then(r => r.data),
    getTeamForm(match.h_title),
    getTeamForm(match.a_title),
    getH2H(match.h_title, match.a_title),
  ])

  const time = new Date(match.datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const date = new Date(match.datetime).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const h2hDate = h2h ? new Date(h2h.datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null
  const fW = match.forecast_w ? Math.round(match.forecast_w * 100) : null
  const fD = match.forecast_d ? Math.round(match.forecast_d * 100) : null
  const fL = match.forecast_l ? Math.round(match.forecast_l * 100) : null

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
        .arrow { font-size: 10px; color: #2a3545; flex-shrink: 0; }

        .kickoff {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 4px;
          flex-shrink: 0;
          padding-top: 36px;
        }

        .kickoff-time { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #00c864; letter-spacing: 2px; line-height: 1; }
        .kickoff-label { font-size: 10px; color: #4a5568; letter-spacing: 2px; text-transform: uppercase; }

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

        .forecast-row { display: flex; gap: 8px; margin-bottom: 8px; }
        .forecast-card { flex: 1; padding: 12px; border-radius: 10px; text-align: center; }
        .forecast-card.win { background: rgba(0,200,100,0.08); border: 1px solid rgba(0,200,100,0.2); }
        .forecast-card.draw { background: rgba(255,200,0,0.08); border: 1px solid rgba(255,200,0,0.2); }
        .forecast-card.loss { background: rgba(255,80,80,0.08); border: 1px solid rgba(255,80,80,0.2); }
        .forecast-pct { font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 1px; }
        .forecast-card.win .forecast-pct { color: #00c864; }
        .forecast-card.draw .forecast-pct { color: #ffc800; }
        .forecast-card.loss .forecast-pct { color: #ff5050; }
        .forecast-label { font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #4a5568; margin-top: 2px; }
      `}</style>

      <div className="app">
        <div className="back-bar">
          <a href="/" className="back-btn">← Fixtures</a>
        </div>

        <div className="match-hero">
          <div className="match-date">{date} · {time} KO</div>

          <div className="teams-row">
            {/* Home */}
            <div className="team-block">
              <div className="team-name">{match.h_title}</div>
              <div className="stat-row">
                <span className="stat-row-label">Form</span>
                <div className="badges">
                  {homeForm.map((f, i) => (
                    <div key={i} style={badgeStyle(formBg(f.result), formColor(f.result))}>{f.result}</div>
                  ))}
                </div>
                <span className="arrow">→</span>
              </div>
              <div className="stat-row">
                <span className="stat-row-label">BTTS</span>
                <div className="badges">
                  {homeForm.map((f, i) => (
                    <div key={i} style={badgeStyle(f.btts ? 'rgba(0,200,100,0.15)' : 'rgba(255,80,80,0.15)', f.btts ? '#00c864' : '#ff5050')}>●</div>
                  ))}
                </div>
                <span className="arrow">→</span>
              </div>
            </div>

            {/* KO */}
            <div className="kickoff">
              <span className="kickoff-time">{time}</span>
              <span className="kickoff-label">Kick Off</span>
            </div>

            {/* Away */}
            <div className="team-block away">
              <div className="team-name">{match.a_title}</div>
              <div className="stat-row">
                <span className="stat-row-label">Form</span>
                <div className="badges">
                  {awayForm.map((f, i) => (
                    <div key={i} style={badgeStyle(formBg(f.result), formColor(f.result))}>{f.result}</div>
                  ))}
                </div>
                <span className="arrow">←</span>
              </div>
              <div className="stat-row">
                <span className="stat-row-label">BTTS</span>
                <div className="badges">
                  {awayForm.map((f, i) => (
                    <div key={i} style={badgeStyle(f.btts ? 'rgba(0,200,100,0.15)' : 'rgba(255,80,80,0.15)', f.btts ? '#00c864' : '#ff5050')}>●</div>
                  ))}
                </div>
                <span className="arrow">←</span>
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
                <span className="h2h-team">{h2h.h_title}</span>
                <span className="h2h-result">{h2h.goals_h} - {h2h.goals_a}</span>
                <span className="h2h-team away">{h2h.a_title}</span>
              </div>
            </div>
          )}

          {(fW || fD || fL) && (
            <div className="forecast-row">
              {fW && <div className="forecast-card win"><div className="forecast-pct">{fW}%</div><div className="forecast-label">Home Win</div></div>}
              {fD && <div className="forecast-card draw"><div className="forecast-pct">{fD}%</div><div className="forecast-label">Draw</div></div>}
              {fL && <div className="forecast-card loss"><div className="forecast-pct">{fL}%</div><div className="forecast-label">Away Win</div></div>}
            </div>
          )}
        </div>

        <Predictions
          match={match}
          homePlayers={homePlayers ?? []}
          awayPlayers={awayPlayers ?? []}
        />

        <SquadView
          match={match}
          homePlayers={homePlayers ?? []}
          awayPlayers={awayPlayers ?? []}
        />
      </div>
    </>
  )
}
