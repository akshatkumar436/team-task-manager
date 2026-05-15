import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingState from '../ui/LoadingState';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState />;
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
