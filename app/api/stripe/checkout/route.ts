import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const MONTHLY_PRICE_ID = 'price_1T5OaNFyTkvKNaO1ywXc8Mwk'
const WEEKLY_PRICE_ID  = 'price_1T5OaOFyTkvKNaO120nUyRWP'

export async function POST(req: NextRequest) {
  const { priceId } = await req.json()

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isSubscription = priceId === MONTHLY_PRICE_ID || priceId === WEEKLY_PRICE_ID
  const isMonthly = priceId === MONTHLY_PRICE_ID

  const session = await stripe.checkout.sessions.create({
    mode: isSubscription ? 'subscription' : 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${req.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.headers.get('origin')}/account`,
    metadata: { userId: user.id },
    customer_email: user.email,
    ...(isMonthly && {
      subscription_data: {
        trial_period_days: 14,
      },
    }),
  })

  return NextResponse.json({ url: session.url })
}