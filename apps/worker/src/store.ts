import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

/** One authoritative local ledger. Every read-modify-write financial operation uses BEGIN IMMEDIATE. */
export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(kind,id));");
  }
  get<T>(kind: string, id: string): T | null {
    const row = this.db.prepare("SELECT data FROM records WHERE kind=? AND id=?").get(kind,id) as {data:string}|undefined;
    return row ? JSON.parse(row.data) as T : null;
  }
  put<T>(kind: string, id: string, value: T): T {
    this.db.prepare("INSERT INTO records(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data").run(kind,id,JSON.stringify(value)); return value;
  }
  list<T>(kind: string): T[] {
    return (this.db.prepare("SELECT data FROM records WHERE kind=? ORDER BY rowid").all(kind) as {data:string}[]).map(r=>JSON.parse(r.data) as T);
  }
  delete(kind: string, id: string): void { this.db.prepare("DELETE FROM records WHERE kind=? AND id=?").run(kind,id); }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const value = fn(); this.db.exec("COMMIT"); return value; } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  next(name: string): number { const n=(this.get<number>("counter",name)??0)+1; this.put("counter",name,n); return n; }
  close(): void { this.db.close(); }
}
