// Augment Express Request with auth fields set by verifyAccessToken middleware
declare namespace Express {
  interface Request {
    /** Authenticated user's ID — set by verifyAccessToken middleware */
    userId: number;
  }
}
