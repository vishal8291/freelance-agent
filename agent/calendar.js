/**
 * Google Calendar integration — Phase 5
 *
 * Reuses the same OAuth2 client as Gmail (same refresh token).
 * Scope: googleapis.com/auth/calendar  (added to getAuthUrl)
 *
 * Key functions:
 *   getFreeSlots(durationMins, lookAheadDays)  → array of slot objects
 *   createMeeting(lead, slot, notes)           → { eventId, meetLink, htmlLink }
 *   getUpcomingMeetings()                      → array of calendar events
 */

import { google } from 'googleapis';
import 'dotenv/config';

// ── OAuth2 client (shared with gmail.js) ─────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI,
);
oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

const gcal        = google.calendar({ version: 'v3', auth: oauth2Client });
const CALENDAR_ID = process.env.CALENDAR_ID || 'primary';

// ── IST helpers (UTC+5:30) ────────────────────────────────────────────────────
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Return a new Date shifted into IST (just for .getUTCHours() comparisons) */
function utcToIST(d) { return new Date(d.getTime() + IST_OFFSET_MS); }

/** Build a UTC Date from IST year/month/day/hour/minute */
function istToUTC(year, month, day, hour, minute = 0) {
  return new Date(Date.UTC(year, month, day, hour, minute) - IST_OFFSET_MS);
}

/** Format a Date as a friendly IST string: "Mon, 09 Jun · 10:00 AM IST" */
export function formatSlot(utcDate) {
  const ist = utcToIST(utcDate);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d   = days[ist.getUTCDay()];
  const dd  = String(ist.getUTCDate()).padStart(2, '0');
  const mon = months[ist.getUTCMonth()];
  const hh  = ist.getUTCHours();
  const mm  = String(ist.getUTCMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12  = hh % 12 || 12;
  return `${d}, ${dd} ${mon} · ${h12}:${mm} ${ampm} IST`;
}

/** Check if a UTC date falls on a Sunday in IST */
function isSunday(utcDate) {
  return utcToIST(utcDate).getUTCDay() === 0;
}

// ── Availability check ────────────────────────────────────────────────────────
const CALL_START_IST = 10; // 10:00 AM IST
const CALL_END_IST   = 17; // 05:00 PM IST
const SLOT_MINS      = 30;

function isCalendarReady() {
  const cid = process.env.GMAIL_CLIENT_ID;
  return cid && !cid.includes('your_');
}

/** Fetch existing calendar events between two UTC dates */
async function fetchEvents(timeMin, timeMax) {
  const res = await gcal.events.list({
    calendarId: CALENDAR_ID,
    timeMin:    timeMin.toISOString(),
    timeMax:    timeMax.toISOString(),
    singleEvents: true,
    orderBy:    'startTime',
    maxResults: 100,
  });
  return res.data.items || [];
}

/** True if [slotStart, slotEnd) overlaps any existing event */
function overlaps(slotStart, slotEnd, events) {
  return events.some(ev => {
    const evStart = new Date(ev.start?.dateTime || ev.start?.date);
    const evEnd   = new Date(ev.end?.dateTime   || ev.end?.date);
    return slotStart < evEnd && slotEnd > evStart;
  });
}

/**
 * Find N free slots starting from tomorrow, within CALL_START–CALL_END IST.
 * Returns mock slots when Calendar is not configured.
 */
export async function getFreeSlots(count = 3, durationMins = SLOT_MINS, lookAheadDays = 7) {
  if (!isCalendarReady()) {
    return getMockSlots(count, durationMins);
  }

  try {
    const now      = new Date();
    const rangeEnd = new Date(now.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);
    const events   = await fetchEvents(now, rangeEnd);

    const slots = [];
    const cursor = utcToIST(now);

    // Start from next day at CALL_START_IST
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(CALL_START_IST, 0, 0, 0);

    let daysChecked = 0;
    while (slots.length < count && daysChecked < lookAheadDays) {
      const istHour = cursor.getUTCHours();

      if (istHour >= CALL_END_IST) {
        // Move to next day
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        cursor.setUTCHours(CALL_START_IST, 0, 0, 0);
        daysChecked++;
        continue;
      }

      // Build UTC dates for this slot
      const slotStartUTC = istToUTC(
        cursor.getUTCFullYear(), cursor.getUTCMonth(),
        cursor.getUTCDate(), cursor.getUTCHours(), cursor.getUTCMinutes(),
      );

      // Skip Sundays and past times
      if (!isSunday(slotStartUTC) && slotStartUTC > now) {
        const slotEndUTC = new Date(slotStartUTC.getTime() + durationMins * 60 * 1000);
        if (!overlaps(slotStartUTC, slotEndUTC, events)) {
          slots.push({ start: slotStartUTC, end: slotEndUTC, label: formatSlot(slotStartUTC) });
        }
      }

      cursor.setUTCMinutes(cursor.getUTCMinutes() + SLOT_MINS);
    }

    return slots.length >= count ? slots : [...slots, ...getMockSlots(count - slots.length, durationMins)];
  } catch (err) {
    console.error('[Calendar] getFreeSlots error:', err.message);
    return getMockSlots(count, durationMins);
  }
}

function getMockSlots(count = 3, durationMins = SLOT_MINS) {
  const slots = [];
  const now   = new Date();
  // Start from tomorrow 10am IST
  const base  = new Date(now);
  base.setUTCDate(base.getUTCDate() + 1);
  const istBase = utcToIST(base);
  istBase.setUTCHours(CALL_START_IST, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor(i / 3);
    const slotOffset = (i % 3) * 2 * SLOT_MINS; // spread across day

    const ist = new Date(istBase);
    ist.setUTCDate(ist.getUTCDate() + dayOffset);
    ist.setUTCMinutes(ist.getUTCMinutes() + slotOffset);

    // Skip Sundays
    if (ist.getUTCDay() === 0) ist.setUTCDate(ist.getUTCDate() + 1);

    const startUTC = istToUTC(
      ist.getUTCFullYear(), ist.getUTCMonth(),
      ist.getUTCDate(), ist.getUTCHours(), ist.getUTCMinutes(),
    );
    const endUTC = new Date(startUTC.getTime() + durationMins * 60 * 1000);
    slots.push({ start: startUTC, end: endUTC, label: formatSlot(startUTC), mock: true });
  }
  return slots;
}

// ── Create meeting ────────────────────────────────────────────────────────────

/**
 * Creates a Google Calendar event with an auto-generated Meet link.
 * Returns { eventId, meetLink, htmlLink } or mock data if not configured.
 */
export async function createMeeting(lead, slot, notes = '') {
  const title    = `Discovery call — ${lead.name || lead.email} × Vishal`;
  const description = [
    `Client: ${lead.name || 'Unknown'} <${lead.email}>`,
    notes ? `\nProject notes: ${notes}` : '',
    '\n---\nBooked via FreelanceAI Agent',
  ].filter(Boolean).join('');

  if (!isCalendarReady() || slot.mock) {
    const mockId   = `mock_evt_${Date.now()}`;
    const mockLink = 'https://meet.google.com/xxx-yyyy-zzz';
    console.log(`[Calendar] MOCK — would create: "${title}" at ${slot.label}`);
    return { eventId: mockId, meetLink: mockLink, htmlLink: '#', mock: true };
  }

  try {
    const event = await gcal.events.insert({
      calendarId:          CALENDAR_ID,
      conferenceDataVersion: 1,           // enables Meet link auto-creation
      requestBody: {
        summary:     title,
        description,
        start: { dateTime: slot.start.toISOString(), timeZone: 'Asia/Kolkata' },
        end:   { dateTime: slot.end.toISOString(),   timeZone: 'Asia/Kolkata' },
        attendees: [
          { email: lead.email, displayName: lead.name || lead.email },
        ],
        conferenceData: {
          createRequest: {
            requestId:             `booking_${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides:  [
            { method: 'email',  minutes: 60 },
            { method: 'popup',  minutes: 15 },
          ],
        },
        guestsCanModifyEvent: false,
        guestsCanInviteOthers: false,
        sendUpdates: 'all', // sends invite email to attendee
      },
    });

    const meetLink = event.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || '';
    console.log(`[Calendar] ✓ Event created: ${event.data.id} | Meet: ${meetLink}`);

    return {
      eventId:  event.data.id,
      meetLink,
      htmlLink: event.data.htmlLink,
      mock:     false,
    };
  } catch (err) {
    console.error('[Calendar] createMeeting error:', err.message);
    return { eventId: null, meetLink: null, htmlLink: null, error: err.message };
  }
}

// ── Upcoming meetings ─────────────────────────────────────────────────────────

export async function getUpcomingMeetings(maxResults = 10) {
  if (!isCalendarReady()) return [];
  try {
    const now    = new Date();
    const events = await fetchEvents(now, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
    return events
      .filter(e => e.summary?.includes('Discovery call'))
      .slice(0, maxResults)
      .map(e => ({
        id:       e.id,
        title:    e.summary,
        start:    e.start?.dateTime,
        end:      e.end?.dateTime,
        meetLink: e.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri || null,
        htmlLink: e.htmlLink,
        attendees:(e.attendees || []).map(a => ({ email: a.email, name: a.displayName })),
      }));
  } catch (err) {
    console.error('[Calendar] getUpcomingMeetings error:', err.message);
    return [];
  }
}
