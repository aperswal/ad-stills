import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { appConfig } from './config';
import * as schema from '../db/schema';
export const database = () => drizzle(env.DB, { schema });
export const bucket = () => env.FILES;
export const settings = () => appConfig(env);
