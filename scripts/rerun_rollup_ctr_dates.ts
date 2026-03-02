import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Affected dates from the CTR fix
const DATES = [
  '2025-01-19','2025-01-25','2025-03-08','2025-07-04','2025-10-26',
  '2025-11-12','2025-11-13','2025-11-17','2025-11-29',
  '2025-12-01','2025-12-09','2025-12-16','2025-12-20','2025-12-24',
  '2026-01-07','2026-01-08','2026-01-30','2026-02-11','2026-02-18'
];

async function main() {
  console.log('\nRe-running rollup for affected CTR dates via API...\n');
  
  for (const date of DATES) {
    const res = await fetch('https://ultimate-report-dashboard.vercel.app/api/admin/run-rollup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date })
    });
    
    if (res.ok) {
      const j = await res.json();
      console.log(`✅ ${date} — ${j.message || 'done'}`);
    } else {
      const text = await res.text();
      console.log(`❌ ${date} — ${res.status}: ${text.slice(0,100)}`);
    }
  }
  console.log('\nDone.');
}
main().catch(console.error);
