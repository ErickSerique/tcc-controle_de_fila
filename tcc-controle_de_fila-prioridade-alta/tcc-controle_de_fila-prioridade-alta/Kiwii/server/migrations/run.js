/**
 * migrations/run.js
 * Executa todas as migrations SQL em ordem.
 * Uso: npm run db:migrate (dentro de /server)
 */
require("dotenv").config({ path: "../.env" });
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const migrationsDir = __dirname;
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`[migrate] Encontradas ${files.length} migration(s).`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`[migrate] Executando: ${file}`);
    try {
      await pool.query(sql);
      console.log(`[migrate] ✓ ${file}`);
    } catch (err) {
      // Ignora erros de "já existe" em modo de desenvolvimento
      if (process.env.NODE_ENV !== "production" && err.code === "42P07") {
        console.warn(`[migrate] ⚠ ${file} — tabela já existe, pulando.`);
      } else {
        console.error(`[migrate] ✗ ${file}: ${err.message}`);
        process.exit(1);
      }
    }
  }

  await pool.end();
  console.log("[migrate] Concluído.");
}

run();
