import { INITIAL_ADMIN_SETUP_ID, InitialAdminSetupModel } from "../models/initial-admin-setup.js";
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
  isFirstAdminRegistrationOpen(): Promise<boolean>;
  registerFirstAdmin(emailNormalized: string, passwordHash: string): Promise<AuthUserWithPassword | null>;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === 11000;
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

  async isFirstAdminRegistrationOpen(): Promise<boolean> {
    if (await UserModel.exists({})) return false;
    if (await InitialAdminSetupModel.exists({ _id: INITIAL_ADMIN_SETUP_ID })) return false;
    return true;
  }

  async registerFirstAdmin(
    emailNormalized: string,
    passwordHash: string
  ): Promise<AuthUserWithPassword | null> {
    if (!(await this.isFirstAdminRegistrationOpen())) return null;

    // The singleton marker serializes public signup and the CLI bootstrap flow.
    // Only one request/process can claim this _id at a time.
    try {
      await InitialAdminSetupModel.create({
        _id: INITIAL_ADMIN_SETUP_ID,
        claimedAt: new Date(),
        completedAt: null,
        userId: null
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) return null;
      throw error;
    }

    try {
      // Re-check after claiming the marker to fail closed if a legacy operator
      // or another process created a user before the marker was acquired.
      if (await UserModel.exists({})) {
        await InitialAdminSetupModel.deleteOne({ _id: INITIAL_ADMIN_SETUP_ID }).exec();
        return null;
      }

      let doc;
      try {
        doc = await UserModel.create({
          emailNormalized,
          passwordHash,
          role: "ADMIN",
          isActive: true
        });
      } catch (error) {
        await InitialAdminSetupModel.deleteOne({ _id: INITIAL_ADMIN_SETUP_ID }).exec().catch(() => undefined);
        if (isDuplicateKeyError(error)) return null;
        throw error;
      }

      // User existence independently closes registration if this status update
      // has a transient failure. Never remove the marker after the account exists.
      await InitialAdminSetupModel.updateOne(
        { _id: INITIAL_ADMIN_SETUP_ID },
        { $set: { completedAt: new Date(), userId: doc._id } }
      ).exec().catch(() => undefined);

      return {
        id: String(doc._id),
        email: doc.emailNormalized,
        role: doc.role as AdminRole,
        isActive: doc.isActive,
        passwordHash: doc.passwordHash
      };
    } catch (error) {
      await InitialAdminSetupModel.deleteOne({ _id: INITIAL_ADMIN_SETUP_ID }).exec().catch(() => undefined);
      throw error;
    }
  }
}
