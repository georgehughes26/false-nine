import { NextRequest, NextResponse } from 'next/server'

const PASSWORD = process.env.APP_PASSWORD!

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password !== PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }
  const res = NextResponse.json({ success: true, redirect: '/lms' })
  res.cookies.set('app_unlocked', 'true', {
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}