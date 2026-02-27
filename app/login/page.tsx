'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  'https://wuripncsrdpezpoxhvcb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cmlwbmNzcmRwZXpwb3hodmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzIyNjMsImV4cCI6MjA4NzYwODI2M30.nvymXC2Z9wpCZJ6vDJ1S1nR404s62uJgu-uure2NTj0'
)
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess('Check your email to confirm your account.')
    }

    setLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
      `}</style>

      <div style={{
        maxWidth: '480px', margin: '0 auto', minHeight: '100vh',
        background: '#080c10', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}>
        <div style={{ position: 'relative', marginBottom: '32px', textAlign: 'center' }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '200px', height: '200px',
            background: 'radial-gradient(ellipse, rgba(0,200,100,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '48px', letterSpacing: '4px', color: '#ffffff',
            lineHeight: 1,
          }}>False Nine</div>
          <div style={{ fontSize: '12px', color: '#4a5568', letterSpacing: '3px', textTransform: 'uppercase', marginTop: '6px' }}>
            Football Predictions
          </div>
        </div>

        <div style={{
          width: '100%', background: '#0e1318',
          border: '1px solid #1a2030', borderRadius: '16px', padding: '24px',
        }}>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#080c10', borderRadius: '10px', padding: '4px' }}>
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.5px',
                background: mode === m ? '#1a2030' : 'transparent',
                color: mode === m ? '#e8edf2' : '#4a5568',
                transition: 'all 0.15s',
              }}>
                {m === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#4a5568', marginBottom: '6px' }}>
                Email
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '12px 14px', background: '#080c10',
                  border: '1px solid #1a2030', borderRadius: '10px',
                  color: '#e8edf2', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#4a5568', marginBottom: '6px' }}>
                Password
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{
                  width: '100%', padding: '12px 14px', background: '#080c10',
                  border: '1px solid #1a2030', borderRadius: '10px',
                  color: '#e8edf2', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
                  outline: 'none',
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: '12px', color: '#ff5050', padding: '10px 14px', background: 'rgba(255,80,80,0.08)', borderRadius: '8px', border: '1px solid rgba(255,80,80,0.2)' }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{ fontSize: '12px', color: '#00c864', padding: '10px 14px', background: 'rgba(0,200,100,0.08)', borderRadius: '8px', border: '1px solid rgba(0,200,100,0.2)' }}>
                {success}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%', padding: '14px', marginTop: '4px',
                background: loading ? '#1a2030' : '#00c864',
                border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer',
                color: loading ? '#4a5568' : '#080c10',
                fontSize: '14px', fontWeight: 700, fontFamily: 'DM Sans, sans-serif',
                letterSpacing: '1px', textTransform: 'uppercase',
                transition: 'all 0.15s',
              }}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}