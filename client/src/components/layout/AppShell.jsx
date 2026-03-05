import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import TopBar from './TopBar';

/**
 * Shell for all authenticated app pages.
 * Renders TopBar + scrollable content + sticky BottomNav.
 */
export default function AppShell() {
  return (
    <div className="app-shell">
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto scroll-hide pb-20">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}

