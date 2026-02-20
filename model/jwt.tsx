interface JWTPayload {
  id: string;
  email: string;
}

interface RefreshJWTPayload {
  id: string;
  email: string;
}

export type { JWTPayload, RefreshJWTPayload };
