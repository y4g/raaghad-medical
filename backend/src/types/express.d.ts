import type { AuthenticatedUser } from '../services/authService';

declare global {
  namespace Express {
    interface Request { currentUser?: AuthenticatedUser; }
  }
}

export {};
