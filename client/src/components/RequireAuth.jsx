import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Gates a route on being logged in. Waits for the initial session check so a
// refresh on a protected page doesn't bounce to /login before the token is
// validated.
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return children;
}

export default RequireAuth;
