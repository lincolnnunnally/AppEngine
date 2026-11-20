// Just the part of `pg` App Engine uses (src/lib/db/postgres.ts). A local
// declaration instead of @types/pg: that package at the repo root leaks into the
// generated apps CI builds under .app-engine/prove and breaks their typecheck.
declare module "pg" {
  export type PoolConfig = {
    connectionString?: string;
    ssl?: boolean | { rejectUnauthorized?: boolean };
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };

  export class Pool {
    constructor(config?: PoolConfig);
    query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
    on(event: "error", listener: (error: Error) => void): this;
    end(): Promise<void>;
  }

  const pg: { Pool: typeof Pool };
  export default pg;
}
