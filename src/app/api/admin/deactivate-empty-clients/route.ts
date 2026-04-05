import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// One-shot: deactivate clients that have no data / were accidentally activated
export async function POST() {
  // All clients that stopped having data on Feb 28 (were deactivated, accidentally re-activated)
  const toDeactivate = [
    'trieu chiropractor',
    'Trieu Ly',
    'Cornerstone Chiropractic',
    'Case Animal Hospital',
    'Symmetry Health Center',
    'Axis Chiropractic',
    'Rigel & Rigel',
    'Functional Spine Chiropractic',
    'Regenerate Chiropractic',
    'The Chiropractic Source',
    'Saigon District Restaurant',
  ];
  // North Alabama was manually deactivated - revert accidental activation
  const northAlabamaId = 'c83bbae9-5ee0-4924-8a2f-593aec45bd64';

  const { data: byName } = await supabaseAdmin
    .from('clients')
    .update({ is_active: false })
    .in('name', toDeactivate)
    .select('id, name');

  const { data: na } = await supabaseAdmin
    .from('clients')
    .update({ is_active: false })
    .eq('id', northAlabamaId)
    .select('id, name');

  // Also delete the 2 ghost rows from Apr 1-2 for Case Animal Hospital and Rigel & Rigel
  const ghostIds = [
    'e939d2f3-d052-4f95-8f3e-e3408a98a054',
    'e38d5610-eb2c-4dad-a3eb-40219eccb126',
  ];
  await supabaseAdmin
    .from('client_metrics_summary')
    .delete()
    .in('client_id', ghostIds)
    .in('date', ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05']);

  return NextResponse.json({
    success: true,
    deactivated: [...(byName || []), ...(na || [])],
  });
}
