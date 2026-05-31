import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureMigrationsTable() {
  await query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

export async function migrate() {
  await ensureMigrationsTable();

  // Migrations live in packages/db/migrations
  const migrationsDir = path.resolve(__dirname, "../../..", "packages/db/migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const id = file;
    const { rows } = await query("select 1 from schema_migrations where id = $1", [id]);
    if (rows.length) continue;

    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await query("begin");
    try {
      await query(sql);
      await query("insert into schema_migrations(id) values ($1)", [id]);
      await query("commit");
    } catch (err) {
      await query("rollback");
      throw err;
    }
  }
}

