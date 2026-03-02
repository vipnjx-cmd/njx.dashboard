const { app, BrowserWindow, ipcMain, Menu, shell } = require("electron");
const path = require("path");
const dotenv = require("dotenv");

// dev vs build
if (app.isPackaged) {
  // quando estiver empacotado, o .env vai estar em process.resourcesPath
  dotenv.config({ path: path.join(process.resourcesPath, ".env") });
} else {
  // em desenvolvimento, lê o .env da pasta do projeto
  dotenv.config();
}

let mainWindow = null;
let isAuthenticated = false;

// admin logado + intervalo de verificação
let currentAdminId = null;
let adminStatusInterval = null;
function ensureAuthenticated() {
    if (!isAuthenticated || !currentAdminId) {
        throw new Error("Acesso negado: administrador não autenticado.");
    }
}

const { Pool } = require("pg");

// =========================
// 🔌 Conexão com Postgres
// =========================
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definido. Verifique seu .env.");
}

const antyPool = new Pool({
    connectionString: process.env.ANTY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// =========================
// 🔧 Helpers
// =========================
function normalizePhone(raw) {
  if (!raw) return null;
  let phone = raw.trim().replace(/[\s()-]/g, "");
  if (!phone.startsWith("+")) {
    if (phone.startsWith("55")) phone = "+" + phone;
    else phone = "+55" + phone;
  }
  return phone;
}
function stripCountry55(raw) {
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, "");
    if (!digits) return null;
    return digits.replace(/^55/, "");
}
function generateKey(len = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// =========================
// 🪟 Janela
// =========================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Abre primeiro a tela de login
  mainWindow.loadFile("login.html");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
     Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (adminStatusInterval) {
    clearInterval(adminStatusInterval);
    adminStatusInterval = null;
  }

  if (process.platform !== "darwin") app.quit();
});

// =========================
// 👮‍♂️ Watcher de status do admin
// =========================
function startAdminStatusWatcher(adminId) {
  // limpa intervalo anterior, se tiver
  if (adminStatusInterval) {
    clearInterval(adminStatusInterval);
    adminStatusInterval = null;
  }

  currentAdminId = adminId;

  adminStatusInterval = setInterval(async () => {
    try {
      if (!currentAdminId) return;

      const { rows } = await antyPool.query(
        "SELECT ativo FROM public.panel_admins WHERE id = $1",
        [currentAdminId]
      );

      const admin = rows[0];

      // se não achar o admin ou estiver inativo, fecha tudo
      if (!admin || admin.ativo === false) {
        console.log("Admin desativado/removido, fechando o app...");

        isAuthenticated = false;
        currentAdminId = null;

        if (adminStatusInterval) {
          clearInterval(adminStatusInterval);
          adminStatusInterval = null;
        }

        if (mainWindow) {
          mainWindow.close(); // vai cair no window-all-closed e dar app.quit()
        } else {
          app.quit();
        }
      }
    } catch (err) {
      console.error("Erro ao checar status do admin:", err);
      // aqui eu só loguei o erro; se quiser, também pode fechar o app em caso de erro repetido
    }
  }, 5000); // 5000 ms = 5 segundos
}

// =========================
// 🔐 ADMIN LOGIN (usa ANTY_DATABASE_URL)
// =========================
ipcMain.handle(
  "admin-login",
    async (event, { username, password, remember } = {}) => {
    try {
      if (!username || !password) {
        return { success: false, error: "Preencha usuário e senha." };
      }

      const sql = `
        SELECT id, username, password, ativo
        FROM public.panel_admins
        WHERE username = $1
        LIMIT 1
      `;

      // 👉 AQUI É O PULO DO GATO: usa antyPool (ANTY_DATABASE_URL)
      const { rows } = await antyPool.query(sql, [username]);
      const admin = rows[0];

      if (!admin) {
        return { success: false, error: "Usuário ou senha inválidos." };
      }

      // checa se está ativo no banco
      if (admin.ativo === false) {
        return {
          success: false,
          error:
            "Este administrador está desativado. Fale com o responsável pelo painel.",
        };
      }

            // senha em texto puro (depois dá pra trocar pra hash)
      if (admin.password !== password) {
        return { success: false, error: "Usuário ou senha inválidos." };
      }

      isAuthenticated = true;

      // começa a vigiar esse admin no banco
      startAdminStatusWatcher(admin.id);

      // após login, vai pro painel principal
      if (mainWindow) {
        await mainWindow.loadFile("index.html");
      }

      return { success: true, adminId: admin.id, username: admin.username };
    } catch (err) {
      console.error("Erro no admin-login:", err);
      return {
        success: false,
        error: "Erro interno ao fazer login.",
      };
    }
  }
);


// =========================
// 🌐 Navegação VIP <-> ANTY
// =========================
ipcMain.handle("open-anty", async () => {
    ensureAuthenticated();
  if (!mainWindow) return;
  if (!isAuthenticated) {
    // opcional: poderia até forçar voltar pro login
    await mainWindow.loadFile("login.html");
    return;
  }
  await mainWindow.loadFile("anty.html");
});

ipcMain.handle("open-vip", async () => {
    ensureAuthenticated();
  if (!mainWindow) return;
  if (!isAuthenticated) {
    await mainWindow.loadFile("login.html");
    return;
  }
  await mainWindow.loadFile("index.html");
});


// =========================
// 🔑 KEYS – listar / criar
// =========================

// Listar keys (usado pelo painel)
ipcMain.handle(
    "get-keys",
    async (event, { planType, redeemed, search } = {}) => {
        ensureAuthenticated();
        let where = [];
        let params = [];
        let i = 1;

        // filtro de plano
        if (planType && planType !== "ALL") {
            where.push(`plan_type = $${i++}`);
            params.push(planType);
        }

        // filtro se foi usada ou não
        if (redeemed === "USED") {
            where.push(`redeemed = true`);
        } else if (redeemed === "UNUSED") {
            where.push(`COALESCE(redeemed, false) = false`);
        }

        // filtro por texto
        if (search && search.trim() !== "") {
            where.push(`key_text ILIKE '%' || $${i++} || '%'`);
            params.push(search.trim());
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const sql = `
      SELECT
        id,
        key_text,
        duration_days,
        redeemed,
        redeemed_by_user,
        redeemed_at,
        expires_at,
        created_at,
        plan_type
      FROM license_keys_unified
      ${whereSql}
      ORDER BY created_at DESC
    `;

        const { rows } = await pool.query(sql, params);
        return rows;
    }
);

// Listar keys com filtros
ipcMain.handle(
    "create-keys",
    async (event, { planType, quantity, baseText, random, durationDays, keyType }) => {
        ensureAuthenticated();

        if (!planType) throw new Error("Plano obrigatório");

        quantity = Number(quantity) || 1;
        if (quantity < 1) quantity = 1;

        durationDays = Number(durationDays) || 30;

        const created = [];

        for (let i = 0; i < quantity; i++) {

            const keyText =
                random || !baseText
                    ? generateKey(8)
                    : `${baseText}${i ? `_${i + 1}` : ""}`;

            // 1️⃣ Inserir no painel normal
            const sql = `
  INSERT INTO license_keys_unified
    (key_text, duration_days, redeemed, redeemed_by_user, redeemed_at, expires_at, created_at, plan_type)
  VALUES
    ($1, $2, false, NULL, NULL, NULL, NOW(), $3)
  RETURNING *
`;

            const { rows } = await pool.query(sql, [
                keyText,
                durationDays,
                planType
            ]);

            const keyCreated = rows[0];
            created.push(keyCreated);

            // 2️⃣ CASO SEJA VIP GOLD → sincronia com NJX ANTY
            if (String(planType).toLowerCase() === "vip_gold") {

                const antyPlanType = String(keyType).toUpperCase();
                // PREMIUM ou LIMITADO

                const antySQL = `
          INSERT INTO login_keys (chave, criado_em, validade_dias, plan_type)
          VALUES ($1, NOW(), $2, $3)
        `;

                await antyPool.query(antySQL, [
                    keyText,
                    durationDays,
                    antyPlanType
                ]);
            }

        } // FOR

        return created;

    }
);

// Exportar keys (para download CSV)
ipcMain.handle(
    "export-keys",
    async (
        event,
        { from, to, planType, redeemed, search } = {}
    ) => {
        ensureAuthenticated();
        let where = [];
        let params = [];
        let i = 1;

        if (planType && planType !== "ALL") {
            where.push(`plan_type = $${i++}`);
            params.push(planType);
        }

        if (redeemed === "USED") {
            where.push(`redeemed = true`);
        } else if (redeemed === "UNUSED") {
            where.push(`COALESCE(redeemed, false) = false`);
        }

        if (search && search.trim() !== "") {
            where.push(`key_text ILIKE '%' || $${i++} || '%'`);
            params.push(search.trim());
        }

        if (from) {
            where.push(`created_at >= $${i++}`);
            params.push(new Date(from));
        }

        if (to) {
            where.push(`created_at <= $${i++}`);
            params.push(new Date(to));
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const sql = `
      SELECT
        id,
        key_text,
        duration_days,
        redeemed,
        redeemed_by_user,
        redeemed_at,
        expires_at,
        created_at,
        plan_type
      FROM license_keys_unified
      ${whereSql}
      ORDER BY created_at DESC
    `;

        const { rows } = await pool.query(sql, params);
        return rows;
    }
);

ipcMain.handle("delete-blacklist", async (event, id) => {
    ensureAuthenticated();
    if (!id) throw new Error("ID obrigatório");

    const sqlDelete = `
    DELETE FROM vip_blacklist
    WHERE id = $1
    RETURNING *
  `;
    const { rows } = await pool.query(sqlDelete, [id]);
    const blRow = rows[0];

    if (blRow && blRow.phone_number) {
        await pool.query(
            `UPDATE users_unified
       SET removed = NULL
       WHERE phone_number = $1 AND removed = 'blacklist'`,
            [blRow.phone_number]
        );
    }

    return blRow;
});

// Criar keys em massa

// =========================
// 👥 USERS – listar + flag
// =========================
ipcMain.handle("get-users", async () => {
    ensureAuthenticated();

    try {
        // 1) Busca usuários no banco do VIP
        const sql = `
      SELECT
        u.id,
        u.telegram_id,
        u.telegram_username,
        u.telegram_name,
        u.phone_number,
        u.discord_id,
        u.discord_username,
        u.expires_at,
        u.created_at,
        u.ativo,
        u.removed,
        COALESCE(f.marked, false) AS marked,
        (
          SELECT key_text
          FROM license_keys_unified lk
          WHERE lk.redeemed_by_user = u.id
          ORDER BY lk.redeemed_at DESC
          LIMIT 1
        ) AS last_key_text,
        EXISTS (
          SELECT 1 FROM license_keys_unified lk
          WHERE lk.redeemed_by_user = u.id
            AND LOWER(lk.plan_type) = 'delay'
            AND (lk.expires_at IS NULL OR lk.expires_at > NOW())
        ) AS has_discord
      FROM users_unified u
      LEFT JOIN panel_user_flags f ON f.user_id = u.id
      ORDER BY u.created_at DESC
      LIMIT 50000
    `;

        const { rows } = await pool.query(sql);

        // se não tem usuários, só retorna
        if (!rows.length) {
            return rows;
        }

        // 2) Normaliza telefones do VIP
        const vipPhones = rows
            .map((u) => ({
                vipId: u.id,
                phoneNorm: stripCountry55(u.phone_number),
            }))
            .filter((x) => !!x.phoneNorm);

        if (!vipPhones.length) {
            // ninguém tem telefone → não tem como cruzar com ANTY
            return rows.map((u) => ({
                ...u,
                has_anty: false,
                anty_user_id: null,
                anty_active: false,
                ip_access: null,
            }));
        }

        // 3) Mapa telefone(normalizado) -> id do usuário ANTY
        const antyUserByPhone = new Map();

        try {
            const { rows: antyRows } = await antyPool.query(`
            SELECT id, email, ativo
            FROM usuarios
            WHERE email IS NOT NULL AND email <> ''
        `);

            for (const r of antyRows) {
                const norm = stripCountry55(r.email);
                if (!norm) continue;

                // se tiver duplicado, mantemos o primeiro
                if (!antyUserByPhone.has(norm)) {
                    antyUserByPhone.set(norm, { id: r.id, ativo: !!r.ativo });
                }
            }
        } catch (err) {
            console.error("Erro ao buscar usuarios no ANTY:", err);
        }

        // 4) Lista de IDs ANTY que correspondem a algum telefone do VIP
        const antyIds = Array.from(
            new Set(
                vipPhones
                    .map((v) => antyUserByPhone.get(v.phoneNorm)?.id)
                    .filter((id) => !!id)
            )
        );

        // 5) Busca IPs na allowed_ips usando user_id do ANTY
        let ipMap = new Map();

        if (antyIds.length) {
            const ipSql = `
    SELECT
      user_id,
      string_agg(ai.ip_address::text, ', ' ORDER BY ai.id) AS ip_access
    FROM allowed_ips ai
    WHERE ai.user_id = ANY($1::int[])
    GROUP BY user_id
  `;

            const { rows: ipRows } = await antyPool.query(ipSql, [antyIds]);

            ipMap = new Map(
                ipRows.map((r) => [String(r.user_id), r.ip_access])
            );
        }

        // 6) Monta resultado final: VIP + has_anty + ip_access
        const merged = rows.map((u) => {
            const phoneNorm = stripCountry55(u.phone_number);
            const antyUser = phoneNorm
                ? antyUserByPhone.get(phoneNorm)
                : null;

            const antyUserId = antyUser ? antyUser.id : null;
            const anty_active = !!(antyUser && antyUser.ativo);

            const has_anty = !!antyUserId;
            const ip_access = antyUserId
                ? ipMap.get(String(antyUserId)) || null
                : null;

            return {
                ...u,
                has_anty,
                anty_user_id: antyUserId,
                anty_active,
                ip_access,
            };
        });

        return merged;
    } catch (err) {
        console.error("Erro em get-users:", err);
        throw err;
    }
});


// Toggle certinho/xizinho
ipcMain.handle("toggle-user-flag", async (event, { userId, newValue }) => {
    ensureAuthenticated();
  const sql = `
    INSERT INTO panel_user_flags (user_id, marked)
    VALUES ($1, $2)
    ON CONFLICT (user_id)
    DO UPDATE SET marked = EXCLUDED.marked
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [userId, newValue]);
  return rows[0];
});

// =========================
// 🚫 BLACKLIST
// =========================

// Listar blacklist ativa
ipcMain.handle("get-blacklist", async () => {
    ensureAuthenticated();
  const sql = `
    SELECT id, phone_number, reason, created_at, created_by, active
    FROM vip_blacklist
    ORDER BY created_at DESC
    LIMIT 5000
  `;
  const { rows } = await pool.query(sql);
  return rows;
});

// Ativar / desativar blacklist (banir / desbanir) + atualizar removed nos usuários
ipcMain.handle("set-blacklist-active", async (event, { id, active }) => {
    ensureAuthenticated();
  if (!id) throw new Error("ID obrigatório");

  const newActive = !!active;

  // Atualizar a entrada da blacklist
  const sqlUpdate = `
    UPDATE vip_blacklist
    SET active = $1
    WHERE id = $2
    RETURNING *
  `;
  const { rows } = await pool.query(sqlUpdate, [newActive, id]);
  const blRow = rows[0];

  if (!blRow) return null;

  // DESBANIR → limpar removed
  if (!newActive && blRow.phone_number) {
    await pool.query(
      `
      UPDATE users_unified
      SET removed = NULL
      WHERE phone_number = $1
        AND removed = 'blacklist'
      `,
      [blRow.phone_number]
    );
  }

  // BANIR → marcar removed = 'blacklist'
  if (newActive && blRow.phone_number) {
    await pool.query(
      `
      UPDATE users_unified
      SET removed = 'blacklist'
      WHERE phone_number = $1
    `,
      [blRow.phone_number]
    );
  }

  return blRow;
});

// Adicionar número à blacklist
ipcMain.handle("add-blacklist", async (event, { phone, reason, createdBy }) => {
    ensureAuthenticated();
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error("Número inválido");

  const sql = `
    INSERT INTO vip_blacklist (phone_number, reason, created_at, created_by, active)
    VALUES ($1, $2, NOW(), $3, true)
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [
    normalized,
    reason || null,
    createdBy || "painel",
  ]);
  return rows[0];
});

// =========================
// 🌐 Abrir links no sistema (Whats / Telegram)
// =========================
ipcMain.handle("open-external", async (event, url) => {
    ensureAuthenticated();
  if (!url) return;
  await shell.openExternal(url);
});

// Apagar uma key individual
ipcMain.handle("delete-key", async (event, id) => {
    ensureAuthenticated();
  if (!id) throw new Error("ID da key obrigatório");
  const res = await pool.query(
    "DELETE FROM license_keys_unified WHERE id = $1",
    [id]
  );
  return { success: true, affected: res.rowCount };
});

// Apagar TODAS as keys NÃO usadas (respeita filtro de plano)
ipcMain.handle("delete-unused-keys", async (event, { planType } = {}) => {
    ensureAuthenticated();
  const clauses = ["COALESCE(redeemed, false) = false"];
  const params = [];
  let i = 1;

  if (planType && planType !== "ALL") {
    clauses.push(`plan_type = $${i++}`);
    params.push(planType);
  }

  const whereSql = `WHERE ${clauses.join(" AND ")}`;
  const sql = `DELETE FROM license_keys_unified ${whereSql}`;
  const res = await pool.query(sql, params);
  return { affected: res.rowCount };
});

// Apagar várias keys de uma vez (IDS selecionados)
ipcMain.handle("delete-many-keys", async (event, ids = []) => {
    ensureAuthenticated();
    if (!Array.isArray(ids) || !ids.length) {
        return { affected: 0 };
    }

    // garante que são números
    const parsed = ids.map((id) => Number(id)).filter((n) => !isNaN(n));

    if (!parsed.length) {
        return { affected: 0 };
    }

    const sql = `
    DELETE FROM license_keys_unified
    WHERE id = ANY($1::int[])
  `;
    const res = await pool.query(sql, [parsed]);
    return { affected: res.rowCount };
});

// Apagar TODAS as keys (respeita filtro de plano)
ipcMain.handle("delete-all-keys", async (event, { planType } = {}) => {
    ensureAuthenticated();
  let whereSql = "";
  const params = [];

  if (planType && planType !== "ALL") {
    whereSql = "WHERE plan_type = $1";
    params.push(planType);
  }

  const sql = `DELETE FROM license_keys_unified ${whereSql}`;
  const res = await pool.query(sql, params);
  return { affected: res.rowCount };
});

// Atualizar expiração do usuário
ipcMain.handle(
  "update-user-expiration",
    async (event, { userId, newExpiresAt }) => {
        ensureAuthenticated();
    if (!userId) throw new Error("userId obrigatório");

    const sql = `
      UPDATE users_unified
      SET expires_at = $1
      WHERE id = $2
      RETURNING *
    `;
    const value = newExpiresAt ? new Date(newExpiresAt) : null;
    const { rows } = await pool.query(sql, [value, userId]);
    return rows[0];
  }
);

// Marcar blacklist como inativa (remover)
ipcMain.handle("deactivate-blacklist", async (event, id) => {
    ensureAuthenticated();
  if (!id) throw new Error("ID obrigatório");
  const sql = `
    UPDATE vip_blacklist
    SET active = false
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0];
});

//anty

// =========================
// 🧪 ANTY – criar / listar / apagar keys
// =========================

// Criar keys do Anty
ipcMain.handle("anty:createKeys", async (event, data) => {
    ensureAuthenticated();
    const {
        planType,
        licenseType,
        durationDays,
        quantity,
        baseText,
        random
    } = data;

    const keys = [];

    for (let i = 0; i < quantity; i++) {
        let key = random
            ? generateRandomKey(8)
            : `${baseText}_${generateRandomKey(4)}`;

        keys.push({
            key,
            planType,
            licenseType,
            durationDays
        });
    }

    return keys;
});

ipcMain.handle("anty:insertKeys", async (event, keys) => {
    ensureAuthenticated();
    try {
        const client = await antyPool.connect();

        for (const k of keys) {
            await client.query(
                `INSERT INTO login_keys (chave, plan_type, validade_dias, criado_em)
                 VALUES ($1, $2, $3, NOW())`,
                [k.key, k.planType, k.durationDays]
            );
        }

        client.release();
        return { success: true };
    } catch (err) {
        console.error("Erro ao inserir keys ANTY:", err);
        return { success: false, error: err.message };
    }
});

// =========================
// 📦 Inserir CASE em lote
// =========================
ipcMain.handle("bulk-insert-keys", async (event, { planType, durationDays, keyType, keys }) => {
    ensureAuthenticated();
    if (!planType) throw new Error("Plano obrigatório");
    if (!Array.isArray(keys) || keys.length === 0)
        throw new Error("Nenhuma CASE enviada");

    const dur = Number(durationDays) || 30;
    const created = [];

    for (const keyText of keys) {
        const sql = `
            INSERT INTO license_keys_unified
                (key_text, duration_days, redeemed, redeemed_by_user, redeemed_at, expires_at, created_at, plan_type)
            VALUES
                ($1, $2, false, NULL, NULL, NULL, NOW(), $3)
            RETURNING *
        `;

        const { rows } = await pool.query(sql, [
            keyText,
            dur,
            planType
        ]);

        created.push(rows[0]);

        // VIP GOLD sincroniza com ANTY
        if (String(planType).toLowerCase() === "vip_gold") {
            const antySQL = `
                INSERT INTO login_keys (chave, criado_em, validade_dias, plan_type)
                VALUES ($1, NOW(), $2, $3)
            `;
            await antyPool.query(antySQL, [
                keyText,
                dur,
                String(keyType).toUpperCase()
            ]);
        }
    }

    return created;
});

// Listar keys do Anty
ipcMain.handle("get-anty-keys", async (event, filters = {}) => {
    ensureAuthenticated();
    const { searchKey } = filters;
    const where = [];
    const params = [];
    let i = 1;

    if (searchKey && searchKey.trim() !== "") {
        where.push(`chave ILIKE '%' || $${i++} || '%'`);
        params.push(searchKey.trim());
    }

    const sql = `
    SELECT 
      id,
      chave,
      criado_em,
      validade_dias,
      plan_type
    FROM login_keys
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY criado_em DESC
  `;

    const { rows } = await antyPool.query(sql, params);
    return rows;
});

// Apagar uma key do Anty
ipcMain.handle("delete-anty-key", async (event, id) => {
    ensureAuthenticated();
    if (!id) throw new Error("ID obrigatório");
    await antyPool.query("DELETE FROM login_keys WHERE id = $1", [id]);
    return { success: true };
});

// ==========================
// GET ANTY USERS
// ==========================
ipcMain.handle("getAntyUsers", async (event, { search } = {}) => {
    ensureAuthenticated();
    try {
        const params = [];
        let i = 1;

        let where = "WHERE 1 = 1";

        if (search && search.trim() !== "") {
            where += `
                AND (
                    CAST(u.id AS TEXT) ILIKE $${i}
                    OR u.usuario ILIKE $${i}
                    OR u.email ILIKE $${i}
                )
            `;
            params.push(`%${search.trim()}%`);
            i++;
        }

        const sql = `
            SELECT
                u.id,
                u.usuario,
                u.email,
                u.plan_type,
                u.ativo,
                u.data_expiracao,
                -- junta todos os IPs da allowed_ips para esse usuário
                string_agg(ai.ip_address::text, ', ' ORDER BY ai.id) AS ip_access
            FROM usuarios u
            LEFT JOIN allowed_ips ai
                ON ai.user_id = u.id
            ${where}
            GROUP BY
                u.id,
                u.usuario,
                u.email,
                u.plan_type,
                u.ativo,
                u.data_expiracao
            ORDER BY u.id DESC
        `;

        const { rows } = await antyPool.query(sql, params);
        return rows;
    } catch (err) {
        console.error("Erro ao carregar usuários Anty:", err);
        throw err;
    }
});

// ==========================
// 🧹 ANTY — restaurar máquina (limpar allowed_devices do usuário)
// ==========================
ipcMain.handle("restoreAntyMachine", async (event, payload = {}) => {
    ensureAuthenticated();

    const { userId } = payload;
    if (!userId) throw new Error("userId obrigatório");

    const { rowCount } = await antyPool.query(
        "DELETE FROM allowed_devices WHERE user_id = $1",
        [userId]
    );

    return { success: true, deleted: rowCount };
});


// ==========================
// 🔵 ANTY — atualizar usuário (plano / ativo / expiração)
// ==========================
// Atualizar usuário do Anty (plano / ativo / expiração)
ipcMain.handle("updateAntyUser", async (event, payload = {}) => {
    const { id, planType, isActive, expiresAt } = payload;

    if (!id) {
        throw new Error("id obrigatório");
    }

    const sql = `
        UPDATE usuarios
        SET
            plan_type      = COALESCE($2, plan_type),
            ativo          = COALESCE($3, ativo),
            data_expiracao = COALESCE($4, data_expiracao)
        WHERE id = $1
        RETURNING id, usuario, email, plan_type, ativo, data_expiracao
    `;

    const expDate = expiresAt ? new Date(expiresAt) : null;

    const { rows } = await antyPool.query(sql, [
        id,
        planType || null,
        typeof isActive === "boolean" ? isActive : null,
        expDate,
    ]);

    return rows[0];
});

// =======================================
// 🔵 ANTY — INSERIR KEYS
// =======================================
ipcMain.handle("insert-anty-keys", async (_, keys, planType, validadeDias) => {
    ensureAuthenticated();
    try {
        const client = new Pool({
            connectionString: process.env.ANTY_DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        });

        for (const chave of keys) {
            await client.query(
                `INSERT INTO login_keys (chave, criado_em, validade_dias, plan_type)
         VALUES ($1, NOW(), $2, $3)`,
                [chave, validadeDias, planType]
            );
        }

        return { success: true };
    } catch (err) {
        console.error("Erro ao inserir keys ANTY:", err);
        return { success: false, error: err.message };
    }
});