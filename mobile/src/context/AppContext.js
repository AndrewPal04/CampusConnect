import React, { createContext, useContext, useState } from 'react';
import { EVENTS, NOTIFICATIONS } from '../data/mockData';

const AppContext = createContext();

export function AppProvider({ children }) {
  // Pre-RSVP event 2 so the demo shows a ticket right away
  const [rsvpedEvents, setRsvpedEvents] = useState(['2']);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);

  const toggleRsvp = (eventId) => {
    const alreadyIn = rsvpedEvents.includes(eventId);
    setRsvpedEvents((prev) =>
      alreadyIn ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );

    if (!alreadyIn) {
      const event = EVENTS.find((e) => e.id === eventId);
      if (event) {
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
    }
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
