import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { EVENTS } from '../data/mockData';
import {
  AUTH_TOKEN_KEY,
  cancelRsvp as cancelRsvpRequest,
  fetchMyRsvps as fetchMyRsvpsRequest,
  getNotifications as fetchNotificationsRequest,
  markAllNotificationsRead as markAllNotificationsReadRequest,
  rsvpEvent as rsvpEventRequest,
} from '../services/api';

const AppContext = createContext();

function extractNotifications(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.notifications)) {
    return payload.notifications;
  }

  if (Array.isArray(payload?.data?.notifications)) {
    return payload.data.notifications;
  }

  return [];
}

function normalizeNotification(notification) {
  return {
    id: String(notification.id),
    type: notification.type || 'event_update',
    title: notification.title || 'Notification',
    body: notification.body || '',
    read: Boolean(notification.read),
    eventId: notification.eventId || notification.event_id || null,
    createdAt: notification.createdAt || notification.created_at || null,
  };
}

export function AppProvider({ children }) {
  const [myRsvps, setMyRsvps] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [externalEvents, setExternalEvents] = useState([]);
  const [recommendedEvents, setRecommendedEventsState] = useState([]);

  const events = useMemo(() => {
    const byId = new Map(EVENTS.map((event) => [String(event.id), event]));
    externalEvents.forEach((event) => {
      byId.set(String(event.id), event);
    });
    return Array.from(byId.values());
  }, [externalEvents]);

  const upsertEventOverride = useCallback((eventId, eventOverride) => {
    if (!eventOverride) {
      return;
    }

    setExternalEvents((prev) => {
      const normalizedId = String(eventId);
      const existingIndex = prev.findIndex(
        (item) => String(item.id) === normalizedId
      );

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = { ...prev[existingIndex], ...eventOverride };
        return next;
      }

      return [...prev, { ...eventOverride, id: normalizedId }];
    });
  }, []);

  const replaceRecommendedEvents = useCallback((nextRecommendedEvents) => {
    const normalizedRecommendations = Array.isArray(nextRecommendedEvents)
      ? nextRecommendedEvents.filter(Boolean)
      : [];

    setRecommendedEventsState(normalizedRecommendations);
    setExternalEvents((prev) => {
      const byId = new Map(prev.map((event) => [String(event.id), event]));

      normalizedRecommendations.forEach((event) => {
        if (!event?.id) {
          return;
        }

        const normalizedId = String(event.id);
        byId.set(normalizedId, {
          ...(byId.get(normalizedId) || {}),
          ...event,
          id: normalizedId,
        });
      });

      return Array.from(byId.values());
    });
  }, []);

  const rsvpedEvents = useMemo(
    () => myRsvps.map((rsvp) => String(rsvp.eventId)),
    [myRsvps]
  );

  const isRsvped = useCallback(
    (eventId) => rsvpedEvents.includes(String(eventId)),
    [rsvpedEvents]
  );

  const fetchMyRsvps = useCallback(async () => {
    if (!currentUser) {
      setMyRsvps([]);
      return [];
    }

    const response = await fetchMyRsvpsRequest();
    const nextRsvps = Array.isArray(response?.rsvps) ? response.rsvps : [];

    setMyRsvps(nextRsvps);
    setExternalEvents((prev) => {
      const byId = new Map(prev.map((event) => [String(event.id), event]));

      nextRsvps.forEach((rsvp) => {
        if (!rsvp?.event?.id) {
          return;
        }

        byId.set(String(rsvp.event.id), rsvp.event);
      });

      return Array.from(byId.values());
    });

    return nextRsvps;
  }, [currentUser]);

  const refreshNotifications = useCallback(async () => {
    if (!currentUser) {
      setNotifications([]);
      return [];
    }

    const response = await fetchNotificationsRequest();
    const nextNotifications = extractNotifications(response).map(normalizeNotification);
    setNotifications(nextNotifications);
    return nextNotifications;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setMyRsvps([]);
      return;
    }

    fetchMyRsvps().catch((error) => {
      console.warn('Failed to hydrate RSVP list:', error?.message || error);
    });
  }, [currentUser, fetchMyRsvps]);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    refreshNotifications().catch((error) => {
      console.warn('Failed to hydrate notifications:', error?.message || error);
    });
  }, [currentUser, refreshNotifications]);

  const rsvpEvent = useCallback(
    async (eventId, eventOverride = null) => {
      const normalizedId = String(eventId);
      upsertEventOverride(normalizedId, eventOverride);

      const response = await rsvpEventRequest(normalizedId);
      await fetchMyRsvps();
      await refreshNotifications();

      return response;
    },
    [fetchMyRsvps, refreshNotifications, upsertEventOverride]
  );

  const cancelRsvp = useCallback(
    async (eventId, eventOverride = null) => {
      const normalizedId = String(eventId);

      const response = await cancelRsvpRequest(normalizedId);
      await fetchMyRsvps();
      await refreshNotifications();

      return response;
    },
    [fetchMyRsvps, refreshNotifications]
  );

  const toggleRsvp = useCallback(
    async (eventId, eventOverride = null) => {
      if (isRsvped(eventId)) {
        return cancelRsvp(eventId, eventOverride);
      }

      return rsvpEvent(eventId, eventOverride);
    },
    [cancelRsvp, isRsvped, rsvpEvent]
  );

  const markAllRead = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));

    try {
      await markAllNotificationsReadRequest();
    } catch (error) {
      await refreshNotifications();
      throw error;
    }
  }, [currentUser, refreshNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const logout = async () => {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    setCurrentUser(null);
    setMyRsvps([]);
    setNotifications([]);
    setExternalEvents([]);
    setRecommendedEventsState([]);
  };

  return (
    <AppContext.Provider
      value={{
        events,
        rsvpedEvents,
        myRsvps,
        fetchMyRsvps,
        rsvpEvent,
        cancelRsvp,
        toggleRsvp,
        isRsvped,
        notifications,
        markAllRead,
        refreshNotifications,
        unreadCount,
        currentUser,
        setCurrentUser,
        recommendedEvents,
        setRecommendedEvents: replaceRecommendedEvents,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
