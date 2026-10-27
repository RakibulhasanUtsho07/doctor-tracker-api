import { AuthSessionModel } from "../models/auth-session.js";
import { UserModel } from "../models/user.js";

export type AdminRole = "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
}

export interface AuthUserWithPassword extends AuthUser {
  passwordHash: string;
}

export interface AuthSession {
  tokenHash: string;
  userId: string;
  csrfToken: string;
  expiresAt: Date;
}

export interface AuthRepository {
  findUserByEmail(emailNormalized: string): Promise<AuthUserWithPassword | null>;
  findUserById(userId: string): Promise<AuthUser | null>;
  createSession(session: AuthSession): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null>;
  deleteSession(tokenHash: string): Promise<void>;
}

export class MongooseAuthRepository implements AuthRepository {
  async findUserByEmail(emailNormalized: string): Promise<AuthUserWithPassword | null> {
    const doc = await UserModel.findOne({ emailNormalized })
      .select("+passwordHash")
      .lean()
      .exec();
    if (!doc) return null;
    return {
      id: String(doc._id),
      email: doc.emailNormalized,
      role: doc.role as AdminRole,
      isActive: doc.isActive,
      passwordHash: doc.passwordHash
    };
  }

  async findUserById(userId: string): Promise<AuthUser | null> {
    const doc = await UserModel.findById(userId)
      .select("emailNormalized role isActive")
      .lean()
      .exec();
    if (!doc) return null;
    return {
      id: String(doc._id),
      email: doc.emailNormalized,
      role: doc.role as AdminRole,
      isActive: doc.isActive
    };
  }

  async createSession(session: AuthSession): Promise<void> {
    await AuthSessionModel.create({
      tokenHash: session.tokenHash,
      userId: session.userId,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt
    });
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSession | null> {
    const doc = await AuthSessionModel.findOne({ tokenHash })
      .select("+tokenHash +csrfToken")
      .lean()
      .exec();
    if (!doc) return null;
    return {
      tokenHash: doc.tokenHash,
      userId: String(doc.userId),
      csrfToken: doc.csrfToken,
      expiresAt: doc.expiresAt
    };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await AuthSessionModel.deleteOne({ tokenHash }).exec();
  }
}
