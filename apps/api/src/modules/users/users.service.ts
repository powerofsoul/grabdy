import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';

import { DbService } from '../../db/db.module';

@Injectable()
export class UsersService {
  constructor(private db: DbService) {}

  async listMembers(orgId: DbId<'Org'>) {
    const memberships = await this.db.kysely
      .selectFrom('org.org_memberships')
      .innerJoin('auth.users', 'auth.users.id', 'org.org_memberships.user_id')
      .select([
        'auth.users.id',
        'auth.users.email',
        'auth.users.name',
        'org.org_memberships.roles',
        'org.org_memberships.created_at',
      ])
      .where('org.org_memberships.org_id', '=', orgId)
      .execute();

    return memberships.map((m) => ({
      id: m.id,
      email: m.email,
      name: m.name,
      roles: m.roles,
      createdAt: m.created_at,
    }));
  }
}
