-- CampusConnect sample seed data (Cal Poly Pomona events)

BEGIN;

INSERT INTO events (
  title,
  description,
  category,
  date,
  end_date,
  location,
  venue,
  image_url,
  is_free,
  price,
  capacity,
  source,
  source_url
)
SELECT *
FROM (
  VALUES
    (
      'CPP Engineering Expo: Senior Design Showcase',
      'Student teams present capstone prototypes in robotics, sustainability, and embedded systems.',
      'tech',
      '2026-05-14 11:00:00-07'::timestamptz,
      '2026-05-14 14:00:00-07'::timestamptz,
      'Building 9',
      'Engineering Meadow',
      'https://www.cpp.edu/events/engineering-expo-2026.jpg',
      true,
      0::numeric,
      450,
      'manual',
      'https://www.cpp.edu/events/engineering-expo-2026'
    ),
    (
      'Rose Garden Sunset Strings',
      'An evening concert featuring student chamber ensembles and alumni guest artists.',
      'music',
      '2026-09-18 18:30:00-07'::timestamptz,
      '2026-09-18 20:00:00-07'::timestamptz,
      'Rose Garden',
      'Rose Garden Stage',
      'https://www.cpp.edu/events/rose-garden-strings-2026.jpg',
      true,
      0::numeric,
      300,
      'manual',
      'https://www.cpp.edu/events/rose-garden-strings-2026'
    ),
    (
      'Bronco Wellness Run and Stretch',
      'A campus wellness morning with a guided run, mobility session, and hydration booths.',
      'sports',
      '2026-06-06 08:00:00-07'::timestamptz,
      '2026-06-06 10:00:00-07'::timestamptz,
      'CLA',
      'CLA Lawn',
      'https://www.cpp.edu/events/bronco-wellness-run-2026.jpg',
      true,
      0::numeric,
      220,
      'manual',
      'https://www.cpp.edu/events/bronco-wellness-run-2026'
    ),
    (
      'Poly Pantry Community Cookout',
      'Fundraiser cookout with student org booths and live acoustic sets.',
      'food',
      '2026-10-24 17:00:00-07'::timestamptz,
      '2026-10-24 20:00:00-07'::timestamptz,
      'Building 35',
      'Bronco Student Center Plaza',
      'https://www.cpp.edu/events/poly-pantry-cookout-2026.jpg',
      false,
      5::numeric,
      500,
      'manual',
      'https://www.cpp.edu/events/poly-pantry-cookout-2026'
    ),
    (
      'AI Research Lightning Talks at CLA',
      'Faculty and graduate students share rapid-fire updates on applied AI projects.',
      'academic',
      '2026-11-05 16:00:00-08'::timestamptz,
      '2026-11-05 18:00:00-08'::timestamptz,
      'CLA',
      'CLA Tower, Room 98',
      'https://www.cpp.edu/events/ai-lightning-talks-2026.jpg',
      true,
      0::numeric,
      180,
      'manual',
      'https://www.cpp.edu/events/ai-lightning-talks-2026'
    )
) AS seeded_events (
  title,
  description,
  category,
  date,
  end_date,
  location,
  venue,
  image_url,
  is_free,
  price,
  capacity,
  source,
  source_url
)
WHERE NOT EXISTS (
  SELECT 1
  FROM events e
  WHERE e.title = seeded_events.title
    AND e.date = seeded_events.date
);

COMMIT;
