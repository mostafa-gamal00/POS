import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { loadEnv } from "./load-env";

export async function withDatabase<T>(
  run: (client: pg.Client) => Promise<T>,
): Promise<T> {
  loadEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is missing. Add the Postgres URI from Supabase → Connect to .env",
    );
  }
  const client = new pg.Client({
    connectionString,
    ssl: connectionString.includes("localhost")
      ? undefined
      : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export async function runSqlFile(
  client: pg.Client,
  directory: string,
  fileName: string,
): Promise<void> {
  const sql = readFileSync(path.join(directory, fileName), "utf8");
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
