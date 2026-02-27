'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const supabase = createBrowserClient(
  'https://wuripncsrdpezpoxhvcb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cmlwbmNzcmRwZXpwb3hodmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzIyNjMsImV4cCI6MjA4NzYwODI2M30.nvymXC2Z9wpCZJ6vDJ1S1nR404s62uJgu-uure2NTj0'
)

export default function LMSLobby() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [myGames, setMyGames] = useState<any[]>([])
  const [myPicks, setMyPicks] = useState<any[]>([])
  const [publicGames, setPublicGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: entries } = await supabase
        .from('lms_entries')
        .select('game_id, status, lms_games(*)')
        .eq('user_id', user.id)

      if (entries) setMyGames(entries.map((e: any) => ({ ...e.lms_games, my_status: e.status })))

      const myGameIds = entries?.map((e: any) => e.game_id) ?? []

      const { data: pubGames } = await supabase
        .from('lms_games')
        .select('*')
        .eq('is_public', true)
        .eq('status', 'waiting')
        .not('id', 'in', myGameIds.length > 0 ? `(${myGameIds.join(',')})` : '(null)')

      if (pubGames) setPublicGames(pubGames)

      const { data: allMyPicks } = await supabase
        .from('lms_picks')
        .select('*')
        .eq('user_id', user.id)

      setMyPicks(allMyPicks ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div style={{ background: '#080c10', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#4a5568', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' }}>Loading...</div>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        .app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #080c10; }
        .header { padding: 56px 24px 20px; position: relative; }
        .header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 200px; background: radial-gradient(ellipse at 50% -20%, rgba(0,200,100,0.15) 0%, transparent 70%); pointer-events: none; }
        .logo { font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 4px; color: #00c864; text-transform: uppercase; margin-bottom: 4px; }
        .page-title { font-family: 'Bebas Neue', sans-serif; font-size: 48px; letter-spacing: 2px; line-height: 1; color: #ffffff; }
        .subtitle { font-size: 13px; color: #4a5568; margin-top: 6px; font-weight: 300; }
        .content { padding: 24px 24px 100px; display: flex; flex-direction: column; gap: 20px; }
        .section-label { font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #00c864; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(0,200,100,0.15); }
        .game-card { background: #0e1318; border: 1px solid #1a2030; border-radius: 12px; padding: 16px; cursor: pointer; transition: all 0.2s; text-decoration: none; color: inherit; display: block; }
        .game-card:hover { border-color: rgba(0,200,100,0.3); background: #111820; }
        .game-name { font-size: 16px; font-weight: 600; color: #e8edf2; margin-bottom: 6px; }
        .game-meta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .game-stat { font-size: 12px; color: #4a5568; }
        .status-pill { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
        .status-alive { background: rgba(0,200,100,0.1); color: #00c864; }
        .status-eliminated { background: rgba(255,80,80,0.1); color: #ff5050; }
        .status-waiting { background: rgba(255,200,0,0.1); color: #ffc800; }
        .action-btns { display: flex; gap: 10px; }
        .btn { flex: 1; padding: 14px; border: none; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif; letter-spacing: 1px; text-transform: uppercase; }
        .btn-primary { background: #00c864; color: #080c10; }
        .btn-secondary { background: #0e1318; color: #e8edf2; border: 1px solid #1a2030; }
        .empty { font-size: 13px; color: #4a5568; text-align: center; padding: 24px; }
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
          <div className="page-title">Last Man Standing</div>
          <div className="subtitle">Pick a team. Survive. Win.</div>
        </div>

        <div className="content">
          <div className="action-btns">
            <button className="btn btn-primary" onClick={() => router.push('/lms/create')}>+ Create</button>
            <button className="btn btn-secondary" onClick={() => router.push('/lms/join')}>Join with Code</button>
          </div>

          <div>
            <div className="section-label">My Games</div>
            {myGames.length === 0 ? (
              <div className="empty">You're not in any games yet</div>
            ) : (
              myGames.map(game => {
                const gamePicks = myPicks.filter(p => p.game_id === game.id)
                const latestPick = gamePicks.sort((a, b) => b.gameweek - a.gameweek)[0]

                return (
                  <a key={game.id} href={`/lms/${game.id}`} className="game-card" style={{ marginBottom: '8px' }}>
                    <div className="game-name">{game.name}</div>
                    <div className="game-meta">
                      <span className={`status-pill ${game.my_status === 'alive' ? 'status-alive' : game.my_status === 'eliminated' ? 'status-eliminated' : 'status-waiting'}`}>
                        {game.my_status === 'alive' ? '✓ Alive' : game.my_status === 'eliminated' ? '✗ Out' : 'Waiting'}
                      </span>
                      {latestPick && (
                        <span className="game-stat">GW{latestPick.gameweek}: {latestPick.team_name}</span>
                      )}
                      {!latestPick && game.my_status === 'alive' && (
                        <span style={{ fontSize: '11px', color: '#ffc800' }}>⚠ No pick yet</span>
                      )}
                      {game.entry_fee > 0 && <span className="game-stat">£{game.entry_fee} entry</span>}
                      {game.pot > 0 && <span className="game-stat">Pot: £{game.pot}</span>}
                    </div>
                  </a>
                )
              })
            )}
          </div>

          {publicGames.length > 0 && (
            <div>
              <div className="section-label">Public Games</div>
              {publicGames.map(game => (
                <a key={game.id} href={`/lms/${game.id}`} className="game-card" style={{ marginBottom: '8px' }}>
                  <div className="game-name">{game.name}</div>
                  <div className="game-meta">
                    <span className="status-pill status-waiting">Open</span>
                    {game.entry_fee > 0 && <span className="game-stat">£{game.entry_fee} entry</span>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <nav className="nav">
          <a href="/" className="nav-item">
            <span className="nav-icon">⚽</span>
            <span className="nav-label">Fixtures</span>
          </a>
          <a href="/lms" className="nav-item active">
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