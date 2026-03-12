'use client'

import { useState, useEffect } from 'react'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem('cookie-consent', 'accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem('cookie-consent', 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        .cookie-banner {
          position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
          width: 100%; max-width: 480px; z-index: 200;
          padding: 16px;
          animation: slideUp 0.3s ease;
        }
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(100%); }
          to { transform: translateX(-50%) translateY(0); }
        }
        .cookie-inner {
          background: #0e1318;
          border: 1px solid #1a2030;
          border-bottom: none;
          border-radius: 16px 16px 0 0;
          padding: 20px;
        }
        .cookie-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 700;
          color: #e8edf2; margin-bottom: 6px;
          letter-spacing: 0.3px;
        }
        .cookie-text {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; color: #4a5568;
          line-height: 1.6; font-weight: 300; margin-bottom: 16px;
        }
        .cookie-link { color: #00c864; text-decoration: none; }
        .cookie-link:hover { text-decoration: underline; }
        .cookie-btns { display: flex; gap: 8px; }
        .cookie-accept {
          flex: 1; padding: 11px; background: #00c864;
          border: none; border-radius: 8px; cursor: pointer;
          color: #080c10; font-size: 12px; font-weight: 700;
          font-family: 'DM Sans', sans-serif; letter-spacing: 1px;
          text-transform: uppercase; transition: opacity 0.2s;
        }
        .cookie-accept:hover { opacity: 0.85; }
        .cookie-decline {
          flex: 1; padding: 11px; background: transparent;
          border: 1px solid #1a2030; border-radius: 8px; cursor: pointer;
          color: #4a5568; font-size: 12px; font-weight: 600;
          font-family: 'DM Sans', sans-serif; letter-spacing: 1px;
          text-transform: uppercase; transition: all 0.2s;
        }
        .cookie-decline:hover { border-color: #2a3545; color: #e8edf2; }
      `}</style>

      <div className="cookie-banner">
        <div className="cookie-inner">
          <div className="cookie-title">🍪 We use cookies</div>
          <div className="cookie-text">
            We use essential cookies to keep you logged in, and analytics cookies via Google Analytics to improve the app.
            See our <a href="/privacy" className="cookie-link">Privacy Policy</a> for details.
          </div>
          <div className="cookie-btns">
            <button className="cookie-accept" onClick={accept}>Accept</button>
            <button className="cookie-decline" onClick={decline}>Decline</button>
          </div>
        </div>
      </div>
    </>
  )
}