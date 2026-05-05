import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Check if path is public (doesn't need auth).
// Cron routes are NOT listed here — they validate CRON_SECRET internally but middleware
// blocks unauthenticated requests to prevent probing.
function isPublicPath(pathname: string): boolean {
  const publicPaths = [
    // Facebook/Twilio webhooks must stay public — external services call them
    /^\/api\/facebook\/webhook/,
    /^\/api\/facebook\/sms\/webhook/,
    /^\/api\/facebook\/voice\/webhook/,
    /^\/api\/facebook\/voice\/status/,
    /^\/api\/facebook\/demo-data/,
    /^\/api\/facebook\/auto-notify/,  // Supabase DB webhook — has own x-webhook-secret
    /^\/api\/auth\//,
    /^\/api\/telegram\//,
    /^\/api\/cron\//,        // Cron routes handle their own CRON_SECRET auth
    /^\/login/,
  ]
  return publicPaths.some(pattern => pattern.test(pathname))
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Don't process if on public path
    if (isPublicPath(pathname)) {
      return NextResponse.next()
    }

    // ── API ROUTE PROTECTION ─────────────────────────────────────────────────
    // /api/admin/* — require admin or team role
    if (pathname.startsWith('/api/admin/')) {
      if (!token || (token.role !== 'admin' && token.role !== 'team')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.next()
    }

    // /api/ai/* — require any authenticated session
    if (pathname.startsWith('/api/ai/')) {
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.next()
    }

    // ── CLIENT ROLE ──────────────────────────────────────────────────────────
    if (token?.role === 'client') {
      // Misconfigured client user (no client_id assigned) — block entirely.
      // Without a clientSlug we cannot scope their access, so they must be
      // bounced back to login until an admin assigns a client.
      if (!token?.clientSlug) {
        const url = new URL('/login', req.url)
        url.searchParams.set('error', 'no-client-assigned')
        return NextResponse.redirect(url)
      }

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
    '/admin-dashboard/:path*',
    '/portal/:path*',
    '/api/admin/:path*',
    '/api/ai/:path*',
    '/api/facebook/:path*',
  ],
}
