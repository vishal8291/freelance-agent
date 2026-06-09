import { google } from 'googleapis';
import 'dotenv/config';

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',   // force refresh_token even if previously authorized
    scope: [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',       // Phase 5: booking
    ],
  });
}

export async function exchangeCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function fetchUnreadEmails(maxResults = 10) {
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread -from:me',
    maxResults,
  });

  if (!res.data.messages) return [];

  const emails = await Promise.all(
    res.data.messages.map(async (msg) => {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const headers = full.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const threadId = full.data.threadId;

      const body = extractBody(full.data.payload);
      const senderName = extractName(from);
      const senderEmail = extractEmail(from);

      return {
        id: msg.id,
        threadId,
        subject,
        from,
        senderName,
        senderEmail,
        body: body.slice(0, 2000),
        snippet: full.data.snippet,
      };
    })
  );

  return emails;
}

export async function sendReply(threadId, toEmail, subject, replyText) {
  const rawSubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

  const message = [
    `To: ${toEmail}`,
    `Subject: ${rawSubject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    replyText,
  ].join('\n');

  const encoded = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encoded,
      threadId,
    },
  });
}

export async function sendDirectEmail(to, subject, htmlBody) {
  const from    = process.env.GMAIL_ADDRESS || 'me';
  const boundary = `boundary_${Date.now()}`;

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    subject, // plain text fallback
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlBody,
    ``,
    `--${boundary}--`,
  ].join('\n');

  const encoded = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });
}

export async function markAsRead(messageId) {
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  });
}

function extractBody(payload) {
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return '';
}

function extractName(from) {
  const match = from.match(/^([^<]+)</);
  return match ? match[1].trim() : from.split('@')[0];
}

function extractEmail(from) {
  const match = from.match(/<(.+)>/);
  return match ? match[1] : from;
}
