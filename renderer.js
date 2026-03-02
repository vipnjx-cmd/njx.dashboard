// renderer.js

const keysStats = document.getElementById("keys-stats");
const usersStats = document.getElementById("users-stats");

// ============ Abas ============
const tabButtons = document.querySelectorAll(".tab-btn");
const tabs = {
  keys: document.getElementById("tab-keys"),
  users: document.getElementById("tab-users"),
  blacklist: document.getElementById("tab-blacklist"),
};

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    Object.entries(tabs).forEach(([name, el]) => {
      el.classList.toggle("hidden", name !== tab);
    });
  });
});

document.querySelectorAll(".app-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const app = btn.dataset.app;
        if (app === "anty") {
            window.api.openAnty();
        } else if (app === "vip") {
            window.api.openVip();
        }
    });
});

// ============ Helpers ============
function formatTimeRemaining(expiresAt) {
  if (!expiresAt) return "—";
  const exp = new Date(expiresAt);
  const now = new Date();
  const diffMs = exp - now;
  if (diffMs <= 0) return "Expirado";

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  return `${diffDays}d ${diffHours}h`;
}
function isUserExpired(u) {
    if (!u) return true;

    if (!u.expires_at) {
        // se não tem data mas está marcado inativo, considero expirado
        return !u.ativo;
    }

    const exp = new Date(u.expires_at);
    if (isNaN(exp.getTime())) return !u.ativo;

    const now = new Date();
    return !u.ativo || exp <= now;
}

function getNetworkButtonInfo(u) {
    const expired = isUserExpired(u);
    let label, className;

    if (expired) {
        if (u.marked) {
            // já removi da network
            label = "Removido";
            className = "network-removed";
        } else {
            // ainda está na network, preciso remover
            label = "Remover";
            className = "network-remover";
        }
    } else {
        if (u.marked) {
            // está na network
            label = "Ativo";
            className = "network-active";
        } else {
            // não está na network
            label = "Removido";
            className = "network-removed";
        }
    }

    return { label, className };
}

function msUntil(exp) {
    if (!exp) return Infinity;
    const d = new Date(exp);
    if (isNaN(d.getTime())) return Infinity;
    const diff = d - new Date();
    return diff;
}

function phoneToWaLink(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

function telegramLink(username) {
  if (!username) return null;
  return `https://t.me/${username}`;
}

function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR");
}

function renderNetworkStatus(u) {
    if (u.removed === "blacklist") {
        return '<span class="status-pill status-blacklist">Blacklist</span>';
    }
    if (u.removed === "telegram") {
        return '<span class="status-pill status-removed">Removido Telegram</span>';
    }
    if (u.ativo) {
        return '<span class="status-pill status-active">Ativo</span>';
    }
    return '<span class="status-pill status-expired">Inativo</span>';
}

// ============ Modal de confirmação ============
const confirmOverlay = document.getElementById("confirm-overlay");
const confirmTitle = document.getElementById("confirm-title");
const confirmMessage = document.getElementById("confirm-message");
const confirmOk = document.getElementById("confirm-ok");
const confirmCancel = document.getElementById("confirm-cancel");
let confirmCallback = null;

function openConfirm({
  title,
  message,
  confirmText = "Confirmar",
  danger = false,
  onConfirm,
}) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmOk.textContent = confirmText;
  confirmOk.classList.toggle("danger", !!danger);
  confirmOverlay.classList.add("show");
  confirmCallback = onConfirm || null;
}

function closeConfirm() {
  confirmOverlay.classList.remove("show");
  confirmCallback = null;
}

confirmCancel.addEventListener("click", closeConfirm);
confirmOverlay.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) closeConfirm();
});
confirmOk.addEventListener("click", async () => {
  const cb = confirmCallback;
  closeConfirm();
  if (cb) await cb();
});

// ============ Modal de editar tempo de usuário ============
const editOverlay = document.getElementById("edit-time-overlay");
const editUserLabel = document.getElementById("edit-time-user");
const editCurrentLabel = document.getElementById("edit-time-current");
const editDaysInput = document.getElementById("edit-days");
const editHoursInput = document.getElementById("edit-hours");
const editCancel = document.getElementById("edit-time-cancel");
const editSave = document.getElementById("edit-time-save");

let editUserId = null;

function openEditTimeModal({ userId, currentExp, displayName }) {
    editUserId = userId;

    // Título com info do usuário
    editUserLabel.textContent =
        `Usuário ID ${userId}` +
        (displayName ? ` – ${displayName}` : "");

    if (currentExp) {
        const expDate = new Date(currentExp);
        if (!isNaN(expDate.getTime())) {
            editCurrentLabel.textContent = expDate.toLocaleString("pt-BR");

            const now = new Date();
            const diffMs = expDate - now;
            let days = 0;
            let hours = 0;
            if (diffMs > 0) {
                days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                hours = Math.floor(
                    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
                );
            }
            editDaysInput.value = days;
            editHoursInput.value = hours;
        } else {
            editCurrentLabel.textContent = "data inválida";
            editDaysInput.value = "";
            editHoursInput.value = "";
        }
    } else {
        editCurrentLabel.textContent = "sem expiração (vitalício)";
        editDaysInput.value = "";
        editHoursInput.value = "";
    }

    editOverlay.classList.add("show");
}

function closeEditTimeModal() {
    editOverlay.classList.remove("show");
    editUserId = null;
}

editCancel.addEventListener("click", closeEditTimeModal);
editOverlay.addEventListener("click", (e) => {
    if (e.target === editOverlay) closeEditTimeModal();
});

editSave.addEventListener("click", async () => {
    if (!editUserId) return;

    const days = Number(editDaysInput.value || 0);
    const hours = Number(editHoursInput.value || 0);

    if (isNaN(days) || isNaN(hours) || days < 0 || hours < 0 || hours > 23) {
        alert("Informe dias/horas válidos (horas entre 0 e 23).");
        return;
    }

    let newIso = null;

    // 0d 0h => remove expiração
    if (days === 0 && hours === 0) {
        // 0d 0h => expira AGORA
        const now = new Date();
        // joga 1 minuto pro passado só pra garantir que já está vencido
        now.setMinutes(now.getMinutes() - 1);
        newIso = now.toISOString();
    } else {
        const now = new Date();
        const ms =
            days * 24 * 60 * 60 * 1000 +
            hours * 60 * 60 * 1000;
        const newDate = new Date(now.getTime() + ms);
        newIso = newDate.toISOString();
    }

    const oldText = editSave.textContent;
    editSave.textContent = "...";

    try {
        await window.api.updateUserExpiration({
            userId: editUserId,
            newExpiresAt: newIso,
        });
        closeEditTimeModal();
        await loadUsers();
    } catch (err) {
        console.error(err);
        alert("Erro ao atualizar expiração: " + err.message);
    } finally {
        editSave.textContent = oldText;
    }
});

// ============ Links externos (Whats / Telegram) ============
document.addEventListener("click", (e) => {
  const link = e.target.closest("a.external-link");
  if (!link) return;
  e.preventDefault();
  const url = link.getAttribute("href");
  if (url) window.api.openExternal(url);
});

// ============ KEYS ============
const keyPlan = document.getElementById("key-plan");
const keyQty = document.getElementById("key-quantity");
const keyBase = document.getElementById("key-base-text");
const keyDuration = document.getElementById("key-duration");
const keyRandom = document.getElementById("key-random");
const btnCreateKeys = document.getElementById("btn-create-keys");
const keysMsg = document.getElementById("keys-msg");
const keyType = document.getElementById("key-type");

// habilita/desabilita o "Tipo da key" conforme o plano
if (keyPlan) {
    keyPlan.addEventListener("change", () => {
        updateKeyTypeEnabled();
    });

    // garante o estado correto assim que o painel abre
    updateKeyTypeEnabled();
}

const filterPlan = document.getElementById("filter-plan");
const filterRedeemed = document.getElementById("filter-redeemed");
const btnRefreshKeys = document.getElementById("btn-refresh-keys");
const btnDeleteUnused = document.getElementById("btn-delete-unused");
const btnDeleteAll = document.getElementById("btn-delete-all");
const keysTableBody = document.querySelector("#keys-table tbody");
const btnOpenExportKeys = document.getElementById("btn-open-export-keys");
const exportOverlay = document.getElementById("export-overlay");
const exportPeriod = document.getElementById("export-period");
const exportFormat = document.getElementById("export-format");
const exportLinkType = document.getElementById("export-link-type");
const exportCancel = document.getElementById("export-cancel");
const exportConfirm = document.getElementById("export-confirm");
const filterKeyText = document.getElementById("filter-key-text");
const btnDeleteSelected = document.getElementById("btn-delete-selected");
const keysSelectAll = document.getElementById("keys-select-all");

btnCreateKeys.addEventListener("click", async () => {
  keysMsg.textContent = "Gerando keys...";
  try {
    const created = await window.api.createKeys({
      planType: keyPlan.value,
      quantity: Number(keyQty.value) || 1,
      baseText: keyBase.value.trim(),
      random: keyRandom.checked,
        durationDays: Number(keyDuration.value) || 30,
        keyType: keyType.value,
    });
    keysMsg.textContent = `Criadas ${created.length} keys.`;
    await loadKeys();
  } catch (err) {
    console.error(err);
    keysMsg.textContent = "Erro ao criar keys: " + err.message;
  }
});

btnRefreshKeys && btnRefreshKeys.addEventListener("click", loadKeys);
filterPlan && filterPlan.addEventListener("change", loadKeys);
filterRedeemed && filterRedeemed.addEventListener("change", loadKeys);

if (filterKeyText) {
    filterKeyText.addEventListener("input", loadKeys);
}

btnDeleteUnused.addEventListener("click", () => {
  const plan = filterPlan.value;
  openConfirm({
    title: "Apagar keys não usadas",
    message:
      "Isso vai apagar TODAS as keys que ainda não foram usadas" +
      (plan !== "ALL" ? ` do plano ${plan}.` : " de todos os planos."),
    confirmText: "Apagar",
    danger: true,
    onConfirm: async () => {
      try {
        const res = await window.api.deleteUnusedKeys({ planType: plan });
        keysMsg.textContent = `Apagadas ${res.affected || 0} keys não usadas.`;
        await loadKeys();
      } catch (err) {
        console.error(err);
        alert("Erro ao apagar keys: " + err.message);
      }
    },
  });
});

btnDeleteAll.addEventListener("click", () => {
  const plan = filterPlan.value;
  openConfirm({
    title: "APAGAR TODAS as keys",
    message:
      "⚠ Isso vai apagar TODAS as keys" +
      (plan !== "ALL" ? ` do plano ${plan}.` : " de todos os planos.") +
      "\n\nEssa ação não pode ser desfeita.",
    confirmText: "Apagar tudo",
    danger: true,
    onConfirm: async () => {
      try {
        const res = await window.api.deleteAllKeys({ planType: plan });
        keysMsg.textContent = `Apagadas ${res.affected || 0} keys.`;
        await loadKeys();
      } catch (err) {
        console.error(err);
        alert("Erro ao apagar todas as keys: " + err.message);
      }
    },
  });
});

async function loadKeys() {
    // se nem existir a tabela, não faz nada
    if (!keysTableBody) return;

    // estado de “carregando”
    keysTableBody.innerHTML =
        "<tr><td colspan='10'>Carregando...</td></tr>";

    try {
        // se a API não tiver o método, evita quebrar
        if (!window.api || !window.api.getKeys) {
            console.error("[loadKeys] window.api.getKeys não definido");
            keysTableBody.innerHTML =
                "<tr><td colspan='10'>API de keys não disponível.</td></tr>";
            return;
        }

        const plan =
            filterPlan && filterPlan.value ? filterPlan.value : "ALL";

        const redeemedFilter =
            filterRedeemed && filterRedeemed.value
                ? filterRedeemed.value
                : "";

        const searchText =
            filterKeyText && typeof filterKeyText.value === "string"
                ? filterKeyText.value.trim()
                : "";

        const rows = await window.api.getKeys({
            planType: plan,
            redeemed: redeemedFilter
                ? redeemedFilter.toUpperCase()
                : "",
            search: searchText,
        });

        // 👉 CONTADORES DE KEYS
        if (keysStats && Array.isArray(rows)) {
            const total = rows.length;
            const used = rows.filter((k) => !!k.redeemed).length;
            const unused = total - used;
            keysStats.textContent =
                `Keys na lista: total ${total} | usadas ${used} | não usadas ${unused}`;
        }

        keysTableBody.innerHTML = "";

        if (!rows || !rows.length) {
            keysTableBody.innerHTML =
                "<tr><td colspan='10'>Nenhuma key encontrada.</td></tr>";
            return;
        }

        for (const k of rows) {
            const tr = document.createElement("tr");
            const used = !!k.redeemed;

            tr.innerHTML = `
        <td style="text-align:center;">
          ${used
                    ? ""
                    : `<input type="checkbox"
                class="key-select"
                data-key-id="${k.id}">`
                }
        </td>
        <td>${k.id}</td>
        <td>${k.key_text}</td>
        <td>${k.plan_type || "-"}</td>
        <td>${k.duration_days || "-"}</td>
        <td class="cell-used ${used ? "used-yes" : "used-no"}">
          ${used ? "✅" : "✕"}
        </td>
        <td>${k.redeemed_by_user || "-"}</td>
        <td>${k.redeemed_at
                    ? new Date(k.redeemed_at).toLocaleString("pt-BR")
                    : "-"
                }</td>
        <td>
          ${used
                    ? ""
                    : `<button class="btn-delete-key" data-key-id="${k.id}">Apagar</button>`
                }
        </td>
      `;

            keysTableBody.appendChild(tr);
        }

        // checkboxes / selecionar tudo
        setupKeySelectionCheckboxes();

        // botões “Apagar” individuais
        document.querySelectorAll(".btn-delete-key").forEach((btn) => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.keyId;
                if (!id) return;

                openConfirm({
                    title: "Apagar key",
                    message: `Apagar a key ID ${id}?`,
                    confirmText: "Apagar",
                    danger: true,
                    onConfirm: async () => {
                        btn.textContent = "...";
                        try {
                            await window.api.deleteKey(id);
                            await loadKeys();
                        } catch (err) {
                            console.error(err);
                            alert(
                                "Erro ao apagar key: " + err.message
                            );
                        }
                    },
                });
            });
        });
    } catch (err) {
        console.error("[loadKeys] erro:", err);
        keysTableBody.innerHTML =
            "<tr><td colspan='10'>Erro ao carregar keys.</td></tr>";
    }
}

if (btnDeleteSelected) {
    btnDeleteSelected.addEventListener("click", () => {
        const selected = Array.from(
            document.querySelectorAll(".key-select:checked")
        ).map((cb) => cb.dataset.keyId);

        if (!selected.length) {
            alert("Nenhuma key selecionada.");
            return;
        }

        openConfirm({
            title: "Apagar keys selecionadas",
            message: `Isso vai apagar ${selected.length} keys que ainda não foram usadas. Deseja continuar?`,
            confirmText: "Apagar selecionadas",
            danger: true,
            onConfirm: async () => {
                try {
                    const res = await window.api.deleteManyKeys(selected);
                    keysMsg.textContent = `Apagadas ${res.affected || 0} keys selecionadas.`;
                    await loadKeys();
                } catch (err) {
                    console.error(err);
                    alert("Erro ao apagar selecionadas: " + err.message);
                }
            },
        });
    });
}

// -------------------------
// GERAR KEYS EM LOTE (modal)
// -------------------------
const btnOpenBulk = document.getElementById("btn-open-bulk-modal");
const bulkOverlay = document.getElementById("bulk-overlay");
const bulkClose = document.getElementById("bulk-close");
const bulkQty = document.getElementById("bulk-qty");
const bulkText = document.getElementById("bulk-text");
const bulkGenerate = document.getElementById("bulk-generate");
const bulkDownload = document.getElementById("bulk-download");
const bulkInsert = document.getElementById("bulk-insert");
const bulkPlan = document.getElementById("bulk-plan");
const bulkType = document.getElementById("bulk-type");
const bulkDuration = document.getElementById("bulk-duration");

if (bulkPlan) {
    bulkPlan.addEventListener("change", updateBulkTypeEnabled);
}
function isVipGold(plan) {
    return String(plan || "").toLowerCase() === "vip_gold";
}

function updateKeyTypeEnabled() {
    if (!keyPlan || !keyType) return;
    const enabled = isVipGold(keyPlan.value);
    keyType.disabled = !enabled;
    keyType.title = enabled
        ? ""
        : "Tipo da key só é usado quando o plano é VIP Gold (para criar key no Anty).";
}
function updateBulkTypeEnabled() {
    if (!bulkPlan || !bulkType) return;
    const enabled = isVipGold(bulkPlan.value);
    bulkType.disabled = !enabled;
    bulkType.title = enabled
        ? ""
        : "Tipo da key só é usado quando o plano é VIP Gold.";
}

const loadingOverlay = document.getElementById("global-loading-overlay");
function openBulk() {
    if (bulkPlan) bulkPlan.value = keyPlan.value;
    if (bulkType) bulkType.value = keyType.value;
    if (bulkDuration) bulkDuration.value = keyDuration.value;

    // atualiza se o tipo deve estar habilitado ou não
    updateBulkTypeEnabled();

    if (bulkOverlay) bulkOverlay.classList.add("show");
}
function closeBulk() {
    if (bulkOverlay) bulkOverlay.classList.remove("show");
}
function showLoading() {
    if (loadingOverlay) loadingOverlay.classList.add("show");
}
function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.remove("show");
}

// abrir / fechar modal
if (btnOpenBulk) btnOpenBulk.addEventListener("click", openBulk);
if (bulkClose) bulkClose.addEventListener("click", closeBulk);
if (bulkOverlay) {
    bulkOverlay.addEventListener("click", (e) => {
        if (e.target === bulkOverlay) closeBulk();
    });
}

// gerar keys só no front
function generateRandomKey(len = 8) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < len; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}

if (bulkGenerate) {
    bulkGenerate.addEventListener("click", () => {
        const qty = Number(bulkQty.value) || 0;
        if (!qty || qty <= 0) {
            alert("Informe uma quantidade válida de keys.");
            return;
        }

        const linkBase = document.getElementById("bulk-link")?.value.trim() || "";

        const arr = [];
        for (let i = 0; i < qty; i++) {
            const key = generateRandomKey(8);
            arr.push(linkBase ? `${linkBase} - ${key}` : key);
        }

        bulkText.value = arr.join("\n");
    });
}

// baixar txt com as keys geradas
if (bulkDownload) {
    bulkDownload.addEventListener("click", () => {
        const txt = (bulkText.value || "").trim();
        if (!txt) {
            alert("Não há keys geradas para baixar.");
            return;
        }
        downloadTextFile("keys_lote.txt", txt);
    });
}

// inserir no VIP (chama IPC bulk-insert-keys)
if (bulkInsert) {
    bulkInsert.addEventListener("click", async () => {
        const lines = (bulkText.value || "")
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
            .map((line) => {
                // separa "link - key"
                const parts = line.split(" - ");
                return parts.length >= 2 ? parts[1] : parts[0];
            });

        if (!lines.length) {
            alert("Nenhuma key para inserir.");
            return;
        }

        showLoading();

        try {
            await window.api.bulkInsertKeys({
                planType: bulkPlan ? bulkPlan.value : keyPlan.value,
                durationDays: bulkDuration ? (Number(bulkDuration.value) || 30) : (Number(keyDuration.value) || 30),
                keyType: bulkType ? bulkType.value : keyType.value,
                keys: lines,
            });

            hideLoading();
            closeBulk();
            alert("SUCESSO! Keys inseridas com sucesso no VIP.");
            await loadKeys(); // recarrega a tabela
        } catch (err) {
            console.error(err);
            hideLoading();
            alert("Erro ao inserir keys: " + (err.message || err));
        }
    });
}

let lastKeyCheckboxIndex = null;

function setupKeySelectionCheckboxes() {
    const checkboxes = Array.from(
        document.querySelectorAll(".key-select")
    );

    const selectAll = keysSelectAll;

    function updateSelectAll() {
        if (!selectAll) return;
        const total = checkboxes.length;
        const checked = checkboxes.filter((c) => c.checked).length;

        if (total === 0) {
            selectAll.checked = false;
            selectAll.indeterminate = false;
            return;
        }

        selectAll.checked = checked === total;
        selectAll.indeterminate = checked > 0 && checked < total;
    }

    checkboxes.forEach((cb, index) => {
        cb.addEventListener("click", (e) => {
            if (e.shiftKey && lastKeyCheckboxIndex !== null) {
                const start = Math.min(lastKeyCheckboxIndex, index);
                const end = Math.max(lastKeyCheckboxIndex, index);
                for (let i = start; i <= end; i++) {
                    checkboxes[i].checked = cb.checked;
                }
            }
            lastKeyCheckboxIndex = index;
            updateSelectAll();
        });
    });

    if (selectAll) {
        selectAll.onclick = () => {
            const state = selectAll.checked;
            checkboxes.forEach((cb) => (cb.checked = state));
            selectAll.indeterminate = false;
        };
    }

    updateSelectAll();
}

async function banUserByPhone(userId, phone) {
    if (!phone) {
        alert("Usuário está sem número de WhatsApp cadastrado.");
        return;
    }

    try {
        // Cria entrada na blacklist
        const bl = await window.api.addBlacklist({
            phone,
            reason: `Banido via painel VIP (user ${userId})`,
            createdBy: "painel_vip",
        });

        // Garante que o status 'removed = blacklist' é aplicado nos usuários
        if (bl && bl.id) {
            await window.api.setBlacklistActive({ id: bl.id, active: true });
        }

        await loadBlacklist();
        await loadUsers();
    } catch (err) {
        console.error(err);
        alert("Erro ao banir usuário: " + (err.message || err));
    }
}

// ============ USERS ============

const btnRefreshUsers = document.getElementById("btn-refresh-users");
const usersTableBody = document.querySelector("#users-table tbody");
const usersSearchInput = document.getElementById("users-search");

let cachedUsers = [];

btnRefreshUsers.addEventListener("click", loadUsers);
usersSearchInput.addEventListener("input", renderUsers);

// Carrega usuários do servidor
async function loadUsers() {
    usersTableBody.innerHTML =
        "<tr><td colspan='13'>Carregando...</td></tr>";

    try {
        const users = await window.api.getUsers();
        cachedUsers = users; // ← cache

        if (usersStats) {
            const total = users.length;
            const ativos = users.filter(u => u.ativo).length;
            const inativos = total - ativos;
            usersStats.textContent = `Usuários: total ${total} | ativos ${ativos} | inativos ${inativos}`;
        }

        renderUsers();
    } catch (err) {
        console.error(err);
        usersTableBody.innerHTML =
            "<tr><td colspan='13'>Erro ao carregar usuários.</td></tr>";
    }
}

let userSortMode = 0;
// 0 = normal
// 1 = maior -> menor
// 2 = menor -> maior

function sortUsersByExpiration(list) {
    if (userSortMode === 0) return list;

    return [...list].sort((a, b) => {
        const msA = msUntil(a.expires_at);
        const msB = msUntil(b.expires_at);

        if (userSortMode === 1) {
            // 1º clique: quem expira mais cedo primeiro (menor tempo)
            return msA - msB;
        }

        if (userSortMode === 2) {
            // 2º clique: quem tem mais tempo primeiro
            return msB - msA;
        }

        return 0;
    });
}

// Renderiza usando filtro
function renderUsers() {
    usersTableBody.innerHTML = "";

    let lista = sortUsersByExpiration(cachedUsers);
    const termo = usersSearchInput.value.trim().toLowerCase();

    if (termo !== "") {
        lista = lista.filter((u) => {
            const campos = [
                String(u.id || ""),
                u.telegram_username || "",
                String(u.telegram_id || ""),
                u.telegram_name || "",
                u.phone_number || "",
                u.last_key_text || "",
                u.discord_username || "",
                String(u.discord_id || ""),
            ];
            return campos.some((v) => v.toLowerCase().includes(termo));
        });
    }

    if (lista.length === 0) {
        usersTableBody.innerHTML =
            "<tr><td colspan='13'>Nenhum usuário encontrado.</td></tr>";
        return;
    }

    for (const u of lista) {
        const tr = document.createElement("tr");

        // STATUS geral
        let statusHtml = "";
        if (u.removed === "blacklist") {
            statusHtml =
                '<span class="status-pill status-blacklist">Blacklist</span>';
        } else if (u.ativo) {
            statusHtml =
                '<span class="status-pill status-active">Ativo</span>';
        } else if (u.removed === "telegram") {
            statusHtml =
                '<span class="status-pill status-removed">Removido Telegram</span>';
        } else {
            statusHtml =
                '<span class="status-pill status-expired">Inativo/Expirado</span>';
        }

        const currentExpIso = u.expires_at
            ? new Date(u.expires_at).toISOString()
            : "";

        // TELEGRAM (link + id)
        let tgHtml = "—";
        const tgUrl = telegramLink(u.telegram_username);
        if (tgUrl) {
            tgHtml =
                `<a href="${tgUrl}" class="external-link" target="_blank">@${u.telegram_username}</a>` +
                (u.telegram_id ? `<br/><small>${u.telegram_id}</small>` : "");
        } else if (u.telegram_id) {
            tgHtml = String(u.telegram_id);
        }
        
        // DISCORD
        let discordHtml = "—";
        if (u.discord_username) {
            discordHtml = u.discord_username;
        } else if (u.discord_id) {
            discordHtml = String(u.discord_id);
        }

        // WhatsApp
        let phoneHtml = u.phone_number || "—";
        const wa = phoneToWaLink(u.phone_number);
        if (wa) {
            phoneHtml = `<a href="${wa}" class="external-link">${u.phone_number}</a>`;
        }

        // NJX Anty: bate telefone do VIP com o "email" do banco do Anty (sem +55)
        const antyUserId = u.anty_user_id || "";
        const njxAntyHtml = (u.anty_active && antyUserId)
            ? `<a href="#" class="anty-open-link status-pill status-active" data-anty-user-id="${antyUserId}">Ativo</a>`
            : '<span class="status-pill status-expired">Inativo</span>';

        // Tempo / vencimento
        const tempoRestante = formatTimeRemaining(u.expires_at);
        const vencimento = formatDateTime(u.expires_at);
        const criadoEm = formatDateTime(u.created_at);

        // IPs da allowed_ips
        const ipAccess = u.ip_access || "—";

        // Network WhatsApp (usa u.marked + expirado/ativo)
        const netInfo = getNetworkButtonInfo(u);

        // FUNÇÕES – Desativar VIP / Banir
        tr.innerHTML = `
  <td>${u.id}<br/>${statusHtml}</td>
  <td>${u.telegram_name || "—"}</td>
  <td>${tgHtml}</td>
  <td>${discordHtml}</td>
  <td>${njxAntyHtml}</td>
  <td>${phoneHtml}</td>
  <td>${tempoRestante}</td>
  <td>${vencimento}</td>
  <td>
    <div class="user-actions">
      <button
        class="user-btn user-btn-blue btn-edit-exp"
        data-user-id="${u.id}"
        data-current-exp="${currentExpIso}"
      >
        Desativar VIP
      </button>

      <button
        class="user-btn user-btn-red btn-ban-user"
        data-user-id="${u.id}"
        data-phone="${u.phone_number || ""}"
      >
        Banir usuário
      </button>
    </div>
  </td>
  <td>${u.last_key_text || "—"}</td>
  <td>${criadoEm}</td>
  <td>${ipAccess}</td>
  <td>
    <button
      class="network-btn ${netInfo.className}"
      data-user-id="${u.id}"
    >
      ${netInfo.label}
    </button>
  </td>
`;
        usersTableBody.appendChild(tr);
    }

    // Botão “Desativar VIP” (usa o mesmo fluxo que você já tinha pro modal de editar expiração)
    document.querySelectorAll(".btn-edit-exp").forEach((btn) => {
        btn.addEventListener("click", () => {
            const userId = btn.dataset.userId;
            const currentExp = btn.dataset.currentExp || null;
            const nome = btn
                .closest("tr")
                ?.querySelector("td:nth-child(2)")
                ?.textContent.trim();

            openEditTimeModal({
                userId,
                currentExp,
                displayName: nome,
            });
        });
    });

    // Botão “Banir usuário” → manda pra blacklist (usa sua API existente)
    document.querySelectorAll(".btn-ban-user").forEach((btn) => {
        btn.addEventListener("click", () => {
            const userId = btn.dataset.userId;
            const phone = btn.dataset.phone || "";

            if (!phone) {
                alert("Usuário está sem número de WhatsApp cadastrado.");
                return;
            }

            openConfirm({
                title: "Banir usuário",
                message: `Adicionar o número ${phone} do usuário ID ${userId} na blacklist?`,
                confirmText: "Banir",
                danger: true,
                onConfirm: () => banUserByPhone(userId, phone),
            });
        });
    });


    // NJX Anty: clicar no "Ativo" abre direto o usuário no painel Anty
    document.querySelectorAll(".anty-open-link").forEach((link) => {
        link.addEventListener("click", (ev) => {
            ev.preventDefault();
            const antyId = link.dataset.antyUserId;
            if (!antyId) return;

            try {
                localStorage.setItem("anty_jump_user_id", String(antyId));
            } catch (_) {
                // ignore
            }

            if (window.api && window.api.openAnty) {
                window.api.openAnty();
            }
        });
    });

    // Botão “Network WhatsApp”
    document.querySelectorAll(".network-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.userId;
            const user = cachedUsers.find((u) => String(u.id) === String(id));
            if (!user) return;

            // toggle simples do booleano marked
            const novoValor = !user.marked;
            btn.disabled = true;

            try {
                await window.api.toggleUserFlag({ userId: id, newValue: novoValor });
                user.marked = novoValor;
                renderUsers(); // re-render pra atualizar cor/label
            } catch (err) {
                console.error(err);
                btn.disabled = false;
            }
        });
    });
}

const thSortExp = document.getElementById("th-sort-exp");

if (thSortExp) {
    thSortExp.style.cursor = "pointer";
    thSortExp.addEventListener("click", () => {
        userSortMode++;

        if (userSortMode > 2) userSortMode = 0;

        // Atualiza o ícone no cabeçalho
        if (userSortMode === 0) thSortExp.textContent = "Tempo restante ⏳";
        if (userSortMode === 1) thSortExp.textContent = "Tempo restante ⬆️";
        if (userSortMode === 2) thSortExp.textContent = "Tempo restante ⬇️";

        renderUsers();
    });
}

const LINKS_BY_TYPE = {
    none: "",
    discord: "- https://discord.gg/rolexnjx",
    telegram: "- https://web.telegram.org/a/#8398503122",
    loja: "- https://rolexnjx.com/"
};

function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function decorateKeyWithLink(keyText, linkType) {
    const link = LINKS_BY_TYPE[linkType] || "";
    if (!link || linkType === "none") return keyText;
    return `${keyText} ${link}`;
}

// ---------- EXPORTAR KEYS ----------

function openExportModal() {
    if (!exportOverlay) return;
    exportOverlay.classList.add("show");
}

function closeExportModal() {
    if (!exportOverlay) return;
    exportOverlay.classList.remove("show");
}

// Abrir modal ao clicar no botão "Baixar keys"
if (btnOpenExportKeys) {
    btnOpenExportKeys.addEventListener("click", () => {
        openExportModal();
    });
}

// Fechar modal
if (exportCancel) exportCancel.addEventListener("click", closeExportModal);
if (exportOverlay) {
    exportOverlay.addEventListener("click", (e) => {
        if (e.target === exportOverlay) closeExportModal();
    });
}

// Calcula o range de datas a partir do select export-period
function getExportDateRange() {
    const now = new Date();
    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0
    );
    const value = exportPeriod.value;

    if (value === "today") {
        const from = new Date(today);
        const to = new Date(today);
        to.setHours(23, 59, 59, 999);
        return { from, to };
    }

    if (value === "yesterday") {
        const from = new Date(today);
        from.setDate(from.getDate() - 1);
        const to = new Date(from);
        to.setHours(23, 59, 59, 999);
        return { from, to };
    }

    if (value === "last7") {
        const from = new Date(today);
        from.setDate(from.getDate() - 6); // últimos 7 dias (hoje + 6 atrás)
        const to = new Date(today);
        to.setHours(23, 59, 59, 999);
        return { from, to };
    }

    // "all"
    return { from: null, to: null };
}

if (exportConfirm) {
    exportConfirm.addEventListener("click", async () => {
        exportConfirm.disabled = true;
        const originalText = exportConfirm.textContent;
        exportConfirm.textContent = "Gerando...";

        try {
            const { from, to } = getExportDateRange();

            const redeemedFilter = filterRedeemed.value;

            const payload = {
                from: from ? from.toISOString() : null,
                to: to ? to.toISOString() : null,
                planType: filterPlan.value,
                redeemed: redeemedFilter ? redeemedFilter.toUpperCase() : "",
                search: filterKeyText.value.trim(),
            };

            const rows = await window.api.exportKeys(payload);

            if (!rows || !rows.length) {
                alert("Nenhuma key encontrada nesse filtro.");
                return;
            }

            const format = exportFormat.value;       // csv ou txt
            const linkType = exportLinkType.value;   // none / discord / telegram / loja

            if (format === "txt") {
                // 1 linha por key, com link opcional
                const lines = rows.map((k) =>
                    decorateKeyWithLink(k.key_text, linkType)
                );
                const nowStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
                downloadTextFile(`keys_${exportPeriod.value}_${nowStr}.txt`, lines.join("\n"));
            } else {
                // CSV; a coluna da key já pode vir com o link junto se quiser
                const header = [
                    "id",
                    "key_text",
                    "plan_type",
                    "duration_days",
                    "redeemed",
                    "redeemed_by_user",
                    "redeemed_at",
                    "expires_at",
                    "created_at",
                ];
                const lines = [header.join(";")];

                for (const k of rows) {
                    const keyWithLink = decorateKeyWithLink(k.key_text, linkType);
                    const line = [
                        k.id,
                        keyWithLink,
                        k.plan_type || "",
                        k.duration_days || "",
                        k.redeemed ? "1" : "0",
                        k.redeemed_by_user || "",
                        k.redeemed_at ? new Date(k.redeemed_at).toISOString() : "",
                        k.expires_at ? new Date(k.expires_at).toISOString() : "",
                        k.created_at ? new Date(k.created_at).toISOString() : "",
                    ]
                        .map((v) => String(v).replace(/"/g, '""'))
                        .map((v) => `"${v}"`)
                        .join(";");

                    lines.push(line);
                }

                const csv = lines.join("\r\n");
                const nowStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
                downloadTextFile(`keys_${exportPeriod.value}_${nowStr}.csv`, csv);
            }

            closeExportModal();
        } catch (err) {
            console.error(err);
            alert("Erro ao exportar keys: " + err.message);
        } finally {
            exportConfirm.disabled = false;
            exportConfirm.textContent = originalText;
        }
    });
}

// ============ BLACKLIST ============
const blPhone = document.getElementById("bl-phone");
const blReason = document.getElementById("bl-reason");
const blCreatedBy = document.getElementById("bl-created-by");
const blMsg = document.getElementById("bl-msg");
const blTableBody = document.querySelector("#bl-table tbody");
const btnAddBlacklist = document.getElementById("btn-add-blacklist");

btnAddBlacklist.addEventListener("click", async () => {
  const phone = blPhone.value.trim();
  const reason = blReason.value.trim();
  const createdBy = blCreatedBy.value.trim();

  if (!phone) {
    blMsg.textContent = "Informe um número.";
    return;
  }

  blMsg.textContent = "Adicionando...";
  try {
    await window.api.addBlacklist({
      phone,
      reason: reason || null,
      createdBy: createdBy || null,
    });
    blMsg.textContent = "Número adicionado à blacklist.";
    blPhone.value = "";
    blReason.value = "";
    blCreatedBy.value = "";
    await loadBlacklist();
  } catch (err) {
    console.error(err);
    blMsg.textContent = "Erro ao adicionar: " + err.message;
  }
});

async function loadBlacklist() {
  blTableBody.innerHTML =
    "<tr><td colspan='7'>Carregando...</td></tr>";

  try {
    const rows = await window.api.getBlacklist();
    blTableBody.innerHTML = "";

    if (!rows.length) {
      blTableBody.innerHTML =
        "<tr><td colspan='7'>Nenhum número na blacklist.</td></tr>";
      return;
    }

    for (const r of rows) {
      const tr = document.createElement("tr");

      const wa = phoneToWaLink(r.phone_number);
      let phoneHtml = r.phone_number;
      if (wa) {
        phoneHtml = `<a href="${wa}" class="external-link">${r.phone_number}</a>`;
      }

      const createdAt = r.created_at
        ? new Date(r.created_at).toLocaleString("pt-BR")
        : "—";

        const isActive = r.active !== false;

        const statusHtml = isActive
            ? '<span class="status-pill status-active">Ativo</span>'
            : '<span class="status-pill status-expired">Inativo</span>';

        tr.innerHTML = `
  <td>${r.id}</td>
  <td>${phoneHtml}</td>
  <td>${r.reason || "—"}</td>
  <td>${r.created_by || "—"}</td>
  <td>${createdAt}</td>
  <td>${statusHtml}</td>
  <td>
    <button
      class="btn-delete-bl"
      data-bl-id="${r.id}"
    >
      Remover
    </button>
  </td>
`;

      blTableBody.appendChild(tr);
      }

        // Evento de REMOVER da blacklist
        document.querySelectorAll(".btn-delete-bl").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = btn.dataset.blId;
                if (!id) return;

                openConfirm({
                    title: "Remover da blacklist",
                    message: `Deseja realmente remover o registro ID ${id} da blacklist?\n\nIsso também limpa o status 'blacklist' dos usuários com esse número.`,
                    confirmText: "Remover",
                    danger: true,
                    onConfirm: async () => {
                        try {
                            btn.textContent = "...";
                            await window.api.deleteBlacklist(id);
                            await loadBlacklist();
                            await loadUsers(); // atualiza lista de usuários
                        } catch (err) {
                            console.error(err);
                            alert("Erro ao remover da blacklist: " + err.message);
                        }
                    },
                });
            });
        });
    } catch (err) {
        console.error(err);
        blTableBody.innerHTML =
            "<tr><td colspan='7'>Erro ao carregar blacklist.</td></tr>";
    }
}

filterKeyText.addEventListener("input", loadKeys);

function isExpiringInNext24h(expiresAt) {
    if (!expiresAt) return false;

    const exp = new Date(expiresAt);
    if (isNaN(exp.getTime())) return false;

    const now = new Date();
    const diffMs = exp - now;

    // já expirado? não entra
    if (diffMs <= 0) return false;

    const DAY_MS = 24 * 60 * 60 * 1000;
    // true se falta menos de 24h
    return diffMs <= DAY_MS;
}

// =============================
// MODAL - USUÁRIOS QUE EXPIRAM HOJE
// =============================
const btnUsersExp = document.getElementById("btn-users-expiring-today");
const modalUsersExp = document.getElementById("users-expiring-modal");
const tbodyUsersExp = document.getElementById("users-expiring-tbody");
const closeUsersExp = document.getElementById("close-users-expiring");

btnUsersExp?.addEventListener("click", async () => {
    if (!modalUsersExp || !tbodyUsersExp) return;

    modalUsersExp.classList.remove("hidden");

    tbodyUsersExp.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;color:#999;">
            Carregando...
          </td>
        </tr>
    `;

    try {
        const users = await window.api.getUsers();

        const expiring = users.filter(u => isExpiringInNext24h(u.expires_at));

        if (expiring.length === 0) {
            tbodyUsersExp.innerHTML = `
                <tr>
                  <td colspan="5" style="text-align:center;color:#999;">
                    Nenhum usuário expira hoje.
                  </td>
                </tr>
            `;
            return;
        }

        tbodyUsersExp.innerHTML = "";

        for (const u of expiring) {
            const tr = document.createElement("tr");

            // monta telefone clicável igual na tabela principal de usuários
            const wa = phoneToWaLink(u.phone_number);
            let phoneHtml = u.phone_number || "—";
            if (wa) {
                phoneHtml = `<a href="${wa}" class="external-link">${u.phone_number}</a>`;
            }

            tr.innerHTML = `
        <td>${u.id}</td>
        <td>${u.telegram_name || u.telegram_username || "—"}</td>
        <td>${phoneHtml}</td>
        <td>${u.last_key_text || u.plan_type || "-"}</td>
        <td>${new Date(u.expires_at).toLocaleString("pt-BR")}</td>
    `;
            tbodyUsersExp.appendChild(tr);
        }
    } catch (err) {
        console.error("Erro ao carregar usuários que expiram hoje:", err);
        tbodyUsersExp.innerHTML = `
            <tr>
              <td colspan="5" style="text-align:center;color:#f87171;">
                Erro ao carregar usuários: ${err.message || err}
              </td>
            </tr>
        `;
    }
});

// Fechar modal
closeUsersExp?.addEventListener("click", () => {
    modalUsersExp?.classList.add("hidden");
});

// Clique fora fecha
modalUsersExp?.addEventListener("click", (e) => {
    if (e.target === modalUsersExp) {
        modalUsersExp.classList.add("hidden");
    }
});
;

// ============ Inicial ============
loadKeys();
loadUsers();
loadBlacklist();
