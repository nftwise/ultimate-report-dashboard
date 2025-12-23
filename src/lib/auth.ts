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

        // Get client data - handle both array and single object responses
        const clientData = Array.isArray(user.client) ? user.client[0] as ClientData | undefined : user.client as ClientData | null

        // Return user object for session
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          clientId: user.client_id,
          clientName: clientData?.name || null,
          clientSlug: clientData?.slug || null,
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
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
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
        return baseUrl + '/dashboard'
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
