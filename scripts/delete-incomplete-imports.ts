import { createClient } from '@supabase/supabase-js'
import * as path from 'path'

require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function deleteIncompleteImports() {
  const slugs = [
    'zen-care-physical-medicine',
    'healing-hands-of-manahawkin',
    'ray-chiropractic',
    'saigon-district-restaurant'
  ]

  for (const slug of slugs) {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('slug', slug)

    if (error) {
      console.log(`❌ Error deleting ${slug}:`, error.message)
    } else {
      console.log(`✅ Deleted ${slug}`)
    }
  }
}

deleteIncompleteImports().then(() => process.exit(0))
