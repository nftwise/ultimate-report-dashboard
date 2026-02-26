import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip auth for login page and auth API
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  // Check for auth cookie
  const authCookie = request.cookies.get('admin-auth')
  const expectedValue = process.env.ADMIN_PASSWORD

  if (!authCookie || !expectedValue || authCookie.value !== expectedValue) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin-dashboard/:path*']
}
