import { NavLink, Outlet } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/events', label: 'Events' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/orgs', label: 'Orgs' },
  { to: '/users', label: 'Users' },
]

function AdminLayout({ user, onLogout }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="app-title">CampusConnect Admin</h1>
          <p className="app-subtitle">
            Signed in as {user?.name || user?.email || 'Admin'}
          </p>
        </div>

        <button type="button" className="secondary-btn" onClick={onLogout}>
          Log out
        </button>
      </header>

      <nav className="app-nav" aria-label="Admin sections">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <main className="content-area">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
