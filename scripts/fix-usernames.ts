import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw'
);

async function main() {
  const { error, count } = await supabase
    .from('bot_credentials')
    .update({ username: 'mychiropractice' })
    .eq('label', 'WordPress Admin');
  
  if (error) console.log('Error:', error.message);
  else console.log('Updated all WordPress Admin credentials to username: mychiropractice');
}

main();
