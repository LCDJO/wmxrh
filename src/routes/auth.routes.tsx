/**
 * Auth Routes — Unauthenticated route definitions.
 */
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import Auth from '@/pages/Auth';
import ResetPassword from '@/pages/ResetPassword';

export const authRoutes: RouteObject[] = [
  { path: '/auth/login', element: <Auth /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '*', element: <Navigate to="/auth/login" replace /> },
];
