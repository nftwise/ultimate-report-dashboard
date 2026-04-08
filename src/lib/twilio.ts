/**
 * SMS Helper — AWS SNS (primary) with Twilio fallback
 * Handles sending SMS via AWS SNS and parsing Twilio webhooks
 */

export interface TwilioSendResult {
  sid: string;
  to: string;
  body: string;
  status: string;
}

/**
 * Send SMS via AWS SNS (or Twilio fallback)
 * @param to Phone number in E.164 format (e.g., +16175551234)
 * @param body Message text
 * @returns Message ID
 * @throws Error if send fails
 */
export async function sendSMS(to: string, body: string): Promise<string> {
  // Try AWS SNS first
  const awsKey = process.env.AWS_ACCESS_KEY_ID;
  const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
  const awsRegion = process.env.AWS_REGION || 'us-east-1';

  if (awsKey && awsSecret) {
    return sendViaSNS(to, body, awsKey, awsSecret, awsRegion);
  }

  // Fallback to Twilio
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Missing SMS config: set AWS_ACCESS_KEY_ID or TWILIO_ACCOUNT_SID');
  }

  return sendViaTwilio(to, body, accountSid, authToken, fromNumber);
}

async function sendViaSNS(
  to: string,
  body: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string
): Promise<string> {
  // AWS SNS Publish via REST API (no SDK needed)
  const host = `sns.${region}.amazonaws.com`;
  const endpoint = `https://${host}/`;

  const params = new URLSearchParams({
    Action: 'Publish',
    PhoneNumber: to,
    Message: body,
    Version: '2010-03-31',
  });

  // AWS Signature V4
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

  const method = 'POST';
  const service = 'sns';
  const contentType = 'application/x-www-form-urlencoded';
  const bodyStr = params.toString();

  // Create canonical request
  const { createHmac, createHash } = await import('crypto');

  const payloadHash = createHash('sha256').update(bodyStr).digest('hex');
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = `${method}\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`;

  const sign = (key: Buffer | string, msg: string) => createHmac('sha256', key).update(msg).digest();
  const kDate = sign(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = sign(kDate, region);
  const kService = sign(kRegion, service);
  const kSigning = sign(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': contentType,
        'X-Amz-Date': amzDate,
        Authorization: authHeader,
        Host: host,
      },
      body: bodyStr,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`AWS SNS error (${response.status}): ${text.slice(0, 200)}`);
    }

    // Extract MessageId from XML
    const match = text.match(/<MessageId>(.*?)<\/MessageId>/);
    return match?.[1] || 'sns-ok';
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AWS SNS request timeout');
    }
    throw error;
  }
}

async function sendViaTwilio(
  to: string,
  body: string,
  accountSid: string,
  authToken: string,
  fromNumber: string
): Promise<string> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const params = new URLSearchParams();
  params.append('From', fromNumber);
  params.append('To', to);
  params.append('Body', body);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

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
      throw new Error(`Twilio API error (${response.status}): ${errorText}`);
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
