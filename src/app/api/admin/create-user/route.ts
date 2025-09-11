import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // User creation disabled - using manual JSON file authentication
    // To add users, manually edit src/data/clients.json
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'User creation disabled. This system uses manual JSON file authentication. Please edit src/data/clients.json to add users.' 
      },
      { status: 501 }
    );

  } catch (error) {
    console.error('Create user API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}