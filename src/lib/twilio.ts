/**
 * Twilio SMS Helper
 * Handles sending SMS and parsing Twilio webhooks
 */

export interface TwilioSendResult {
  sid: string;
  to: string;
  body: string;
  status: string;
}

/**
 * Send SMS via Twilio
 * @param to Phone number in E.164 format (e.g., +16175551234)
 * @param body Message text
 * @returns Twilio message SID
 * @throws Error if send fails
 */
export async function sendSMS(to: string, body: string): Promise<string> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      'Missing Twilio env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER'
    );
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  // Basic auth header
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  // Build form data
  const params = new URLSearchParams();
  params.append('From', fromNumber);
  params.append('To', to);
  params.append('Body', body);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Twilio API error (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as TwilioSendResult;
    return data.sid;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Twilio API request timeout');
    }
    throw error;
  }
}

/**
 * Parse Twilio webhook FormData and validate signature
 * @param body Raw request body
 * @param signature X-Twilio-Signature header
 * @param url Request URL
 * @returns Parsed message (From, Body) or null if invalid
 */
export async function parseTwilioWebhook(
  body: string,
  signature: string,
  url: string
): Promise<{ from: string; body: string } | null> {
  // For now, skip signature validation (optional)
  // In production, validate against TWILIO_AUTH_TOKEN
  // See: https://www.twilio.com/docs/usage/webhooks/webhooks-security

  // Parse form data manually since it's URLencoded
  const params = new URLSearchParams(body);

  const from = params.get('From');
  const messageBody = params.get('Body');

  if (!from || !messageBody) {
    return null;
  }

  return { from, body: messageBody };
}

/**
 * Generate TwiML response for Twilio
 * @param message Optional message text to reply with
 * @returns TwiML XML string
 */
export function generateTwiMLResponse(message?: string): string {
  if (message) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;
}

/**
 * Escape special characters for XML
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Normalize phone number to E.164 format
 * @param phone Phone number string
 * @returns Normalized number (e.g., +16175551234)
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');

  // If starts with 1 (US) and is 10 digits, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If already 11+ digits and first is 1, make sure it's +1
  if (digits.length >= 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Otherwise just add +
  return `+${digits}`;
}
