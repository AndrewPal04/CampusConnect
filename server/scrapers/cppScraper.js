const fetch = require('node-fetch');
const cheerio = require('cheerio');
const ICAL = require('ical.js');

const pool = require('../db');

const CPP_EVENTS_URL = 'https://www.cpp.edu/events/';
const DEFAULT_ICAL_FEED_URL = 'https://25livepub.collegenet.com/calendars/cpp-master-calendar.ics';
const SCRAPER_HEADERS = { 'user-agent': 'CampusConnectScraper/1.0' };

const CATEGORY_MAPPINGS = [
  {
    category: 'sports',
    keywords: [
      'sport',
      'athletic',
      'basketball',
      'soccer',
      'volleyball',
      'badminton',
      'intramural',
      'fitness',
      'pilates',
      'boxing',
      'recreation',
      'gym',
      'taekwondo'
    ]
  },
  {
    category: 'music',
    keywords: ['music', 'concert', 'choir', 'band', 'dj', 'orchestra']
  },
  {
    category: 'art',
    keywords: ['art', 'gallery', 'exhibit', 'theater', 'dance', 'film', 'photography']
  },
  {
    category: 'food',
    keywords: ['food', 'meal', 'lunch', 'dinner', 'snack', 'pizza', 'bbq', 'cook', 'catering']
  },
  {
    category: 'tech',
    keywords: [
      'tech',
      'technology',
      'coding',
      'hack',
      'cyber',
      'engineering',
      'computer',
      'software',
      'ai',
      'robotics',
      'data',
      'forensics'
    ]
  },
  {
    category: 'academic',
    keywords: [
      'academic',
      'advising',
      'exam',
      'registrar',
      'registration',
      'lecture',
      'career',
      'research',
      'education',
      'study',
      'finals'
    ]
  },
  {
    category: 'social',
    keywords: ['social', 'community', 'mixer', 'club', 'network', 'welcome', 'student life', 'celebration', 'fair']
  }
];

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function stripHtml(value) {
  const html = typeof value === 'string' ? value : '';
  const $ = cheerio.load(`<div>${html}</div>`);
  return normalizeText($.text());
}

function toAbsoluteUrl(value, baseUrl) {
  const raw = normalizeText(value);

  if (!raw) {
    return null;
  }

  try {
    return new URL(raw, baseUrl).toString();
  } catch (error) {
    return null;
  }
}

function inferCategory(...parts) {
  const haystack = normalizeText(parts.filter(Boolean).join(' ')).toLowerCase();

  for (const mapping of CATEGORY_MAPPINGS) {
    if (mapping.keywords.some((keyword) => haystack.includes(keyword))) {
      return mapping.category;
    }
  }

  return 'social';
}

function toJsDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof ICAL.Time) {
    return value.toJSDate();
  }

  if (typeof value.toJSDate === 'function') {
    return value.toJSDate();
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function splitLocationAndVenue(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return { location: null, venue: null };
  }

  const parts = normalized.split(/\s+-\s+|,\s+/);
  const location = normalizeText(parts[0]) || normalized;
  const venue = parts.length > 1 ? normalizeText(parts.slice(1).join(', ')) : normalized;

  return { location, venue };
}

function normalizeEndDate(startDate, endDate) {
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) {
    return null;
  }

  if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  return endDate.getTime() > startDate.getTime() ? endDate : null;
}

function parseDateFromText(dateText) {
  const normalized = normalizeText(dateText);

  if (!normalized) {
    return null;
  }

  const directDate = new Date(normalized);

  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const firstDateMatch = normalized.match(/[A-Za-z]+\s+\d{1,2},\s+\d{4}/);

  if (!firstDateMatch) {
    return null;
  }

  const fallbackDate = new Date(firstDateMatch[0]);
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

function extractHtmlEvents(html) {
  const $ = cheerio.load(html);
  const blockSelector = [
    '.twRyoPhotoEventsItem',
    '.twSimpleEvent',
    '.twMainListEvent',
    '.twSimpleTableEventRow',
    '.twEvent'
  ].join(', ');

  const events = [];

  $(blockSelector).each((_, element) => {
    const block = $(element);
    const title = normalizeText(
      block.find('.twRyoPhotoEventsItemHeader, .twEventTitle, h1, h2, h3, a[title], a').first().text()
    );
    const sourceUrl = toAbsoluteUrl(block.find('a[href]').first().attr('href'), CPP_EVENTS_URL);
    const dateTime = normalizeText(
      block
        .find('.twRyoPhotoEventsDate, .twDate, .twEventDate, .twStartDate, .twTime, .twEventTime')
        .first()
        .text()
    );
    const locationText = normalizeText(
      block.find('.twRyoPhotoEventsLocation, .twLocation, .twWhere, .twEventLocation').first().text()
    );
    const description = stripHtml(
      block.find('.twRyoPhotoEventsNotes, .twDescription, .twRyoPhotoEventsDescription').first().html()
    );
    const date = parseDateFromText(dateTime);
    const { location, venue } = splitLocationAndVenue(locationText);

    if (!title || !sourceUrl || !date) {
      return;
    }

    events.push({
      title,
      date,
      endDate: null,
      location: location || null,
      venue: venue || null,
      description: description || null,
      sourceUrl,
      category: inferCategory(title, description, locationText, dateTime)
    });
  });

  return events;
}

function extractIcalEvents(icalText) {
  const parsedData = ICAL.parse(icalText);
  const calendar = new ICAL.Component(parsedData);
  const vevents = calendar.getAllSubcomponents('vevent');

  return vevents
    .map((vevent) => {
      const title = normalizeText(vevent.getFirstPropertyValue('summary'));
      const date = toJsDate(vevent.getFirstPropertyValue('dtstart'));
      const endDate = toJsDate(vevent.getFirstPropertyValue('dtend'));
      const locationText = normalizeText(vevent.getFirstPropertyValue('location'));
      const { location, venue } = splitLocationAndVenue(locationText);
      const description = stripHtml(vevent.getFirstPropertyValue('description'));
      const sourceUrlFromFeed = toAbsoluteUrl(vevent.getFirstPropertyValue('url'), CPP_EVENTS_URL);
      const sourceUrl =
        sourceUrlFromFeed || `cpp-ical-${Buffer.from(title + date).toString('base64').slice(0, 16)}`;

      if (!title || !date) {
        return null;
      }

      return {
        title,
        date,
        endDate: normalizeEndDate(date, endDate),
        location: location || null,
        venue: venue || null,
        description: description || null,
        sourceUrl,
        category: inferCategory(title, description, locationText)
      };
    })
    .filter(Boolean);
}

async function upsertEvents(events) {
  if (!events.length) {
    return 0;
  }

  const client = await pool.connect();
  let count = 0;

  try {
    await client.query('BEGIN');

    for (const event of events) {
      await client.query(
        `
          INSERT INTO events (title, description, category, date, end_date, location, venue, source, source_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'scraped', $8)
          ON CONFLICT (source_url) DO UPDATE
          SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            date = EXCLUDED.date,
            end_date = EXCLUDED.end_date,
            location = EXCLUDED.location,
            venue = EXCLUDED.venue,
            source = EXCLUDED.source
        `,
        [
          event.title,
          event.description,
          event.category,
          event.date,
          event.endDate,
          event.location,
          event.venue,
          event.sourceUrl,
        ]
      );

      count += 1;
    }

    await client.query('COMMIT');
    return count;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function runScraper() {
  let events = [];
  let source = 'ical';

  try {
    const icalResponse = await fetch(DEFAULT_ICAL_FEED_URL, { headers: SCRAPER_HEADERS });

    if (!icalResponse.ok) {
      throw new Error(`Failed to fetch CPP iCal feed (${icalResponse.status})`);
    }

    const icalText = await icalResponse.text();
    events = extractIcalEvents(icalText);

    if (!events.length) {
      throw new Error('iCal feed returned 0 parsable events');
    }
  } catch (icalError) {
    console.warn(`[CPP scraper] iCal primary failed: ${icalError.message}. Falling back to HTML.`);

    const listingResponse = await fetch(CPP_EVENTS_URL, { headers: SCRAPER_HEADERS });

    if (!listingResponse.ok) {
      throw new Error(`Failed to fetch CPP events listing (${listingResponse.status})`);
    }

    const listingHtml = await listingResponse.text();
    events = extractHtmlEvents(listingHtml);
    source = 'html';

    if (!events.length) {
      throw new Error(`Failed to scrape events from iCal and HTML fallback. Last error: ${icalError.message}`);
    }
  }

  const upsertedCount = await upsertEvents(events);

  return {
    source,
    fetchedCount: events.length,
    upsertedCount
  };
}

module.exports = { runScraper };
