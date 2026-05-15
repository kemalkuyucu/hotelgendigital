import { NextResponse } from 'next/server'
import { destroyManagerSession } from '@/lib/auth/manager-session'

export async function POST() {
  await destroyManagerSession()
  return NextResponse.json({ success: true }, { status: 200 })
}
