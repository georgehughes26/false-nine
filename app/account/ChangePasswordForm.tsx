'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  'https://wuripncsrdpezpoxhvcb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cmlwbmNzcmRwZXpwb3hodmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzIyNjMsImV4cCI6MjA4NzYwODI2M30.nvymXC2Z9wpCZJ6vDJ1S1nR404s62uJgu-uure2NTj0'
)

export default function ChangePasswordForm() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    setSuccess(null)
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else { setSuccess('Password updated successfully'); setPassword(''); setConfirm(''); setOpen(false) }
    setLoading(false)
  }

  return (
    <div style={{ background: '#0e1318', border: '1px solid #1a2030', borderRadius: '12px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '20px',
          background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#4a5568', marginBottom: '4px' }}>Password</div>
          <div style={{ fontSize: '15px', fontWeight: 500, color: '#e8edf2' }}>Change password</div>
        </div>
        <span style={{ color: '#4a5568', fontSize: '18px' }}>{open ? '↑' : '↓'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #1a2030' }}>
          <div style={{ paddingTop: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#4a5568', marginBottom: '6px' }}>New Password</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '12px 14px', background: '#080c10', border: '1px solid #1a2030', borderRadius: '10px', color: '#e8edf2', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
            />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#4a5568', marginBottom: '6px' }}>Confirm Password</div>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '12px 14px', background: '#080c10', border: '1px solid #1a2030', borderRadius: '10px', color: '#e8edf2', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
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
            style={{ width: '100%', padding: '12px', background: loading ? '#1a2030' : '#00c864', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', color: loading ? '#4a5568' : '#080c10', fontSize: '13px', fontWeight: 700, fontFamily: 'DM Sans, sans-serif', letterSpacing: '1px', textTransform: 'uppercase' }}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      )}
    </div>
  )
}