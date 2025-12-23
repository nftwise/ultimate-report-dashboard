import { NextResponse } from 'next/server';
import { cache } from '@/lib/cache';

/**
 * Clear all cached data
 * Useful when you update client data or need fresh API results
 */
export async function POST() {
  try {
    const sizeBefore = cache.size;
    cache.clear();

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
      itemsCleared: sizeBefore
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to clear cache'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    cacheSize: cache.size,
    message: 'Use POST to clear cache'
  });
}
