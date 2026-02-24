import { ObjectId } from "mongodb";

export interface Session {
	userId: ObjectId;
	csrfToken: string;
	createdAt: Date;
	expiresAt: Date;
	userAgent?: string;
	ipAddress?: string;
	revoked?: boolean;
	revokedAt?: Date;
}