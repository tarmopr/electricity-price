// Minimal typings for Node's built-in `node:sqlite` (Node ≥ 22.5), used only by
// test helpers. The installed @types/node (20.x) predates the module.
declare module "node:sqlite" {
  type SQLValue = number | string | bigint | null | Uint8Array;

  interface StatementSync {
    run(...params: SQLValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    all(...params: SQLValue[]): Record<string, SQLValue>[];
    get(...params: SQLValue[]): Record<string, SQLValue> | undefined;
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
