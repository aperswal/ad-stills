import { eq, lt, sql } from 'drizzle-orm';
import type { Database } from '../batches/repository';
import { loginAttempts } from '../../db/schema';
import type { AppConfig } from '../../shared/config';
import { AppError, success } from '../../shared/http';
import { addressHash, secretMatches, sessionFor } from './lock';
export async function unlock(db: Database, request: Request, config: AppConfig, passcode: string) {
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const hash = addressHash(request);
  await db.delete(loginAttempts).where(lt(loginAttempts.windowStart, now - window));
  const [counter] = await db
    .insert(loginAttempts)
    .values({ addressHash: hash, windowStart: now, attempts: 1 })
    .onConflictDoUpdate({
      target: loginAttempts.addressHash,
      set: { attempts: sql`${loginAttempts.attempts}+1` },
    })
    .returning();
  if (!counter || counter.attempts > 5)
    throw new AppError(429, 'TOO_MANY_TRIES', 'Too many tries. Wait 15 minutes.');
  if (!secretMatches(passcode, config.APP_PASSCODE))
    throw new AppError(401, 'WRONG_PASSCODE', 'That passcode is not right.');
  await db.delete(loginAttempts).where(eq(loginAttempts.addressHash, hash));
  const response = success({ ok: true });
  const session = await sessionFor(request, response, config);
  session.unlocked = true;
  await session.save();
  return response;
}
