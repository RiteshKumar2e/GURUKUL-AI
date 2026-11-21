import { like } from 'drizzle-orm';
import { db } from '../src/db/client';
import { users } from '../src/db/schema';
import { userRepository } from '../src/repositories/userRepository';

/** Deletes every test user whose username starts with the prefix, with all their data. */
export async function deleteUsersWithPrefix(prefix: string) {
  const rows = await db.select({ id: users.id }).from(users).where(like(users.username, `${prefix}%`));
  for (const r of rows) await userRepository.delete(r.id);
}
