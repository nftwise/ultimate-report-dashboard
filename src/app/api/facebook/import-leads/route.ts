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
    const { clientId, adAccountId, forceReimport } = await request.json();

    if (!clientId || !adAccountId) {
      return NextResponse.json({ error: 'Missing clientId or adAccountId' }, { status: 400 });
    }

    // Force reimport: delete existing FB leads for this client
    if (forceReimport) {
      await supabaseAdmin
        .from('fb_leads')
        .delete()
        .eq('client_id', clientId)
        .eq('lead_source', 'fb_lead_ad');
      console.log(`[import-leads] Deleted existing fb_lead_ad leads for client ${clientId}`);
    }

    const accessToken = process.env.FB_ADS_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: 'Missing FB_ADS_ACCESS_TOKEN' }, { status: 500 });
    }

    // Get client name
    const { data: client } = await supabaseAdmin
      .from('clients').select('name').eq('id', clientId).single();

    // Get all ads from the ad account
    const adsUrl = `https://graph.facebook.com/v19.0/act_${adAccountId}/ads?fields=id,name&limit=200&access_token=${accessToken}`;
    const adsRes = await fetch(adsUrl);
    const adsJson = await adsRes.json();
    if (adsJson.error) throw new Error(`Ads fetch: ${adsJson.error.message}`);
    const adIds = (adsJson.data || []).map((a: any) => a.id);
    console.log(`[import-leads] Found ${adIds.length} ads, error: ${adsJson.error?.message || 'none'}`);

    // Fetch leads from each ad (ad-level endpoint works with Business Manager pages)
    let allLeads: any[] = [];
    for (const adId of adIds) {
      let url: string | null = `https://graph.facebook.com/v19.0/${adId}/leads` +
        `?fields=id,created_time,field_data,ad_name,campaign_name` +
        `&limit=100&access_token=${accessToken}`;

      while (url) {
        const adRes: Response = await fetch(url);
        const adJson: any = await adRes.json();
        if (adJson.error) break;
        allLeads = allLeads.concat(adJson.data || []);
        url = adJson.paging?.next || null;
      }
    }

    // Deduplicate by lead ID
    const seen = new Set<string>();
    allLeads = allLeads.filter((l: any) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });

    console.log(`[import-leads] Found ${allLeads.length} leads from ${adIds.length} ads`);

    let inserted = 0, skipped = 0;
    const errors: string[] = [];

    const SPAM_PATTERNS = [
      /skip\s*question/i, /not\s*interested/i, /no\s*thank/i, /disregard/i,
      /accidental/i, /by\s*mistake/i, /in\s*error/i, /don'?t\s*know\s*why/i,
      /just\s*scrolling/i, /sorry/i, /no\s*pets/i, /kiss\s*my/i,
    ];

    for (const lead of allLeads) {
      // Parse ALL field_data
      const fields: Record<string, string> = {};
      for (const f of lead.field_data || []) {
        fields[f.name] = f.values?.[0] || '';
      }

      const phone = fields['phone_number'] || fields['phone'] || '';
      const name = fields['full_name'] || fields['name'] || '';
      const email = fields['email'] || '';

      // Build notes from ALL form responses
      const allResponses = (lead.field_data || [])
        .map((f: any) => `${f.name}: ${f.values?.[0] || ''}`)
        .join('\n');

      // Detect spam from responses
      const allText = Object.values(fields).join(' ');
      const isSpam = SPAM_PATTERNS.some(p => p.test(allText));

      // Extract phone from any field if phone_number field is empty
      let finalPhone = phone;
      if (!finalPhone) {
        for (const v of Object.values(fields)) {
          if (/^\+?[\d\s\-()]{10,}$/.test(v.trim())) {
            finalPhone = v.trim();
            break;
          }
        }
      }

      // Check if already exists
      const { data: existing } = await supabaseAdmin
        .from('fb_leads')
        .select('id')
        .eq('client_id', clientId)
        .eq('fb_lead_id', lead.id)
        .single();

      if (existing) { skipped++; continue; }

      // Normalize phone — only if it has 7+ digits, otherwise use lead ID placeholder
      const digits = (finalPhone || '').replace(/\D/g, '');
      const normalizedPhone = digits.length >= 7 ? normalizePhoneNumber(finalPhone) : `+0${lead.id.slice(-10)}`;

      // Insert lead — include ALL data, mark spam
      const { error } = await supabaseAdmin.from('fb_leads').insert({
        client_id: clientId,
        lead_source: 'fb_lead_ad',
        fb_lead_id: lead.id,
        name: name || null,
        phone: normalizedPhone,
        email: email || null,
        ad_name: lead.ad_name || null,
        campaign_name: lead.campaign_name || null,
        status: isSpam ? 'closed' : 'new',
        notes: allResponses || null,
        created_at: lead.created_time,
      });

      if (!error) inserted++;
      else {
        skipped++;
        errors.push(`${name || lead.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      total: allLeads.length,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      client: client?.name,
      adsFound: adIds.length,
    });

  } catch (err: any) {
    console.error('[import-leads]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
