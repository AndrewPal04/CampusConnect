import { NavLink, useLocation } from 'react-router-dom';
import { ROUTES } from '@utils/constants';

const NAV_ITEMS = [
  { to: ROUTES.HOME,          icon: '🏠', label: 'Home' },
  { to: ROUTES.MAP,           icon: '🗺️', label: 'Map' },
  { to: ROUTES.NOTIFICATIONS, icon: '🔔', label: 'Alerts' },
  { to: ROUTES.PROFILE,       icon: '👤', label: 'Profile' },
  { to: ROUTES.ORGANISER,     icon: '📊', label: 'Manage' },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app
                 bg-cream border-t border-[var(--border)] flex z-50"
      style={{ maxWidth: 430 }}
    >
      {NAV_ITEMS.map(({ to, icon, label }) => {
        const isActive = pathname === to || pathname.startsWith(to + '/');
        return (
          <NavLink
            key={to}
            to={to}
            className="flex-1 flex flex-col items-center gap-1 py-2 pt-3 relative"
          >
            <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>
              {icon}
            </span>
            <span
              className={`text-[0.55rem] font-sans font-semibold tracking-wide transition-colors
                          ${isActive ? 'text-navy' : 'text-[var(--muted)]'}`}
            >
              {label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1
                               rounded-full bg-navy" />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

