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

interface GWOption {
  gw: number
  earliestDate: Date | null
}

export default function CreateGame() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startGw, setStartGw] = useState<number>(1)
  const [gwOptions, setGwOptions] = useState<GWOption[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: matches } = await supabase
        .from('matches')
        .select('round, goals_h, goals_a, datetime')
        .eq('league_id', 39)
        .order('datetime', { ascending: true })

      if (matches) {
        const gws: Record<number, { total: number, played: number, earliest: Date | null }> = {}
        matches.forEach((m: any) => {
          const gw = parseInt(m.round?.match(/(\d+)/)?.[1] ?? '0')
          if (!gw) return
          if (!gws[gw]) gws[gw] = { total: 0, played: 0, earliest: null }
          gws[gw].total++
          if (m.goals_h !== null && m.goals_a !== null) gws[gw].played++
          const dt = new Date(m.datetime)
          if (!gws[gw].earliest || dt < gws[gw].earliest!) gws[gw].earliest = dt
        })

        // Only show GWs that haven't fully played yet
        const upcoming = Object.entries(gws)
          .filter(([, v]) => v.played < v.total)
          .map(([gw, v]) => ({ gw: parseInt(gw), earliestDate: v.earliest }))
          .sort((a, b) => a.gw - b.gw)

        setGwOptions(upcoming)

        // Default to the next GW (first with any unplayed matches)
        if (upcoming.length > 0) setStartGw(upcoming[0].gw)
      }
    }
    load()
  }, [router])

  async function handleCreate() {
    setError(null)
    if (!name.trim()) { setError('Please enter a game name'); return }
    setLoading(true)

    const code = generateCode()

    const { data: game, error: gameError } = await supabase
      .from('lms_games')
      .insert({
        name: name.trim(),
        code,
        created_by: user.id,
        is_public: true,
        entry_fee: 0,
        pot: 0,
        start_gw: startGw,
        current_gw: startGw,
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

  function formatGWDate(date: Date | null) {
    if (!date) return ''
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
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
        .field-label { font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #8896a8; margin-bottom: 6px; }
        .input { width: 100%; padding: 14px; background: #0e1318; border: 1px solid #1a2030; border-radius: 10px; color: #e8edf2; font-family: 'DM Sans', sans-serif; outline: none; font-size: 14px; }
        .input:focus { border-color: rgba(0,200,100,0.3); }
        .btn { width: 100%; padding: 14px; border: none; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif; letter-spacing: 1px; text-transform: uppercase; }
        .btn-primary { background: #00c864; color: #080c10; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .back-btn { display: flex; align-items: center; gap: 6px; color: #8896a8; font-size: 13px; cursor: pointer; background: none; border: none; font-family: 'DM Sans', sans-serif; padding: 0; margin-bottom: 8px; }
        .error { font-size: 12px; color: #ff5050; padding: 10px 14px; background: rgba(255,80,80,0.08); border-radius: 8px; border: 1px solid rgba(255,80,80,0.2); }
        select.input option { background: #0e1318; color: #e8edf2; }
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
              placeholder="e.g. The Lads LMS 25/26"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
  <div className="field-label">Starting Gameweek</div>
  <select
    className="input"
    value={startGw}
    onChange={e => setStartGw(parseInt(e.target.value))}
    style={{ appearance: 'none', cursor: 'pointer' }}
  >
    {gwOptions.map(({ gw, earliestDate }) => (
      <option key={gw} value={gw} style={{ background: '#0e1318' }}>
        GW{gw}{earliestDate ? ` · ${formatGWDate(earliestDate)}` : ''}
      </option>
    ))}
  </select>
</div>

{/* Deadline box */}
{(() => {
  const selected = gwOptions.find(o => o.gw === startGw)
  if (!selected?.earliestDate) return null
  const deadline = new Date(selected.earliestDate.getTime() - 5 * 60 * 1000)
  return (
    <div style={{
      background: 'rgba(0,200,100,0.06)',
      border: '1px solid rgba(0,200,100,0.15)',
      borderRadius: '10px',
      padding: '12px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#8896a8', marginBottom: '4px' }}>
          Pick Deadline
        </div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#e8edf2' }}>
          {deadline.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          {' · '}
          {deadline.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
})()}

          

          {error && <div className="error">{error}</div>}

          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={loading || !user}
          >
            {loading ? 'Creating...' : 'Create Game - £5'}
          </button>
        </div>
      </div>
    </>
  )
}