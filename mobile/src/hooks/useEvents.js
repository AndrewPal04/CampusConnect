import { useCallback, useEffect, useState } from 'react';
import { EVENTS as MOCK_EVENTS } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { getEvents, getRecommendedEvents } from '../services/api';

const DEGRADED_EVENTS_MESSAGE = 'Live data temporarily unavailable \u2014 showing cached events.';
const FALLBACK_EVENTS_MESSAGE = 'Live events loading \u2014 showing sample events for now.';

function normalizeCategory(category) {
  if (!category || category === 'All') {
    return null;
  }

  return String(category).toLowerCase();
}

function applyLocalFilters(events, { category, search, sort }) {
  const normalizedCategory = normalizeCategory(category);
  const query = (search || '').trim().toLowerCase();

  const filtered = events.filter((event) => {
    const eventCategory = String(event.category || '').toLowerCase();
    const matchesCategory = !normalizedCategory || eventCategory === normalizedCategory;
    const matchesSearch =
      !query ||
      String(event.title || '').toLowerCase().includes(query) ||
      String(event.org || '').toLowerCase().includes(query) ||
      String(event.location || '').toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  if (sort === 'date_desc') {
    return [...filtered].reverse();
  }

  if (sort === 'popular') {
    return [...filtered].sort((a, b) => (b.rsvpCount || 0) - (a.rsvpCount || 0));
  }

  return filtered;
}

export default function useEvents({
  category = 'All',
  search = '',
  sort = 'date_asc',
  page = 1,
  limit = 20,
} = {}) {
  const { recommendedEvents, setRecommendedEvents } = useApp();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [demoBannerMessage, setDemoBannerMessage] = useState('');
  const [recommendedLoading, setRecommendedLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getEvents({
        category: normalizeCategory(category),
        search,
        sort,
        page,
        limit,
      });

      if (response?.degraded) {
        setEvents(applyLocalFilters(MOCK_EVENTS, { category, search, sort }));
        setDemoMode(true);
        setDemoBannerMessage(DEGRADED_EVENTS_MESSAGE);
        return;
      }

      const nextEvents = Array.isArray(response?.events) ? response.events : [];
      if (nextEvents.length === 0) {
        setEvents(applyLocalFilters(MOCK_EVENTS, { category, search, sort }));
        setDemoMode(true);
        setDemoBannerMessage(FALLBACK_EVENTS_MESSAGE);
        return;
      }

      setEvents(nextEvents);
      setDemoMode(false);
      setDemoBannerMessage('');
    } catch (fetchError) {
      setError(fetchError);
      setEvents(applyLocalFilters(MOCK_EVENTS, { category, search, sort }));
      setDemoMode(true);
      setDemoBannerMessage(FALLBACK_EVENTS_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [category, search, sort, page, limit]);

  const fetchRecommended = useCallback(async () => {
    setRecommendedLoading(true);

    try {
      const response = await getRecommendedEvents();
      const nextRecommended = Array.isArray(response?.events) ? response.events : [];
      setRecommendedEvents(nextRecommended);
    } catch {
      // Keep the last known recommendations to avoid visual flicker on transient failures.
    } finally {
      setRecommendedLoading(false);
    }
  }, [setRecommendedEvents]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    fetchRecommended();
  }, [fetchRecommended]);

  return {
    events,
    loading,
    error,
    refetch,
    demoMode,
    demoBannerMessage,
    recommendedEvents,
    recommendedLoading,
    fetchRecommended,
  };
}

