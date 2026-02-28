'use client'

import { useState } from 'react'

function parseGW(round: string | null): number {
  if (!round) return 0
  const m = round?.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

interface Match {
  fixture_id: number
  round: string
  datetime: string
  home_team_name: string
  away_team_name: string
  goals_h: number | null
  goals_a: number | null
  venue_name: string | null
}

interface Props {
  matches: Match[]
  nextGW: number
  upcomingGWs: number[]
  grouped: Record<string, Match[]>
}

function MatchCard({ match }: { match: Match }) {
  const isPlayed = match.goals_h !== null && match.goals_a !== null
  const kickoff = new Date(match.datetime)

  return (
    <a
      href={`/match/${match.fixture_id}`}
      className={`match-card ${isPlayed ? 'played' : ''}`}
    >
      <div className="match-teams">
        <div className="team">{match.home_team_name}</div>
        <div className="vs-block">
          {isPlayed ? (
            <>
              <span className="score">{match.goals_h}</span>
              <span className="score-divider">–</span>
              <span className="score">{match.goals_a}</span>
            </>
          ) : (
            <span className="vs-text">VS</span>
          )}
        </div>
        <div className="team away">{match.away_team_name}</div>
      </div>
      <div className="match-meta">
        {isPlayed ? (
          <span className="ft-badge">FT</span>
        ) : (
          <span className="match-time">
            {kickoff.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            {' · '}
            {kickoff.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {match.venue_name && <span className="match-venue">{match.venue_name}</span>}
        <span className="arrow">›</span>
      </div>
    </a>
  )
}

export default function GWFilterPage({ matches, nextGW, upcomingGWs, grouped }: Props) {
  const [selectedGW, setSelectedGW] = useState(nextGW)

  const gwKey = Object.keys(grouped).find(k => parseGW(k) === selectedGW)
  const gwMatches = gwKey ? grouped[gwKey] : []

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        .app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #080c10; }
        .header { padding: 56px 24px 16px; position: relative; }
        .header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 200px; background: radial-gradient(ellipse at 50% -20%, rgba(0,200,100,0.15) 0%, transparent 70%); pointer-events: none; }
        .logo { font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 4px; color: #00c864; text-transform: uppercase; margin-bottom: 4px; }
        .page-title { font-family: 'Bebas Neue', sans-serif; font-size: 48px; letter-spacing: 2px; line-height: 1; color: #ffffff; }
        .match-count { font-size: 13px; color: #4a5568; margin-top: 6px; font-weight: 300; }
        .gw-scroll { display: flex; gap: 8px; padding: 12px 24px; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; }
        .gw-scroll::-webkit-scrollbar { display: none; }
        .gw-pill { flex-shrink: 0; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; cursor: pointer; border: 1px solid #1a2030; background: #0e1318; color: #4a5568; transition: all 0.2s; font-family: 'DM Sans', sans-serif; }
        .gw-pill.active { background: #00c864; color: #080c10; border-color: #00c864; }
        .content { padding: 8px 24px 100px; }
        .match-card { background: #0e1318; border: 1px solid #1a2030; border-radius: 12px; padding: 16px; margin-bottom: 8px; display: block; text-decoration: none; color: inherit; transition: all 0.2s ease; position: relative; overflow: hidden; }
        .match-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: #00c864; opacity: 0; transition: opacity 0.2s ease; }
        .match-card:hover { border-color: rgba(0,200,100,0.3); transform: translateX(2px); background: #111820; }
        .match-card:hover::before { opacity: 1; }
        .match-card.played { border-left: 3px solid rgba(0,200,100,0.3); }
        .match-teams { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .team { flex: 1; font-size: 15px; font-weight: 500; color: #e8edf2; line-height: 1.2; }
        .team.away { text-align: right; }
        .vs-block { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .score { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #00c864; letter-spacing: 1px; min-width: 20px; text-align: center; }
        .score-divider { font-family: 'Bebas Neue', sans-serif; font-size: 18px; color: #2a3545; }
        .vs-text { font-size: 12px; font-weight: 600; color: #2a3545; padding: 0 8px; }
        .match-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #1a2030; }
        .match-time { font-size: 12px; color: #4a5568; }
        .match-venue { font-size: 11px; color: #2a3545; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
        .ft-badge { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #00c864; background: rgba(0,200,100,0.1); padding: 2px 7px; border-radius: 4px; }
        .arrow { color: #2a3545; font-size: 14px; }
        .nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: rgba(8,12,16,0.95); backdrop-filter: blur(20px); border-top: 1px solid #1a2030; display: flex; padding: 12px 0 24px; z-index: 50; }
        .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; opacity: 0.4; transition: opacity 0.2s; text-decoration: none; color: inherit; }
        .nav-item.active { opacity: 1; }
        .nav-icon { font-size: 20px; }
        .nav-label { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #00c864; }
        .nav-item:not(.active) .nav-label { color: #4a5568; }
      `}</style>

      <div className="app">
        <div className="header">
          <div className="logo">False Nine</div>
          <div className="page-title">Fixtures</div>
          <div className="match-count">Gameweek {selectedGW}</div>
        </div>

        <div className="gw-scroll">
          {upcomingGWs.map(gw => (
            <button
              key={gw}
              className={`gw-pill ${selectedGW === gw ? 'active' : ''}`}
              onClick={() => setSelectedGW(gw)}
            >
              GW{gw}
            </button>
          ))}
        </div>

        <div className="content">
          {gwMatches.map(match => (
            <MatchCard key={match.fixture_id} match={match} />
          ))}
        </div>

        <nav className="nav">
          <a href="/" className="nav-item active">
            <span className="nav-icon">⚽</span>
            <span className="nav-label">Fixtures</span>
          </a>
          <a href="/lms" className="nav-item">
            <span className="nav-icon">🏆</span>
            <span className="nav-label">LMS</span>
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