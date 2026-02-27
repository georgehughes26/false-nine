import { supabase } from '@/lib/supabase'

function parseGW(round: string | null): number {
  if (!round) return 0
  const m = round.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

export default async function Home() {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .not('goals_h', 'is', null)
    .not('goals_a', 'is', null)
    .order('datetime', { ascending: false })

  if (error) {
    console.error(error)
    return <div>Error loading results</div>
  }

  if (!matches) {
    return <div>No results found</div>
  }

  const grouped: Record<string, any[]> = matches.reduce((acc: Record<string, any[]>, match: any) => {
    const gw = match.round ?? 'Unknown'
    if (!acc[gw]) acc[gw] = []
    acc[gw].push(match)
    return acc
  }, {})

  const sortedGroups = Object.entries(grouped).sort(
    ([a], [b]) => parseGW(b) - parseGW(a)
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background-color: #080c10;
          color: #e8edf2;
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
        }

        .app {
          max-width: 480px;
          margin: 0 auto;
          min-height: 100vh;
          position: relative;
          background: #080c10;
        }

        .header {
          padding: 56px 24px 20px;
          position: relative;
        }

        .header::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 200px;
          background: radial-gradient(ellipse at 50% -20%, rgba(0, 200, 100, 0.15) 0%, transparent 70%);
          pointer-events: none;
        }

        .logo {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 11px;
          letter-spacing: 4px;
          color: #00c864;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .page-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 48px;
          letter-spacing: 2px;
          line-height: 1;
          color: #ffffff;
        }

        .match-count {
          font-size: 13px;
          color: #4a5568;
          margin-top: 6px;
          font-weight: 300;
        }

        .content {
          padding: 8px 24px 100px;
        }

        .date-group {
          margin-bottom: 28px;
        }

        .date-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #00c864;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(0, 200, 100, 0.15);
        }

        .match-card {
          background: #0e1318;
          border: 1px solid #1a2030;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .match-card::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: #00c864;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .match-card:hover {
          border-color: rgba(0, 200, 100, 0.3);
          transform: translateX(2px);
          background: #111820;
        }

        .match-card:hover::before {
          opacity: 1;
        }

        .match-teams {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .team {
          flex: 1;
          font-size: 15px;
          font-weight: 500;
          color: #e8edf2;
          line-height: 1.2;
        }

        .team.away {
          text-align: right;
        }

        .vs-block {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .score {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 24px;
          color: #ffffff;
          letter-spacing: 1px;
          min-width: 20px;
          text-align: center;
        }

        .score-divider {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          color: #2a3545;
        }

        .match-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #1a2030;
        }

        .forecast-pills {
          display: flex;
          gap: 6px;
        }

        .pill {
          font-size: 10px;
          font-weight: 600;
          padding: 3px 7px;
          border-radius: 4px;
          letter-spacing: 0.5px;
        }

        .pill-w {
          background: rgba(0, 200, 100, 0.1);
          color: #00c864;
        }

        .pill-d {
          background: rgba(255, 200, 0, 0.1);
          color: #ffc800;
        }

        .pill-l {
          background: rgba(255, 80, 80, 0.1);
          color: #ff5050;
        }

        .match-date-label {
          font-size: 10px;
          color: #4a5568;
          letter-spacing: 0.5px;
        }

        .arrow {
          color: #2a3545;
          font-size: 14px;
        }

        .nav {
          position: fixed;
          bottom: 0; left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 480px;
          background: rgba(8, 12, 16, 0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid #1a2030;
          display: flex;
          padding: 12px 0 24px;
        }

        .nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          opacity: 0.4;
          transition: opacity 0.2s;
        }

        .nav-item.active {
          opacity: 1;
        }

        .nav-icon {
          font-size: 20px;
        }

        .nav-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #00c864;
        }

        .nav-item:not(.active) .nav-label {
          color: #4a5568;
        }
      `}</style>

      <div className="app">
        <div className="header">
          <div className="logo">False Nine</div>
          <div className="page-title">Results</div>
          <div className="match-count">{matches.length} matches played</div>
        </div>

        <div className="content">
          {sortedGroups.map(([round, gwMatches]) => (
            <div key={round} className="date-group">
              <div className="date-label">Gameweek {parseGW(round)}</div>
              {gwMatches.map((match: any) => {
                const h = match.goals_h
                const a = match.goals_a
                let resultClass = 'pill-d'
                let resultLabel = 'D'
                if (h > a) { resultClass = 'pill-w'; resultLabel = 'H' }
                else if (a > h) { resultClass = 'pill-l'; resultLabel = 'A' }

                return (
                  <a key={match.fixture_id} href={`/match/${match.fixture_id}`} className="match-card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                    <div className="match-teams">
                      <div className="team">{match.home_team_name}</div>
                      <div className="vs-block">
                        <span className="score">{h}</span>
                        <span className="score-divider">-</span>
                        <span className="score">{a}</span>
                      </div>
                      <div className="team away">{match.away_team_name}</div>
                    </div>
                    <div className="match-meta">
                      <div className="forecast-pills">
                        <span className={`pill ${resultClass}`}>{resultLabel}</span>
                        <span className="match-date-label">
                          {new Date(match.datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <span className="arrow">›</span>
                    </div>
                  </a>
                )
              })}
            </div>
          ))}
        </div>

        <nav className="nav">
  <a href="/" className="nav-item active" style={{ textDecoration: 'none' }}>
    <span className="nav-icon">⚽</span>
    <span className="nav-label">Results</span>
  </a>
  <a href="/performance" className="nav-item" style={{ textDecoration: 'none' }}>
    <span className="nav-icon">📈</span>
    <span className="nav-label">Performance</span>
  </a>
  <a href="/account" className="nav-item" style={{ textDecoration: 'none' }}>
    <span className="nav-icon">👤</span>
    <span className="nav-label">Account</span>
  </a>
</nav>
      </div>
    </>
  )
}
