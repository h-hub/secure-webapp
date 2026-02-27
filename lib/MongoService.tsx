import { ObjectId, UpdateResult, WithId } from "mongodb";
import client from "@/lib/mongodb";
import User from "@/model/user";
import { RefreshToken } from "@/model/refreshToken";
import { Session } from "@/model/session";

class MongoService {
  private async getDb() {
    await client.connect();
    return client.db();
  }

  /**
   * Find a user by email.
   */
  async findUserByEmail(email: string): Promise<WithId<User> | null> {
    const db = await this.getDb();
    const users = db.collection<User>("Users");
    return users.findOne({ email });
  }

  /**
   * Find a user by ObjectId.
   */
  async findUserById(userId: ObjectId): Promise<WithId<User> | null> {
    const db = await this.getDb();
    const users = db.collection<User>("Users");
    return users.findOne({ _id: userId });
  }

  /**
   * Upsert a refresh token for a given user, user-agent, and IP address.
   * If a matching document exists, it is updated; otherwise, a new one is inserted.
   */
  async upsertRefreshToken(
    userId: ObjectId,
    token: string,
    userAgent: string,
    ipAddress: string,
    expiresInMs: number = 1000 * 60 * 60 * 24 * 7, // 7 days
  ): Promise<UpdateResult> {
    const db = await this.getDb();
    const refreshTokens = db.collection("RefreshTokens");

    return refreshTokens.updateOne(
      { userId, userAgent, ipAddress },
      {
        $set: {
          token,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + expiresInMs),
          revoked: false,
          revokedAt: null,
          replacedByToken: null,
        },
      },
      { upsert: true },
    );
  }

  /**
   * Find a refresh token by user ID.
   */
  async findRefreshTokenByUserId(
    userId: ObjectId,
  ): Promise<WithId<RefreshToken> | null> {
    const db = await this.getDb();
    const refreshTokens = db.collection<RefreshToken>("RefreshTokens");
    return refreshTokens.findOne({ userId });
  }

  /**
   * Save a new session for a given user.
   */
  async saveSession(
    userId: ObjectId,
    userAgent: string,
    ipAddress: string,
    csrfToken: string,
    expiresInMs: number = 1000 * 60 * 60 * 24, // 1 day
  ): Promise<ObjectId> {
    const db = await this.getDb();
    const sessions = db.collection<Session>("Sessions");

    const result = await sessions.insertOne({
      userId,
      userAgent,
      ipAddress,
      csrfToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiresInMs),
      revoked: false,
    });

    return result.insertedId;
  }

  /**
   * Find a session by its ObjectId.
   */
  async getSessionById(sessionId: ObjectId): Promise<WithId<Session> | null> {
    const db = await this.getDb();
    const sessions = db.collection<Session>("Sessions");
    return sessions.findOne({ _id: sessionId });
  }

  /**
   * Update the CSRF token for a session by its ObjectId.
   */
  async updateCsrfTokenBySessionId(
    sessionId: ObjectId,
    newCsrfToken: string,
  ): Promise<string> {
    const db = await this.getDb();
    const sessions = db.collection<Session>("Sessions");
    const updateResult = await sessions.updateOne(
      { _id: sessionId },
      { $set: { csrfToken: newCsrfToken } },
    );
    if (updateResult.modifiedCount > 0) {
      return newCsrfToken;
    }
    throw new Error("Failed to update CSRF token for session");
  }

  /**
   * Revoke a session by userId, userAgent, ipAddress, csrfToken.
   */
  async revokeSession(
    userId: ObjectId,
    userAgent: string,
    ipAddress: string,
  ): Promise<UpdateResult> {
    const db = await this.getDb();
    const sessions = db.collection<Session>("Sessions");
    return sessions.updateOne(
      {
        userId,
        userAgent,
        ipAddress,
        revoked: false,
      },
      {
        $set: {
          revoked: true,
          revokedAt: new Date(),
        },
      },
    );
  }
}

const mongoService = new MongoService();
export default mongoService;
