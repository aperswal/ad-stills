import { describe, expect, it } from 'vitest';
import { deployDatabaseId } from './deploy';

describe('the database a deployed app uses', () => {
  it('is the ID written in the deploy settings', () => {
    const id = '0f9a1c8e-2b3d-4e5f-8a6b-7c8d9e0f1a2b';
    expect(deployDatabaseId({ D1_DATABASE_ID: id })).toBe(id);
  });
  it('is not set when the line is missing or empty', () => {
    expect(deployDatabaseId({})).toBeUndefined();
    expect(deployDatabaseId({ D1_DATABASE_ID: '' })).toBeUndefined();
  });
  it('refuses a value that is not a database ID', () => {
    expect(() => deployDatabaseId({ D1_DATABASE_ID: 'ad-stills' })).toThrow();
  });
});
