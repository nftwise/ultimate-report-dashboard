import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

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

export const config = {
  matcher: [
    '/admin-dashboard',
    '/admin-dashboard/:path*',
    '/portal/:path*',
    '/api/((?!auth|cron|admin/run-rollup|telegram).*)',
  ]
}
