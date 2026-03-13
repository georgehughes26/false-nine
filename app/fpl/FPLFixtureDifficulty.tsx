'use client'

import { useState } from 'react'
import { CaptainPick } from './page'

interface Fixture {
  gw: number
  opponent: string
  opponentCode: string
  isHome: boolean
  difficulty: number
  csChance: number
  csRating: number
  datetime: string
}

interface Team {
  teamName: string
  teamCode: string
  rank: number
  fixtures: Fixture[]
}

interface Props {
  teams: Team[]
  upcomingGWs: number[]
  captainPicks: CaptainPick[]
  nextGW: number
}

const COLORS: Record<number, { bg: string, text: string, border: string }> = {
  1: { bg: 'rgba(0,200,100,0.15)', text: '#00c864', border: 'rgba(0,200,100,0.3)' },
  2: { bg: 'rgba(0,200,100,0.08)', text: '#00a050', border: 'rgba(0,200,100,0.15)' },
  3: { bg: 'rgba(255,200,0,0.1)', text: '#ffc800', border: 'rgba(255,200,0,0.25)' },
  4: { bg: 'rgba(255,120,0,0.1)', text: '#ff7800', border: 'rgba(255,120,0,0.25)' },
  5: { bg: 'rgba(255,80,80,0.15)', text: '#ff5050', border: 'rgba(255,80,80,0.3)' },
}

const MEDALS = [
  { color: '#FFD700', bg: 'rgba(255,215,0,0.08)', border: 'rgba(255,215,0,0.25)', emoji: '🥇' },
  { color: '#C0C0C0', bg: 'rgba(192,192,192,0.08)', border: 'rgba(192,192,192,0.25)', emoji: '🥈' },
  { color: '#CD7F32', bg: 'rgba(205,127,50,0.08)', border: 'rgba(205,127,50,0.25)', emoji: '🥉' },
]

const POSITION_SHORT: Record<string, string> = {
  'Goalkeeper': 'GK',
  'Defender': 'DEF',
  'Midfielder': 'MID',
  'Attacker': 'FWD',
}

function positionStats(pick: CaptainPick) {
  const pos = pick.position
  
  let stats: { label: string, value: string | number }[] = []
  
  if (pos === 'Goalkeeper') {
    stats = [
      { label: 'xSaves', value: pick.savesPerGame },
      { label: 'CS%', value: `${pick.csChance}%` },
      { label: '', value: '' },
      { label: '', value: '' },
      { label: '', value: '' },
      { label: '', value: '' },
    ]
  } else if (pos === 'Defender') {
    stats = [
      { label: 'xGoals', value: pick.xG },
      { label: 'xAssists', value: pick.xA },
      { label: 'CS%', value: `${pick.csChance}%` },
      { label: 'xKey Passes', value: pick.keyPassesPerGame },
      { label: 'Yellow Risk', value: pick.yellowRisk },
      { label: 'xMins', value: pick.avgMins },
    ]
  } else if (pos === 'Midfielder') {
    stats = [
      { label: 'xGoals', value: pick.xG },
      { label: 'xAssists', value: pick.xA },
      { label: 'xSOTs', value: pick.sotPerGame },
      { label: 'xKey Passes', value: pick.keyPassesPerGame },
      { label: 'Yellow Risk', value: pick.yellowRisk },
      { label: 'xMins', value: pick.avgMins },
    ]
  } else {
    stats = [
      { label: 'xGoals', value: pick.xG },
      { label: 'xAssists', value: pick.xA },
      { label: 'xSOTs', value: pick.sotPerGame },
      { label: 'xKey Passes', value: pick.keyPassesPerGame },
      { label: 'Yellow Risk', value: pick.yellowRisk },
      { label: 'xMins', value: pick.avgMins },
    ]
  }

  // Pad to always 6 items — real stats first, empty placeholders at the end
  while (stats.length < 6) {
    stats.push({ label: '', value: '' })
  }

  return stats
}

function FixtureBadge({ opponentCode, isHome, difficulty }: {
  opponentCode: string
  isHome: boolean
  difficulty: number
}) {
  const c = COLORS[difficulty] ?? COLORS[3]
  return (
    <div style={{
      padding: '2px 7px', borderRadius: '4px',
      background: c.bg, border: `1px solid ${c.border}`,
      display: 'inline-flex', alignItems: 'center', gap: '3px',
    }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: c.text }}>{opponentCode}</span>
      <span style={{ fontSize: '9px', color: c.text, opacity: 0.7 }}>{isHome ? 'H' : 'A'}</span>
    </div>
  )
}

function CaptainCard({ pick, index }: { pick: CaptainPick, index: number }) {
  const isMedal = index < 3
  const medal = isMedal ? MEDALS[index] : null
  const xpColor = isMedal ? medal!.color : '#e8edf2'
  const stats = positionStats(pick)

  return (
    <div style={{
      background: isMedal ? medal!.bg : '#0e1318',
      border: `1px solid ${isMedal ? medal!.border : '#1a2030'}`,
      borderRadius: '10px',
      padding: '10px 12px',
      marginBottom: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}>
      {/* Left — rank */}
      <div style={{
        width: '22px', flexShrink: 0, textAlign: 'center',
        fontSize: isMedal ? '16px' : '11px',
        fontWeight: 700,
        color: isMedal ? medal!.color : '#8896a8',
      }}>
        {isMedal ? medal!.emoji : pick.rank}
      </div>

      {/* Middle — player info + stats */}
{/* Middle — player info + stats */}
{/* Middle — player info + stats */}
<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px', marginLeft: '3%' }}>
    <span style={{
      fontSize: '13px', fontWeight: 600, color: '#e8edf2',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px',
    }}>
      {pick.playerName}
    </span>
    <span style={{
      fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px',
      background: '#1a2030', color: '#8896a8', flexShrink: 0,
    }}>
      {POSITION_SHORT[pick.position] ?? pick.position}
    </span>
    <span style={{ fontSize: '10px', color: '#8896a8', flexShrink: 0 }}>
      {pick.teamCode}
    </span>
    <FixtureBadge
      opponentCode={pick.opponentCode}
      isHome={pick.isHome}
      difficulty={pick.difficulty}
    />
  </div>

{/* Stats row */}
<div style={{ display: 'flex', gap: '0px', marginTop: '6px' }}>
  {stats.map(s => (
    <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
      <div style={{
        fontSize: '8px', color: '#8896a8', textTransform: 'uppercase',
        letterSpacing: '0.3px', lineHeight: 1, marginBottom: '2px',
      }}>
        {s.label}
      </div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#a0aec0', lineHeight: 1 }}>
        {s.value}
      </div>
    </div>
  ))}
</div>
      </div>

      {/* Right — xP */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '26px', letterSpacing: '1px', lineHeight: 1, color: xpColor,
        }}>
          {pick.xP}
        </div>
        <div style={{ fontSize: '8px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#8896a8' }}>
          xPts
        </div>
      </div>
    </div>
  )
}

function DifficultyCell({ fixture, mode }: { fixture: Fixture | undefined, mode: 'fdr' | 'cs' }) {
  if (!fixture) {
    return (
      <div style={{
        width: '100%', height: '44px', background: '#0a0f14',
        borderRadius: '6px', border: '1px solid #1a2030',
      }} />
    )
  }

  const rating = mode === 'cs' ? fixture.csRating : fixture.difficulty
  const c = COLORS[rating] ?? COLORS[3]

  return (
    <div style={{
      width: '100%', height: '44px', background: c.bg,
      border: `1px solid ${c.border}`, borderRadius: '6px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '1px',
    }}>
      {mode === 'fdr' ? (
        <>
          <span style={{ fontSize: '11px', fontWeight: 700, color: c.text, letterSpacing: '0.5px' }}>
            {fixture.opponentCode}
          </span>
          <span style={{ fontSize: '9px', color: c.text, opacity: 0.7, fontWeight: 500 }}>
            {fixture.isHome ? 'H' : 'A'}
          </span>
        </>
      ) : (
        <>
          <span style={{ fontSize: '12px', fontWeight: 700, color: c.text, letterSpacing: '0.5px' }}>
            {fixture.csChance}%
          </span>
          <span style={{ fontSize: '9px', color: c.text, opacity: 0.7, fontWeight: 500 }}>
            {fixture.opponentCode} {fixture.isHome ? 'H' : 'A'}
          </span>
        </>
      )}
    </div>
  )
}

export default function FPLFixtureDifficulty({ teams, upcomingGWs, captainPicks, nextGW }: Props) {
  const [mode, setMode] = useState<'fdr' | 'cs' | 'captain'>('fdr')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        .app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #080c10; }
        .header { padding: 56px 24px 0px; position: relative; }
        .header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 200px; background: radial-gradient(ellipse at 50% -20%, rgba(0,200,100,0.15) 0%, transparent 70%); pointer-events: none; }
        .logo { font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 4px; color: #00c864; text-transform: uppercase; margin-bottom: 4px; }
        .page-title { font-family: 'Bebas Neue', sans-serif; font-size: 48px; letter-spacing: 2px; line-height: 1; color: #ffffff; }
        .subtitle { font-size: 13px; color: #8896a8; margin-top: 6px; font-weight: 300; }
        .toggle-bar { display: flex; gap: 6px; padding: 16px 24px 4px; }
        .toggle-btn { flex: 1; padding: 9px 6px; border-radius: 8px; border: 1px solid #1a2030; background: #0e1318; color: #8896a8; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
        .toggle-btn.active { background: #00c864; color: #080c10; border-color: #00c864; }
        .legend { display: flex; gap: 8px; padding: 10px 24px; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #8896a8; }
        .legend-dot { width: 8px; height: 8px; border-radius: 2px; }
        .table-wrap { padding: 0 16px 100px; overflow-x: auto; }
        .fdr-table { width: 100%; border-collapse: separate; border-spacing: 0 4px; min-width: 340px; }
        .th { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #8896a8; padding: 4px 4px 8px; text-align: center; }
        .th-team { text-align: left; padding-left: 0; }
        .team-cell { font-size: 13px; font-weight: 500; color: #e8edf2; padding: 4px 12px 4px 0; white-space: nowrap; min-width: 130px; }
        .gw-cell { padding: 2px; }
        .captain-wrap { padding: 0 16px 100px; }
        .captain-header { font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #00c864; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(0,200,100,0.15); }
        .nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: rgba(8,12,16,0.95); backdrop-filter: blur(20px); border-top: 1px solid #1a2030; display: flex; padding: 12px 0 24px; z-index: 50; }
        .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; opacity: 0.4; transition: opacity 0.2s; text-decoration: none; color: inherit; }
        .nav-item.active { opacity: 1; }
        .nav-icon { font-size: 20px; }
        .nav-label { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
        .nav-item.active .nav-label { color: #00c864; }
        .nav-item:not(.active) .nav-label { color: #8896a8; }
      `}</style>

      <div className="app">
        <div className="header">
          <div className="logo">False Nine</div>
          <div className="page-title">FPL Hub</div>
          <div className="subtitle">
            {mode === 'fdr' && 'Fixture Difficulty Rating — Next 5 GWs'}
            {mode === 'cs' && 'Clean Sheet Probability — Next 5 GWs'}
            {mode === 'captain' && `The Best Captain Picks — GW${nextGW}`}
          </div>
        </div>

        <div className="toggle-bar">
          <button className={`toggle-btn ${mode === 'fdr' ? 'active' : ''}`} onClick={() => setMode('fdr')}>
            Fixture Difficulty
          </button>
          <button className={`toggle-btn ${mode === 'cs' ? 'active' : ''}`} onClick={() => setMode('cs')}>
            Clean Sheet %
          </button>
          <button className={`toggle-btn ${mode === 'captain' ? 'active' : ''}`} onClick={() => setMode('captain')}>
            Captain Picks
          </button>
        </div>

        {mode !== 'captain' && (
          <div className="legend">
            {mode === 'fdr' ? (
              [
                { label: 'Very Easy', bg: 'rgba(0,200,100,0.4)' },
                { label: 'Easy', bg: 'rgba(0,200,100,0.2)' },
                { label: 'Medium', bg: 'rgba(255,200,0,0.4)' },
                { label: 'Hard', bg: 'rgba(255,120,0,0.4)' },
                { label: 'Very Hard', bg: 'rgba(255,80,80,0.4)' },
              ].map(({ label, bg }) => (
                <div key={label} className="legend-item">
                  <div className="legend-dot" style={{ background: bg }} />
                  {label}
                </div>
              ))
            ) : (
              [
                { label: 'High (40%+)', bg: 'rgba(0,200,100,0.4)' },
                { label: 'Medium (20–40%)', bg: 'rgba(255,200,0,0.4)' },
                { label: 'Low (<20%)', bg: 'rgba(255,80,80,0.4)' },
              ].map(({ label, bg }) => (
                <div key={label} className="legend-item">
                  <div className="legend-dot" style={{ background: bg }} />
                  {label}
                </div>
              ))
            )}
          </div>
        )}

{mode === 'captain' && (
  <div style={{ display: 'flex', gap: '12px', padding: '8px 24px 4px', flexWrap: 'wrap' }}>
    {[
      { label: 'x = Expected' },
      { label: 'CS = Clean Sheet' },
      { label: 'SOT = Shots on Target' },
      { label: 'PTS = Points' },
      
    ].map(({ label }) => (
      <div key={label} style={{ fontSize: '10px', color: '#8896a8', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '1px', background: '#1a2030', flexShrink: 0 }} />
        {label}
      </div>
    ))}
  </div>
)}

        {mode === 'captain' ? (
          <div className="captain-wrap">
            {captainPicks.map((pick, i) => (
              <CaptainCard key={pick.playerName} pick={pick} index={i} />
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="fdr-table">
              <thead>
                <tr>
                  <th className="th th-team">Team</th>
                  {upcomingGWs.map(gw => (
                    <th key={gw} className="th">GW{gw}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
              {(() => {
  const sorted = [...teams].sort((a, b) => {
    if (mode === 'fdr') {
      const avgDiffA = a.fixtures.reduce((sum, f) => sum + f.difficulty, 0) / (a.fixtures.length || 1)
      const avgDiffB = b.fixtures.reduce((sum, f) => sum + f.difficulty, 0) / (b.fixtures.length || 1)
      if (avgDiffA !== avgDiffB) return avgDiffA - avgDiffB
      // Tiebreak: higher CS% = better
      const avgCSA = a.fixtures.reduce((sum, f) => sum + f.csChance, 0) / (a.fixtures.length || 1)
      const avgCSB = b.fixtures.reduce((sum, f) => sum + f.csChance, 0) / (b.fixtures.length || 1)
      return avgCSB - avgCSA
    } else {
      // CS view — highest average CS% first
      const avgCSA = a.fixtures.reduce((sum, f) => sum + f.csChance, 0) / (a.fixtures.length || 1)
      const avgCSB = b.fixtures.reduce((sum, f) => sum + f.csChance, 0) / (b.fixtures.length || 1)
      if (avgCSA !== avgCSB) return avgCSB - avgCSA
      // Tiebreak: lower difficulty = better
      const avgDiffA = a.fixtures.reduce((sum, f) => sum + f.difficulty, 0) / (a.fixtures.length || 1)
      const avgDiffB = b.fixtures.reduce((sum, f) => sum + f.difficulty, 0) / (b.fixtures.length || 1)
      return avgDiffA - avgDiffB
    }
  })

  return sorted.map(team => (
    <tr key={team.teamName}>
      <td className="team-cell">{team.teamName}</td>
      {upcomingGWs.map(gw => {
        const fixture = team.fixtures.find(f => f.gw === gw)
        return (
          <td key={gw} className="gw-cell">
            <DifficultyCell fixture={fixture} mode={mode} />
          </td>
        )
      })}
    </tr>
  ))
})()}
              </tbody>
            </table>
          </div>
        )}

        <nav className="nav">
          <a href="/" className="nav-item">
            <span className="nav-icon">⚽</span>
            <span className="nav-label">Fixtures</span>
          </a>
          <a href="/lms" className="nav-item">
            <span className="nav-icon">🏆</span>
            <span className="nav-label">LMS</span>
          </a>
          <a href="/fpl" className="nav-item active">
            <span className="nav-icon">📊</span>
            <span className="nav-label">FPL</span>
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