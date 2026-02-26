import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    // Client role: only allow access to their own dashboard
    if (token?.role === 'client' && token?.clientSlug) {
      const pathname = req.nextUrl.pathname
      const allowedPrefix = `/admin-dashboard/${token.clientSlug}`
      if (!pathname.startsWith(allowedPrefix)) {
        return NextResponse.redirect(new URL(allowedPrefix, req.url))
      }
    }
    return NextResponse.next()
  },
  { pages: { signIn: '/login' } }
)

export const config = {
  matcher: ['/admin-dashboard/:path*']
}
