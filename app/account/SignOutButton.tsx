'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const supabase = createBrowserClient(
  'https://wuripncsrdpezpoxhvcb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1cmlwbmNzcmRwZXpwb3hodmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzIyNjMsImV4cCI6MjA4NzYwODI2M30.nvymXC2Z9wpCZJ6vDJ1S1nR404s62uJgu-uure2NTj0'
)

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        width: '100%', padding: '16px 20px',
        background: 'transparent', border: 'none',
        cursor: 'pointer', textAlign: 'left',
        fontSize: '14px', fontWeight: 600,
        fontFamily: 'DM Sans, sans-serif',
        color: '#ff5050', letterSpacing: '0.5px',
        borderRadius: '12px',
      }}
    >
      Sign Out
    </button>
  )
}