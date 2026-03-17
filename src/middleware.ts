import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // client role: restricted to their own slug for dashboard pages
    if (token?.role === 'client' && token?.clientSlug) {
      const allowedPrefix = `/admin-dashboard/${token.clientSlug}`
      if (pathname.startsWith('/admin-dashboard/') && !pathname.startsWith(allowedPrefix)) {
        return NextResponse.redirect(new URL(allowedPrefix, req.url))
      }
    }

    return NextResponse.next()
  },
  { pages: { signIn: '/login' } }
)

export const config = {
  // Protect dashboard pages + ALL API routes except auth/*, cron/*, and run-rollup
  // withAuth returns 401 JSON for /api/* routes, redirects to /login for pages
  matcher: [
    '/admin-dashboard/:path*',
    '/api/((?!auth|cron|admin/run-rollup).*)',
  ]
}
