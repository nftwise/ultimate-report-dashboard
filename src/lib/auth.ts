import { NextAuthOptions } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import { Session, User } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

interface ClientData {
  id: string
  name: string
  slug: string
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Get user from database
        const { data: user, error } = await supabaseAdmin
          .from('users')
          .select(`
            id,
            email,
            password_hash,
            password_version,
            role,
            client_id,
            is_active,
            client:clients(id, name, slug)
          `)
          .eq('email', credentials.email)
          .eq('is_active', true)
          .single()

        if (error || !user) {
          console.error('User not found:', credentials.email)
          return null
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password_hash
        )

        if (!isValidPassword) {
          console.error('Invalid password for:', credentials.email)
          return null
        }

        // Update last login
        await supabaseAdmin
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', user.id)

        // Log login event (fire-and-forget async IIFE — Supabase is lazy, needs .then())
        ;(async () => {
          try {
            await supabaseAdmin.from('login_logs').insert({
              user_id: user.id,
              email: user.email,
              role: user.role,
            })
          } catch (logErr) {
            console.error('Failed to insert login_log:', logErr)
          }
        })()

        // Get client data - handle both array and single object responses
        const clientData = Array.isArray(user.client) ? user.client[0] as ClientData | undefined : user.client as ClientData | null

        // Return user object for session
        // Supported roles: 'admin' | 'team' | 'client'
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          clientId: user.client_id,
          clientName: clientData?.name || null,
          clientSlug: clientData?.slug || null,
          // Snapshot of the password_version at login time. Stored in the
          // JWT so the session callback can detect later password changes
          // and revoke stale tokens (issue #5).
          passwordVersion: typeof user.password_version === 'number' ? user.password_version : 1,
        }
      }
    })
  ],

  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.clientId = user.clientId
        token.clientName = user.clientName
        token.clientSlug = user.clientSlug
        token.passwordVersion = user.passwordVersion
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      // ── JWT revocation on password change (issue #5) ─────────────────
      // If the JWT carries a passwordVersion, compare it against the
      // current value in the DB. A mismatch means the user changed their
      // password after this token was issued — invalidate the session.
      //
      // Tokens minted BEFORE the migration ran will not have a
      // passwordVersion claim; we treat those as legacy and let them
      // through to avoid breaking active sessions on deploy day. They
      // will be re-issued (with the claim) on next login.
      if (token.id && typeof token.passwordVersion === 'number') {
        try {
          const { data: row } = await supabaseAdmin
            .from('users')
            .select('password_version, is_active')
            .eq('id', token.id as string)
            .single()

          // User deleted/deactivated → revoke
          if (!row || row.is_active === false) {
            return { ...session, user: undefined as unknown as Session['user'] }
          }

          const currentVersion = typeof row.password_version === 'number' ? row.password_version : 1
          if (currentVersion !== token.passwordVersion) {
            // Password was changed after this token was issued → revoke.
            // Returning a session without `user` causes NextAuth's client
            // helpers (useSession / getServerSession) to treat it as
            // unauthenticated and force a re-login.
            return { ...session, user: undefined as unknown as Session['user'] }
          }
        } catch (err) {
          // DB hiccup: fail open (keep session alive) so a transient
          // outage doesn't lock everyone out. The mismatch will be
          // re-checked on the next session call.
          console.error('[auth] password_version check failed:', err)
        }
      }

      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.clientId = token.clientId as string | null
        session.user.clientName = token.clientName as string | null
        session.user.clientSlug = token.clientSlug as string | null
      }
      return session
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // After login, redirect based on role
      if (url.includes('/api/auth/signin')) {
        return baseUrl + '/admin-dashboard'
      }
      return url.startsWith(baseUrl) ? url : baseUrl
    }
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
}
