import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const sb = createClient(
  'https://tupedninjataarmdrwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw'
)

async function main() {
  const { data: users, error } = await sb.from('users').select('id,email,role').eq('role','admin')
  if (error) { console.error('DB error:', error.message); return }
  console.log('Admin users found:', users)

  const hash = bcrypt.hashSync('Admin123!@#', 10)
  const { error: e2 } = await sb.from('users').update({ password_hash: hash }).eq('role','admin')
  if (e2) console.error('Update failed:', e2.message)
  else console.log('✅ Password reset to Admin123!@# for all admin accounts')
}

main().catch(console.error)
