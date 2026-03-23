import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Custom middleware that runs on all routes
export async function middleware(req: any) {
  const pathname = req.nextUrl.pathname

  // Public routes that should never require auth
  const publicPaths = [
    /^\/api\/facebook\//,
    /^\/api\/auth\//,
    /^\/api\/cron\//,
    /^\/api\/telegram\//,
    /^\/login$/,
  ]

  const isPublic = publicPaths.some(pattern => pattern.test(pathname))
  if (isPublic) {
    return NextResponse.next()
  }

  // For protected routes, check auth
  const token = await getToken({ req })

  // If no token and trying to access protected routes, redirect to login
  if (!token) {
    if (pathname.startsWith('/admin-dashboard') || pathname.startsWith('/portal')) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  // Apply role-based logic if authenticated
  if (token) {
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
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Run middleware on all routes except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
