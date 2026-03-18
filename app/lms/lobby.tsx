'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
  .app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #080c10; }
  .logo { font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 4px; color: #00c864; text-transform: uppercase; margin-bottom: 4px; }
  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #00c864; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(0,200,100,0.15); }
  .game-card { background: #0e1318; border: 1px solid #1a2030; border-radius: 12px; padding: 16px; cursor: pointer; transition: all 0.2s; text-decoration: none; color: inherit; display: block; margin-bottom: 8px; }
  .game-card:hover { border-color: rgba(0,200,100,0.3); background: #111820; }
  .game-card.complete { opacity: 0.6; }
  .game-name { font-size: 16px; font-weight: 600; color: #e8edf2; margin-bottom: 6px; }
  .game-meta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .game-stat { font-size: 12px; color: #8896a8; }
  .status-pill { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
  .status-alive { background: rgba(0,200,100,0.1); color: #00c864; }
  .status-eliminated { background: rgba(255,80,80,0.1); color: #ff5050; }
  .status-waiting { background: rgba(255,200,0,0.1); color: #ffc800; }
  .status-complete { background: rgba(74,85,104,0.2); color: #8896a8; }
  .status-active { background: rgba(0,200,100,0.1); color: #00c864; }
  .pick-warning { font-size: 11px; color: #ffc800; }
  .action-btns { display: flex; gap: 10px; }
  .btn { flex: 1; padding: 14px; border: none; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif; letter-spacing: 1px; text-transform: uppercase; transition: all 0.15s; }
  .btn-primary { background: #00c864; color: #080c10; }
  .btn-primary:hover { background: #00e070; transform: translateY(-1px); }
  .btn-secondary { background: #0e1318; color: #e8edf2; border: 1px solid #1a2030; }
  .empty { font-size: 13px; color: #8896a8; text-align: center; padding: 24px; }
  .nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: rgba(8,12,16,0.95); backdrop-filter: blur(20px); border-top: 1px solid #1a2030; display: flex; padding: 12px 0 24px; z-index: 50; }
  .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; opacity: 0.4; transition: opacity 0.2s; text-decoration: none; color: inherit; }
  .nav-item.active { opacity: 1; }
  .nav-icon { font-size: 20px; }
  .nav-label { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
  .nav-item.active .nav-label { color: #00c864; }
  .nav-item:not(.active) .nav-label { color: #8896a8; }
  @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
`

const lmsFeatures = [
  {
    icon: '🔗',
    title: 'Invite Your Group',
    desc: 'Share a link or code — anyone can join in seconds. Set it up in minutes and get your mates in.',
  },
  {
    icon: '⏱',
    title: 'Picks Lock 5 mins Before Kickoff',
    desc: 'No last-minute changes once the whistle blows. Everyone commits before the action starts.',
  },
  {
    icon: '❌',
    title: 'Auto-Elimination',
    desc: "Team lose? You're out automatically. No manual admin, no arguments — the app handles it.",
  },
  {
    icon: '💰',
    title: 'One-Off Payment',
    desc: "One payment to create your league - and that's it. Then play for free, or collect money off your players.",
  },
]

function LMSFeatureCard({ feature, index }: { feature: typeof lmsFeatures[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        background: '#0e1318',
        border: '1px solid #1a2030',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '12px',
        transition: `opacity 0.5s ease ${index * 0.08}s, transform 0.5s ease ${index * 0.08}s`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '120px', height: '120px',
        background: 'radial-gradient(ellipse at 100% 0%, rgba(0,200,100,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: 'rgba(0,200,100,0.08)', border: '1px solid rgba(0,200,100,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', flexShrink: 0,
        }}>
          {feature.icon}
        </div>
        <div style={{
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: '22px', letterSpacing: '1px', color: '#ffffff', lineHeight: 1,
        }}>
          {feature.title}
        </div>
      </div>
      <div style={{ fontSize: '14px', color: '#8896a8', lineHeight: 1.6, fontWeight: 300 }}>
        {feature.desc}
      </div>
    </div>
  )
}
/*

function Nav() {
  return (
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
  )
}
  */

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
      if (!user) {
        setLoading(false)
        return
      }
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
        .in('status', ['waiting', 'active'])
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
      <div style={{ color: '#8896a8', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' }}>Loading...</div>
    </div>
  )

  // ── Unauthenticated landing ──────────────────────────────────────────────
  if (!user) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="app">

          {/* Hero */}
          <div style={{ padding: '56px 24px 32px', position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: '300px', height: '300px',
              background: 'radial-gradient(ellipse, rgba(0,200,100,0.12) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative' }}>
              <div className="logo">False Nine</div>
              <div style={{
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: '64px', letterSpacing: '2px', lineHeight: 0.95, color: '#ffffff',
                marginBottom: '16px',
              }}>
                LMS
              </div>
              <div style={{ fontSize: '14px', color: '#8896a8', fontWeight: 300, lineHeight: 1.6, marginBottom: '24px' }}>
                Set up or join a Last Man Standing game. One pick a week. Use each team once. Last one standing wins.
              </div>
              <div className="action-btns">
                <button className="btn btn-primary" onClick={() => router.push('/login?redirect=/lms/create')}>
                  Create a Game
                </button>
                <button className="btn btn-secondary" onClick={() => router.push('/login?redirect=/lms/join')}>
                  Join with Code
                </button>
              </div>
            </div>
          </div>

          {/* Scroll hint */}
          <div style={{ textAlign: 'center', padding: '32px 0 40px' }}>
            <div style={{ fontSize: '11px', color: '#4a5568', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
              How it works
            </div>
            <div style={{ color: '#4a5568', fontSize: '18px', animation: 'bounce 2s ease-in-out infinite' }}>↓</div>
          </div>

          {/* Feature cards */}
          <div style={{ padding: '0 24px 40px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: '36px', letterSpacing: '2px', color: '#ffffff', lineHeight: 1,
              }}>
                Everything you need
              </div>
            </div>
            {lmsFeatures.map((f, i) => (
              <LMSFeatureCard key={f.title} feature={f} index={i} />
            ))}
          </div>

          {/* Bottom CTA */}
          <div style={{ padding: '0 24px 100px' }}>
            <div style={{
              padding: '28px 24px',
              background: 'linear-gradient(135deg, rgba(0,200,100,0.08) 0%, rgba(0,200,100,0.03) 100%)',
              border: '1px solid rgba(0,200,100,0.15)',
              borderRadius: '20px',
            }}>
              <div style={{
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: '28px', letterSpacing: '2px', color: '#ffffff', marginBottom: '8px',
              }}>
                Ready to play?
              </div>
              <div style={{ fontSize: '13px', color: '#8896a8', fontWeight: 300, lineHeight: 1.6 }}>
                Sign up in seconds. Invite your group. Automated eliminations and progressions until one player remains.
              </div>
            </div>
          </div>

          <Nav />
        </div>
      </>
    )
  }

  // ── Authenticated lobby ──────────────────────────────────────────────────
  const activeMyGames = myGames.filter(g => g.status !== 'complete')
  const completedMyGames = myGames.filter(g => g.status === 'complete')

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div style={{ padding: '56px 24px 20px', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '200px',
            background: 'radial-gradient(ellipse at 50% -20%, rgba(0,200,100,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div className="logo">False Nine</div>
          <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '48px', letterSpacing: '2px', lineHeight: 1, color: '#ffffff' }}>
            Last Man Standing
          </div>
          <div style={{ fontSize: '13px', color: '#8896a8', marginTop: '6px', fontWeight: 300 }}>
            Pick a team. Survive. Win.
          </div>
        </div>

        <div style={{ padding: '24px 24px 100px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="action-btns">
            <button className="btn btn-primary" onClick={() => router.push('/lms/create')}>+ Create</button>
            <button className="btn btn-secondary" onClick={() => router.push('/lms/join')}>Join with Code</button>
          </div>

          {/* ACTIVE MY GAMES */}
          <div>
            <div className="section-label">My Games</div>
            {activeMyGames.length === 0 ? (
              <div className="empty">You're not in any active games</div>
            ) : (
              activeMyGames.map(game => {
                const gamePicks = myPicks.filter(p => p.game_id === game.id)
                const currentGwPick = gamePicks.find(p => p.gameweek === game.current_gw)
                const latestPick = gamePicks.sort((a, b) => b.gameweek - a.gameweek)[0]
                const needsPick = game.my_status === 'alive' && !currentGwPick && game.status === 'active'

                return (
                  <a key={game.id} href={`/lms/${game.id}`} className="game-card">
                    <div className="game-name">{game.name}</div>
                    <div className="game-meta">
                      <span className={`status-pill ${
                        game.my_status === 'alive' ? 'status-alive'
                        : game.my_status === 'eliminated' ? 'status-eliminated'
                        : 'status-waiting'
                      }`}>
                        {game.my_status === 'alive' ? '✓ Alive'
                        : game.my_status === 'eliminated' ? '✗ Out'
                        : 'Waiting'}
                      </span>
                      {game.status === 'active' && (
                        <span className="status-pill status-active">GW{game.current_gw}</span>
                      )}
                      {game.status === 'waiting' && (
                        <span className="status-pill status-waiting">Not started</span>
                      )}
                      {currentGwPick && (
                        <span className="game-stat">GW{game.current_gw}: {currentGwPick.team_name}</span>
                      )}
                      {!currentGwPick && latestPick && (
                        <span className="game-stat">Last: {latestPick.team_name}</span>
                      )}
                      {needsPick && (
                        <span className="pick-warning">⚠ Pick needed</span>
                      )}
                      {game.entry_fee > 0 && <span className="game-stat">£{game.entry_fee} entry</span>}
                      {game.pot > 0 && <span className="game-stat">Pot: £{game.pot}</span>}
                    </div>
                  </a>
                )
              })
            )}
          </div>

          {/* PUBLIC GAMES */}
          {publicGames.length > 0 && (
            <div>
              <div className="section-label">Public Games</div>
              {publicGames.map(game => (
                <a key={game.id} href={`/lms/${game.id}`} className="game-card">
                  <div className="game-name">{game.name}</div>
                  <div className="game-meta">
                    <span className={`status-pill ${game.status === 'active' ? 'status-active' : 'status-waiting'}`}>
                      {game.status === 'active' ? `Live — GW${game.current_gw}` : 'Open'}
                    </span>
                    {game.entry_fee > 0 && <span className="game-stat">£{game.entry_fee} entry</span>}
                    {game.pot > 0 && <span className="game-stat">Pot: £{game.pot}</span>}
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* COMPLETED MY GAMES */}
          {completedMyGames.length > 0 && (
            <div>
              <div className="section-label">Completed</div>
              {completedMyGames.map(game => (
                <a key={game.id} href={`/lms/${game.id}`} className="game-card complete">
                  <div className="game-name">{game.name}</div>
                  <div className="game-meta">
                    <span className="status-pill status-complete">Finished</span>
                    <span className={`status-pill ${game.my_status === 'alive' ? 'status-alive' : 'status-eliminated'}`}>
                      {game.my_status === 'alive' ? '🏆 Winner' : '✗ Out'}
                    </span>
                    {game.pot > 0 && <span className="game-stat">Pot: £{game.pot}</span>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <Nav />
      </div>
    </>
  )
}