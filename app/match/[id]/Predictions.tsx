'use client'

interface Player {
  player_id: number
  player_name: string
  team_title: string
  games: number
  time: number
  goals: number
  xG: number
  assists: number
  xA: number
  shots: number
  yellow_cards: number
  red_cards: string
  position: string
}

interface Match {
  h_title: string
  a_title: string
  xG_h: number | null
  xG_a: number | null
}

function poisson(lambda: number, k: number): number {
  let result = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) result *= lambda / i
  return result
}

function calcProbabilities(avgHome: number, avgAway: number) {
  const maxGoals = 8
  let homeWin = 0, draw = 0, awayWin = 0

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const prob = poisson(avgHome, h) * poisson(avgAway, a)
      if (h > a) homeWin += prob
      else if (h === a) draw += prob
      else awayWin += prob
    }
  }

  const total = homeWin + draw + awayWin
  return {
    homeWin: Math.round((homeWin / total) * 100),
    draw: Math.round((draw / total) * 100),
    awayWin: Math.round((awayWin / total) * 100),
  }
}

function calcBTTS(homePlayers: Player[], awayPlayers: Player[]) {
  const homeGames = Math.max(...homePlayers.map(p => p.games ?? 0).filter(g => g > 0), 1)
  const awayGames = Math.max(...awayPlayers.map(p => p.games ?? 0).filter(g => g > 0), 1)
  const homeGoalsPerGame = homePlayers.reduce((s, p) => s + (p.goals ?? 0), 0) / homeGames
  const awayGoalsPerGame = awayPlayers.reduce((s, p) => s + (p.goals ?? 0), 0) / awayGames
  const homeScoreProb = 1 - poisson(homeGoalsPerGame, 0)
  const awayScoreProb = 1 - poisson(awayGoalsPerGame, 0)
  return Math.round(homeScoreProb * awayScoreProb * 100)
}

function calcOverUnder(avgHome: number, avgAway: number, threshold: number) {
  const combined = avgHome + avgAway
  let under = 0
  for (let g = 0; g <= Math.floor(threshold); g++) {
    under += poisson(combined, g)
  }
  return Math.round((1 - under) * 100)
}

function weightedScore(stat: number, mins: number, maxMins: number) {
  if (!mins || mins === 0) return 0
  const per90 = (stat / mins) * 90
  const confidence = mins / maxMins
  return per90 * confidence
}

function predColor(pct: number) {
  if (pct >= 60) return '#00c864'
  if (pct >= 40) return '#ffc800'
  return '#ff5050'
}

function predBg(pct: number) {
  if (pct >= 60) return 'rgba(0,200,100,0.12)'
  if (pct >= 40) return 'rgba(255,200,0,0.12)'
  return 'rgba(255,80,80,0.12)'
}

const medals = [
  { color: '#FFD700', bg: 'rgba(255,215,0,0.10)', border: 'rgba(255,215,0,0.25)', label: '1st' },
  { color: '#C0C0C0', bg: 'rgba(192,192,192,0.10)', border: 'rgba(192,192,192,0.25)', label: '2nd' },
  { color: '#CD7F32', bg: 'rgba(205,127,50,0.10)', border: 'rgba(205,127,50,0.25)', label: '3rd' },
]

export default function Predictions({ match, homePlayers, awayPlayers }: { match: Match, homePlayers: Player[], awayPlayers: Player[] }) {
  const allPlayers = [...homePlayers, ...awayPlayers].filter(p => (p.games ?? 0) >= 3 && (p.time ?? 0) > 0)
  const maxMins = Math.max(...allPlayers.map(p => p.time ?? 0), 1)

  const homeGames = Math.max(...homePlayers.map(p => p.games ?? 0).filter(g => g > 0), 1)
  const awayGames = Math.max(...awayPlayers.map(p => p.games ?? 0).filter(g => g > 0), 1)

  const homeXG = match.xG_h ?? (homePlayers.reduce((s, p) => s + (p.xG ?? 0), 0) / homeGames)
  const awayXG = match.xG_a ?? (awayPlayers.reduce((s, p) => s + (p.xG ?? 0), 0) / awayGames)

  const { homeWin, draw, awayWin } = calcProbabilities(homeXG, awayXG)
  const btts = calcBTTS(homePlayers, awayPlayers)
  const over05 = calcOverUnder(homeXG, awayXG, 0.5)
  const over15 = calcOverUnder(homeXG, awayXG, 1.5)
  const over25 = calcOverUnder(homeXG, awayXG, 2.5)
  const over35 = calcOverUnder(homeXG, awayXG, 3.5)

  const topScorers = [...allPlayers]
    .sort((a, b) => weightedScore(b.xG ?? 0, b.time, maxMins) - weightedScore(a.xG ?? 0, a.time, maxMins))
    .slice(0, 3)

  const topShots = [...allPlayers]
    .sort((a, b) => weightedScore(b.shots ?? 0, b.time, maxMins) - weightedScore(a.shots ?? 0, a.time, maxMins))
    .slice(0, 3)

  const topYellows = [...allPlayers]
    .sort((a, b) => weightedScore(b.yellow_cards ?? 0, b.time, maxMins) - weightedScore(a.yellow_cards ?? 0, a.time, maxMins))
    .slice(0, 3)

  const PlayerCard = ({ player, statValue, statLabel, isPercent, rank }: {
    player: Player
    statValue: number
    statLabel: string
    isPercent: boolean
    rank: number
  }) => {
    const medal = medals[rank]
    const display = isPercent
      ? `${Math.min(Math.round(statValue * 100), 99)}%`
      : (statValue * 90 / 90).toFixed(1)

    return (
      <div style={{
        background: medal.bg,
        border: `1px solid ${medal.border}`,
        borderRadius: '10px',
        padding: '12px 14px',
        marginBottom: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '6px',
            background: `rgba(${medal.color === '#FFD700' ? '255,215,0' : medal.color === '#C0C0C0' ? '192,192,192' : '205,127,50'},0.15)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', flexShrink: 0,
          }}>
            {rank === 0 ? '🥇' : rank === 1 ? '🥈' : '🥉'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e8edf2' }}>{player.player_name}</div>
            <div style={{ fontSize: '10px', color: '#4a5568', marginTop: '2px' }}>{player.team_title}</div>
            <div style={{ fontSize: '10px', color: '#2a3545', marginTop: '1px' }}>{player.time} mins</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '22px',
            letterSpacing: '1px',
            lineHeight: 1,
            color: medal.color,
          }}>{display}</div>
          <div style={{
            fontSize: '9px', fontWeight: 600, letterSpacing: '1px',
            textTransform: 'uppercase', color: '#4a5568', marginTop: '2px',
          }}>{statLabel}</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .pred-section { padding: 0 24px; margin-top: 4px; padding-bottom: 40px; }
        .pred-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px;
          letter-spacing: 2px;
          color: #ffffff;
          margin-bottom: 12px;
        }
        .pred-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          margin-bottom: 6px;
        }
        .pred-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          margin-bottom: 12px;
        }
        .pred-card {
          border-radius: 10px;
          padding: 10px 12px;
          border: 1px solid #1a2030;
          text-align: center;
        }
        .pred-pct {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 26px;
          letter-spacing: 1px;
          line-height: 1;
        }
        .pred-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #4a5568;
          margin-top: 3px;
        }
        .pred-subtitle {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #4a5568;
          margin: 12px 0 8px;
        }
        .divider { height: 1px; background: #1a2030; margin: 20px 0; }
      `}</style>

      <div className="pred-section">
        <div className="pred-title">Predictions</div>

        <div className="pred-subtitle">Result</div>
        <div className="pred-grid">
          <div className="pred-card" style={{ background: predBg(homeWin) }}>
            <div className="pred-pct" style={{ color: predColor(homeWin) }}>{homeWin}%</div>
            <div className="pred-label">Home Win</div>
          </div>
          <div className="pred-card" style={{ background: predBg(draw) }}>
            <div className="pred-pct" style={{ color: predColor(draw) }}>{draw}%</div>
            <div className="pred-label">Draw</div>
          </div>
          <div className="pred-card" style={{ background: predBg(awayWin) }}>
            <div className="pred-pct" style={{ color: predColor(awayWin) }}>{awayWin}%</div>
            <div className="pred-label">Away Win</div>
          </div>
        </div>

        <div className="pred-subtitle">Goals</div>
        <div className="pred-grid">
          <div className="pred-card" style={{ background: predBg(over05) }}>
            <div className="pred-pct" style={{ color: predColor(over05) }}>{over05}%</div>
            <div className="pred-label">Over 0.5</div>
          </div>
          <div className="pred-card" style={{ background: predBg(over15) }}>
            <div className="pred-pct" style={{ color: predColor(over15) }}>{over15}%</div>
            <div className="pred-label">Over 1.5</div>
          </div>
          <div className="pred-card" style={{ background: predBg(over25) }}>
            <div className="pred-pct" style={{ color: predColor(over25) }}>{over25}%</div>
            <div className="pred-label">Over 2.5</div>
          </div>
        </div>
        <div className="pred-grid-2">
          <div className="pred-card" style={{ background: predBg(over35) }}>
            <div className="pred-pct" style={{ color: predColor(over35) }}>{over35}%</div>
            <div className="pred-label">Over 3.5</div>
          </div>
          <div className="pred-card" style={{ background: predBg(btts) }}>
            <div className="pred-pct" style={{ color: predColor(btts) }}>{btts}%</div>
            <div className="pred-label">BTTS Yes</div>
          </div>
        </div>

        <div className="divider" />

        <div className="pred-title">Player Picks</div>

        <div className="pred-subtitle">Most Likely to Score</div>
        {topScorers.map((p, i) => (
          <PlayerCard
            key={p.player_id}
            player={p}
            statValue={weightedScore(p.xG ?? 0, p.time, maxMins)}
            statLabel="To Score"
            isPercent={true}
            rank={i}
          />
        ))}

        <div className="pred-subtitle">Most Shots Expected</div>
        {topShots.map((p, i) => (
          <PlayerCard
            key={p.player_id}
            player={p}
            statValue={weightedScore(p.shots ?? 0, p.time, maxMins)}
            statLabel="Shots per 90"
            isPercent={false}
            rank={i}
          />
        ))}

        <div className="pred-subtitle">Yellow Card Risk</div>
        {topYellows.map((p, i) => (
          <PlayerCard
            key={p.player_id}
            player={p}
            statValue={weightedScore(p.yellow_cards ?? 0, p.time, maxMins)}
            statLabel="Yellow Card"
            isPercent={true}
            rank={i}
          />
        ))}
      </div>
    </>
  )
}
