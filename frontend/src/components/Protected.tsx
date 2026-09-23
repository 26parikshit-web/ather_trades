// Route guard — redirects to /login when session missing.
import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';

export default function Protected({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  const init = useAuth((s) => s.init);
  const location = useLocation();

  useEffect(() => {
    void init();
  }, [init]);

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <>{children}</>;
}
