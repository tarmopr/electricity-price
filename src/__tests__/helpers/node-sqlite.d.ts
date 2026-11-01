// Minimal typings for Node's built-in `node:sqlite` (unflagged from Node 22.13), used
// only by tests. Delete once the installed @types/node ships node:sqlite (this
// declaration would then duplicate it).
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
