import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { fetchMyRsvps } from '../services/api';
import { CATEGORY_COLORS, COLORS } from '../theme';

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseUnknownDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const directDate = new Date(trimmed);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const normalizedRange = trimmed.replace(/[–—]/g, '-');
  const rangeMatch = normalizedRange.match(
    /^([A-Za-z]{3,9}\s+\d{1,2})\s*-\s*\d{1,2},\s*(\d{4})$/
  );

  if (rangeMatch) {
    const fallbackDate = new Date(`${rangeMatch[1]}, ${rangeMatch[2]}`);
    if (!Number.isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }
  }

  return null;
}

function parseEventDate(event) {
  const dateFields = [
    event?.startsAt,
    event?.startAt,
    event?.start_date,
    event?.startDate,
    event?.eventDate,
    event?.date,
  ];

  for (const dateField of dateFields) {
    const parsed = parseUnknownDate(dateField);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function hasTimeInfo(value) {
  return typeof value === 'string' && (value.includes('T') || /\d{1,2}:\d{2}/.test(value));
}

function formatEventTime(event) {
  if (typeof event?.time === 'string' && event.time.trim()) {
    return event.time.trim();
  }

  const startSource =
    event?.startsAt || event?.startAt || event?.start_date || event?.startDate || null;
  const endSource = event?.endsAt || event?.endAt || event?.end_date || event?.endDate || null;
  const parsedStart = parseUnknownDate(startSource);
  const parsedEnd = parseUnknownDate(endSource);

  if (!parsedStart || !hasTimeInfo(startSource)) {
    return 'Time TBA';
  }

  if (!parsedEnd || !hasTimeInfo(endSource)) {
    return timeFormatter.format(parsedStart);
  }

  return `${timeFormatter.format(parsedStart)} - ${timeFormatter.format(parsedEnd)}`;
}

function resolveCategoryPalette(rawCategory) {
  if (typeof rawCategory !== 'string') {
    return CATEGORY_COLORS.Default;
  }

  const trimmed = rawCategory.trim();
  if (!trimmed) {
    return CATEGORY_COLORS.Default;
  }

  const titleCase = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}`;
  return CATEGORY_COLORS[trimmed] || CATEGORY_COLORS[titleCase] || CATEGORY_COLORS.Default;
}

function resolveCategoryLabel(rawCategory) {
  if (typeof rawCategory !== 'string' || !rawCategory.trim()) {
    return 'General';
  }

  const trimmed = rawCategory.trim();
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}`;
}

function normalizeRsvpEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      if (entry.event && typeof entry.event === 'object') {
        return entry.event;
      }

      if (entry.eventDetails && typeof entry.eventDetails === 'object') {
        return entry.eventDetails;
      }

      if (entry.rsvp?.event && typeof entry.rsvp.event === 'object') {
        return entry.rsvp.event;
      }

      return entry;
    })
    .filter(Boolean);
}

function extractRsvpEvents(payload) {
  const containers = [payload, payload?.data, payload?.results, payload?.data?.results];

  for (const container of containers) {
    if (Array.isArray(container)) {
      return normalizeRsvpEntries(container);
    }

    if (!container || typeof container !== 'object') {
      continue;
    }

    if (Array.isArray(container.events)) {
      return normalizeRsvpEntries(container.events);
    }

    if (Array.isArray(container.rsvps)) {
      return normalizeRsvpEntries(container.rsvps);
    }

    if (Array.isArray(container.items)) {
      return normalizeRsvpEntries(container.items);
    }
  }

  return [];
}

function mergeEvents(primaryEvents, fallbackEvents) {
  const merged = [];
  const seenKeys = new Set();

  [...(primaryEvents || []), ...(fallbackEvents || [])].forEach((event) => {
    const parsedDate = parseEventDate(event);
    if (!parsedDate) {
      return;
    }

    const dateKey = toDateKey(parsedDate);
    const identifier =
      event?.id ??
      event?._id ??
      `${event?.title || 'event'}-${dateKey}-${event?.time || 'time'}`;
    const dedupeKey = String(identifier);

    if (seenKeys.has(dedupeKey)) {
      return;
    }

    seenKeys.add(dedupeKey);
    merged.push({
      ...event,
      id: identifier,
      category: resolveCategoryLabel(event?.category),
      dateKey,
      eventDate: parsedDate,
    });
  });

  return merged;
}

function buildUpcomingEvents(events) {
  const todayKey = toDateKey(new Date());

  return [...events]
    .filter((event) => event.dateKey >= todayKey)
    .sort((firstEvent, secondEvent) => firstEvent.eventDate - secondEvent.eventDate);
}

function buildMarkedDates(events, selectedDate) {
  const dateColorMap = events.reduce((accumulator, event) => {
    if (!accumulator[event.dateKey]) {
      accumulator[event.dateKey] = new Set();
    }

    const categoryPalette = resolveCategoryPalette(event.category);
    accumulator[event.dateKey].add(categoryPalette.header);
    return accumulator;
  }, {});

  const markedDates = Object.entries(dateColorMap).reduce((accumulator, [dateKey, colorSet]) => {
    const dots = Array.from(colorSet).map((color, index) => ({
      key: `${dateKey}-${index}`,
      color,
    }));

    accumulator[dateKey] = { dots };
    return accumulator;
  }, {});

  if (selectedDate) {
    const selectedEntry = markedDates[selectedDate] || { dots: [] };
    markedDates[selectedDate] = {
      ...selectedEntry,
      selected: true,
      selectedColor: COLORS.ink,
      selectedTextColor: COLORS.cream,
    };
  }

  return markedDates;
}

export default function CalendarScreen({ navigation }) {
  const { events, rsvpedEvents } = useApp();
  const [apiRsvpEvents, setApiRsvpEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const contextRsvpEvents = useMemo(() => {
    const rsvpIds = new Set((rsvpedEvents || []).map((eventId) => String(eventId)));
    return (events || []).filter((event) => rsvpIds.has(String(event.id)));
  }, [events, rsvpedEvents]);

  useEffect(() => {
    let isMounted = true;
    const hasContextFallback = contextRsvpEvents.length > 0;

    const loadMyRsvps = async () => {
      try {
        const payload = await fetchMyRsvps();
        const remoteEvents = extractRsvpEvents(payload);

        if (isMounted) {
          setApiRsvpEvents(remoteEvents);
          setFetchError('');
        }
      } catch (error) {
        if (isMounted && !hasContextFallback) {
          setFetchError(error.message || 'Unable to refresh RSVPs.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadMyRsvps();

    return () => {
      isMounted = false;
    };
  }, [contextRsvpEvents.length]);

  const upcomingEvents = useMemo(() => {
    const mergedEvents = mergeEvents(apiRsvpEvents, contextRsvpEvents);
    return buildUpcomingEvents(mergedEvents);
  }, [apiRsvpEvents, contextRsvpEvents]);

  useEffect(() => {
    if (selectedDate) {
      return;
    }

    const firstUpcomingDate = upcomingEvents[0]?.dateKey;
    setSelectedDate(firstUpcomingDate || toDateKey(new Date()));
  }, [selectedDate, upcomingEvents]);

  const markedDates = useMemo(
    () => buildMarkedDates(upcomingEvents, selectedDate),
    [upcomingEvents, selectedDate]
  );

  const selectedDayEvents = useMemo(
    () => upcomingEvents.filter((event) => event.dateKey === selectedDate),
    [upcomingEvents, selectedDate]
  );

  const navigateToEventsTab = () => {
    const tabNavigator = navigation.getParent();

    if (tabNavigator) {
      tabNavigator.navigate('Events');
      return;
    }

    navigation.navigate('Events');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient
        colors={[COLORS.ink, '#1b2438']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>My Events</Text>
        <Text style={styles.headerSub}>Upcoming RSVPs in your calendar</Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.calendarCard}>
          <Calendar
            markingType="multi-dot"
            markedDates={markedDates}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            enableSwipeMonths
            theme={{
              calendarBackground: COLORS.white,
              monthTextColor: COLORS.ink,
              arrowColor: COLORS.amber,
              textSectionTitleColor: '#7a4400',
              dayTextColor: COLORS.ink,
              textDisabledColor: '#c5bfb4',
              todayTextColor: COLORS.blueMid,
              textDayFontWeight: '600',
              textMonthFontWeight: '800',
              textDayHeaderFontWeight: '700',
            }}
          />
        </View>

        {fetchError ? (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={16} color="#8a1f1f" />
            <Text style={styles.warningText}>{fetchError}</Text>
          </View>
        ) : null}

        <View style={styles.dayHeader}>
          <Text style={styles.dayHeaderTitle}>Events on {selectedDate || toDateKey(new Date())}</Text>
          <Text style={styles.dayHeaderSub}>{selectedDayEvents.length} planned</Text>
        </View>

        {loading && upcomingEvents.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.amber} />
          </View>
        ) : null}

        {!loading && selectedDayEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={34} color={COLORS.gray} />
            <Text style={styles.emptyStateText}>
              No events on this day — browse events to RSVP!
            </Text>
            <TouchableOpacity style={styles.browseBtn} onPress={navigateToEventsTab}>
              <Ionicons name="compass-outline" size={16} color={COLORS.cream} />
              <Text style={styles.browseBtnText}>Browse Events</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {selectedDayEvents.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {selectedDayEvents.map((event) => {
              const categoryPalette = resolveCategoryPalette(event.category);

              return (
                <TouchableOpacity
                  key={String(event.id)}
                  style={styles.eventChip}
                  onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
                  activeOpacity={0.86}
                >
                  <View style={styles.chipBadgeRow}>
                    <View
                      style={[
                        styles.colorBadge,
                        { backgroundColor: categoryPalette.header },
                      ]}
                    />
                    <Text
                      style={[
                        styles.chipCategory,
                        { color: categoryPalette.text },
                      ]}
                    >
                      {event.category}
                    </Text>
                  </View>

                  <Text style={styles.chipTitle} numberOfLines={2}>
                    {event.title}
                  </Text>

                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={14} color={COLORS.gray} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {formatEventTime(event)}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={14} color={COLORS.gray} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {event.location || 'Location TBA'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.amber,
  },
  headerTitle: {
    color: COLORS.amber,
    fontSize: 20,
    fontWeight: '800',
  },
  headerSub: {
    color: '#b6bfce',
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 36,
  },
  calendarCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 9,
    elevation: 3,
  },
  warningBanner: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#f0c4c4',
    borderRadius: 10,
    backgroundColor: COLORS.redLight,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    color: '#8a1f1f',
    fontSize: 12,
    flex: 1,
  },
  dayHeader: {
    marginTop: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  dayHeaderTitle: {
    color: COLORS.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  dayHeaderSub: {
    color: COLORS.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 42,
  },
  emptyState: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 22,
    gap: 10,
  },
  emptyStateText: {
    color: COLORS.gray,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  browseBtn: {
    marginTop: 2,
    backgroundColor: COLORS.blue,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  browseBtnText: {
    color: COLORS.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  chipsRow: {
    paddingVertical: 4,
    gap: 12,
  },
  eventChip: {
    width: 248,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 2,
  },
  chipBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  colorBadge: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  chipCategory: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chipTitle: {
    color: COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
    marginBottom: 9,
    minHeight: 38,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  metaText: {
    color: '#555',
    fontSize: 12,
    flex: 1,
  },
});
