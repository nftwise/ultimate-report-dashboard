import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Fetch one record from client_metrics_summary to see all fields
    const { data, error } = await supabaseAdmin
      .from('client_metrics_summary')
      .select('*')
      .limit(1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const record = data?.[0]
    const fields = record ? Object.keys(record) : []

    return NextResponse.json({
      success: true,
      availableFields: fields,
      sampleRecord: record,
      totalFields: fields.length
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
