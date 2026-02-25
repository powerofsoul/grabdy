import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { type DbId, dbIdSchema, extractOrgNumericId, GLOBAL_ORG, packId } from '@grabdy/common';
import type { OrgRole } from '@grabdy/contracts';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DbService } from '../../db/db.module';
import { EmailService } from '../email/email.service';

import { AdminApiKeyGuard } from './admin-api-key.guard';

interface CreateAccountBody {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  orgName?: string;
}

interface InviteMemberBody {
  email: string;
  roles: OrgRole[];
}

interface CreateOrgBody {
  name: string;
}

interface AddMemberBody {
  userId: DbId<'User'>;
  roles: OrgRole[];
}

@Controller('admin')
@Public()
@UseGuards(AdminApiKeyGuard)
export class AdminController {
  constructor(
    private db: DbService,
    private emailService: EmailService
  ) {}

  /**
   * Create a user account with an org and OWNER membership.
   * Replaces the public register endpoint.
   */
  @Post('create-account')
  async createAccount(@Body() body: CreateAccountBody) {
    const { email, firstName, lastName, password, orgName } = body;
    const normalizedEmail = email.toLowerCase();

    const existing = await this.db.kysely
      .selectFrom('auth.users')
      .select(['id'])
      .where('email', '=', normalizedEmail)
      .executeTakeFirst();

    if (existing) {
      return { success: false, error: 'Account already exists' };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await this.db.kysely.transaction().execute(async (trx) => {
      const newUser = await trx
        .insertInto('auth.users')
        .values({
          id: packId('User', GLOBAL_ORG),
          email: normalizedEmail,
          first_name: firstName,
          last_name: lastName,
          password_hash: passwordHash,
          email_verified: true,
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const newOrg = await trx
        .insertInto('org.orgs')
        .values({
          name: orgName ?? `${firstName}'s Organization`,
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const membership = await trx
        .insertInto('org.org_memberships')
        .values({
          id: packId('OrgMembership', newOrg.id),
          user_id: newUser.id,
          org_id: newOrg.id,
          roles: ['OWNER'],
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return { user: newUser, org: newOrg, membership };
    });

    return {
      success: true,
      data: {
        userId: result.user.id,
        email: result.user.email,
        firstName: result.user.first_name,
        lastName: result.user.last_name,
        orgId: result.org.id,
        orgName: result.org.name,
        membershipId: result.membership.id,
      },
    };
  }

  /**
   * Invite a member to an org. Creates an invitation that the user
   * redeems via /auth/complete-account.
   */
  @Post('orgs/:orgId/invite')
  async inviteMember(
    @Param('orgId', new ZodValidationPipe(dbIdSchema('Org'))) orgId: DbId<'Org'>,
    @Body() body: InviteMemberBody
  ) {
    const { email, roles } = body;
    const normalizedEmail = email.toLowerCase();

    // Check org exists
    const org = await this.db.kysely
      .selectFrom('org.orgs')
      .select(['id', 'name'])
      .where('id', '=', orgId)
      .executeTakeFirst();

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    // Check if user already exists and is already a member
    const existingUser = await this.db.kysely
      .selectFrom('auth.users')
      .select(['id'])
      .where('email', '=', normalizedEmail)
      .executeTakeFirst();

    if (existingUser) {
      const existingMembership = await this.db.kysely
        .selectFrom('org.org_memberships')
        .select(['id'])
        .where('user_id', '=', existingUser.id)
        .where('org_id', '=', orgId)
        .executeTakeFirst();

      if (existingMembership) {
        return { success: false, error: 'User is already a member of this organization' };
      }

      // Add existing user directly
      await this.db.kysely
        .insertInto('org.org_memberships')
        .values({
          id: packId('OrgMembership', orgId),
          user_id: existingUser.id,
          org_id: orgId,
          roles,
        })
        .execute();

      return { success: true, message: 'User added to organization' };
    }

    // Create invitation for new user
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.db.kysely
      .insertInto('org.org_invitations')
      .values({
        id: packId('OrgInvitation', orgId),
        email: normalizedEmail,
        roles,
        token,
        expires_at: expiresAt,
        org_id: orgId,
      })
      .execute();

    await this.emailService.sendOrgInviteEmail(normalizedEmail, org.name, token);

    return {
      success: true,
      message: 'Invitation sent',
      data: { token, expiresAt: expiresAt.toISOString() },
    };
  }

  /**
   * List all users with their org memberships.
   */
  @Get('users')
  async listUsers() {
    const rows = await this.db.kysely
      .selectFrom('auth.users')
      .leftJoin('org.org_memberships', 'org.org_memberships.user_id', 'auth.users.id')
      .leftJoin('org.orgs', 'org.orgs.id', 'org.org_memberships.org_id')
      .select([
        'auth.users.id',
        'auth.users.email',
        'auth.users.first_name',
        'auth.users.last_name',
        'auth.users.created_at',
        'org.org_memberships.org_id',
        'org.orgs.name as org_name',
        'org.org_memberships.roles',
      ])
      .orderBy('auth.users.created_at', 'asc')
      .execute();

    const usersMap = new Map<
      string,
      {
        userId: DbId<'User'>;
        email: string;
        firstName: string;
        lastName: string;
        createdAt: Date;
        memberships: Array<{ orgId: DbId<'Org'>; orgName: string; roles: unknown }>;
      }
    >();

    for (const r of rows) {
      let entry = usersMap.get(r.id);
      if (!entry) {
        entry = {
          userId: r.id,
          email: r.email,
          firstName: r.first_name,
          lastName: r.last_name,
          createdAt: r.created_at,
          memberships: [],
        };
        usersMap.set(r.id, entry);
      }
      if (r.org_id && r.org_name) {
        entry.memberships.push({ orgId: r.org_id, orgName: r.org_name, roles: r.roles });
      }
    }

    return {
      success: true,
      data: Array.from(usersMap.values()),
    };
  }

  /**
   * List all orgs with member counts.
   */
  @Get('orgs')
  async listOrgs() {
    const orgs = await this.db.kysely
      .selectFrom('org.orgs')
      .leftJoin('org.org_memberships', 'org.org_memberships.org_id', 'org.orgs.id')
      .select([
        'org.orgs.id',
        'org.orgs.name',
        'org.orgs.created_at',
        (eb) => eb.fn.count('org.org_memberships.id').as('member_count'),
      ])
      .groupBy(['org.orgs.id', 'org.orgs.name', 'org.orgs.created_at'])
      .orderBy('org.orgs.created_at', 'asc')
      .execute();

    return {
      success: true,
      data: orgs.map((o) => ({
        orgId: o.id,
        name: o.name,
        createdAt: o.created_at,
        memberCount: Number(o.member_count),
      })),
    };
  }

  /**
   * Create a new org (no user attached).
   */
  @Post('orgs')
  async createOrg(@Body() body: CreateOrgBody) {
    const { name } = body;

    const newOrg = await this.db.kysely
      .insertInto('org.orgs')
      .values({
        name,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      success: true,
      data: {
        orgId: newOrg.id,
        name: newOrg.name,
        createdAt: newOrg.created_at,
      },
    };
  }

  /**
   * Add an existing user to an org.
   */
  @Post('orgs/:orgId/members')
  async addMember(
    @Param('orgId', new ZodValidationPipe(dbIdSchema('Org'))) orgId: DbId<'Org'>,
    @Body() body: AddMemberBody
  ) {
    const { userId, roles } = body;

    const org = await this.db.kysely
      .selectFrom('org.orgs')
      .select(['id'])
      .where('id', '=', orgId)
      .executeTakeFirst();

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    const user = await this.db.kysely
      .selectFrom('auth.users')
      .select(['id'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const existingMembership = await this.db.kysely
      .selectFrom('org.org_memberships')
      .select(['id'])
      .where('user_id', '=', userId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (existingMembership) {
      return { success: false, error: 'User is already a member of this organization' };
    }

    const membership = await this.db.kysely
      .insertInto('org.org_memberships')
      .values({
        id: packId('OrgMembership', extractOrgNumericId(orgId)),
        user_id: user.id,
        org_id: orgId,
        roles,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      success: true,
      data: {
        membershipId: membership.id,
        userId: membership.user_id,
        orgId: membership.org_id,
        roles: membership.roles,
      },
    };
  }
}
