export const metadata = {
    title: 'Privacy Policy',
    description: 'How False Nine collects, uses and protects your personal data.',
  }
  
  export default function PrivacyPage() {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background-color: #080c10; color: #e8edf2; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
          .app { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #080c10; padding-bottom: 80px; }
          .header { padding: 56px 24px 24px; position: relative; }
          .header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 200px; background: radial-gradient(ellipse at 50% -20%, rgba(0,200,100,0.15) 0%, transparent 70%); pointer-events: none; }
          .logo { font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 4px; color: #00c864; text-transform: uppercase; margin-bottom: 4px; }
          .page-title { font-family: 'Bebas Neue', sans-serif; font-size: 48px; letter-spacing: 2px; line-height: 1; color: #ffffff; }
          .updated { font-size: 12px; color: #2a3545; margin-top: 8px; }
          .content { padding: 8px 24px; }
          .section { margin-bottom: 32px; }
          .section-title { font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; color: #00c864; margin-bottom: 10px; }
          .body-text { font-size: 14px; color: #8899aa; line-height: 1.7; font-weight: 300; }
          .body-text + .body-text { margin-top: 10px; }
          ul { list-style: none; margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
          ul li { font-size: 14px; color: #8899aa; line-height: 1.6; font-weight: 300; padding-left: 16px; position: relative; }
          ul li::before { content: '–'; position: absolute; left: 0; color: #00c864; }
          ul li strong { color: #e8edf2; font-weight: 500; }
          .divider { height: 1px; background: #1a2030; margin-bottom: 32px; }
          a.back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #4a5568; text-decoration: none; margin-bottom: 24px; transition: color 0.2s; }
          a.back:hover { color: #00c864; }
          .contact-link { color: #00c864; text-decoration: none; }
          .contact-link:hover { text-decoration: underline; }
        `}</style>
  
        <div className="app">
          <div className="header">
            <div className="logo">False Nine</div>
            <div className="page-title">Privacy Policy</div>
            <div className="updated">Last updated: March 2026</div>
          </div>
  
          <div className="content">
            <a href="/" className="back">← Back to app</a>
  
            <div className="section">
              <div className="section-title">1. Who we are</div>
              <p className="body-text">False Nine ("we", "us", "our") is operated as a sole trader under the trading name False Nine. Our contact email is <a href="mailto:george.falsenine@outlook.com" className="contact-link">george.falsenine@outlook.com</a>.</p>
            </div>
  
            <div className="divider" />
  
            <div className="section">
              <div className="section-title">2. What data we collect</div>
              <ul>
                <li><strong>Account data:</strong> email address and password (hashed) when you register</li>
                <li><strong>Profile data:</strong> subscription status (free or Pro)</li>
                <li><strong>Usage data:</strong> pages visited, features used, session duration — collected via Google Analytics</li>
                <li><strong>Payment data:</strong> billing information processed by Stripe. We never see or store your full card details</li>
              </ul>
            </div>
  
            <div className="divider" />
  
            <div className="section">
              <div className="section-title">3. How we use your data</div>
              <ul>
                <li>To provide and maintain your account</li>
                <li>To process payments and manage your subscription</li>
                <li>To analyse usage and improve the app via Google Analytics</li>
                <li>To contact you about your account if necessary</li>
              </ul>
            </div>
  
            <div className="divider" />
  
            <div className="section">
              <div className="section-title">4. Third parties</div>
              <p className="body-text">We share data with the following third parties solely to operate the service:</p>
              <ul>
                <li><strong>Supabase</strong> (database and authentication) — supabase.com/privacy</li>
                <li><strong>Stripe</strong> (payment processing) — stripe.com/privacy</li>
                <li><strong>Google Analytics</strong> (usage analytics) — policies.google.com/privacy</li>
              </ul>
              <p className="body-text" style={{ marginTop: '12px' }}>We do not sell your data to any third party.</p>
            </div>
  
            <div className="divider" />
  
            <div className="section">
              <div className="section-title">5. Cookies</div>
              <p className="body-text">We use cookies to keep you logged in and to collect anonymised analytics data via Google Analytics. You can decline non-essential cookies via the cookie banner when you first visit the site. You can also control cookies through your browser settings.</p>
            </div>
  
            <div className="divider" />
  
            <div className="section">
              <div className="section-title">6. Data retention</div>
              <p className="body-text">We retain your account data for as long as your account is active. If you delete your account, your personal data will be removed within 30 days. Analytics data is retained by Google Analytics per their own retention policy.</p>
            </div>
  
            <div className="divider" />
  
            <div className="section">
              <div className="section-title">7. Your rights (GDPR)</div>
              <p className="body-text">If you are based in the UK or EU you have the right to:</p>
              <ul>
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to or restrict processing</li>
                <li>Lodge a complaint with the Information Commissioner's Office (ICO) at ico.org.uk</li>
              </ul>
              <p className="body-text" style={{ marginTop: '12px' }}>To exercise any of these rights, contact us at <a href="mailto:george.falsenine@outlook.com" className="contact-link">george.falsenine@outlook.com</a>.</p>
            </div>
  
            <div className="divider" />
  
            <div className="section">
              <div className="section-title">8. Data security</div>
              <p className="body-text">We use industry-standard security measures including encrypted storage via Supabase and HTTPS across the entire site. Passwords are hashed and never stored in plain text.</p>
            </div>
  
            <div className="divider" />
  
            <div className="section">
              <div className="section-title">9. Changes to this policy</div>
              <p className="body-text">We may update this policy from time to time. We will notify you of significant changes by updating the date at the top of this page.</p>
            </div>
  
            <div className="divider" />
  
            <div className="section">
              <div className="section-title">10. Contact</div>
              <p className="body-text"><a href="mailto:george.falsenine@outlook.com" className="contact-link">george.falsenine@outlook.com</a></p>
            </div>
          </div>
        </div>
      </>
    )
  }