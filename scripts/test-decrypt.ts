import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
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

function decryptPassword(data: string): string {
  const key = Buffer.from(KEY_HEX, 'hex');
  const [ivHex, authTagHex, encryptedHex] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

async function main() {
  // Step 1: local round-trip test
  console.log('=== Step 1: Local round-trip ===');
  const plain = '[[$4f]3K7a!-Kang]3617^93tu';
  const enc = encryptPassword(plain);
  console.log('Encrypted:', enc);
  const dec = decryptPassword(enc);
  console.log('Decrypted:', dec);
  console.log('Match:', dec === plain ? '✓' : '✗ MISMATCH');

  // Step 2: fetch actual DB value for Zen Care
  console.log('\n=== Step 2: Fetch from DB (Zen Care) ===');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%zen care%')
    .single();
  
  console.log('Client:', client);
  
  if (!client) { console.log('Client not found'); return; }

  const { data: creds, error } = await supabase
    .from('bot_credentials')
    .select('label, username, password_encrypted, url, notes')
    .eq('client_id', client.id);
  
  console.log('Creds error:', error);
  console.log('Creds:', JSON.stringify(creds, null, 2));

  if (!creds?.length) { console.log('No credentials found'); return; }

  // Step 3: try to decrypt DB value
  console.log('\n=== Step 3: Decrypt DB value ===');
  for (const c of creds) {
    console.log('password_encrypted:', c.password_encrypted);
    console.log('Type:', typeof c.password_encrypted);
    console.log('Length:', c.password_encrypted?.length);
    try {
      const result = decryptPassword(c.password_encrypted);
      console.log('Decrypted:', result);
    } catch (err) {
      console.log('ERROR:', err);
    }
  }
}

main().catch(console.error);
