'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ComingSoonPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailSubmitted, setEmailSubmitted] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleEmailSubmit() {
    if (!email || !email.includes('@')) {
      setEmailError('Please enter a valid email')
      return
    }
    setLoading(true)
    setEmailError('')
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    if (res.ok) {
      setEmailSubmitted(true)
    } else {
      const data = await res.json()
      setEmailError(data.error ?? 'Something went wrong')
    }
  }

  async function handlePasswordSubmit() {
    if (!password) {
      setPasswordError('Please enter the access code')
      return
    }
    setLoading(true)
    setPasswordError('')
    const res = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/')
    } else {
      setPasswordError('Incorrect access code')
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
        .app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #080c10; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; position: relative; }
        .glow { position: absolute; top: 0; left: 0; right: 0; height: 300px; background: radial-gradient(ellipse at 50% -10%, rgba(0,200,100,0.18) 0%, transparent 70%); pointer-events: none; }
        .logo { font-family: 'Bebas Neue', sans-serif; font-size: 56px; letter-spacing: 4px; color: #ffffff; line-height: 1; text-align: center; }
        .tagline { font-size: 12px; color: #4a5568; letter-spacing: 3px; text-transform: uppercase; margin-top: 8px; text-align: center; margin-bottom: 48px; }
        .card { width: 100%; background: #0e1318; border: 1px solid #1a2030; border-radius: 16px; padding: 24px; }
        .card-title { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 1px; color: #ffffff; margin-bottom: 4px; }
        .card-sub { font-size: 13px; color: #4a5568; margin-bottom: 20px; font-weight: 300; }
        .label { font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #4a5568; margin-bottom: 6px; }
        .input { width: 100%; padding: 12px 14px; background: #080c10; border: 1px solid #1a2030; border-radius: 10px; color: #e8edf2; font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; transition: border-color 0.2s; }
        .input:focus { border-color: rgba(0,200,100,0.4); }
        .input.error { border-color: rgba(255,80,80,0.4); }
        .error-msg { font-size: 12px; color: #ff5050; margin-top: 6px; }
        .btn { width: 100%; padding: 14px; margin-top: 16px; background: #00c864; border: none; border-radius: 10px; cursor: pointer; color: #080c10; font-size: 14px; font-weight: 700; font-family: 'DM Sans', sans-serif; letter-spacing: 1px; text-transform: uppercase; transition: opacity 0.2s; }
        .btn:hover { opacity: 0.85; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .divider { display: flex; align-items: center; gap: 12px; margin: 24px 0; }
        .divider-line { flex: 1; height: 1px; background: #1a2030; }
        .divider-text { font-size: 11px; color: #2a3545; letter-spacing: 1px; text-transform: uppercase; }
        .success { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 0; }
        .success-icon { font-size: 32px; }
        .success-text { font-size: 14px; color: #00c864; font-weight: 600; }
        .success-sub { font-size: 12px; color: #4a5568; text-align: center; }
      `}</style>

      <div className="app">
        <div className="glow" />

        <div className="logo">
  <span style={{ color: '#ffffff', fontWeight: 500 }}>FALSE </span>
  <span style={{ color: '#00c864', fontWeight: 800 }}>NINE</span>
</div>
        <div className="tagline">Football Predictions · Coming Soon</div>

        <div className="card">
          <div className="card-title">Get Early Access</div>
          <div className="card-sub">Sign up to be notified when we launch</div>

          {emailSubmitted ? (
            <div className="success">
              <div className="success-icon">⚽</div>
              <div className="success-text">You're on the list!</div>
              <div className="success-sub">We'll be in touch when False Nine launches</div>
            </div>
          ) : (
            <>
              <div className="label">Email</div>
              <input
                type="email"
                className={`input${emailError ? ' error' : ''}`}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()}
              />
              {emailError && <div className="error-msg">{emailError}</div>}
              <button className="btn" onClick={handleEmailSubmit} disabled={loading}>
                {loading ? 'Submitting...' : 'Notify Me'}
              </button>
            </>
          )}

          <div className="divider">
            <div className="divider-line" />
            <div className="divider-text">Have access?</div>
            <div className="divider-line" />
          </div>

          <div className="label">Access Code</div>
          <input
            type="password"
            className={`input${passwordError ? ' error' : ''}`}
            placeholder="••••••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
          />
          {passwordError && <div className="error-msg">{passwordError}</div>}
          <button className="btn" onClick={handlePasswordSubmit} disabled={loading}>
            {loading ? 'Checking...' : 'Enter App'}
          </button>
        </div>
      </div>
    </>
  )
}