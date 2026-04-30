export function createEventBus() {
  const observers = new Map();

  const subscribe = (eventName, handler) => {
    const handlers = observers.get(eventName) || new Set();
    handlers.add(handler);
    observers.set(eventName, handlers);

    return () => {
      const currentHandlers = observers.get(eventName);
      if (!currentHandlers) {
        return;
      }

      currentHandlers.delete(handler);
      if (currentHandlers.size === 0) {
        observers.delete(eventName);
      }
    };
  };

  const publish = (eventName, payload) => {
    const handlers = observers.get(eventName);
    if (!handlers) {
      return;
    }

    handlers.forEach((handler) => handler(payload));
  };

  return { subscribe, publish };
}

export const APP_EVENTS = {
  RSVP_CREATED: 'rsvp:created',
  RSVP_CANCELLED: 'rsvp:cancelled',
};
