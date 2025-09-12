import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Read clients from JSON file
    const filePath = path.join(process.cwd(), 'src', 'data', 'clients.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const clientsData = JSON.parse(fileContents);

    // Find user by email and validate password
    const user = clientsData.clients.find((client: any) => 
      client.email === email && client.password === password
    );

    if (user) {
      // Set a simple cookie with user data
      const response = NextResponse.json({ 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          companyName: user.companyName
        }
      });
      
      // Store user data in a simple cookie
      response.cookies.set('user', JSON.stringify({
        id: user.id,
        email: user.email,
        companyName: user.companyName,
        googleAnalyticsPropertyId: user.googleAnalyticsPropertyId,
        googleAdsCustomerId: user.googleAdsCustomerId,
        callrailAccountId: user.callrailAccountId
      }), {
        httpOnly: true,
        maxAge: 86400 // 24 hours
      });
      
      return response;
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Invalid credentials' 
    }, { status: 401 });
    
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: 'Server error' 
    }, { status: 500 });
  }
}

// Handle logout
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('user');
  return response;
}

// Check if logged in
export async function GET(request: NextRequest) {
  const userCookie = request.cookies.get('user');
  
  if (userCookie) {
    try {
      const user = JSON.parse(userCookie.value);
      return NextResponse.json({ success: true, user });
    } catch {
      return NextResponse.json({ success: false }, { status: 401 });
    }
  }
  
  return NextResponse.json({ success: false }, { status: 401 });
}