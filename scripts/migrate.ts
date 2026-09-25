import { readFileSync } from "node:fs";
import path from "node:path";
import { listSqlFiles } from "./sql-files";
import { withDatabase } from "./db";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

async function migrate(): Promise<void> {
  const files = listSqlFiles(migrationsDir);
  await withDatabase(async (client) => {
    await client.query(`
      create schema if not exists app_private;
      revoke all on schema app_private from public, anon, authenticated;
      create table if not exists app_private.schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      );
    `);
    const applied = await client.query<{ version: string }>(
      "select version from app_private.schema_migrations",
    );
    const done = new Set(applied.rows.map((row) => row.version));
    const pending = files.filter((fileName) => !done.has(fileName));
    if (pending.length === 0) {
      console.log("No pending migrations.");
      return;
    }
    for (const fileName of pending) {
      console.log(`Applying ${fileName}`);
      const sql = readFileSync(path.join(migrationsDir, fileName), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into app_private.schema_migrations (version) values ($1)",
          [fileName],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
    console.log(`Applied ${pending.length} migration(s).`);
  });
}

migrate().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
