import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';
import { OrgRole } from '@grabdy/contracts';
import { randomBytes } from 'crypto';

import { authLinks } from '../../common/auth-links';
import { INVITE_EXPIRY_MS, INVITE_TOKEN_BYTES } from '../../config/constants';
import { DbService } from '../../db/db.module';
import { EmailService } from '../email/email.service';

function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString('hex');
}

@Injectable()
export class OrgsService {
  constructor(
    private db: DbService,
    private emailService: EmailService
  ) {}

  async create(data: { name: string }, userId: DbId<'User'>) {
    const result = await this.db.kysely.transaction().execute(async (trx) => {
      const org = await trx
        .insertInto('org.orgs')
        .values({
          name: data.name,
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('org.org_memberships')
        .values({
          id: packId('OrgMembership', org.id),
          user_id: userId,
          org_id: org.id,
          roles: ['OWNER'],
        })
        .execute();

      return org;
    });

    return {
      id: result.id,
      name: result.name,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  async findById(id: DbId<'Org'>) {
    const org = await this.db.kysely
      .selectFrom('org.orgs')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return {
      id: org.id,
      name: org.name,
      createdAt: org.created_at,
      updatedAt: org.updated_at,
    };
  }

  async update(id: DbId<'Org'>, data: { name?: string }) {
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (data.name) {
      updates.name = data.name;
    }

    const org = await this.db.kysely
      .updateTable('org.orgs')
      .set(updates)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: org.id,
      name: org.name,
      createdAt: org.created_at,
      updatedAt: org.updated_at,
    };
  }

  async inviteMember(orgId: DbId<'Org'>, data: { email: string; roles: OrgRole[] }) {
    const org = await this.findById(orgId);
    const normalizedEmail = data.email.toLowerCase();

    const existingMembership = await this.db.kysely
      .selectFrom('org.org_memberships')
      .innerJoin('auth.users', 'auth.users.id', 'org.org_memberships.user_id')
      .select(['org.org_memberships.id'])
      .where('org.org_memberships.org_id', '=', orgId)
      .where('auth.users.email', '=', normalizedEmail)
      .executeTakeFirst();

    if (existingMembership) {
      throw new ConflictException('User is already a member of this organization');
    }

    // If user exists, add them directly
    const existingUser = await this.db.kysely
      .selectFrom('auth.users')
      .selectAll()
      .where('email', '=', normalizedEmail)
      .executeTakeFirst();

    if (existingUser) {
      const membership = await this.db.kysely
        .insertInto('org.org_memberships')
        .values({
          id: packId('OrgMembership', orgId),
          user_id: existingUser.id,
          org_id: org.id,
          roles: data.roles,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return {
        id: membership.id,
        email: normalizedEmail,
        roles: data.roles,
        inviteLink: '',
        expiresAt: null,
        createdAt: membership.created_at,
      };
    }

    // Create invitation for new user
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

    const invitation = await this.db.kysely
      .insertInto('org.org_invitations')
      .values({
        id: packId('OrgInvitation', orgId),
        email: normalizedEmail,
        roles: data.roles,
        token,
        expires_at: expiresAt,
        org_id: org.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await this.emailService.sendOrgInviteEmail(normalizedEmail, org.name, token);

    return {
      id: invitation.id,
      email: invitation.email,
      roles: invitation.roles,
      inviteLink: authLinks.completeAccount(token),
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at,
    };
  }

  async getMembers(orgId: DbId<'Org'>) {
    const memberships = await this.db.kysely
      .selectFrom('org.org_memberships')
      .innerJoin('auth.users', 'auth.users.id', 'org.org_memberships.user_id')
      .select([
        'org.org_memberships.id',
        'org.org_memberships.user_id',
        'org.org_memberships.org_id',
        'org.org_memberships.roles',
        'org.org_memberships.created_at',
        'auth.users.email',
        'auth.users.first_name',
        'auth.users.last_name',
      ])
      .where('org.org_memberships.org_id', '=', orgId)
      .execute();

    return memberships.map((m) => ({
      id: m.id,
      userId: m.user_id,
      orgId: m.org_id,
      roles: m.roles,
      createdAt: m.created_at,
      email: m.email,
      firstName: m.first_name,
      lastName: m.last_name,
    }));
  }

  async getPendingInvitations(orgId: DbId<'Org'>) {
    const invitations = await this.db.kysely
      .selectFrom('org.org_invitations')
      .select(['id', 'email', 'roles', 'token', 'expires_at', 'created_at'])
      .where('org_id', '=', orgId)
      .execute();

    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      roles: inv.roles,
      inviteLink: authLinks.completeAccount(inv.token),
      expiresAt: inv.expires_at,
      createdAt: inv.created_at,
    }));
  }

  async revokeInvitation(orgId: DbId<'Org'>, invitationId: DbId<'OrgInvitation'>) {
    const result = await this.db.kysely
      .deleteFrom('org.org_invitations')
      .where('id', '=', invitationId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      throw new NotFoundException('Invitation not found');
    }
  }

  async updateMemberRole(
    orgId: DbId<'Org'>,
    memberId: DbId<'OrgMembership'>,
    roles: OrgRole[],
    requestingUserId: DbId<'User'>
  ) {
    const membership = await this.db.kysely
      .selectFrom('org.org_memberships')
      .innerJoin('auth.users', 'auth.users.id', 'org.org_memberships.user_id')
      .select([
        'org.org_memberships.id',
        'org.org_memberships.user_id',
        'org.org_memberships.org_id',
        'org.org_memberships.roles',
        'org.org_memberships.created_at',
        'auth.users.email',
        'auth.users.first_name',
        'auth.users.last_name',
      ])
      .where('org.org_memberships.id', '=', memberId)
      .where('org.org_memberships.org_id', '=', orgId)
      .executeTakeFirst();

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.user_id === requestingUserId) {
      throw new BadRequestException('Cannot change your own role');
    }

    if (roles.includes('OWNER')) {
      throw new BadRequestException('Cannot assign OWNER role via this endpoint');
    }

    // If removing OWNER from this member, check they're not the last owner
    if (membership.roles.includes('OWNER') && !roles.includes('OWNER')) {
      const ownerCount = await this.db.kysely
        .selectFrom('org.org_memberships')
        .select(this.db.kysely.fn.countAll().as('count'))
        .where('org_id', '=', orgId)
        .where('roles', '@>', ['OWNER'])
        .executeTakeFirstOrThrow();

      if (Number(ownerCount.count) <= 1) {
        throw new BadRequestException('Cannot remove the last owner of the organization');
      }
    }

    const updated = await this.db.kysely
      .updateTable('org.org_memberships')
      .set({ roles })
      .where('id', '=', memberId)
      .where('org_id', '=', orgId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: updated.id,
      userId: updated.user_id,
      orgId: updated.org_id,
      roles: updated.roles,
      createdAt: updated.created_at,
      email: membership.email,
      firstName: membership.first_name,
      lastName: membership.last_name,
    };
  }

  async removeMember(
    orgId: DbId<'Org'>,
    memberId: DbId<'OrgMembership'>,
    requestingUserId: DbId<'User'>
  ) {
    const membership = await this.db.kysely
      .selectFrom('org.org_memberships')
      .selectAll()
      .where('id', '=', memberId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.user_id === requestingUserId) {
      throw new BadRequestException('Cannot remove yourself from the organization');
    }

    if (membership.roles.includes('OWNER')) {
      const ownerCount = await this.db.kysely
        .selectFrom('org.org_memberships')
        .select(this.db.kysely.fn.countAll().as('count'))
        .where('org_id', '=', orgId)
        .where('roles', '@>', ['OWNER'])
        .executeTakeFirstOrThrow();

      if (Number(ownerCount.count) <= 1) {
        throw new BadRequestException('Cannot remove the last owner of the organization');
      }
    }

    await this.db.kysely
      .deleteFrom('org.org_memberships')
      .where('id', '=', memberId)
      .where('org_id', '=', orgId)
      .execute();
  }
}
