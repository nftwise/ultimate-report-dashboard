import { createCipheriv, randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tupedninjtaarmdwppgy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw';
const KEY_HEX = '46617cbcb2f17a75ee557c15f48c68e344495bab3cdde7e7561026dbe0be28f0';

function encryptPassword(text: string): string {
  const key = Buffer.from(KEY_HEX, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const wp_creds = [
  ["Chiropractic Care Centre",          "drdean@painresults.com",              "[[$4f]3K7a!-DeanBrown]7788(1)",       "https://painresults.com/wp-admin"],
  ["Chiropractic First",                "chiroteam@chirofirst.net",            "[[$4f]3K7a!-ToddRoyse]2266(a)",       "https://chirofirstredding.com/wp-admin"],
  ["Chiropractic Health Club",          "info@chiropractichealthclub.com",     "[[$4f]3K7a!-Kang]0510#47lx",          "https://chiropractichealthclub.com/wp-admin"],
  ["ChiroSolutions Center",             "info@mychirosolutions.com",           "[[$4f]3K7a!-Coleman]7007>56b",        "https://mychirosolutions.com/wp-admin"],
  ["Cinque Chiropractic",               "dralexacinque@gmail.com",             "[[$4f]3K7a1-Cinque5801]L69",          "https://cinquechiropractic.com/wp-admin"],
  ["CorePosture",                       "seo@mychiropractice.com",             "[[$4f]3K7a!-Meier]0209@69df",         "https://coreposturechiropractic.com/wp-admin"],
  ["DeCarlo Chiropractic",              "info@decarlochiropractic.com",        "[[$4f]3K7a!-DeCarlo]6457&78hr",       "https://decarlochiropractic.com/wp-admin"],
  ["Haven Chiropractic",                "frontdesk@havencbp.com",              "[[$4f]3K7a!-HavenChiro]1111(S)",      "https://havencbp.com/wp-admin"],
  ["Healing Hands of Manahawkin",       "drnicolebonner.com",                  "S$4f]3K7a!-Nicole-Bonner",            "https://drnicolebonner.com/wp-admin"],
  ["Hood Chiropractic",                 "chirochampion@me.com",                "[[$4f]3K7a!-Hood]7103*ez24v",         "https://hoodchiropractic.com/wp-admin"],
  ["Newport Center Family Chiropractic","ncfc@drdigrado.com",                  "[[$4f]3K7a!-DiGrado]2585+12gn",       "https://drdigrado.com/wp-admin"],
  ["North Alabama Spine & Rehab",       "hurtoc.com",                          "[[$4f]3K7a!-Shafran]4226&12ed",       "https://hurtoc.com/wp-admin"],
  ["Ray Chiropractic",                  "redlandschiro.net",                   "[[$4f]3K7a!-DrRay]1674(xo)",          "https://redlandschiro.net/wp-admin"],
  ["Restoration Dental",                "info@restorationdentaloc.com",        "[[$4f]3K7a!-Pham]2019#52nm",          "https://restorationdentaloc.com/wp-admin"],
  ["Southport Chiropractic",            "info@chiroct.com",                    "[[$4f]3K7a!-RichardPinsky]9133",      "https://chiroct.com/wp-admin"],
  ["Tails Animal Chiropractic Care",    "dralisha@tailschirocare.com",         "[[$4f]3K7a!-Barnes]8862#83jb",        "https://tailschirocare.com/wp-admin"],
  ["Tinker Family Chiro",               "tinkerfamilychiro@gmail.com",         "[[$4f]3K7a1-Tink3r2024!]",            "https://tinkerfamilychiro.com/wp-admin"],
  ["Whole Body Wellness",               "wbwchiro.com",                        "[[$4f]3K7a!-Mendez]8190*28eg",        "https://wbwchiro.com/wp-admin"],
  ["Zen Care Physical Medicine",        "jay@zencare.com",                     "[[$4f]3K7a!-Kang]3617^93tu",          "https://zencare.com/wp-admin"],
];

async function main() {
  const { data: clients } = await supabase.from('clients').select('id, name').eq('is_active', true);
  const clientMap: Record<string, string> = {};
  for (const c of clients || []) clientMap[c.name] = c.id;

  // Delete old (Python-encrypted) entries first
  await supabase.from('bot_credentials').delete().eq('label', 'WordPress Admin');
  console.log('Deleted old entries');

  let ok = 0;
  for (const [name, username, password, url] of wp_creds) {
    const client_id = clientMap[name];
    if (!client_id) { console.log(`  SKIP: ${name}`); continue; }
    const { error } = await supabase.from('bot_credentials').insert({
      client_id, label: 'WordPress Admin', username, password_encrypted: encryptPassword(password), url
    });
    if (error) console.log(`  ✗ ${name}: ${error.message}`);
    else { console.log(`  ✓ ${name}`); ok++; }
  }
  console.log(`\nDone: ${ok}/${wp_creds.length}`);
}

main();
