import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { type DbId, GLOBAL_ORG, packId } from '@grabdy/common';
import { isWorkEmail, type OrgRole, orgRoleEnum, type UserStatus } from '@grabdy/contracts';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import type { CookieOptions } from 'express';
import { OAuth2Client } from 'google-auth-library';

import type { JwtMembership, JwtPayload } from '../../common/guards/auth.guard';
import {
  BCRYPT_SALT_ROUNDS,
  JWT_EXPIRY,
  JWT_MAX_AGE_MS,
  OTP_EXPIRY_MINUTES,
  OTP_MAX,
  OTP_MIN,
} from '../../config/constants';
import { InjectEnv } from '../../config/env.config';
import { DbService } from '../../db/db.module';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notification/notification.service';

/**
 * PostgreSQL returns array columns as strings like "{OWNER,ADMIN}".
 * Parse them into proper JS arrays.
 */
function parseRoles(roles: OrgRole[] | string): OrgRole[] {
  if (Array.isArray(roles)) return roles;
  if (typeof roles === 'string') {
    return roles
      .replace(/^\{|\}$/g, '')
      .split(',')
      .filter(Boolean)
      .flatMap((r) => {
        const parsed = orgRoleEnum.safeParse(r);
        return parsed.success ? [parsed.data] : [];
      });
  }
  return [];
}

export const AUTH_TOKEN_EXPIRY = JWT_EXPIRY;
export const AUTH_TOKEN_MAX_AGE_MS = JWT_MAX_AGE_MS;

export function authCookieOptions(nodeEnv: string): CookieOptions {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: AUTH_TOKEN_MAX_AGE_MS,
    path: '/',
  };
}

export interface OrgMembershipData {
  id: DbId<'OrgMembership'>;
  orgId: DbId<'Org'>;
  orgName: string;
  roles: OrgRole[];
}

export interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  memberships: OrgMembershipData[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private db: DbService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private notificationService: NotificationService,
    @InjectEnv('jwtSecret') private readonly jwtSecret: string,
    @InjectEnv('googleClientId') private readonly googleClientId: string
  ) {
    this.googleClient = new OAuth2Client(this.googleClientId);
  }

  private async getUserMemberships(userId: DbId<'User'>): Promise<OrgMembershipData[]> {
    const memberships = await this.db.kysely
      .selectFrom('org.org_memberships')
      .innerJoin('org.orgs', 'org.orgs.id', 'org.org_memberships.org_id')
      .select([
        'org.org_memberships.id',
        'org.org_memberships.org_id',
        'org.org_memberships.roles',
        'org.orgs.name as org_name',
      ])
      .where('org.org_memberships.user_id', '=', userId)
      .execute();

    return memberships.map((m) => ({
      id: m.id,
      orgId: m.org_id,
      orgName: m.org_name,
      roles: parseRoles(m.roles),
    }));
  }

  private generateToken(user: {
    id: DbId<'User'>;
    email: string;
    firstName: string;
    lastName: string;
    memberships: JwtMembership[];
  }): string {
    const payload: Omit<JwtPayload, 'iat'> = {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      memberships: user.memberships,
    };

    // jwt.sign() adds `iat` automatically
    return this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: AUTH_TOKEN_EXPIRY,
    });
  }

  private generateOTP(): string {
    return crypto.randomInt(OTP_MIN, OTP_MAX).toString();
  }

  async getCurrentUser(userId: DbId<'User'>): Promise<UserData | null> {
    const user = await this.db.kysely
      .selectFrom('auth.users')
      .select(['id', 'email', 'first_name', 'last_name', 'status'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) return null;

    const memberships = await this.getUserMemberships(userId);

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      status: user.status,
      memberships,
    };
  }

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<{ user: UserData; token: string }> {
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existing = await this.db.kysely
      .selectFrom('auth.users')
      .select(['id'])
      .where('email', '=', normalizedEmail)
      .executeTakeFirst();

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Transaction: create user -> create org -> create membership with OWNER role
    const result = await this.db.kysely.transaction().execute(async (trx) => {
      const newUser = await trx
        .insertInto('auth.users')
        .values({
          id: packId('User', GLOBAL_ORG),
          email: normalizedEmail,
          first_name: firstName,
          last_name: lastName,
          password_hash: passwordHash,
          email_verified: false,
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // Auto-create an org named after the user
      const newOrg = await trx
        .insertInto('org.orgs')
        .values({
          name: `${firstName}'s Organization`,
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // Create membership with OWNER role
      await trx
        .insertInto('org.org_memberships')
        .values({
          id: packId('OrgMembership', newOrg.id),
          user_id: newUser.id,
          org_id: newOrg.id,
          roles: ['OWNER'],
        })
        .execute();

      return { user: newUser, org: newOrg };
    });

    const memberships = await this.getUserMemberships(result.user.id);
    const jwtToken = this.generateToken({
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.first_name,
      lastName: result.user.last_name,
      memberships: toJwtMemberships(memberships),
    });

    await this.emailService.sendWelcomeEmail(result.user.email, result.user.first_name);
    this.notificationService.notifyNewSignup(result.user.email, result.user.first_name, 'email');

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.first_name,
        lastName: result.user.last_name,
        status: result.user.status,
        memberships,
      },
      token: jwtToken,
    };
  }

  async googleAuth(credential: string): Promise<{ user: UserData; token: string }> {
    const ticket = await this.googleClient.verifyIdToken({
      idToken: credential,
      audience: this.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new BadRequestException('Invalid Google token');
    }

    if (!payload.email_verified) {
      throw new BadRequestException('Google email is not verified');
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    if (!isWorkEmail(email)) {
      throw new BadRequestException('Please use your work email');
    }

    const firstName = payload.given_name || email.split('@')[0];
    const lastName = payload.family_name || '';

    // 1. Look up by google_id (stable across email changes)
    const byGoogleId = await this.db.kysely
      .selectFrom('auth.users')
      .select(['id', 'email', 'first_name', 'last_name', 'status'])
      .where('google_id', '=', googleId)
      .executeTakeFirst();

    if (byGoogleId) {
      const memberships = await this.getUserMemberships(byGoogleId.id);
      const token = this.generateToken({
        id: byGoogleId.id,
        email: byGoogleId.email,
        firstName: byGoogleId.first_name,
        lastName: byGoogleId.last_name,
        memberships: toJwtMemberships(memberships),
      });

      return {
        user: {
          id: byGoogleId.id,
          email: byGoogleId.email,
          firstName: byGoogleId.first_name,
          lastName: byGoogleId.last_name,
          status: byGoogleId.status,
          memberships,
        },
        token,
      };
    }

    // 2. Fall back to email match — link google_id to existing account
    const byEmail = await this.db.kysely
      .selectFrom('auth.users')
      .select(['id', 'email', 'first_name', 'last_name', 'status'])
      .where('email', '=', email)
      .executeTakeFirst();

    if (byEmail) {
      await this.db.kysely
        .updateTable('auth.users')
        .set({ google_id: googleId, email_verified: true, updated_at: new Date() })
        .where('id', '=', byEmail.id)
        .execute();

      const memberships = await this.getUserMemberships(byEmail.id);
      const token = this.generateToken({
        id: byEmail.id,
        email: byEmail.email,
        firstName: byEmail.first_name,
        lastName: byEmail.last_name,
        memberships: toJwtMemberships(memberships),
      });

      return {
        user: {
          id: byEmail.id,
          email: byEmail.email,
          firstName: byEmail.first_name,
          lastName: byEmail.last_name,
          status: byEmail.status,
          memberships,
        },
        token,
      };
    }

    // 3. New user — create user + org + membership
    const result = await this.db.kysely.transaction().execute(async (trx) => {
      const newUser = await trx
        .insertInto('auth.users')
        .values({
          id: packId('User', GLOBAL_ORG),
          email,
          first_name: firstName,
          last_name: lastName,
          password_hash: null,
          google_id: googleId,
          email_verified: true,
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const newOrg = await trx
        .insertInto('org.orgs')
        .values({
          name: `${firstName}'s Organization`,
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('org.org_memberships')
        .values({
          id: packId('OrgMembership', newOrg.id),
          user_id: newUser.id,
          org_id: newOrg.id,
          roles: ['OWNER'],
        })
        .execute();

      return { user: newUser, org: newOrg };
    });

    const memberships = await this.getUserMemberships(result.user.id);
    const jwtToken = this.generateToken({
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.first_name,
      lastName: result.user.last_name,
      memberships: toJwtMemberships(memberships),
    });

    await this.emailService.sendWelcomeEmail(result.user.email, result.user.first_name);
    this.notificationService.notifyNewSignup(result.user.email, result.user.first_name, 'google');

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.first_name,
        lastName: result.user.last_name,
        status: result.user.status,
        memberships,
      },
      token: jwtToken,
    };
  }

  async login(email: string, password: string): Promise<{ user: UserData; token: string }> {
    const user = await this.db.kysely
      .selectFrom('auth.users')
      .select(['id', 'email', 'first_name', 'last_name', 'status', 'password_hash'])
      .where('email', '=', email.toLowerCase())
      .executeTakeFirst();

    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const memberships = await this.getUserMemberships(user.id);
    const token = this.generateToken({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      memberships: toJwtMemberships(memberships),
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        status: user.status,
        memberships,
      },
      token,
    };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.db.kysely
      .selectFrom('auth.users')
      .select(['id', 'first_name'])
      .where('email', '=', email.toLowerCase())
      .executeTakeFirst();

    // Always return success to prevent email enumeration
    if (!user) return;

    // Invalidate any existing password reset tokens
    await this.db.kysely
      .updateTable('auth.auth_tokens')
      .set({ used_at: new Date() })
      .where('user_id', '=', user.id)
      .where('type', '=', 'PASSWORD_RESET')
      .where('used_at', 'is', null)
      .execute();

    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.db.kysely
      .insertInto('auth.auth_tokens')
      .values({
        id: packId('AuthToken', GLOBAL_ORG),
        token: otp,
        type: 'PASSWORD_RESET',
        user_id: user.id,
        expires_at: expiresAt,
      })
      .execute();

    await this.emailService.sendPasswordResetOTP(email, user.first_name, otp);
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const user = await this.db.kysely
      .selectFrom('auth.users')
      .select(['id'])
      .where('email', '=', email.toLowerCase())
      .executeTakeFirst();

    if (!user) {
      throw new BadRequestException('Invalid or expired code');
    }

    const token = await this.db.kysely
      .selectFrom('auth.auth_tokens')
      .selectAll()
      .where('user_id', '=', user.id)
      .where('type', '=', 'PASSWORD_RESET')
      .where('token', '=', otp)
      .where('used_at', 'is', null)
      .where('expires_at', '>', new Date())
      .executeTakeFirst();

    if (!token) {
      throw new BadRequestException('Invalid or expired code');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await this.db.kysely.transaction().execute(async (trx) => {
      await trx
        .updateTable('auth.users')
        .set({ password_hash: passwordHash, updated_at: new Date() })
        .where('id', '=', user.id)
        .execute();

      await trx
        .updateTable('auth.auth_tokens')
        .set({ used_at: new Date() })
        .where('id', '=', token.id)
        .execute();
    });
  }

  async verifySetupToken(token: string): Promise<{ email: string; orgName: string }> {
    const invitation = await this.db.kysely
      .selectFrom('org.org_invitations')
      .innerJoin('org.orgs', 'org.orgs.id', 'org.org_invitations.org_id')
      .select([
        'org.org_invitations.email',
        'org.org_invitations.expires_at',
        'org.orgs.name as org_name',
      ])
      .where('org.org_invitations.token', '=', token)
      .executeTakeFirst();

    if (!invitation) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    if (invitation.expires_at && invitation.expires_at < new Date()) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    return {
      email: invitation.email,
      orgName: invitation.org_name,
    };
  }

  async completeAccount(
    token: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<{ user: UserData; token: string }> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const result = await this.db.kysely.transaction().execute(async (trx) => {
      const invitation = await trx
        .selectFrom('org.org_invitations')
        .selectAll()
        .where('token', '=', token)
        .executeTakeFirst();

      if (!invitation) {
        throw new BadRequestException('Invalid or expired invitation token');
      }

      if (invitation.expires_at && invitation.expires_at < new Date()) {
        throw new BadRequestException('Invalid or expired invitation token');
      }

      const newUser = await trx
        .insertInto('auth.users')
        .values({
          id: packId('User', GLOBAL_ORG),
          email: invitation.email,
          first_name: firstName,
          last_name: lastName,
          password_hash: passwordHash,
          email_verified: true,
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('org.org_memberships')
        .values({
          id: packId('OrgMembership', invitation.org_id),
          user_id: newUser.id,
          org_id: invitation.org_id,
          roles: invitation.roles,
        })
        .execute();

      await trx.deleteFrom('org.org_invitations').where('id', '=', invitation.id).execute();

      return newUser;
    });

    const memberships = await this.getUserMemberships(result.id);
    const jwtToken = this.generateToken({
      id: result.id,
      email: result.email,
      firstName: result.first_name,
      lastName: result.last_name,
      memberships: toJwtMemberships(memberships),
    });

    return {
      user: {
        id: result.id,
        email: result.email,
        firstName: result.first_name,
        lastName: result.last_name,
        status: result.status,
        memberships,
      },
      token: jwtToken,
    };
  }

  async updateProfile(
    userId: DbId<'User'>,
    data: { firstName?: string; lastName?: string }
  ): Promise<{ user: UserData; token: string }> {
    let query = this.db.kysely
      .updateTable('auth.users')
      .set('updated_at', new Date())
      .where('id', '=', userId);

    if (data.firstName !== undefined) {
      query = query.set('first_name', data.firstName);
    }
    if (data.lastName !== undefined) {
      query = query.set('last_name', data.lastName);
    }

    await query.execute();

    const user = await this.getCurrentUser(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const token = this.generateToken({
      id: userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      memberships: toJwtMemberships(user.memberships),
    });

    return { user, token };
  }

  async refreshToken(
    currentPayload: JwtPayload
  ): Promise<{ user: UserData; token: string } | null> {
    const user = await this.db.kysely
      .selectFrom('auth.users')
      .select(['id', 'email', 'first_name', 'last_name', 'status'])
      .where('id', '=', currentPayload.sub)
      .executeTakeFirst();

    if (!user) return null;

    const memberships = await this.getUserMemberships(user.id);
    const jwtMemberships = toJwtMemberships(memberships);

    const token = this.generateToken({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      memberships: jwtMemberships,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        status: user.status,
        memberships,
      },
      token,
    };
  }
}

function toJwtMemberships(memberships: OrgMembershipData[]): JwtMembership[] {
  return memberships.map((m) => ({
    id: m.id,
    roles: m.roles,
  }));
}
