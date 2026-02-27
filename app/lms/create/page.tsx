'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const supabase = createBrowserClient(
  'https://wuripncsrdpezpoxhvcb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cmlwbmNzcmRwZXpwb3hodmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzIyNjMsImV4cCI6MjA4NzYwODI2M30.nvymXC2Z9wpCZJ6vDJ1S1nR404s62uJgu-uure2NTj0'
)

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function CreateGame() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [entryFee, setEntryFee] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startGw, setStartGw] = useState<number>(1)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: matches } = await supabase
        .from('matches')
        .select('round, goals_h, goals_a')
        .order('round', { ascending: true })

      if (matches) {
        const gws: Record<number, { total: number, played: number }> = {}
        matches.forEach((m: any) => {
          const gw = parseInt(m.round?.match(/(\d+)/)?.[1] ?? '0')
          if (!gw) return
          if (!gws[gw]) gws[gw] = { total: 0, played: 0 }
          gws[gw].total++
          if (m.goals_h !== null && m.goals_a !== null) gws[gw].played++
        })
        const nextGw = Object.entries(gws).find(([, v]) => v.played < v.total)
        if (nextGw) setStartGw(parseInt(nextGw[0]))
      }
    }
    load()
  }, [router])

  async function handleCreate() {
    setError(null)
    if (!name.trim()) { setError('Please enter a game name'); return }
    setLoading(true)

    const code = generateCode()
    const fee = parseFloat(entryFee) || 0

    const { data: game, error: gameError } = await supabase
      .from('lms_games')
      .insert({
        name: name.trim(),
        code,
        created_by: user.id,
        is_public: isPublic,
        entry_fee: fee,
        pot: fee,
        start_gw: startGw,
      })
      .select()
      .single()

    if (gameError) { setError(gameError.message); setLoading(false); return }

    await supabase.from('lms_entries').insert({
      game_id: game.id,
      user_id: user.id,
      has_paid: true,
    })

    router.push(`/lms/${game.id}`)
  }

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
        .content { padding: 24px 24px 100px; display: flex; flex-direction: column; gap: 16px; }
        .field-label { font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #4a5568; margin-bottom: 6px; }
        .input { width: 100%; padding: 14px; background: #0e1318; border: 1px solid #1a2030; border-radius: 10px; color: #e8edf2; font-family: 'DM Sans', sans-serif; outline: none; font-size: 14px; }
        .input:focus { border-color: rgba(0,200,100,0.3); }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; background: #0e1318; border: 1px solid #1a2030; border-radius: 10px; padding: 14px; cursor: pointer; }
        .toggle-label { font-size: 14px; font-weight: 500; color: #e8edf2; }
        .toggle-sub { font-size: 11px; color: #4a5568; margin-top: 2px; }
        .toggle { width: 44px; height: 24px; border-radius: 12px; position: relative; transition: background 0.2s; flex-shrink: 0; }
        .toggle.on { background: #00c864; }
        .toggle.off { background: #1a2030; }
        .toggle-thumb { position: absolute; top: 3px; width: 18px; height: 18px; border-radius: 9px; background: white; transition: left 0.2s; }
        .toggle.on .toggle-thumb { left: 23px; }
        .toggle.off .toggle-thumb { left: 3px; }
        .btn { width: 100%; padding: 14px; border: none; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif; letter-spacing: 1px; text-transform: uppercase; }
        .btn-primary { background: #00c864; color: #080c10; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .back-btn { display: flex; align-items: center; gap: 6px; color: #4a5568; font-size: 13px; cursor: pointer; background: none; border: none; font-family: 'DM Sans', sans-serif; padding: 0; margin-bottom: 8px; }
        .error { font-size: 12px; color: #ff5050; padding: 10px 14px; background: rgba(255,80,80,0.08); border-radius: 8px; border: 1px solid rgba(255,80,80,0.2); }
        .fee-row { display: flex; align-items: center; background: #0e1318; border: 1px solid #1a2030; border-radius: 10px; overflow: hidden; }
        .fee-prefix { padding: 14px; color: #4a5568; font-size: 14px; border-right: 1px solid #1a2030; }
        .fee-input { flex: 1; padding: 14px; background: transparent; border: none; color: #e8edf2; font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; }
      `}</style>

      <div className="app">
        <div className="header">
          <div className="logo">False Nine</div>
          <div className="page-title">Create Game</div>
        </div>

        <div className="content">
          <button className="back-btn" onClick={() => router.push('/lms')}>← Back</button>

          <div>
            <div className="field-label">Game Name</div>
            <input
              className="input"
              placeholder="e.g. Last Man Standing 25/26"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <div className="field-label">Entry Fee</div>
            <div className="fee-row">
              <span className="fee-prefix">£</span>
              <input
                className="fee-input"
                type="number"
                placeholder="0.00 (free)"
                value={entryFee}
                onChange={e => setEntryFee(e.target.value)}
                min="0"
                step="0.50"
              />
            </div>
          </div>

          <div>
            <div className="field-label">Starting Gameweek</div>
            <select
              className="input"
              value={startGw}
              onChange={e => setStartGw(parseInt(e.target.value))}
              style={{ appearance: 'none', cursor: 'pointer' }}
            >
              {Array.from({ length: 38 }, (_, i) => i + 1).map(gw => (
                <option key={gw} value={gw} style={{ background: '#0e1318' }}>
                  Gameweek {gw}
                </option>
              ))}
            </select>
          </div>

          <div className="toggle-row" onClick={() => setIsPublic(!isPublic)}>
            <div>
              <div className="toggle-label">{isPublic ? 'Public Game' : 'Private Game'}</div>
              <div className="toggle-sub">{isPublic ? 'Anyone can find and join this game' : 'Only people with the invite code can join'}</div>
            </div>
            <div className={`toggle ${isPublic ? 'on' : 'off'}`}>
              <div className="toggle-thumb" />
            </div>
          </div>

          {error && <div className="error">{error}</div>}

          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Game'}
          </button>
        </div>
      </div>
    </>
  )
}