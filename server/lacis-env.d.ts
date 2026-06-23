import type { AuthUser } from './src/types';

// Make req.locals.user available and typed in every handler.
declare module 'lacis' {
  interface Locals {
    user: AuthUser;
  }
}
