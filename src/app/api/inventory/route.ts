import { NextResponse } from 'next/server'

export async function POST() {
  // Future: email/EC integration webhook endpoint
  return NextResponse.json({ status: 'ok', message: 'not implemented' }, { status: 501 })
}
