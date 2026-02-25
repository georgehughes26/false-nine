'use client'

import { useState } from 'react'

export default function SquadView({ match, homePlayers, awayPlayers }: { match: any, homePlayers: any[], awayPlayers: any[] }) {
  const [activeTab, setActiveTab] = useState<'home' | 'away'>('home')
  const [per90, setPer90] = useState(false)

  const players = activeTab === 'home' ? homePlayers : awayPlayers
  const teamName = activeTab === 'home' ? match.h_title : match.a_title

  const calc = (stat: number | null, minutes: number | null) => {
    if (!per90) return stat ?? 0
    if (!minutes || minutes === 0) return 0
    return (((stat ?? 0) / minutes) * 90)
  }

  const fmt = (val: number) => {
    if (Number.isInteger(val) && !per90) return val.toString()
    return val.toFixed(2)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        .squad-section { padding: 0 24px; margin-top: 24px; padding-bottom: 40px; }

        .team-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .team-tab {
          flex: 1;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid #1a2030;
          background: #0e1318;
          color: #4a5568;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .team-tab.active {
          background: rgba(0, 200, 100, 0.1);
          border-color: rgba(0, 200, 100, 0.4);
          color: #00c864;
        }

        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .toggle-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #4a5568;
        }

        .toggle {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toggle-text {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #4a5568;
        }

        .toggle-text.on { color: #00c864; }

        .toggle-switch {
          width: 40px;
          height: 22px;
          border-radius: 11px;
          border: none;
          cursor: pointer;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }

        .toggle-switch::after {
          content: '';
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          top: 3px;
          transition: left 0.2s;
        }

        .player-card {
          background: #0e1318;
          border: 1px solid #1a2030;
          border-radius: 10px;
          padding: 10px 14px;
          margin-bottom: 6px;
        }

        .player-top {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }

        .player-name {
          font-size: 13px;
          font-weight: 600;
          color: #e8edf2;
        }

        .dot {
          color: #2a3545;
          font-size: 10px;
        }

        .player-position {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #4a5568;
        }

        .player-games {
          font-size: 10px;
          color: #4a5568;
          margin-left: auto;
          white-space: nowrap;
        }

        .stats-row {
          display: flex;
          gap: 0;
          border-top: 1px solid #1a2030;
          padding-top: 8px;
        }

        .stat {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 0 2px;
        }

        .stat + .stat {
          border-left: 1px solid #1a2030;
        }

        .stat-value {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 16px;
          color: #e8edf2;
          letter-spacing: 0.5px;
          line-height: 1;
        }

        .stat-value.highlight { color: #00c864; }
        .stat-value.yellow { color: #ffc800; }
        .stat-value.red { color: #ff5050; }

        .stat-label {
          font-size: 8px;
          color: #4a5568;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-top: 2px;
        }
      `}</style>

      <div className="squad-section">
        <div className="team-tabs">
          <button className={`team-tab ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
            {match.h_title}
          </button>
          <button className={`team-tab ${activeTab === 'away' ? 'active' : ''}`} onClick={() => setActiveTab('away')}>
            {match.a_title}
          </button>
        </div>

        <div className="toggle-row">
          <span className="toggle-label">{teamName}</span>
          <div className="toggle">
            <span className={`toggle-text ${per90 ? 'on' : ''}`}>Per 90</span>
            <button
              className="toggle-switch"
              onClick={() => setPer90(!per90)}
              style={{ background: per90 ? '#00c864' : '#1a2030' }}
            >
              <style>{`.toggle-switch::after { left: ${per90 ? '21px' : '3px'}; }`}</style>
            </button>
          </div>
        </div>

        {players.map((p: any) => (
          <div key={p.player_id} className="player-card">
            <div className="player-top">
              <span className="player-name">{p.player_name}</span>
              <span className="dot">·</span>
              <span className="player-position">{p.position}</span>
              <span className="player-games">{p.games ?? 0}G · {p.time ?? 0}mins</span>
            </div>
            <div className="stats-row">
              <div className="stat">
                <div className={`stat-value ${!per90 && p.goals > 0 ? 'highlight' : ''}`}>{fmt(calc(p.goals, p.time))}</div>
                <div className="stat-label">Goals</div>
              </div>
              <div className="stat">
                <div className="stat-value">{fmt(calc(p.xG, p.time))}</div>
                <div className="stat-label">xG</div>
              </div>
              <div className="stat">
                <div className={`stat-value ${!per90 && p.assists > 0 ? 'highlight' : ''}`}>{fmt(calc(p.assists, p.time))}</div>
                <div className="stat-label">Ast</div>
              </div>
              <div className="stat">
                <div className="stat-value">{fmt(calc(p.xA, p.time))}</div>
                <div className="stat-label">xA</div>
              </div>
              <div className="stat">
                <div className="stat-value">{fmt(calc(p.shots, p.time))}</div>
                <div className="stat-label">Shots</div>
              </div>
              <div className="stat">
                <div className="stat-value yellow">{fmt(calc(p.yellow_cards, p.time))}</div>
                <div className="stat-label">YC</div>
              </div>
              <div className="stat">
                <div className="stat-value red">{fmt(calc(Number(p.red_cards), p.time))}</div>
                <div className="stat-label">RC</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
