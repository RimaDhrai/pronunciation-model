import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;

  const isCefrDone = user.cefrCompleted || user.cefr_completed;

  // Première connexion : rediriger directement vers le test CEFR
  const cefrAllowed = ['/cefr-test', '/profile'];
  if (!isCefrDone && !cefrAllowed.includes(location.pathname)) {
    return <Navigate to="/cefr-test" replace />;
  }

  return children;
}
