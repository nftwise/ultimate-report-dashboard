import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // client role: always redirect to their own slug
    if (token?.role === 'client' && token?.clientSlug) {
      const allowedPrefix = `/admin-dashboard/${token.clientSlug}`
      const onAdminRoot = pathname === '/admin-dashboard'
      const onWrongPath = pathname.startsWith('/admin-dashboard/') && !pathname.startsWith(allowedPrefix)
      if (onAdminRoot || onWrongPath) {
        return NextResponse.redirect(new URL(allowedPrefix, req.url))
      }
    }

    return NextResponse.next()
  },
  { pages: { signIn: '/login' } }
)

export const config = {
  // Protect dashboard pages + ALL API routes except auth/* and cron/*
  // withAuth returns 401 JSON for /api/* routes, redirects to /login for pages
  matcher: [
    '/admin-dashboard',
    '/admin-dashboard/:path*',
    '/api/((?!auth|cron).*)',
  ]
}
