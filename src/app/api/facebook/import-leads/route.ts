import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhoneNumber } from '@/lib/twilio';

export const maxDuration = 60;

/**
 * POST /api/facebook/import-leads
 * Pull historical leads from FB Lead Ads API and insert into fb_leads
 * Body: { clientId, adAccountId }
 */
export async function POST(request: NextRequest) {
  try {
    const { clientId, adAccountId } = await request.json();

    if (!clientId || !adAccountId) {
      return NextResponse.json({ error: 'Missing clientId or adAccountId' }, { status: 400 });
    }

    const accessToken = process.env.FB_ADS_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: 'Missing FB_ADS_ACCESS_TOKEN' }, { status: 500 });
    }

    // Get client name
    const { data: client } = await supabaseAdmin
      .from('clients').select('name').eq('id', clientId).single();

    // Fetch leads from FB
    let url = `https://graph.facebook.com/v19.0/act_${adAccountId}/leads` +
      `?fields=id,created_time,field_data,ad_id,ad_name,adset_name,campaign_name,form_name` +
      `&limit=100&access_token=${accessToken}`;

    let allLeads: any[] = [];
    while (url) {
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      allLeads = allLeads.concat(json.data || []);
      url = json.paging?.next || null;
    }

    console.log(`[import-leads] Found ${allLeads.length} leads from FB`);

    let inserted = 0, skipped = 0;

    for (const lead of allLeads) {
      // Parse field_data
      const fields: Record<string, string> = {};
      for (const f of lead.field_data || []) {
        fields[f.name] = f.values?.[0] || '';
      }

      const phone = fields['phone_number'] || fields['phone'] || '';
      const name = fields['full_name'] || fields['name'] || '';
      const email = fields['email'] || '';

      if (!phone) { skipped++; continue; }

      const normalizedPhone = normalizePhoneNumber(phone);

      // Check if already exists
      const { data: existing } = await supabaseAdmin
        .from('fb_leads')
        .select('id')
        .eq('client_id', clientId)
        .eq('fb_lead_id', lead.id)
        .single();

      if (existing) { skipped++; continue; }

      // Insert lead
      const { error } = await supabaseAdmin.from('fb_leads').insert({
        client_id: clientId,
        lead_source: 'fb_lead_ad',
        fb_lead_id: lead.id,
        name: name || null,
        phone: normalizedPhone,
        email: email || null,
        ad_name: lead.ad_name || null,
        campaign_name: lead.campaign_name || null,
        status: 'new',
        created_at: lead.created_time,
      });

      if (!error) inserted++;
      else skipped++;
    }

    return NextResponse.json({
      success: true,
      total: allLeads.length,
      inserted,
      skipped,
      client: client?.name,
    });

  } catch (err: any) {
    console.error('[import-leads]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
