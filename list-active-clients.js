const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function listActiveClients() {
  console.log('\n' + '='.repeat(80));
  console.log('DANH SÁCH KHÁCH HÀNG ĐANG ACTIVE');
  console.log('='.repeat(80) + '\n');

  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, slug, city, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Lỗi:', error.message);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('Không có khách hàng nào đang active');
      return;
    }

    console.log(`Tổng số khách hàng active: ${clients.length}\n`);
    console.log('STT | Tên Khách Hàng                              | City              | Slug');
    console.log('-'.repeat(80));

    clients.forEach((client, index) => {
      const num = String(index + 1).padStart(3, ' ');
      const name = client.name.substring(0, 40).padEnd(40, ' ');
      const city = (client.city || 'N/A').substring(0, 17).padEnd(17, ' ');
      const slug = client.slug;
      console.log(`${num} | ${name} | ${city} | ${slug}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log(`Tổng cộng: ${clients.length} khách hàng\n`);

  } catch (error) {
    console.error('Lỗi:', error);
  }
}

listActiveClients();
