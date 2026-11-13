import { readFile } from 'node:fs/promises';

export const MIGRATIONS = ['0001_initial.sql', '0002_stable_keys_and_checkout.sql'];
/** Apply migration files statement by statement (comment lines stripped). */
export async function migrate(db, files = MIGRATIONS) {
  for (const file of files) {
    const sql = (await readFile(`migrations/${file}`, 'utf8')).split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
}
