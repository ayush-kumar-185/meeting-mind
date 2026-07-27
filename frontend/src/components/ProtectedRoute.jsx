import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-neutral-50">
      <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;

  return children;
}