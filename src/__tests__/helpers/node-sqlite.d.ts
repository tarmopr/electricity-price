// Minimal typings for Node's built-in `node:sqlite` (unflagged from Node 22.13), used
// only by test helpers. Delete this file once @types/node >= 22 is installed — it then
// ships these types and this declaration would conflict.
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
