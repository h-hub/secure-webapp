interface JWTPayload {
  id: string;
  email: string;
  sid: string; // session ID
}

interface RefreshJWTPayload {
  id: string;
  email: string;
}

export type { JWTPayload, RefreshJWTPayload };
