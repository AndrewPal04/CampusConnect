import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { EVENTS, NOTIFICATIONS } from '../data/mockData';
import { APP_EVENTS, createEventBus } from '../services/EventBus';

const AppContext = createContext();

export function AppProvider({ children }) {
  // Pre-RSVP event 2 so the demo shows a ticket right away
  const [rsvpedEvents, setRsvpedEvents] = useState(['2']);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);

  // Observer Pattern: single in-memory event bus for app domain events.
  const eventBus = useMemo(() => createEventBus(), []);

  useEffect(() => {
    const unsubscribeRsvpCreated = eventBus.subscribe(
      APP_EVENTS.RSVP_CREATED,
      ({ event }) => {
        setNotifications((prev) => [
          {
            id: `n${Date.now()}`,
            title: 'RSVP Confirmed',
            body: `You're registered for ${event.title}.`,
            time: 'just now',
            icon: '✅',
            read: false,
          },
          ...prev,
        ]);
      }
    );

    const unsubscribeRsvpCancelled = eventBus.subscribe(
      APP_EVENTS.RSVP_CANCELLED,
      ({ event }) => {
        setNotifications((prev) => [
          {
            id: `n${Date.now()}`,
            title: 'RSVP Cancelled',
            body: `You cancelled ${event.title}.`,
            time: 'just now',
            icon: 'ℹ️',
            read: false,
          },
          ...prev,
        ]);
      }
    );

    return () => {
      unsubscribeRsvpCreated();
      unsubscribeRsvpCancelled();
    };
  }, [eventBus]);

  const toggleRsvp = (eventId) => {
    const alreadyIn = rsvpedEvents.includes(eventId);
    const event = EVENTS.find((e) => e.id === eventId);

    setRsvpedEvents((prev) =>
      alreadyIn ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );

    if (!event) {
      return;
    }

    eventBus.publish(
      alreadyIn ? APP_EVENTS.RSVP_CANCELLED : APP_EVENTS.RSVP_CREATED,
      { event }
    );
  };

  const isRsvped = (eventId) => rsvpedEvents.includes(eventId);

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        events: EVENTS,
        rsvpedEvents,
        toggleRsvp,
        isRsvped,
        notifications,
        markAllRead,
        unreadCount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
