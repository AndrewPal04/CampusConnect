import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';

// Layouts
import AppShell from '@components/layout/AppShell';
import AuthLayout from '@components/layout/AuthLayout';

// Auth pages
import SplashPage    from '@pages/auth/SplashPage';
import LoginPage     from '@pages/auth/LoginPage';
import RegisterPage  from '@pages/auth/RegisterPage';
import InterestsPage from '@pages/auth/InterestsPage';

// Main app pages (protected)
import HomePage          from '@pages/app/HomePage';
import EventDetailPage   from '@pages/app/EventDetailPage';
import MapPage           from '@pages/app/MapPage';
import NotificationsPage from '@pages/app/NotificationsPage';
import ProfilePage       from '@pages/app/ProfilePage';

// Organiser pages (protected + role check)
import DashboardPage   from '@pages/organiser/DashboardPage';
import CreateEventPage from '@pages/organiser/CreateEventPage';
import EditEventPage   from '@pages/organiser/EditEventPage';
import CheckInPage     from '@pages/organiser/CheckInPage';

// Utility
import NotFoundPage from '@pages/NotFoundPage';

// Route guard — redirects to splash if not authenticated
function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return null; // wait for auth state to resolve
  if (!user) return <Navigate to="/" replace />;
  return children;
}

// Route guard — redirects to home if already authenticated
function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return null;
  if (user) return <Navigate to="/home" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* ── Public / Auth routes ── */}
      <Route element={<AuthLayout />}>
        <Route path="/" element={
          <PublicOnlyRoute><SplashPage /></PublicOnlyRoute>
        } />
        <Route path="/login" element={
          <PublicOnlyRoute><LoginPage /></PublicOnlyRoute>
        } />
        <Route path="/register" element={
          <PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>
        } />
        <Route path="/interests" element={
          <ProtectedRoute><InterestsPage /></ProtectedRoute>
        } />
      </Route>

      {/* ── Protected app routes (with bottom nav) ── */}
      <Route element={
        <ProtectedRoute><AppShell /></ProtectedRoute>
      }>
        <Route path="/home"           element={<HomePage />} />
        <Route path="/events/:id"     element={<EventDetailPage />} />
        <Route path="/map"            element={<MapPage />} />
        <Route path="/notifications"  element={<NotificationsPage />} />
        <Route path="/profile"        element={<ProfilePage />} />

        {/* Organiser sub-routes */}
        <Route path="/organiser"             element={<DashboardPage />} />
        <Route path="/organiser/create"      element={<CreateEventPage />} />
        <Route path="/organiser/edit/:id"    element={<EditEventPage />} />
        <Route path="/organiser/checkin/:id" element={<CheckInPage />} />
      </Route>

      {/* ── 404 ── */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
