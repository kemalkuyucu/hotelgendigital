import { NextResponse } from 'next/server'
import { getSessionManager } from '@/lib/auth/manager-session'

export async function GET() {
  try {
    const manager = await getSessionManager()
    if (!manager) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({
      id: manager.id,
      username: manager.username,
      role: manager.role,
    })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
