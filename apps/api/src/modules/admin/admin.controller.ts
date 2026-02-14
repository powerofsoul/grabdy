import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';

import { type DbId, dbIdSchema, GLOBAL_ORG, packId } from '@grabdy/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DbService } from '../../db/db.module';
import type { OrgRole } from '../../db/enums';
import { EmailService } from '../email/email.service';

import { AdminApiKeyGuard } from './admin-api-key.guard';

interface CreateAccountBody {
  email: string;
  name: string;
  password: string;
  orgName?: string;
}

interface InviteMemberBody {
  email: string;
  name: string;
  roles: OrgRole[];
}

@Controller('api/admin')
@Public()
@UseGuards(AdminApiKeyGuard)
export class AdminController {
  constructor(
    private db: DbService,
    private emailService: EmailService,
  ) {}

  /**
   * Create a user account with an org and OWNER membership.
   * Replaces the public register endpoint.
   */
  @Post('create-account')
  async createAccount(@Body() body: CreateAccountBody) {
    const { email, name, password, orgName } = body;
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
          name,
          password_hash: passwordHash,
          email_verified: true,
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const newOrg = await trx
        .insertInto('org.orgs')
        .values({
          name: orgName ?? `${name}'s Organization`,
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
        name: result.user.name,
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
    @Body() body: InviteMemberBody,
  ) {
    const { email, name, roles } = body;
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
        name,
        roles,
        token,
        expires_at: expiresAt,
        org_id: orgId,
      })
      .execute();

    await this.emailService.sendOrgInviteEmail(normalizedEmail, name, org.name, token);

    return {
      success: true,
      message: 'Invitation sent',
      data: { token, expiresAt: expiresAt.toISOString() },
    };
  }
}
