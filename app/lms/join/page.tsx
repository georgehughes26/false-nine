'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const supabase = createBrowserClient(
  'https://wuripncsrdpezpoxhvcb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cmlwbmNzcmRwZXpwb3hodmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzIyNjMsImV4cCI6MjA4NzYwODI2M30.nvymXC2Z9wpCZJ6vDJ1S1nR404s62uJgu-uure2NTj0'
)

export default function JoinGame() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
    }
    load()
  }, [router])

  async function handleJoin() {
    setError(null)
    if (!code.trim()) { setError('Please enter an invite code'); return }
    setLoading(true)

    // Find the game
    const { data: game, error: gameError } = await supabase
      .from('lms_games')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .single()

    if (gameError || !game) {
      setError('Game not found. Check the code and try again.')
      setLoading(false)
      return
    }

    if (game.status === 'complete') {
      setError('This game has already finished.')
      setLoading(false)
      return
    }

    // Check if already in game
    const { data: existing } = await supabase
      .from('lms_entries')
      .select('id')
      .eq('game_id', game.id)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      router.push(`/lms/${game.id}`)
      return
    }

    // Join the game
    const { error: entryError } = await supabase
      .from('lms_entries')
      .insert({
        game_id: game.id,
        user_id: user.id,
        has_paid: game.entry_fee === 0, // auto-paid if free
      })

    if (entryError) {
      setError(entryError.message)
      setLoading(false)
      return
    }

    // If there's an entry fee, go to Stripe
    if (game.entry_fee > 0) {
      const res = await fetch('/api/stripe/lms-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, entryFee: game.entry_fee }),
      })
      const { url } = await res.json()
      if (url) { window.location.href = url; return }
    }

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
        .input { width: 100%; padding: 14px; background: #0e1318; border: 1px solid #1a2030; border-radius: 10px; color: #e8edf2; font-family: 'DM Sans', sans-serif; outline: none; font-size: 20px; letter-spacing: 6px; text-transform: uppercase; text-align: center; }
        .input:focus { border-color: rgba(0,200,100,0.3); }
        .btn { width: 100%; padding: 14px; border: none; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif; letter-spacing: 1px; text-transform: uppercase; }
        .btn-primary { background: #00c864; color: #080c10; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .back-btn { display: flex; align-items: center; gap: 6px; color: #4a5568; font-size: 13px; cursor: pointer; background: none; border: none; font-family: 'DM Sans', sans-serif; padding: 0; margin-bottom: 8px; }
        .error { font-size: 12px; color: #ff5050; padding: 10px 14px; background: rgba(255,80,80,0.08); border-radius: 8px; border: 1px solid rgba(255,80,80,0.2); }
        .hint { font-size: 12px; color: #4a5568; text-align: center; }
      `}</style>

      <div className="app">
        <div className="header">
          <div className="logo">False Nine</div>
          <div className="page-title">Join Game</div>
        </div>

        <div className="content">
          <button className="back-btn" onClick={() => router.push('/lms')}>← Back</button>

          <div>
            <div className="field-label">Invite Code</div>
            <input
              className="input"
              placeholder="ABC123"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
          </div>

          <div className="hint">Ask the game creator for their 6-character invite code</div>

          {error && <div className="error">{error}</div>}

          <button
            className="btn btn-primary"
            onClick={handleJoin}
            disabled={loading}
          >
            {loading ? 'Joining...' : 'Join Game'}
          </button>
        </div>
      </div>
    </>
  )
}