import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname

    // Skip auth checks for public API paths
    if (isPublicPath(pathname)) {
      return NextResponse.next()
    }

    const token = req.nextauth.token

    // ── CLIENT ROLE ──────────────────────────────────────────────────────────
    if (token?.role === 'client' && token?.clientSlug) {
      const allowedPortal = `/portal/${token.clientSlug}`

      // Block clients from /admin-dashboard entirely → send to their portal
      if (pathname === '/admin-dashboard' || pathname.startsWith('/admin-dashboard/')) {
        return NextResponse.redirect(new URL(allowedPortal, req.url))
      }

      // Block clients from another client's portal
      if (pathname.startsWith('/portal/') && !pathname.startsWith(allowedPortal)) {
        return NextResponse.redirect(new URL(allowedPortal, req.url))
      }
    }

    // ── ADMIN / TEAM ROLE ────────────────────────────────────────────────────
    if ((token?.role === 'admin' || token?.role === 'team') && pathname.startsWith('/portal/')) {
      // Redirect admin/team from /portal/[slug] → /admin-dashboard/[slug]
      const slug = pathname.replace('/portal/', '').split('/')[0]
      const rest = pathname.replace(`/portal/${slug}`, '')
      return NextResponse.redirect(new URL(`/admin-dashboard/${slug}${rest}`, req.url))
    }

    return NextResponse.next()
  },
  { pages: { signIn: '/login' } }
)

// Explicit public API paths that don't require auth
const publicApiPaths = [
  '/api/auth',
  '/api/cron',
  '/api/admin/run-rollup',
  '/api/telegram',
  '/api/facebook',
]

export const config = {
  matcher: [
    '/admin-dashboard',
    '/admin-dashboard/:path*',
    '/portal/:path*',
    // All API routes except those explicitly public
    '/api/:path*',
  ]
}

// Check if path is public
export function isPublicPath(pathname: string): boolean {
  return publicApiPaths.some(p => pathname.startsWith(p))
}
