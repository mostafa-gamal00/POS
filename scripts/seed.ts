import path from "node:path";
import { withDatabase, runSqlFile } from "./db";
import { loadEnv } from "./load-env";
import { readAdminCredentials, seedSuperAdmin } from "./seed-admin";
import { listSqlFiles } from "./sql-files";

const seedersDir = path.join(process.cwd(), "supabase", "seeders");

async function seed(): Promise<void> {
  loadEnv();
  const credentials = readAdminCredentials({
    SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD,
  });
  const files = listSqlFiles(seedersDir);
  await withDatabase(async (client) => {
    for (const fileName of files) {
      console.log(`Seeding ${fileName}`);
      await runSqlFile(client, seedersDir, fileName);
    }
    await seedSuperAdmin(client, credentials);
  });
  console.log(`Ran ${files.length} seeder(s) and confirmed the super admin.`);
}

seed().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
