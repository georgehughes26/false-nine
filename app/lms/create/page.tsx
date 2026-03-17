'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useParams } from 'next/navigation'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function getEmail(profiles: any): string {
  const profile = Array.isArray(profiles) ? profiles[0] : profiles
  return profile?.email?.split('@')[0] ?? 'Unknown'
}

export default function GamePage() {
  const router = useRouter()
  const { id } = useParams()
  const [user, setUser] = useState<any>(null)
  const [game, setGame] = useState<any>(null)
  const [myEntry, setMyEntry] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [picks, setPicks] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [gwComplete, setGwComplete] = useState(false)
  const [currentGw, setCurrentGw] = useState<number>(1)
  const [myPick, setMyPick] = useState<any>(null)
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [usedTeams, setUsedTeams] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'pick' | 'survivors' | 'history'>('pick')
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  useEffect(() => {
    // Check for payment success redirect
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      setPaymentSuccess(true)
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: game } = await supabase
        .from('lms_games')
        .select('*')
        .eq('id', id)
        .single()
      if (!game) { router.push('/lms'); return }
      setGame(game)

      const { data: entry } = await supabase
        .from('lms_entries')
        .select('*')
        .eq('game_id', id)
        .eq('user_id', user.id)
        .single()
      setMyEntry(entry)

      const { data: allEntries } = await supabase
        .from('lms_entries')
        .select('*, profiles(id, email)')
        .eq('game_id', id)
        .order('created_at', { ascending: true })
      setEntries(allEntries ?? [])

      const { data: allPicks } = await supabase
        .from('lms_picks')
        .select('*')
        .eq('game_id', id)
      setPicks(allPicks ?? [])

      const activeGwNum = game.current_gw ?? game.start_gw
      setCurrentGw(activeGwNum)

      const { data: matchData } = await supabase
        .from('matches')
        .select('round, goals_h, goals_a, datetime, home_team_name, away_team_name, home_team_id, away_team_id, fixture_id')
        .eq('league_id', game.league_id ?? 39)
        .order('datetime', { ascending: true })

      if (matchData) {
        const gwMatches = matchData.filter((m: any) => {
          const gw = parseInt(m.round?.match(/(\d+)/)?.[1] ?? '0')
          return gw === activeGwNum
        })
        setMatches(gwMatches)

        const complete = gwMatches.length > 0 && gwMatches.every(
          (m: any) => m.goals_h !== null && m.goals_a !== null
        )
        setGwComplete(complete)
      }

      const myPicks = (allPicks ?? []).filter((p: any) => p.user_id === user.id)
      setUsedTeams(myPicks.map((p: any) => p.team_id))

      const thisPick = myPicks.find((p: any) => p.gameweek === activeGwNum)
      setMyPick(thisPick ?? null)

      setLoading(false)
    }
    load()
  }, [id, router])

  async function handlePickSave() {
    if (!selectedTeam) return
    setSaving(true)
    setError(null)

    const { data, error } = await supabase
      .from('lms_picks')
      .insert({
        game_id: id,
        user_id: user.id,
        gameweek: currentGw,
        team_id: selectedTeam.id,
        team_name: selectedTeam.name,
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
    } else {
      setMyPick(data)
      setUsedTeams(prev => [...prev, selectedTeam.id])
      setSelectedTeam(null)
    }
    setSaving(false)
  }

  async function handleRetryPayment() {
    if (!game || !user) return
    const res = await fetch('/lms/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: game.id, userId: user.id }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
  }

  const pickWindowOpen = (() => {
    if (!matches.length) return false
    const unplayed = matches.filter(m => m.goals_h === null)
    if (!unplayed.length) return false
    const earliest = Math.min(...unplayed.map(m => new Date(m.datetime).getTime()))
    return Date.now() < earliest - 5 * 60 * 1000
  })()

  if (loading) return (
    <div style={{ background: '#080c10', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#8896a8', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' }}>Loading...</div>
    </div>
  )

  // Payment guard
  if (game?.payment_status === 'unpaid') {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        `}</style>
        <div style={{ background: '#080c10', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '11px', letterSpacing: '4px', color: '#00c864', textTransform: 'uppercase', marginBottom: '4px' }}>False Nine</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '36px', color: '#ffffff', letterSpacing: '2px' }}>Payment Required</div>
          <div style={{ fontSize: '13px', color: '#8896a8', maxWidth: '280px' }}>Complete payment to activate your game and start inviting players.</div>
          <button
            onClick={handleRetryPayment}
            style={{ background: '#00c864', color: '#080c10', border: 'none', borderRadius: '10px', padding: '14px 32px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", marginTop: '8px' }}
          >
            Complete Payment — £4.99
          </button>
          <button
            onClick={() => router.push('/lms')}
            style={{ background: 'none', border: 'none', color: '#8896a8', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            ← Back to games
          </button>
        </div>
      </>
    )
  }

  const aliveCount = entries.filter(e => e.status === 'alive').length
  const totalCount = entries.length
  const isComplete = game.status === 'complete'
  const winner = isComplete && game.winner_id
    ? entries.find(e => e.user_id === game.winner_id)
    : null

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
        .page-title { font-family: 'Bebas Neue', sans-serif; font-size: 40px; letter-spacing: 2px; line-height: 1; color: #ffffff; }
        .header-meta { display: flex; gap: 12px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
        .meta-pill { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
        .pill-alive { background: rgba(0,200,100,0.1); color: #00c864; }
        .pill-eliminated { background: rgba(255,80,80,0.1); color: #ff5050; }
        .pill-complete { background: rgba(255,200,0,0.1); color: #ffc800; }
        .code-badge { font-size: 11px; color: #8896a8; letter-spacing: 2px; font-family: monospace; }
        .survivors { font-size: 12px; color: #8896a8; }
        .winner-banner { margin: 0 24px 16px; background: rgba(255,200,0,0.08); border: 1px solid rgba(255,200,0,0.25); border-radius: 12px; padding: 16px; text-align: center; }
        .winner-label { font-size: 10px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #ffc800; margin-bottom: 6px; }
        .winner-name { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #ffffff; letter-spacing: 2px; }
        .tabs { display: flex; padding: 0 24px; gap: 4px; margin-bottom: 4px; }
        .tab { flex: 1; padding: 10px; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #8896a8; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
        .tab.active { color: #00c864; border-bottom-color: #00c864; }
        .content { padding: 16px 24px 100px; display: flex; flex-direction: column; gap: 12px; }
        .section-label { font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #00c864; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(0,200,100,0.15); }
        .card { background: #0e1318; border: 1px solid #1a2030; border-radius: 12px; padding: 16px; }
        .match-row { display: flex; align-items: center; justify-content: space-between; padding: 12px; border-radius: 10px; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; margin-bottom: 8px; background: #0e1318; }
        .match-row:hover { border-color: rgba(0,200,100,0.2); }
        .match-row.selected { border-color: #00c864; background: rgba(0,200,100,0.05); }
        .match-row.used { opacity: 0.35; cursor: not-allowed; }
        .team-name { font-size: 14px; font-weight: 500; color: #e8edf2; }
        .team-name.away { text-align: right; }
        .pick-confirm { background: #0e1318; border: 1px solid #1a2030; border-radius: 12px; padding: 16px; }
        .pick-label { font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #8896a8; margin-bottom: 6px; }
        .pick-team { font-size: 20px; font-weight: 600; color: #00c864; margin-bottom: 12px; }
        .btn { width: 100%; padding: 14px; border: none; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif; letter-spacing: 1px; text-transform: uppercase; }
        .btn-primary { background: #00c864; color: #080c10; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .confirmed-pick { border-radius: 12px; padding: 16px; text-align: center; }
        .confirmed-pick.pending { background: rgba(0,200,100,0.08); border: 1px solid rgba(0,200,100,0.2); }
        .confirmed-pick.win { background: rgba(0,200,100,0.12); border: 1px solid rgba(0,200,100,0.4); }
        .confirmed-pick.loss { background: rgba(255,80,80,0.08); border: 1px solid rgba(255,80,80,0.2); }
        .confirmed-label { font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #8896a8; margin-bottom: 6px; }
        .confirmed-team { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: 2px; }
        .confirmed-team.pending { color: #00c864; }
        .confirmed-team.win { color: #00c864; }
        .confirmed-team.loss { color: #ff5050; }
        .confirmed-status { font-size: 12px; margin-top: 6px; }
        .confirmed-status.pending { color: #8896a8; }
        .confirmed-status.win { color: #00c864; font-weight: 600; }
        .confirmed-status.loss { color: #ff5050; font-weight: 600; }
        .entry-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #1a2030; }
        .entry-row:last-child { border-bottom: none; }
        .entry-email { font-size: 13px; color: #e8edf2; }
        .entry-pick { font-size: 12px; color: #8896a8; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dot-alive { background: #00c864; }
        .dot-eliminated { background: #ff5050; }
        .history-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #1a2030; }
        .history-row:last-child { border-bottom: none; }
        .history-gw { font-size: 11px; font-weight: 600; color: #8896a8; letter-spacing: 1px; text-transform: uppercase; }
        .history-team { font-size: 14px; font-weight: 500; color: #e8edf2; }
        .history-result { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
        .result-win { background: rgba(0,200,100,0.1); color: #00c864; }
        .result-pending { background: rgba(74,85,104,0.2); color: #8896a8; }
        .result-loss { background: rgba(255,80,80,0.1); color: #ff5050; }
        .window-closed { text-align: center; padding: 24px; color: #8896a8; font-size: 13px; }
        .pot-banner { background: rgba(0,200,100,0.08); border: 1px solid rgba(0,200,100,0.2); border-radius: 10px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
        .pot-label { font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #8896a8; }
        .pot-amount { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #00c864; letter-spacing: 1px; }
        .error { font-size: 12px; color: #ff5050; padding: 10px 14px; background: rgba(255,80,80,0.08); border-radius: 8px; border: 1px solid rgba(255,80,80,0.2); }
        .back-btn { display: flex; align-items: center; gap: 6px; color: #8896a8; font-size: 13px; cursor: pointer; background: none; border: none; font-family: 'DM Sans', sans-serif; padding: 0; }
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
          <div className="page-title">{game.name}</div>
          <div className="header-meta">
            {isComplete ? (
              <span className="meta-pill pill-complete">🏁 Finished</span>
            ) : myEntry ? (
              <span className={`meta-pill ${myEntry.status === 'alive' ? 'pill-alive' : 'pill-eliminated'}`}>
                {myEntry.status === 'alive' ? '✓ Alive' : '✗ Eliminated'}
              </span>
            ) : null}
            <span className="survivors">{aliveCount}/{totalCount} surviving</span>
            <span className="code-badge">{game.code}</span>
          </div>
        </div>

        {/* Payment success banner */}
        {paymentSuccess && (
          <div style={{
            margin: '0 24px 16px',
            background: 'rgba(0,200,100,0.08)',
            border: '1px solid rgba(0,200,100,0.25)',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ fontSize: '18px' }}>✓</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#00c864' }}>Payment confirmed</div>
              <div style={{ fontSize: '11px', color: '#8896a8', marginTop: '2px' }}>Your game is now active. Share the code to invite players.</div>
            </div>
          </div>
        )}

        {isComplete && (
          <div className="winner-banner">
            <div className="winner-label">🏆 Winner</div>
            <div className="winner-name">
              {winner
                ? getEmail(winner.profiles)
                : 'No winner — all eliminated'}
            </div>
          </div>
        )}

        <div className="tabs">
          <button className={`tab ${tab === 'pick' ? 'active' : ''}`} onClick={() => setTab('pick')}>Pick</button>
          <button className={`tab ${tab === 'survivors' ? 'active' : ''}`} onClick={() => setTab('survivors')}>Survivors</button>
          <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
        </div>

        <div className="content">
          <button className="back-btn" onClick={() => router.push('/lms')}>← Back to games</button>

          {game.pot > 0 && (
            <div className="pot-banner">
              <div>
                <div className="pot-label">Prize Pot</div>
                <div className="pot-amount">£{game.pot.toFixed(2)}</div>
              </div>
              <span style={{ fontSize: '24px' }}>🏆</span>
            </div>
          )}

          {/* PICK TAB */}
          {tab === 'pick' && (
            <>
              <div className="section-label">Gameweek {currentGw}</div>

              {isComplete ? (
                <div className="window-closed">This game has finished.</div>
              ) : myEntry?.status === 'eliminated' ? (
                <div className="window-closed">You've been eliminated from this game.</div>
              ) : myPick ? (
                (() => {
                  const resultClass = myPick.result === 'win' ? 'win' : myPick.result === 'loss' ? 'loss' : 'pending'
                  const statusText = myPick.result === 'win'
                    ? '✓ Your team won — you survive!'
                    : myPick.result === 'loss'
                    ? "✗ Your team lost — you've been eliminated."
                    : 'Waiting for result...'
                  return (
                    <div className={`confirmed-pick ${resultClass}`}>
                      <div className="confirmed-label">Your Pick — GW{currentGw}</div>
                      <div className={`confirmed-team ${resultClass}`}>{myPick.team_name}</div>
                      <div className={`confirmed-status ${resultClass}`}>{statusText}</div>
                    </div>
                  )
                })()
              ) : !pickWindowOpen ? (
                <div className="window-closed">Pick window is closed — GW{currentGw} has kicked off.</div>
              ) : (
                <>
                  <div style={{ fontSize: '12px', color: '#8896a8', marginBottom: '4px' }}>
                    Pick a team to win. Teams you've already used are greyed out.
                  </div>
                  {matches.map((match: any) => {
                    const homeUsed = usedTeams.includes(match.home_team_id)
                    const awayUsed = usedTeams.includes(match.away_team_id)
                    const homeSelected = selectedTeam?.id === match.home_team_id
                    const awaySelected = selectedTeam?.id === match.away_team_id

                    return (
                      <div key={match.fixture_id ?? `${match.home_team_id}-${match.away_team_id}`} style={{ marginBottom: '4px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <div
                            className={`match-row ${homeSelected ? 'selected' : ''} ${homeUsed ? 'used' : ''}`}
                            style={{ flex: 1 }}
                            onClick={() => !homeUsed && setSelectedTeam({ id: match.home_team_id, name: match.home_team_name })}
                          >
                            <span className="team-name">{match.home_team_name}</span>
                            <span style={{ fontSize: '10px', color: '#8896a8' }}>H</span>
                          </div>
                          <div
                            className={`match-row ${awaySelected ? 'selected' : ''} ${awayUsed ? 'used' : ''}`}
                            style={{ flex: 1 }}
                            onClick={() => !awayUsed && setSelectedTeam({ id: match.away_team_id, name: match.away_team_name })}
                          >
                            <span style={{ fontSize: '10px', color: '#8896a8' }}>A</span>
                            <span className="team-name away">{match.away_team_name}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {selectedTeam && (
                    <div className="pick-confirm">
                      <div className="pick-label">Your Pick</div>
                      <div className="pick-team">{selectedTeam.name}</div>
                      {error && <div className="error" style={{ marginBottom: '12px' }}>{error}</div>}
                      <button className="btn btn-primary" onClick={handlePickSave} disabled={saving}>
                        {saving ? 'Saving...' : `Lock In ${selectedTeam.name}`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* SURVIVORS TAB */}
          {tab === 'survivors' && (
            <>
              <div className="section-label">Players — {aliveCount} alive</div>
              <div className="card">
                {entries.map((entry: any) => {
                  const gwPick = gwComplete
                    ? picks.find(p => p.user_id === entry.user_id && p.gameweek === currentGw)
                    : null

                  return (
                    <div key={entry.id} className="entry-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className={`status-dot ${entry.status === 'alive' ? 'dot-alive' : 'dot-eliminated'}`} />
                        <div>
                          <div className="entry-email">{getEmail(entry.profiles)}</div>
                          {gwPick && (
                            <div className="entry-pick">
                              GW{currentGw}: {gwPick.team_name}
                              {gwPick.result === 'win' && ' ✓'}
                              {gwPick.result === 'loss' && ' ✗'}
                            </div>
                          )}
                          {!gwPick && gwComplete && entry.status === 'eliminated' && entry.eliminated_gw === currentGw && (
                            <div className="entry-pick" style={{ color: '#ff5050' }}>No pick — eliminated</div>
                          )}
                        </div>
                      </div>
                      {entry.status === 'eliminated' && entry.eliminated_gw && (
                        <span style={{ fontSize: '11px', color: '#ff5050' }}>Out GW{entry.eliminated_gw}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* HISTORY TAB */}
          {tab === 'history' && (
            <>
              <div className="section-label">My Picks</div>
              {picks.filter(p => p.user_id === user?.id).length === 0 ? (
                <div className="window-closed">No picks made yet.</div>
              ) : (
                <div className="card">
                  {picks
                    .filter(p => p.user_id === user?.id)
                    .sort((a, b) => b.gameweek - a.gameweek)
                    .map((pick: any) => (
                      <div key={pick.id} className="history-row">
                        <div>
                          <div className="history-gw">GW{pick.gameweek}</div>
                          <div className="history-team">{pick.team_name}</div>
                        </div>
                        <span className={`history-result ${
                          pick.result === 'win' ? 'result-win'
                          : pick.result === 'loss' ? 'result-loss'
                          : 'result-pending'
                        }`}>
                          {pick.result === 'win' ? 'Survived'
                          : pick.result === 'loss' ? 'Eliminated'
                          : 'Pending'}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </>
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
          <a href="/fpl" className="nav-item">
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