import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      slug,
      name,
      contactEmail,
      contact_email,
      contact_name,
      city,
      owner,
      has_seo,
      has_ads,
      gaPropertyId,
      gadsCustomerId,
      gscSiteUrl,
      callrailAccountId,
      gbpLocationId
    } = body;

    const email = contactEmail || contact_email || null;

    // Validate required fields
    if (!slug || !name || !email) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: slug, name, contactEmail'
      }, { status: 400 });
    }

    // Check if slug already exists
    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('slug')
      .eq('slug', slug)
      .single();

    if (existingClient) {
      return NextResponse.json({
        success: false,
        error: `Client with slug "${slug}" already exists`
      }, { status: 400 });
    }

    // Step 1: Insert client
    const { data: newClient, error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({
        slug,
        name,
        contact_email: email,
        contact_name: contact_name || null,
        city: city || null,
        owner: owner || null,
        has_seo: has_seo ?? false,
        has_ads: has_ads ?? false,
        is_active: true
      })
      .select('id')
      .single();

    if (clientError) {
      console.error('Error creating client:', clientError);
      return NextResponse.json({
        success: false,
        error: `Failed to create client: ${clientError.message}`
      }, { status: 500 });
    }

    // Step 2: Insert service_configs
    const { error: configError } = await supabaseAdmin
      .from('service_configs')
      .insert({
        client_id: newClient.id,
        ga_property_id: gaPropertyId || null,
        gads_customer_id: gadsCustomerId || null,
        gsc_site_url: gscSiteUrl || null,
        callrail_account_id: callrailAccountId || null,
        gbp_location_id: gbpLocationId || null
      });

    if (configError) {
      console.error('Error creating service config:', configError);

      // Rollback: delete the client we just created
      await supabaseAdmin
        .from('clients')
        .delete()
        .eq('id', newClient.id);

      return NextResponse.json({
        success: false,
        error: `Failed to create service configuration: ${configError.message}`
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Client created successfully',
      client: {
        id: newClient.id,
        slug,
        name
      }
    });

  } catch (error: any) {
    console.error('Error in create-client API:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
}
