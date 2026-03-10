#!/usr/bin/env node
/**
 * Cron: desativar usuários expirados (tabela usuarios, banco ANTY).
 * Coloque este arquivo na raiz do repositório do server no Railway.
 * Variável de ambiente: DATABASE_URL (postgresql://...)
 */

const { Pool } = require("pg");

const statementTimeoutMs = Number(process.env.STATEMENT_TIMEOUT_MS) || 30000;
const hardTimeoutMs = Number(process.env.HARD_TIMEOUT_MS) || 60000;
const dryRun = process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";

function log(tag, obj) {
  console.log(JSON.stringify({ [tag]: obj }));
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    log("cron", { fatal: { message: "DATABASE_URL não definido" } });
    process.exit(1);
  }

  log("cron", {
    start: {
      dbHost: dbUrl.replace(/:[^:@]+@/, ":****@").split("/")[0],
      dryRun: !!dryRun,
      statementTimeoutMs,
      hardTimeoutMs,
    },
  });

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    statement_timeout: statementTimeoutMs,
  });

  const hardTimeout = setTimeout(() => {
    log("cron", { fatal: { message: "hardTimeoutMs excedido" } });
    process.exit(1);
  }, hardTimeoutMs);

  try {
    const client = await pool.connect();

    if (dryRun) {
      const { rows } = await client.query(
        `SELECT id, usuario, email, data_expiracao FROM usuarios
         WHERE ativo = true AND data_expiracao IS NOT NULL AND data_expiracao < NOW()`
      );
      log("cron", { dryRun: { count: rows.length, ids: rows.map((r) => r.id) } });
      client.release();
      clearTimeout(hardTimeout);
      await pool.end();
      log("cron", { exit: { code: 0, elapsedMs: 0 } });
      process.exit(0);
      return;
    }

    const res = await client.query(
      `UPDATE usuarios
       SET ativo = false
       WHERE ativo = true
         AND data_expiracao IS NOT NULL
         AND data_expiracao < NOW()
       RETURNING id`
    );

    client.release();
    clearTimeout(hardTimeout);
    await pool.end();

    log("cron", { ok: { updated: res.rowCount || 0 } });
    log("cron", { exit: { code: 0 } });
    process.exit(0);
  } catch (err) {
    clearTimeout(hardTimeout);
    await pool.end().catch(() => {});
    log("cron", {
      fatal: {
        code: err.code,
        message: err.message,
        stack: err.stack,
      },
    });
    process.exit(1);
  }
}

main();
