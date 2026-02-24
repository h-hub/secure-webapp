import { ObjectId } from "mongodb";

export interface RefreshToken {
  token: string;
  userId: ObjectId;
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
  revoked?: boolean;
  revokedAt?: Date;
  replacedByToken?: string;
  userAgent?: string;
  ipAddress?: string;
}
