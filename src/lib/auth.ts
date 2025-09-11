// Simple JSON file-based authentication utilities
// Used for development/demo purposes with manual client management

import fs from 'fs';
import path from 'path';

export interface ClientUser {
  id: string;
  email: string;
  companyName: string;
  googleAnalyticsPropertyId?: string;
  googleAdsCustomerId?: string;
  callrailAccountId?: string;
  password?: string; // For JSON file auth only
}

// Read clients from JSON file
function getClientsData() {
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'clients.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContents);
    return data.clients || [];
  } catch (error) {
    console.error('Error reading clients data:', error);
    return [];
  }
}

// Find user by email (for JSON file authentication)
export function findUserByEmail(email: string): ClientUser | null {
  try {
    const clients = getClientsData();
    const user = clients.find((client: any) => client.email === email);
    
    if (!user) {
      return null;
    }

    // Map JSON structure to ClientUser interface
    return {
      id: user.id,
      email: user.email,
      companyName: user.companyName,
      googleAnalyticsPropertyId: user.googleAnalyticsPropertyId,
      googleAdsCustomerId: user.googleAdsCustomerId,
      callrailAccountId: user.callrailAccountId,
      password: user.password // Only for JSON auth
    };
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

// Validate password (simple text comparison for JSON auth)
export function validatePassword(user: ClientUser, password: string): boolean {
  return user.password === password;
}

// Get user by ID
export function getUserById(id: string): ClientUser | null {
  try {
    const clients = getClientsData();
    const user = clients.find((client: any) => client.id === id);
    
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      companyName: user.companyName,
      googleAnalyticsPropertyId: user.googleAnalyticsPropertyId,
      googleAdsCustomerId: user.googleAdsCustomerId,
      callrailAccountId: user.callrailAccountId
    };
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}