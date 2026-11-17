const knexLib = require("knex");

async function ensureTestDatabase() {
  const url = new URL(process.env.DATABASE_URL);
  const dbName = url.pathname.slice(1);

  const adminUrl = new URL(process.env.DATABASE_URL);
  adminUrl.pathname = "/postgres";

  const admin = knexLib({ client: "pg", connection: adminUrl.toString() });
  try {
    const existing = await admin.raw("SELECT 1 FROM pg_database WHERE datname = ?", [dbName]);
    if (existing.rows.length === 0) {
      await admin.raw("CREATE DATABASE ??", [dbName]);
    }
  } finally {
    await admin.destroy();
  }
}

async function resetDatabase(db) {
  await db.raw("TRUNCATE audit_log, reservations, rooms, buildings, users RESTART IDENTITY CASCADE");
}

module.exports = { ensureTestDatabase, resetDatabase };
