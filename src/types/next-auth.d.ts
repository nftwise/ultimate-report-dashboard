import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      role: string
      clientId: string | null
      clientName: string | null
      clientSlug: string | null
      accessToken?: string
    }
  }

  interface User {
    id: string
    email: string
    role: string
    clientId: string | null
    clientName: string | null
    clientSlug: string | null
    accessToken?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    clientId: string | null
    clientName: string | null
    clientSlug: string | null
    accessToken?: string
  }
}
