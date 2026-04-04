/**
 * Google Sheets Integration
 * Syncs Facebook leads to per-client Google Sheets
 */

import { google } from 'googleapis';

interface GoogleSheetsConfig {
  serviceAccountKey: any;
  sheetId: string;
  worksheetTitle: string;
}

const sheets = google.sheets('v4');

/**
 * Build Google service account credentials for Sheets API.
 * Priority:
 *  1. GOOGLE_SHEETS_SERVICE_KEY (full JSON)
 *  2. GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY + GOOGLE_PROJECT_ID (individual vars)
 */
export function parseGoogleServiceKey(): any | null {
  // Try GOOGLE_SHEETS_SERVICE_KEY first
  const raw = process.env.GOOGLE_SHEETS_SERVICE_KEY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw.trim());
      if (typeof parsed === 'string') return JSON.parse(parsed);
      if (parsed?.type === 'service_account') return parsed;
    } catch {
      // fall through to individual vars
    }
  }

  // Fallback: build from individual Google env vars
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const projectId = process.env.GOOGLE_PROJECT_ID;

  if (clientEmail && privateKey) {
    return {
      type: 'service_account',
      project_id: projectId || '',
      private_key: privateKey.replace(/\\n/g, '\n'),
      client_email: clientEmail,
    };
  }

  return null;
}

/**
 * Initialize Google Sheets client with service account credentials
 */
function getAuthClient(serviceAccountKey: any) {
  return new google.auth.GoogleAuth({
    credentials: serviceAccountKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

/**
 * Get or create worksheet in a spreadsheet
 */
export async function ensureWorksheet(
  sheetId: string,
  worksheetTitle: string,
  serviceAccountKey: any
): Promise<number> {
  const auth = getAuthClient(serviceAccountKey);
  const spreadsheet = await sheets.spreadsheets.get({
    auth,
    spreadsheetId: sheetId,
  });

  // Check if worksheet exists
  const existingSheet = (spreadsheet.data.sheets || []).find(
    (s: any) => s.properties?.title === worksheetTitle
  );

  if (existingSheet) {
    return existingSheet.properties?.sheetId || 0;
  }

  // Create new worksheet
  const response = await sheets.spreadsheets.batchUpdate({
    auth,
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: worksheetTitle,
              gridProperties: {
                rowCount: 1000,
                columnCount: 10,
              },
            },
          },
        },
      ],
    },
  });

  return response.data.replies?.[0]?.addSheet?.properties?.sheetId || 0;
}

/**
 * Initialize sheet headers if they don't exist
 */
export async function initializeHeaders(
  sheetId: string,
  worksheetTitle: string,
  serviceAccountKey: any
): Promise<void> {
  const auth = getAuthClient(serviceAccountKey);

  const headers = [
    'Name',
    'Phone',
    'Email',
    'Lead Source',
    'Ad Name',
    'Campaign',
    'Status',
    'Created Date',
    'Last Contact',
    'Notes',
  ];

  // Check if headers exist
  const response = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId: sheetId,
    range: `${worksheetTitle}!A1:J1`,
  });

  const existingHeaders = response.data.values?.[0];

  if (!existingHeaders || existingHeaders.length === 0) {
    // Write headers
    await sheets.spreadsheets.values.update({
      auth,
      spreadsheetId: sheetId,
      range: `${worksheetTitle}!A1:J1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
  }
}

/**
 * Append a new lead row to Google Sheet
 */
export async function appendLead(
  sheetId: string,
  worksheetTitle: string,
  lead: {
    name?: string;
    phone: string;
    email?: string;
    lead_source: string;
    ad_name?: string;
    campaign_name?: string;
    status: string;
    created_at: string;
    notes?: string;
  },
  serviceAccountKey: any
): Promise<void> {
  const auth = getAuthClient(serviceAccountKey);

  const row = [
    lead.name || '',
    lead.phone,
    lead.email || '',
    lead.lead_source,
    lead.ad_name || '',
    lead.campaign_name || '',
    lead.status,
    new Date(lead.created_at).toLocaleDateString(),
    '',
    lead.notes || '',
  ];

  await sheets.spreadsheets.values.append({
    auth,
    spreadsheetId: sheetId,
    range: `${worksheetTitle}!A:J`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [row],
    },
  });
}

/**
 * Update a lead row in Google Sheet (by phone number)
 */
export async function updateLeadByPhone(
  sheetId: string,
  worksheetTitle: string,
  phone: string,
  updates: {
    status?: string;
    notes?: string;
    lastContact?: string;
  },
  serviceAccountKey: any
): Promise<void> {
  const auth = getAuthClient(serviceAccountKey);

  // Get all rows
  const response = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId: sheetId,
    range: `${worksheetTitle}!A:J`,
  });

  const rows = response.data.values || [];
  let targetRowIndex = -1;

  // Find row by phone (column B)
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === phone) {
      targetRowIndex = i;
      break;
    }
  }

  if (targetRowIndex === -1) {
    console.warn(`[google-sheets] Lead with phone ${phone} not found in sheet`);
    return;
  }

  // Update the row
  const rowNumber = targetRowIndex + 1; // Sheets is 1-indexed
  if (updates.status !== undefined) {
    rows[targetRowIndex][6] = updates.status; // Column G (Status)
  }
  if (updates.lastContact !== undefined) {
    rows[targetRowIndex][8] = updates.lastContact; // Column I (Last Contact)
  }
  if (updates.notes !== undefined) {
    rows[targetRowIndex][9] = updates.notes; // Column J (Notes)
  }

  // Write back
  await sheets.spreadsheets.values.update({
    auth,
    spreadsheetId: sheetId,
    range: `${worksheetTitle}!A${rowNumber}:J${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [rows[targetRowIndex]],
    },
  });
}

/**
 * Create a new Google Sheet for a client
 */
export async function createClientSheet(
  clientName: string,
  serviceAccountKey: any,
  parentFolderId?: string
): Promise<string> {
  const auth = getAuthClient(serviceAccountKey);

  const response = await sheets.spreadsheets.create({
    auth,
    requestBody: {
      properties: {
        title: `${clientName} - Facebook Leads`,
      },
    },
  });

  const sheetId = response.data.spreadsheetId;
  if (!sheetId) {
    throw new Error('Failed to create Google Sheet');
  }

  // Initialize with headers
  await initializeHeaders(sheetId, 'Leads', serviceAccountKey);

  return sheetId;
}
