import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null as ReturnType<typeof drizzle> | null }));
vi.mock('../client/current', () => ({ getDbClient: () => ({ drizzle: h.db }) }));
import { listQuickSwitcherCatalog } from '../quickSwitcher';

let sqlite: Database.Database | undefined;
afterEach(() => sqlite?.close());

describe('title catalogue database query', () => {
  it('paginates all visible history and excludes messages, deleted rows and workers', async () => {
    sqlite = new Database(':memory:');
    sqlite.exec(`CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT, working_dir TEXT, workspace_kind TEXT, remote_host_id TEXT, agent_kind TEXT, status TEXT, source TEXT, orca_role TEXT, parent_session_id TEXT, pinned_at INTEGER, user_send_at INTEGER, updated_at INTEGER, created_at INTEGER);
      CREATE TABLE messages (session_id TEXT, rewind_at INTEGER);
      CREATE INDEX messages_session_id_idx ON messages(session_id);`);
    const insert = sqlite.prepare(
      'INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    for (let i = 0; i < 270; i++)
      insert.run(
        String(i).padStart(3, '0'),
        `History ${i}`,
        '/repo',
        'project',
        null,
        'cc',
        i === 269 ? 'archived' : 'active',
        'desktop',
        null,
        null,
        null,
        null,
        i,
        i,
      );
    insert.run(
      'deleted',
      'Deleted',
      '/repo',
      'project',
      null,
      'cc',
      'deleted',
      'desktop',
      null,
      null,
      null,
      null,
      1,
      1,
    );
    insert.run(
      'worker',
      'Worker',
      '/repo',
      'project',
      null,
      'cc',
      'active',
      'desktop',
      'worker',
      null,
      null,
      null,
      1,
      1,
    );
    sqlite.prepare('INSERT INTO messages VALUES (?, NULL)').run('269');
    h.db = drizzle(sqlite);
    const first = await listQuickSwitcherCatalog(null);
    const second = await listQuickSwitcherCatalog(first.nextCursor);
    const third = await listQuickSwitcherCatalog(second.nextCursor);
    expect(first.sessions).toHaveLength(128);
    expect(second.sessions).toHaveLength(128);
    expect(third.sessions).toHaveLength(14);
    expect(third.nextCursor).toBeNull();
    expect(third.sessions.at(-1)).toMatchObject({
      id: '269',
      status: 'archived',
      _count: { messages: 1 },
    });
    expect(first.sessions[0]._count.messages).toBe(0);
    expect(first.sessions[0]).not.toHaveProperty('preview');
  });
});
