import { useCallback, useEffect, useState } from 'react';
import { EVENTS as MOCK_EVENTS } from '../data/mockData';
import { getEvents, getRecommendedEvents } from '../services/api';

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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [recommendedEvents, setRecommendedEvents] = useState([]);
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

      const nextEvents = Array.isArray(response?.events) ? response.events : [];
      setEvents(nextEvents);
      setDemoMode(false);
    } catch (fetchError) {
      setError(fetchError);
      setEvents(applyLocalFilters(MOCK_EVENTS, { category, search, sort }));
      setDemoMode(true);
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
      setRecommendedEvents([]);
    } finally {
      setRecommendedLoading(false);
    }
  }, []);

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
    recommendedEvents,
    recommendedLoading,
    fetchRecommended,
  };
}
