import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface GBPLocation {
  client_id: string;
  gbp_location_id: string;
  location_name: string;
  address?: string;
  phone?: string;
  website?: string;
  business_type?: string;
}

interface DailyMetric {
  gbp_location_id: string;
  date: string; // YYYY-MM-DD
  views?: number;
  actions?: number;
  direction_requests?: number;
  phone_calls?: number;
  website_clicks?: number;
  total_reviews?: number;
  new_reviews_today?: number;
  average_rating?: number;
  business_photo_views?: number;
  customer_photo_count?: number;
  customer_photo_views?: number;
  posts_count?: number;
  posts_views?: number;
  posts_actions?: number;
}

interface GBPPost {
  gbp_location_id: string;
  post_id: string;
  post_type?: string;
  post_title?: string;
  post_content?: string;
  post_image_url?: string;
  created_date?: string;
  expiration_date?: string;
  views?: number;
  impressions?: number;
  actions?: number;
  website_clicks?: number;
  phone_calls?: number;
  direction_requests?: number;
}

interface GBPPhoto {
  gbp_location_id: string;
  photo_id: string;
  photo_url?: string;
  photo_type?: string;
  is_customer_photo?: boolean;
  uploaded_by?: string;
  views?: number;
  upload_date?: string;
}

interface BackfillPayload {
  locations?: GBPLocation[];
  daily_metrics?: DailyMetric[];
  posts?: GBPPost[];
  photos?: GBPPhoto[];
}

export async function POST(request: NextRequest) {
  try {
    const payload: BackfillPayload = await request.json();
    const results: any = {
      locations: { inserted: 0, skipped: 0, errors: [] },
      daily_metrics: { inserted: 0, skipped: 0, errors: [] },
      posts: { inserted: 0, skipped: 0, errors: [] },
      photos: { inserted: 0, skipped: 0, errors: [] },
    };

    // 1. BACKFILL LOCATIONS
    if (payload.locations && payload.locations.length > 0) {
      const locationsData = await Promise.all(
        payload.locations.map(async (loc) => {
          try {
            // Map client_id (if it's a name, fetch the ID)
            let clientId = loc.client_id;
            if (clientId && clientId.length > 50) {
              // Likely a UUID already
            } else {
              // Try to fetch by name
              const { data: clientData } = await supabaseAdmin
                .from('clients')
                .select('id')
                .ilike('name', `%${clientId}%`)
                .single();
              if (clientData) {
                clientId = clientData.id;
              }
            }

            return {
              client_id: clientId,
              gbp_location_id: loc.gbp_location_id,
              location_name: loc.location_name,
              address: loc.address || null,
              phone: loc.phone || null,
              website: loc.website || null,
              business_type: loc.business_type || null,
            };
          } catch (error: any) {
            results.locations.errors.push({
              location: loc.gbp_location_id,
              error: error.message,
            });
            return null;
          }
        })
      );

      const validLocations = locationsData.filter((l) => l !== null);
      if (validLocations.length > 0) {
        const { error: locError } = await supabaseAdmin
          .from('gbp_locations')
          .upsert(validLocations, { onConflict: 'client_id,gbp_location_id' });

        if (locError) {
          results.locations.errors.push({ error: locError.message });
        } else {
          results.locations.inserted = validLocations.length;
        }
      }
      results.locations.skipped = payload.locations.length - validLocations.length;
    }

    // 2. BACKFILL DAILY METRICS
    if (payload.daily_metrics && payload.daily_metrics.length > 0) {
      const metricsData = await Promise.all(
        payload.daily_metrics.map(async (metric) => {
          try {
            // Get location_id from gbp_location_id
            const { data: locData } = await supabaseAdmin
              .from('gbp_locations')
              .select('id, client_id')
              .eq('gbp_location_id', metric.gbp_location_id)
              .single();

            if (!locData) {
              throw new Error(`Location not found: ${metric.gbp_location_id}`);
            }

            return {
              location_id: locData.id,
              client_id: locData.client_id,
              date: metric.date,
              views: metric.views || 0,
              actions: metric.actions || 0,
              direction_requests: metric.direction_requests || 0,
              phone_calls: metric.phone_calls || 0,
              website_clicks: metric.website_clicks || 0,
              total_reviews: metric.total_reviews || 0,
              new_reviews_today: metric.new_reviews_today || 0,
              average_rating: metric.average_rating || null,
              business_photo_views: metric.business_photo_views || 0,
              customer_photo_count: metric.customer_photo_count || 0,
              customer_photo_views: metric.customer_photo_views || 0,
              posts_count: metric.posts_count || 0,
              posts_views: metric.posts_views || 0,
              posts_actions: metric.posts_actions || 0,
            };
          } catch (error: any) {
            results.daily_metrics.errors.push({
              date: metric.date,
              location: metric.gbp_location_id,
              error: error.message,
            });
            return null;
          }
        })
      );

      const validMetrics = metricsData.filter((m) => m !== null);
      if (validMetrics.length > 0) {
        const { error: metricsError } = await supabaseAdmin
          .from('gbp_location_daily_metrics')
          .upsert(validMetrics, { onConflict: 'location_id,date' });

        if (metricsError) {
          results.daily_metrics.errors.push({ error: metricsError.message });
        } else {
          results.daily_metrics.inserted = validMetrics.length;
        }
      }
      results.daily_metrics.skipped = payload.daily_metrics.length - validMetrics.length;
    }

    // 3. BACKFILL POSTS
    if (payload.posts && payload.posts.length > 0) {
      const postsData = await Promise.all(
        payload.posts.map(async (post) => {
          try {
            const { data: locData } = await supabaseAdmin
              .from('gbp_locations')
              .select('id, client_id')
              .eq('gbp_location_id', post.gbp_location_id)
              .single();

            if (!locData) {
              throw new Error(`Location not found: ${post.gbp_location_id}`);
            }

            return {
              location_id: locData.id,
              client_id: locData.client_id,
              post_id: post.post_id,
              post_type: post.post_type || null,
              post_title: post.post_title || null,
              post_content: post.post_content || null,
              post_image_url: post.post_image_url || null,
              created_date: post.created_date || null,
              expiration_date: post.expiration_date || null,
              views: post.views || 0,
              impressions: post.impressions || 0,
              actions: post.actions || 0,
              website_clicks: post.website_clicks || 0,
              phone_calls: post.phone_calls || 0,
              direction_requests: post.direction_requests || 0,
            };
          } catch (error: any) {
            results.posts.errors.push({
              post: post.post_id,
              error: error.message,
            });
            return null;
          }
        })
      );

      const validPosts = postsData.filter((p) => p !== null);
      if (validPosts.length > 0) {
        const { error: postsError } = await supabaseAdmin
          .from('gbp_posts')
          .upsert(validPosts, { onConflict: 'location_id,post_id' });

        if (postsError) {
          results.posts.errors.push({ error: postsError.message });
        } else {
          results.posts.inserted = validPosts.length;
        }
      }
      results.posts.skipped = payload.posts.length - validPosts.length;
    }

    // 4. BACKFILL PHOTOS
    if (payload.photos && payload.photos.length > 0) {
      const photosData = await Promise.all(
        payload.photos.map(async (photo) => {
          try {
            const { data: locData } = await supabaseAdmin
              .from('gbp_locations')
              .select('id, client_id')
              .eq('gbp_location_id', photo.gbp_location_id)
              .single();

            if (!locData) {
              throw new Error(`Location not found: ${photo.gbp_location_id}`);
            }

            return {
              location_id: locData.id,
              client_id: locData.client_id,
              photo_id: photo.photo_id,
              photo_url: photo.photo_url || null,
              photo_type: photo.photo_type || null,
              is_customer_photo: photo.is_customer_photo || false,
              uploaded_by: photo.uploaded_by || null,
              views: photo.views || 0,
              upload_date: photo.upload_date || null,
            };
          } catch (error: any) {
            results.photos.errors.push({
              photo: photo.photo_id,
              error: error.message,
            });
            return null;
          }
        })
      );

      const validPhotos = photosData.filter((p) => p !== null);
      if (validPhotos.length > 0) {
        const { error: photosError } = await supabaseAdmin
          .from('gbp_location_photos')
          .upsert(validPhotos, { onConflict: 'location_id,photo_id' });

        if (photosError) {
          results.photos.errors.push({ error: photosError.message });
        } else {
          results.photos.inserted = validPhotos.length;
        }
      }
      results.photos.skipped = payload.photos.length - validPhotos.length;
    }

    return NextResponse.json({
      success: true,
      message: 'Backfill completed',
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
