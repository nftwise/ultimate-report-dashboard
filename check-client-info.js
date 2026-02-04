const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkClientInfo() {
  console.log('\n' + '='.repeat(100));
  console.log('KIỂM TRA CHI TIẾT THÔNG TIN KHÁCH HÀNG - TÌM LỖI');
  console.log('='.repeat(100) + '\n');

  try {
    // Lấy tất cả khách hàng (active và inactive)
    const { data: allClients } = await supabase
      .from('clients')
      .select('id, name, slug, city, contact_email, is_active, created_at, updated_at')
      .order('name', { ascending: true });

    console.log(`Tổng số khách hàng (tất cả): ${allClients?.length}\n`);

    // Phân tích
    const active = allClients?.filter(c => c.is_active) || [];
    const inactive = allClients?.filter(c => !c.is_active) || [];

    console.log(`Active: ${active.length}`);
    console.log(`Inactive: ${inactive.length}\n`);

    // Hiển thị chi tiết mỗi khách
    console.log('='.repeat(100));
    console.log('CHI TIẾT TỪng KHÁCH HÀNG:');
    console.log('='.repeat(100) + '\n');

    allClients?.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name}`);
      console.log(`   Slug: ${client.slug}`);
      console.log(`   City: ${client.city || '(trống)'}`);
      console.log(`   Email: ${client.contact_email || '(trống)'}`);
      console.log(`   Active: ${client.is_active ? '✅ YES' : '❌ NO'}`);
      console.log(`   Created: ${client.created_at?.substring(0, 10) || '?'}`);
      console.log(`   Updated: ${client.updated_at?.substring(0, 10) || '?'}`);
      console.log();
    });

    console.log('\n' + '='.repeat(100));
    console.log('TÓMLẠI TẠI TRƯỜNG NÀO:');
    console.log('='.repeat(100));
    console.log('\nBảng: clients');
    console.log('Các trường chính:');
    console.log('  - id (UUID)');
    console.log('  - name (VARCHAR)');
    console.log('  - slug (VARCHAR - unique)');
    console.log('  - city (VARCHAR)');
    console.log('  - contact_email (VARCHAR)');
    console.log('  - is_active (BOOLEAN) ← TRƯỜNG XÁC ĐỊNH ACTIVE/INACTIVE');
    console.log('  - service_configs (relation)');
    console.log('  - created_at (TIMESTAMP)');
    console.log('  - updated_at (TIMESTAMP)');

  } catch (error) {
    console.error('Lỗi:', error);
  }
}

checkClientInfo();
