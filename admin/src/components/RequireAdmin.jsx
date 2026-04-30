import { Navigate, Outlet, useLocation } from 'react-router-dom'

function RequireAdmin({ auth }) {
  const location = useLocation()

  if (!auth?.token || auth?.user?.role !== 'admin') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export default RequireAdmin
