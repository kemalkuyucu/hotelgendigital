import { NextRequest, NextResponse } from 'next/server'

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Pass through non-admin routes and the login page itself
  if (!pathname.startsWith('/admin') || pathname.startsWith('/admin/login')) {
    return NextResponse.next()
  }

  const token = req.cookies.get('hg_admin_session')?.value
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
