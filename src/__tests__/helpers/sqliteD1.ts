import { readFileSync } from "fs";
import { resolve } from "path";
import { DatabaseSync } from "node:sqlite";

type Param = number | string | null;

/**
 * In-memory SQLite database with the production schema (db/schema.sql), exposed
 * through the subset of the D1 API used by src/lib/db.ts and the API routes
 * (prepare/bind/run/all/first and batch). Lets tests run the real SQL instead of
 * asserting on mocks.
 * Requires a Node environment: add `// @vitest-environment node` to the test file.
 */
export function createSqliteD1(): { d1: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(resolve(__dirname, "../../../db/schema.sql"), "utf8"));

  const statement = (sql: string, params: Param[]) => ({
    bind: (...next: Param[]) => statement(sql, next),
    run: async () => {
      sqlite.prepare(sql).run(...params);
      return { success: true, results: [], meta: {} };
    },
    all: async () => ({ success: true, results: sqlite.prepare(sql).all(...params), meta: {} }),
    first: async (column?: string) => {
      const row = sqlite.prepare(sql).get(...params);
      return column ? (row?.[column] ?? null) : (row ?? null);
    },
  });

  const d1 = {
    prepare: (sql: string) => statement(sql, []),
    batch: async (stmts: ReturnType<typeof statement>[]) => {
      sqlite.exec("BEGIN");
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        sqlite.exec("COMMIT");
        return out;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };

  return { d1: d1 as unknown as D1Database, sqlite };
}
