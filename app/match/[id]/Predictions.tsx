'use client'

import ProLock from '@/components/ProLock'

interface PlayerPrediction {
  rank: number
  player_id: number
  player_name: string
  team_name: string
  category: string
  stat_value: number
  per90_value: number
}

interface SeasonStats {
  games: number
  scored: number
  conceded: number
  bttsCount: number
  cleanSheets: number
  wins: number
  draws: number
  losses: number
  scoredPerGame: number
  concededPerGame: number
  bttsRate: number
  cleanSheetRate: number
}

function poisson(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
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

function calcOverUnder(avgHome: number, avgAway: number, threshold: number) {
  const combined = avgHome + avgAway
  let under = 0
  for (let g = 0; g <= Math.floor(threshold); g++) {
    under += poisson(combined, g)
  }
  return Math.round((1 - under) * 100)
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
  { color: '#FFD700', bg: 'rgba(255,215,0,0.10)', border: 'rgba(255,215,0,0.25)', emoji: '🥇' },
  { color: '#C0C0C0', bg: 'rgba(192,192,192,0.10)', border: 'rgba(192,192,192,0.25)', emoji: '🥈' },
  { color: '#CD7F32', bg: 'rgba(205,127,50,0.10)', border: 'rgba(205,127,50,0.25)', emoji: '🥉' },
]

function PlayerCard({ prediction, statLabel, rank }: {
  prediction: PlayerPrediction | null
  statLabel: string
  rank: number
}) {
  const medal = medals[rank]
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
          background: medal.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', flexShrink: 0,
        }}>
          {medal.emoji}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e8edf2' }}>
            {prediction?.player_name ?? '—'}
          </div>
          <div style={{ fontSize: '10px', color: '#4a5568', marginTop: '2px' }}>
            {prediction?.team_name ?? '—'}
          </div>
          {prediction && (
            <div style={{ fontSize: '10px', color: '#2a3545', marginTop: '1px' }}>
              {prediction.stat_value} total this season
            </div>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: '22px',
          letterSpacing: '1px',
          lineHeight: 1,
          color: medal.color,
        }}>
          {prediction?.per90_value ?? '—'}
        </div>
        <div style={{
          fontSize: '9px', fontWeight: 600, letterSpacing: '1px',
          textTransform: 'uppercase' as const, color: '#4a5568', marginTop: '2px',
        }}>
          Predicted {statLabel}
        </div>
      </div>
    </div>
  )
}

export default function Predictions({ playerPredictions, homeSeasonStats, awaySeasonStats, isPro }: {
  playerPredictions: PlayerPrediction[]
  homeSeasonStats: SeasonStats | null
  awaySeasonStats: SeasonStats | null
  isPro: boolean
}) {
  const homeAvg = homeSeasonStats?.scoredPerGame ?? 1.2
  const awayAvg = awaySeasonStats?.scoredPerGame ?? 1.0

  const { homeWin, draw, awayWin } = calcProbabilities(homeAvg, awayAvg)

  const btts = homeSeasonStats && awaySeasonStats
    ? Math.min(99, Math.round(
        (homeSeasonStats.bttsRate * awaySeasonStats.bttsRate * 100 +
        (1 - homeSeasonStats.cleanSheetRate) * (1 - awaySeasonStats.cleanSheetRate) * 100) / 2
      ))
    : 50

  const over05 = calcOverUnder(homeAvg, awayAvg, 0.5)
  const over15 = calcOverUnder(homeAvg, awayAvg, 1.5)
  const over25 = calcOverUnder(homeAvg, awayAvg, 2.5)
  const over35 = calcOverUnder(homeAvg, awayAvg, 3.5)

  const getCategory = (cat: string) => {
    const filtered = playerPredictions.filter(p => p.category === cat).sort((a, b) => a.rank - b.rank)
    while (filtered.length < 3) filtered.push(null as any)
    return filtered.slice(0, 3)
  }

  const topShotsOn     = getCategory('shots_on_target')
  const topShots       = getCategory('shots')
  const topYellows     = getCategory('bookings')
  const topFoulsCommit = getCategory('fouls_committed')
  const topFoulsWon    = getCategory('fouls_won')

  const hasPlayerData = playerPredictions.length > 0

  const playerCards = (list: (PlayerPrediction | null)[], statLabel: string) =>
    [0, 1, 2].map(i => (
      <PlayerCard key={i} prediction={list[i]} statLabel={statLabel} rank={i} />
    ))

  const goalsSection = (
    <>
      <div className="pred-subtitle">Goals</div>
      <div className="pred-grid-4">
        <div className="pred-card-sm" style={{ background: predBg(over05) }}>
          <div className="pred-pct-sm" style={{ color: predColor(over05) }}>{over05}%</div>
          <div className="pred-label-sm">Over 0.5</div>
        </div>
        <div className="pred-card-sm" style={{ background: predBg(over15) }}>
          <div className="pred-pct-sm" style={{ color: predColor(over15) }}>{over15}%</div>
          <div className="pred-label-sm">Over 1.5</div>
        </div>
        <div className="pred-card-sm" style={{ background: predBg(over25) }}>
          <div className="pred-pct-sm" style={{ color: predColor(over25) }}>{over25}%</div>
          <div className="pred-label-sm">Over 2.5</div>
        </div>
        <div className="pred-card-sm" style={{ background: predBg(over35) }}>
          <div className="pred-pct-sm" style={{ color: predColor(over35) }}>{over35}%</div>
          <div className="pred-label-sm">Over 3.5</div>
        </div>
      </div>
      <div className="pred-grid-2">
        <div className="pred-card" style={{ background: predBg(btts) }}>
          <div className="pred-pct" style={{ color: predColor(btts) }}>{btts}%</div>
          <div className="pred-label">BTTS Yes</div>
        </div>
        <div className="pred-card" style={{ background: predBg(100 - btts) }}>
          <div className="pred-pct" style={{ color: predColor(100 - btts) }}>{100 - btts}%</div>
          <div className="pred-label">BTTS No</div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <style>{`
        .pred-section { padding: 0 24px; margin-top: 4px; padding-bottom: 20px; }
        .pred-title { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 2px; color: #ffffff; margin-bottom: 12px; }
        .pred-subtitle { font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #4a5568; margin: 12px 0 8px; }
        .pred-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 6px; }
        .pred-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 6px; }
        .pred-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 12px; }
        .pred-card { border-radius: 10px; padding: 10px 12px; border: 1px solid #1a2030; text-align: center; }
        .pred-card-sm { border-radius: 10px; padding: 8px 4px; border: 1px solid #1a2030; text-align: center; }
        .pred-pct { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 1px; line-height: 1; }
        .pred-pct-sm { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 0.5px; line-height: 1; }
        .pred-label { font-size: 9px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #4a5568; margin-top: 3px; }
        .pred-label-sm { font-size: 7px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #4a5568; margin-top: 2px; }
        .divider { height: 1px; background: #1a2030; margin: 20px 0; }
        .no-data-note { font-size: 11px; color: #2a3545; text-align: center; padding: 8px 0 16px; font-style: italic; }
      `}</style>

      <div className="pred-section">
        <div className="pred-title">Predictions</div>

        <div className="pred-subtitle">Result</div>
        <div className="pred-grid-3">
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

        {isPro ? goalsSection : <ProLock>{goalsSection}</ProLock>}

        <div className="divider" />

        <div className="pred-title">Player Picks</div>
        {!hasPlayerData && <div className="no-data-note">Player stats coming soon</div>}

        <div className="pred-subtitle">Most Shots on Target</div>
        {playerCards(topShotsOn, 'Shots on target').slice(0, 1)}
        {isPro
          ? playerCards(topShotsOn, 'Shots on target').slice(1)
          : <ProLock>{playerCards(topShotsOn, 'Shots on target').slice(1)}</ProLock>
        }

        <div className="pred-subtitle">Most Shots</div>
        {playerCards(topShots, 'Shots').slice(0, 1)}
        {isPro
          ? playerCards(topShots, 'Shots').slice(1)
          : <ProLock>{playerCards(topShots, 'Shots').slice(1)}</ProLock>
        }

        <div className="pred-subtitle">Most Likely to be Booked</div>
        {playerCards(topYellows, 'Yellow cards').slice(0, 1)}
        {isPro
          ? playerCards(topYellows, 'Yellow cards').slice(1)
          : <ProLock>{playerCards(topYellows, 'Yellow cards').slice(1)}</ProLock>
        }

        <div className="pred-subtitle">Most Fouls Committed</div>
        {playerCards(topFoulsCommit, 'Fouls committed').slice(0, 1)}
        {isPro
          ? playerCards(topFoulsCommit, 'Fouls committed').slice(1)
          : <ProLock>{playerCards(topFoulsCommit, 'Fouls committed').slice(1)}</ProLock>
        }

        <div className="pred-subtitle">Most Fouls Won</div>
        {playerCards(topFoulsWon, 'Fouls won').slice(0, 1)}
        {isPro
          ? playerCards(topFoulsWon, 'Fouls won').slice(1)
          : <ProLock>{playerCards(topFoulsWon, 'Fouls won').slice(1)}</ProLock>
        }
      </div>
    </>
  )
}