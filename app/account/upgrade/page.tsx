'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const plans = [
  {
    id: 'weekly',
    label: 'Weekly',
    priceId: 'price_1T5OaOFyTkvKNaO120nUyRWP',
    price: '£3.99',
    period: 'per week',
    description: 'Full Pro access, billed weekly',
  },
  {
    id: 'monthly',
    label: 'Monthly',
    priceId: 'price_1T5OaNFyTkvKNaO1ywXc8Mwk',
    price: '£5.99',
    period: 'per month',
    description: 'Full Pro access, billed monthly',
    popular: true,
  },
  {
    id: 'season',
    label: 'Season Pass',
    priceId: 'price_1T5OaJFyTkvKNaO1uNSX4LCr',
    price: '£39.99',
    period: 'one-off',
    description: 'Full access for the entire season',
  },
]

export default function UpgradePage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(priceId: string, planId: string) {
    setLoading(planId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const text = await res.text()
      console.log('Response:', text)
      const { url } = JSON.parse(text)
      if (url) window.location.href = url
      else setLoading(null)
    } catch (err) {
      console.error(err)
      setLoading(null)
    }
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
        .subtitle { font-size: 13px; color: #4a5568; margin-top: 6px; font-weight: 300; }
        .content { padding: 24px 24px 100px; display: flex; flex-direction: column; gap: 12px; }
        .plan-card { background: #0e1318; border: 1px solid #1a2030; border-radius: 12px; padding: 20px; position: relative; cursor: pointer; transition: border-color 0.2s; }
        .plan-card.popular { border-color: rgba(0,200,100,0.4); }
        .popular-badge { position: absolute; top: -10px; left: 20px; background: #00c864; color: #080c10; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 3px 10px; border-radius: 4px; }
        .plan-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .plan-label { font-size: 16px; font-weight: 600; color: #e8edf2; }
        .plan-price { text-align: right; }
        .plan-amount { font-family: 'Bebas Neue', sans-serif; font-size: 28px; color: #ffffff; letter-spacing: 1px; }
        .plan-period { font-size: 11px; color: #4a5568; }
        .plan-desc { font-size: 12px; color: #4a5568; margin-bottom: 16px; }
        .plan-btn { width: 100%; padding: 12px; border: none; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif; letter-spacing: 1px; text-transform: uppercase; transition: opacity 0.2s; }
        .plan-btn-primary { background: #00c864; color: #080c10; }
        .plan-btn-secondary { background: #1a2030; color: #e8edf2; }
        .plan-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .back-btn { display: flex; align-items: center; gap: 6px; color: #4a5568; font-size: 13px; cursor: pointer; margin-bottom: 8px; background: none; border: none; font-family: 'DM Sans', sans-serif; padding: 0; }
      `}</style>

      <div className="app">
        <div className="header">
          <div className="logo">False Nine</div>
          <div className="page-title">Go Pro</div>
          <div className="subtitle">Unlock full predictions & stats</div>
        </div>

        <div className="content">
          <button className="back-btn" onClick={() => router.push('/account')}>← Back to account</button>

          {plans.map(plan => (
            <div key={plan.id} className={`plan-card ${plan.popular ? 'popular' : ''}`}>
              {plan.popular && <div className="popular-badge">Most Popular</div>}
              <div className="plan-header">
                <div className="plan-label">{plan.label}</div>
                <div className="plan-price">
                  <div className="plan-amount">{plan.price}</div>
                  <div className="plan-period">{plan.period}</div>
                </div>
              </div>
              <div className="plan-desc">{plan.description}</div>
              <button
                className={`plan-btn ${plan.popular ? 'plan-btn-primary' : 'plan-btn-secondary'}`}
                onClick={() => handleUpgrade(plan.priceId, plan.id)}
                disabled={loading === plan.id}
              >
                {loading === plan.id ? 'Redirecting...' : `Choose ${plan.label}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}