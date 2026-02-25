import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .is('goals_h', null)
    .is('goals_a', null)
    .order('datetime', { ascending: true })

  if (error) {
    console.error(error)
    return <div>Error loading fixtures</div>
  }

  if (!matches) {
    return <div>No matches found</div>
  }

  const grouped: Record<string, any[]> = matches.reduce((acc: Record<string, any[]>, match: any) => {
    const date = new Date(match.datetime).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(match)
    return acc
  }, {})

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
          flex-direction: column;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        .vs {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          color: #2a3545;
          letter-spacing: 1px;
        }

        .match-time {
          font-size: 11px;
          font-weight: 600;
          color: #00c864;
          letter-spacing: 1px;
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
          <div className="page-title">Fixtures</div>
          <div className="match-count">{matches.length} upcoming matches</div>
        </div>

        <div className="content">
          {Object.entries(grouped).map(([date, dayMatches]) => (
            <div key={date} className="date-group">
              <div className="date-label">{date}</div>
              {dayMatches.map((match: any) => {
                const time = new Date(match.datetime).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
                const fW = match.forecast_w ? Math.round(match.forecast_w * 100) : null
                const fD = match.forecast_d ? Math.round(match.forecast_d * 100) : null
                const fL = match.forecast_l ? Math.round(match.forecast_l * 100) : null

                return (
                  <a key={match.match_id} href={`/match/${match.match_id}`} className="match-card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                    <div className="match-teams">
                      <div className="team">{match.h_title}</div>
                      <div className="vs-block">
                        <span className="match-time">{time}</span>
                        <span className="vs">VS</span>
                      </div>
                      <div className="team away">{match.a_title}</div>
                    </div>
                    {(fW || fD || fL) && (
                      <div className="match-meta">
                        <div className="forecast-pills">
                          {fW && <span className="pill pill-w">W {fW}%</span>}
                          {fD && <span className="pill pill-d">D {fD}%</span>}
                          {fL && <span className="pill pill-l">L {fL}%</span>}
                        </div>
                        <span className="arrow">›</span>
                      </div>
                    )}
                  </a>
                )
              })}
            </div>
          ))}
        </div>

        <nav className="nav">
          <div className="nav-item active">
            <span className="nav-icon">⚽</span>
            <span className="nav-label">Fixtures</span>
          </div>
          <div className="nav-item">
            <span className="nav-icon">📈</span>
            <span className="nav-label">Performance</span>
          </div>
          <div className="nav-item">
            <span className="nav-icon">👤</span>
            <span className="nav-label">Account</span>
          </div>
        </nav>
      </div>
    </>
  )
}
