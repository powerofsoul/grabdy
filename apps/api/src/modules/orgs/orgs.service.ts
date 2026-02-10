import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { OrgRole } from '@db/enums';
import { randomBytes } from 'crypto';

import { type DbId, extractOrgNumericId, packId } from '@fastdex/common';

import { DbService } from '../../db/db.module';
import { EmailService } from '../email/email.service';

function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
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
          id: packId('OrgMembership', extractOrgNumericId(org.id)),
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

  async inviteMember(orgId: DbId<'Org'>, data: { email: string; name: string; roles: OrgRole[] }) {
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
          id: packId('OrgMembership', extractOrgNumericId(orgId)),
          user_id: existingUser.id,
          org_id: org.id,
          roles: data.roles,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return {
        id: membership.id,
        email: normalizedEmail,
        name: data.name,
        roles: data.roles,
        expiresAt: null,
        createdAt: membership.created_at,
      };
    }

    // Create invitation for new user
    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.db.kysely
      .insertInto('org.org_invitations')
      .values({
        id: packId('OrgInvitation', extractOrgNumericId(orgId)),
        email: normalizedEmail,
        name: data.name,
        roles: data.roles,
        token,
        expires_at: expiresAt,
        org_id: org.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await this.emailService.sendOrgInviteEmail(normalizedEmail, data.name, org.name, token);

    return {
      id: invitation.id,
      email: invitation.email,
      name: invitation.name,
      roles: invitation.roles,
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
        'auth.users.name',
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
      name: m.name,
    }));
  }

  async removeMember(orgId: DbId<'Org'>, memberId: DbId<'OrgMembership'>) {
    const membership = await this.db.kysely
      .selectFrom('org.org_memberships')
      .selectAll()
      .where('id', '=', memberId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    await this.db.kysely
      .deleteFrom('org.org_memberships')
      .where('id', '=', memberId)
      .execute();
  }
}
