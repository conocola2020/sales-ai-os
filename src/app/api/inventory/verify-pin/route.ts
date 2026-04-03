import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { pin } = await request.json()
  const correctPin = process.env.INVENTORY_PIN

  if (!correctPin) {
    return NextResponse.json({ error: 'PIN not configured' }, { status: 500 })
  }

  if (pin === correctPin) {
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
}
