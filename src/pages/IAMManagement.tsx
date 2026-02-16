/**
 * IAM Management — Legacy redirect wrapper
 * Kept for backward compatibility, redirects to /settings/users.
 */
import { Navigate } from 'react-router-dom';

export default function IAMManagement() {
  return <Navigate to="/settings/users" replace />;
}
