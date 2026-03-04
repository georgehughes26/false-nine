import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }
  const { error } = await supabase.from('waitlist').insert({ email })
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to save email' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}