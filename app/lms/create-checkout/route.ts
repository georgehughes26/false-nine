import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { gameId, userId } = await req.json()

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
        price_data: {
          currency: 'gbp',
          product: 'prod_UAPqeZTbDNjyUh', // your Stripe product ID
          unit_amount: 499,
        },
        quantity: 1,
      }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/lms/${gameId}?payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/lms/create`,
    metadata: {
      gameId,
      userId,
    },
  })

  return NextResponse.json({ url: session.url })
}