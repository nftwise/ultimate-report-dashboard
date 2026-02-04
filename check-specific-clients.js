const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSpecificClients() {
  console.log('\n' + '='.repeat(80));
  console.log('KIỂM TRA TRẠNG THÁI IS_ACTIVE CỦA 2 KHÁCH');
  console.log('='.repeat(80) + '\n');

  try {
    // Tìm THE CHIROPRACTIC SOURCE
    const { data: chiroSource } = await supabase
      .from('clients')
      .select('id, name, slug, is_active, city, contact_email')
      .eq('slug', 'the-chiropractic-source')
      .single();

    console.log('1️⃣ THE CHIROPRACTIC SOURCE:');
    console.log('-'.repeat(80));
    if (chiroSource) {
      console.log(`   Tên: ${chiroSource.name}`);
      console.log(`   Slug: ${chiroSource.slug}`);
      console.log(`   City: ${chiroSource.city || '(trống)'}`);
      console.log(`   Email: ${chiroSource.contact_email || '(trống)'}`);
      console.log(`   is_active: ${chiroSource.is_active ? '✅ TRUE (ACTIVE)' : '❌ FALSE (INACTIVE)'}`);
      console.log(`   ID: ${chiroSource.id}`);
    } else {
      console.log('   ❌ Không tìm thấy');
    }

    console.log('\n');

    // Tìm AXIS CHIROPRACTIC
    const { data: axis } = await supabase
      .from('clients')
      .select('id, name, slug, is_active, city, contact_email')
      .eq('slug', 'axis-chiropractic')
      .single();

    console.log('2️⃣ AXIS CHIROPRACTIC:');
    console.log('-'.repeat(80));
    if (axis) {
      console.log(`   Tên: ${axis.name}`);
      console.log(`   Slug: ${axis.slug}`);
      console.log(`   City: ${axis.city || '(trống)'}`);
      console.log(`   Email: ${axis.contact_email || '(trống)'}`);
      console.log(`   is_active: ${axis.is_active ? '✅ TRUE (ACTIVE)' : '❌ FALSE (INACTIVE)'}`);
      console.log(`   ID: ${axis.id}`);
    } else {
      console.log('   ❌ Không tìm thấy');
    }

    console.log('\n' + '='.repeat(80));
    console.log('KẾT LUẬN:');
    console.log('='.repeat(80));
    if (chiroSource && axis) {
      console.log(`\nTHE CHIROPRACTIC SOURCE: is_active = ${chiroSource.is_active}`);
      console.log(`AXIS CHIROPRACTIC:      is_active = ${axis.is_active}`);

      if (chiroSource.is_active === axis.is_active) {
        console.log('\n✅ Cả hai đều cùng trạng thái');
      } else {
        console.log('\n⚠️ Hai khách có trạng thái khác nhau!');
      }
    }
    console.log('\n');

  } catch (error) {
    console.error('Lỗi:', error);
  }
}

checkSpecificClients();
