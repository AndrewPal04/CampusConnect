import { Outlet } from 'react-router-dom';

/**
 * Wraps auth screens (Splash, Login, Register, Interests).
 * Full-height, no bottom nav, centred app-shell.
 */
export default function AuthLayout() {
  return (
    <div className="app-shell">
      <Outlet />
    </div>
  );
}

