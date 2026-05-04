import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('[Supabase] WARNING: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Using placeholder values — database operations will fail at runtime.')
}

// Client for browser/frontend use (Row Level Security applies)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Service client for server-side use (bypasses RLS - use carefully!)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey && process.env.NODE_ENV !== 'production') {
  // During local dev, warn but allow build to proceed
  console.error('[Supabase] WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. supabaseAdmin will not work.')
}
if (!serviceRoleKey && process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  // In production server-side, this is a critical error
  throw new Error('[Supabase] FATAL: SUPABASE_SERVICE_ROLE_KEY is not set. Cannot create supabaseAdmin in production.')
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey || 'placeholder-service-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
