import { ObjectId, UpdateResult, WithId } from "mongodb";
import client from "@/lib/mongodb";
import User from "@/model/user";
import { RefreshToken } from "@/model/refreshToken";

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
}

const mongoService = new MongoService();
export default mongoService;
