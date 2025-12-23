import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as bcrypt from 'bcryptjs'

require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function resetPasswords() {
  console.log('🔐 Resetting passwords...\n')

  // Reset admin password
  const adminPassword = 'Admin123!@#'
  const adminHash = await bcrypt.hash(adminPassword, 10)
  
  const { error: adminError } = await supabase
    .from('users')
    .update({ password_hash: adminHash })
    .eq('email', 'seo@mychiropractice.com')
  
  if (adminError) {
    console.error('❌ Admin password error:', adminError.message)
  } else {
    console.log('✅ Admin password reset: seo@mychiropractice.com / Admin123!@#')
  }

  // Reset Dr DiGrado password
  const clientPassword = 'TempPassword456'
  const clientHash = await bcrypt.hash(clientPassword, 10)
  
  const { error: clientError } = await supabase
    .from('users')
    .update({ password_hash: clientHash })
    .eq('email', 'dr@digrado.com')
  
  if (clientError) {
    console.error('❌ Dr DiGrado password error:', clientError.message)
  } else {
    console.log('✅ Dr DiGrado password reset: dr@digrado.com / TempPassword456')
  }

  console.log('\n✅ Done!')
}

resetPasswords()
