const fetch = require('node-fetch');
const cheerio = require('cheerio');
const ICAL = require('ical.js');

const pool = require('../db');

const CPP_EVENTS_URL = 'https://www.cpp.edu/events/';
const DEFAULT_ICAL_FEED_URL = 'https://25livepub.collegenet.com/calendars/cpp-master-calendar.ics';

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

function extractCalendarWebName(html) {
  const match = html.match(/webName\s*:\s*["']([^"']+)["']/i);
  return match?.[1] ?? null;
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
    const location = normalizeText(
      block.find('.twRyoPhotoEventsLocation, .twLocation, .twWhere, .twEventLocation').first().text()
    );
    const description = stripHtml(
      block.find('.twRyoPhotoEventsNotes, .twDescription, .twRyoPhotoEventsDescription').first().html()
    );
    const date = parseDateFromText(dateTime);

    if (!title || !sourceUrl || !date) {
      return;
    }

    events.push({
      title,
      date,
      endDate: null,
      location: location || null,
      description: description || null,
      sourceUrl,
      category: inferCategory(title, description, location, dateTime)
    });
  });

  return events;
}

function extractTrumbaCustomField(component, fieldName) {
  const expected = normalizeText(fieldName).toLowerCase();
  const customFields = component.getAllProperties('x-trumba-customfield');

  for (const customField of customFields) {
    const nameParam = normalizeText(customField.getParameter('name')).toLowerCase();

    if (nameParam === expected) {
      return normalizeText(customField.getFirstValue());
    }
  }

  return '';
}

function extractCategories(component) {
  const categoryProperties = component.getAllProperties('categories');
  const categories = [];

  for (const property of categoryProperties) {
    const value = property.getFirstValue();

    if (Array.isArray(value)) {
      for (const innerValue of value) {
        const normalized = normalizeText(String(innerValue));

        if (normalized) {
          categories.push(normalized);
        }
      }
    } else {
      const normalized = normalizeText(String(value ?? ''));

      if (normalized) {
        categories.push(normalized);
      }
    }
  }

  return categories;
}

function extractIcalEvents(icalText) {
  const parsedData = ICAL.parse(icalText);
  const calendar = new ICAL.Component(parsedData);
  const vevents = calendar.getAllSubcomponents('vevent');

  return vevents
    .map((vevent) => {
      const event = new ICAL.Event(vevent);
      const title = normalizeText(event.summary || vevent.getFirstPropertyValue('summary'));
      const date = event.startDate ? event.startDate.toJSDate() : null;
      const endDate = event.endDate ? event.endDate.toJSDate() : null;
      const location = normalizeText(event.location || vevent.getFirstPropertyValue('location'));
      const description = stripHtml(event.description || vevent.getFirstPropertyValue('description'));
      const sourceUrl = toAbsoluteUrl(
        vevent.getFirstPropertyValue('x-trumba-link') || vevent.getFirstPropertyValue('url'),
        CPP_EVENTS_URL
      );
      const eventType = extractTrumbaCustomField(vevent, 'event type');
      const organization = extractTrumbaCustomField(vevent, 'organization');
      const categories = extractCategories(vevent).join(' ');

      if (!title || !sourceUrl || !date) {
        return null;
      }

      return {
        title,
        date,
        endDate: endDate || null,
        location: location || null,
        description: description || null,
        sourceUrl,
        category: inferCategory(title, description, location, categories, eventType, organization)
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
          INSERT INTO events (title, description, category, date, end_date, location, source, source_url)
          VALUES ($1, $2, $3, $4, $5, $6, 'scraped', $7)
          ON CONFLICT (source_url) DO UPDATE
          SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            date = EXCLUDED.date,
            end_date = EXCLUDED.end_date,
            location = EXCLUDED.location,
            source = EXCLUDED.source
        `,
        [event.title, event.description, event.category, event.date, event.endDate, event.location, event.sourceUrl]
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
  const listingResponse = await fetch(CPP_EVENTS_URL, { headers: { 'user-agent': 'CampusConnectScraper/1.0' } });

  if (!listingResponse.ok) {
    throw new Error(`Failed to fetch CPP events listing (${listingResponse.status})`);
  }

  const listingHtml = await listingResponse.text();
  const htmlEvents = extractHtmlEvents(listingHtml);

  let events = htmlEvents;
  let source = 'html';

  if (!events.length) {
    const calendarWebName = extractCalendarWebName(listingHtml);
    const fallbackIcalUrl = calendarWebName
      ? `https://25livepub.collegenet.com/calendars/${calendarWebName}.ics`
      : DEFAULT_ICAL_FEED_URL;

    const icalResponse = await fetch(fallbackIcalUrl, { headers: { 'user-agent': 'CampusConnectScraper/1.0' } });

    if (!icalResponse.ok) {
      throw new Error(`Failed to fetch CPP iCal feed (${icalResponse.status})`);
    }

    const icalText = await icalResponse.text();
    events = extractIcalEvents(icalText);
    source = 'ical';
  }

  const upsertedCount = await upsertEvents(events);

  return {
    source,
    fetchedCount: events.length,
    upsertedCount
  };
}

module.exports = { runScraper };
