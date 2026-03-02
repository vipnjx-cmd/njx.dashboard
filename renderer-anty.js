// renderer-anty.js
// Tudo que for do NJX Anty fica separado aqui.

window.addEventListener("DOMContentLoaded", () => {
    console.log("renderer-anty carregado");

    // botão "Rolex VIP" volta pro painel principal
    const btnGoVip = document.getElementById("btn-go-vip");
    if (btnGoVip) {
        btnGoVip.addEventListener("click", () => {
            if (window.api && window.api.openVip) {
                window.api.openVip();
            }
        });
    }

    // -----------------------------
    // CAMPOS – CRIAR KEYS ANTY
    // -----------------------------
    const planTypeEl = document.getElementById("anty-plan-type");
    const durationEl = document.getElementById("anty-duration");
    const quantityEl = document.getElementById("anty-quantity");
    const baseTextEl = document.getElementById("anty-base-text");
    const randomModeEl = document.getElementById("anty-random-mode");
    const outputEl = document.getElementById("anty-generated-keys");
    const createBtn = document.getElementById("btn-create-anty-keys");
    const insertBtn = document.getElementById("btn-insert-anty");

    // função util para gerar 8 chars aleatórios
    function gerarChaveAleatoria() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let key = "";
        for (let i = 0; i < 8; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return key;
    }

    // --------- GERAR KEYS (apenas front-end) ----------
    if (createBtn) {
        createBtn.addEventListener("click", () => {
            const planType = planTypeEl.value;                // LIMITADO / PREMIUM
            const duration = Number(durationEl.value || 30);  // só pra mostrar depois / inserir
            const quantity = Number(quantityEl.value || 1);
            const baseText = baseTextEl.value.trim();
            const randomMode = randomModeEl.value;              // "random" ou "base"

            if (quantity <= 0) {
                alert("Quantidade inválida.");
                return;
            }

            const keys = [];

            for (let i = 0; i < quantity; i++) {
                let chave;

                if (randomMode === "random" || !baseText) {
                    // só random
                    chave = gerarChaveAleatoria();
                } else {
                    // texto base + aleatório
                    chave = `${baseText}_${gerarChaveAleatoria()}`;
                }

                keys.push(chave);
            }

            // coloca no textarea
            outputEl.value = keys.join("\n");
        });
    }

    // --------- INSERIR KEYS NO BANCO DO ANTY ----------
    if (insertBtn) {
        insertBtn.addEventListener("click", async () => {
            const texto = (outputEl.value || "").trim();

            if (!texto) {
                alert("Gere as keys antes de inserir!");
                return;
            }

            const linhas = texto
                .split("\n")
                .map(l => l.trim())
                .filter(Boolean);

            if (!linhas.length) {
                alert("Nenhuma key válida encontrada.");
                return;
            }

            if (!window.api || !window.api.insertAntyKeys) {
                alert("window.api.insertAntyKeys não está ligado no preload/main.js");
                return;
            }

            const planType = planTypeEl.value;
            const duracao = Number(durationEl.value || 30);

            try {
                const resp = await window.api.insertAntyKeys(
                    linhas,      // array de strings (keys)
                    planType,    // LIMITADO / PREMIUM
                    duracao      // validade_dias
                );

                if (resp && resp.success) {
                    alert("Keys inseridas no ANTY com sucesso!");
                } else {
                    alert("Erro ao inserir keys: " + (resp && resp.error));
                }
            } catch (err) {
                console.error(err);
                alert("Erro ao inserir keys: " + (err.message || String(err)));
            }
        });
    }

    // -----------------------------
    // LISTAR KEYS ANTY
    // -----------------------------
    const antyFilterKey = document.getElementById("anty-filter-key");
    const antyKeysTbody = document.getElementById("anty-keys-tbody");
    const antyKeysMsg = document.getElementById("anty-keys-msg");
    const btnRefreshKeys = document.getElementById("btn-refresh-anty-keys");

    async function loadAntyKeys() {
        if (!antyKeysTbody) return;

        antyKeysTbody.innerHTML = "<tr><td colspan='6'>Carregando...</td></tr>";
        antyKeysMsg.textContent = "";

        try {
            if (!window.api || !window.api.getAntyKeys) {
                antyKeysTbody.innerHTML =
                    "<tr><td colspan='6'>⚠️ window.api.getAntyKeys não está ligado.</td></tr>";
                return;
            }

            const rows = await window.api.getAntyKeys({
                searchKey: (antyFilterKey?.value || "").trim(),
            });

            if (!rows || !rows.length) {
                antyKeysTbody.innerHTML =
                    "<tr><td colspan='6'>Nenhuma key encontrada.</td></tr>";
                return;
            }

            antyKeysTbody.innerHTML = "";

            for (const row of rows) {
                const tr = document.createElement("tr");
                const created =
                    row.criado_em && new Date(row.criado_em).toLocaleString();
                const dur = row.validade_dias ?? row.duration_days ?? "";

                tr.innerHTML = `
                    <td>${row.id}</td>
                    <td>${row.chave || row.key_text || "—"}</td>
                    <td>${row.plan_type || "LIMITADO"}</td>
                    <td>${created || "—"}</td>
                    <td>${dur}</td>
                    <td style="text-align:right;">
                        <button
                            class="btn-small btn-danger btn-delete-anty-key"
                            data-id="${row.id}"
                        >
                            Apagar
                        </button>
                    </td>
                `;
                antyKeysTbody.appendChild(tr);
            }

            document.querySelectorAll(".btn-delete-anty-key").forEach((btn) => {
                btn.addEventListener("click", async () => {
                    const id = btn.getAttribute("data-id");
                    if (!id) return;

                    if (!confirm(`Apagar key do Anty ID ${id}? Essa ação não pode ser desfeita.`)) {
                        return;
                    }

                    try {
                        await window.api.deleteAntyKey(Number(id));
                        await loadAntyKeys();
                    } catch (err) {
                        console.error(err);
                        alert("Erro ao apagar key do Anty: " + (err.message || String(err)));
                    }
                });
            });
        } catch (err) {
            console.error(err);
            antyKeysTbody.innerHTML =
                "<tr><td colspan='6'>Erro ao carregar keys.</td></tr>";
            antyKeysMsg.textContent =
                "Erro ao carregar keys: " + (err.message || String(err));
            antyKeysMsg.className = "msg msg-error";
        }
    }

    if (btnRefreshKeys) {
        btnRefreshKeys.addEventListener("click", () => loadAntyKeys());
    }

    if (antyFilterKey) {
        // atualiza a lista enquanto digita, igual no VIP
        antyFilterKey.addEventListener("input", () => {
            loadAntyKeys();
        });
    }

    // -----------------------------
    // LISTAR USUÁRIOS ANTY
    // -----------------------------
    const antyUsersTbody = document.getElementById("anty-users-tbody");
    const antyUsersMsg = document.getElementById("anty-users-msg");
    const antyUsersFilter = document.getElementById("anty-users-filter");
    const btnRefreshUsers = document.getElementById("btn-refresh-anty-users");

    // modal de edição de tempo
    const antyEditModal = document.getElementById("anty-edit-time-modal");
    const antyEditTitle = document.getElementById("anty-edit-time-title");
    const antyEditDays = document.getElementById("anty-edit-days");
    const antyEditHours = document.getElementById("anty-edit-hours");
    const antyEditCurrentExp = document.getElementById("anty-edit-current-exp");
    const antyEditCancel = document.getElementById("anty-edit-time-cancel");
    const antyEditSave = document.getElementById("anty-edit-time-save");

    const DAY_MS = 1000 * 60 * 60 * 24;
    const HOUR_MS = 1000 * 60 * 60;

    let antyUserBeingEdited = null;
    let antyUsersRequestId = 0;

let cachedAntyUsers = [];
let antySortMode = 0;
// 0 = normal
// 1 = menor tempo primeiro
// 2 = maior tempo primeiro

function msUntilAnty(expStr) {
    if (!expStr) return Infinity;
    const d = new Date(expStr);
    if (isNaN(d.getTime())) return Infinity;
    return d - new Date();
}

function sortAntyUsersByRemaining(list) {
    if (antySortMode === 0) return list;
    return [...list].sort((a, b) => {
        const msA = msUntilAnty(a.data_expiracao);
        const msB = msUntilAnty(b.data_expiracao);

        if (antySortMode === 1) return msA - msB;
        if (antySortMode === 2) return msB - msA;
        return 0;
    });
}


    function getRemainingInfo(expStr) {
        const result = { label: "—", days: 0, hours: 0 };

        if (!expStr) return result;
        const exp = new Date(expStr);
        if (isNaN(exp.getTime())) return result;

        const now = new Date();
        let diff = exp - now;
        if (diff <= 0) {
            result.label = "0d 0h";
            return result;
        }

        const days = Math.floor(diff / DAY_MS);
        const hours = Math.floor((diff % DAY_MS) / HOUR_MS);

        result.days = days;
        result.hours = hours;
        result.label = `${days}d ${hours}h`;
        return result;
    }

    function openAntyEditModal(user) {
        if (!antyEditModal || !antyEditDays || !antyEditHours) return;

        antyUserBeingEdited = user;

        const rem = getRemainingInfo(user.data_expiracao);
        antyEditDays.value = rem.days;
        antyEditHours.value = rem.hours;

        const expDate = user.data_expiracao ? new Date(user.data_expiracao) : null;
        if (expDate && !isNaN(expDate.getTime())) {
            antyEditCurrentExp.textContent =
                "Expiração atual: " + expDate.toLocaleString("pt-BR");
        } else {
            antyEditCurrentExp.textContent = "Sem expiração definida.";
        }

        const nome = user.usuario || `ID ${user.id}`;
        antyEditTitle.textContent = `Editar dias para ${nome}`;
        antyEditModal.classList.add("show");
    }

    function closeAntyEditModal() {
        if (!antyEditModal) return;
        antyEditModal.classList.remove("show");
        antyUserBeingEdited = null;
    }


        function renderAntyUsers() {
            if (!antyUsersTbody) return;

            const users = sortAntyUsersByRemaining(cachedAntyUsers || []);

            if (!users.length) {
                antyUsersTbody.innerHTML =
                    "<tr><td colspan='9'>Nenhum usuário encontrado.</td></tr>";
                return;
            }

            antyUsersTbody.innerHTML = "";

            for (const u of users) {
                const tr = document.createElement("tr");

                const ativoLabel = u.ativo ? "Ativo" : "Inativo";
                const ativoClass = u.ativo ? "status-pill-ok" : "status-pill-bad";

                const expDate = u.data_expiracao && new Date(u.data_expiracao);
                const expStr =
                    expDate && !isNaN(expDate.getTime())
                        ? expDate.toLocaleString("pt-BR")
                        : "—";

                const remaining = getRemainingInfo(u.data_expiracao);
                const plan = (u.plan_type || "LIMITADO").toUpperCase();
                const ipAccess = u.ip_access || "—";

                const toggleLabel = u.ativo ? "Desativar" : "Ativar";
                const toggleClass = u.ativo ? "btn-danger" : "btn-success";

                tr.innerHTML = `
    <td>${u.id}</td>
    <td>${u.usuario || "—"}</td>
    <td>${u.email || "—"}</td>
    <td>
        <select class="anty-user-plan">
            <option value="LIMITADO" ${plan === "LIMITADO" ? "selected" : ""}>Limitado</option>
            <option value="PREMIUM" ${plan === "PREMIUM" ? "selected" : ""}>Premium</option>
            <option value="PREMIUM_PLUS" ${plan === "PREMIUM_PLUS" ? "selected" : ""}>Premium Plus</option>
        </select>
    </td>
    <td><span class="${ativoClass}">${ativoLabel}</span></td>
    <td>
        <button type="button" class="anty-remaining-link">
            ${remaining.label}
        </button>
    </td>
    <td>${expStr}</td>
    <td>${ipAccess}</td>
    <td class="anty-actions-td">
  <div class="anty-actions">
    <button
      type="button"
      class="btn-small btn-warning anty-btn-restore-machine"
      title="Restaurar máquina"
    >
      Restaurar
    </button>

    <button
      type="button"
      class="btn-small ${toggleClass} anty-btn-toggle-active"
    >
      ${toggleLabel}
    </button>
  </div>
</td>
`;

                const planSelect = tr.querySelector(".anty-user-plan");
                const remainingBtn = tr.querySelector(".anty-remaining-link");
                const toggleBtn = tr.querySelector(".anty-btn-toggle-active");
                const restoreBtn = tr.querySelector(".anty-btn-restore-machine");

                if (restoreBtn) {
                    restoreBtn.addEventListener("click", async () => {
                        const nome = u.usuario || `ID ${u.id}`;

                        const ok = confirm(
                            `Restaurar máquina de ${nome}?\n\nIsso vai remover o dispositivo liberado (allowed_devices) e forçar novo vínculo.`
                        );
                        if (!ok) return;

                        try {
                            restoreBtn.disabled = true;

                            if (!window.api || !window.api.restoreAntyMachine) {
                                alert("restoreAntyMachine não está ligado no preload/main.js");
                                return;
                            }

                            const resp = await window.api.restoreAntyMachine({ userId: u.id });
                            const removed = resp?.deleted ?? 0;

                            alert(`✅ Máquina restaurada!\nRegistros removidos: ${removed}`);
                        } catch (err) {
                            console.error(err);
                            alert("Erro ao restaurar máquina: " + (err.message || String(err)));
                        } finally {
                            restoreBtn.disabled = false;
                        }
                    });
                }

                // trocar plano => salva na hora
                if (planSelect) {
                    planSelect.addEventListener("change", async () => {
                        const newPlan = planSelect.value;
                        try {
                            planSelect.disabled = true;
                            await window.api.updateAntyUser({
                                id: u.id,
                                planType: newPlan,
                                // mantém ativo/expiração do jeito que estão
                                isActive: u.ativo,
                                expiresAt: u.data_expiracao,
                            });
                            await loadAntyUsers();
                        } catch (err) {
                            console.error(err);
                            alert("Erro ao atualizar plano: " + (err.message || String(err)));
                        } finally {
                            planSelect.disabled = false;
                        }
                    });
                }

                // clicar no tempo restante => abre modal
                if (remainingBtn) {
                    remainingBtn.addEventListener("click", () => {
                        openAntyEditModal(u);
                    });
                }

                // botão Desativar / Ativar rápido
                if (toggleBtn) {
                    toggleBtn.addEventListener("click", async () => {
                        const now = new Date();
                        let isActive;
                        let expiresAt;

                        if (u.ativo) {
                            // Desativar agora
                            isActive = false;
                            expiresAt = now.toISOString();
                        } else {
                            // Ativar: se tiver exp futura, mantém; senão +30 dias
                            const exp = u.data_expiracao ? new Date(u.data_expiracao) : null;
                            if (exp && !isNaN(exp.getTime()) && exp > now) {
                                expiresAt = exp.toISOString();
                            } else {
                                const newExp = new Date(now.getTime() + 30 * DAY_MS);
                                expiresAt = newExp.toISOString();
                            }
                            isActive = true;
                        }

                        try {
                            toggleBtn.disabled = true;
                            await window.api.updateAntyUser({
                                id: u.id,
                                planType: u.plan_type,
                                isActive,
                                expiresAt,
                            });
                            await loadAntyUsers();
                        } catch (err) {
                            console.error(err);
                            alert(
                                "Erro ao atualizar status do usuário: " +
                                (err.message || String(err))
                            );
                        } finally {
                            toggleBtn.disabled = false;
                        }
                    });
                }

                antyUsersTbody.appendChild(tr);
            }
        }

    
async function loadAntyUsers() {
    if (!antyUsersTbody) return;

    // identifica esta chamada
    const requestId = ++antyUsersRequestId;

    antyUsersTbody.innerHTML = "<tr><td colspan='9'>Carregando...</td></tr>";
    antyUsersMsg.textContent = "";

    try {
        if (!window.api || !window.api.getAntyUsers) {
            cachedAntyUsers = [];
            antyUsersTbody.innerHTML =
                "<tr><td colspan='9'>⚠️ Listagem de usuários Anty ainda não foi ligada no back-end.</td></tr>";
            return;
        }

        const termo = (antyUsersFilter?.value || "").trim();
        const users = await window.api.getAntyUsers({ search: termo });

        // se já existe uma requisição mais nova em andamento,
        // ignora essa resposta pra não “voltar a lista”
        if (requestId !== antyUsersRequestId) {
            return;
        }

        cachedAntyUsers = users || [];
        renderAntyUsers();
    } catch (err) {
        console.error(err);

        // se já tem uma requisição mais nova, nem atualiza a UI
        if (requestId !== antyUsersRequestId) {
            return;
        }

        cachedAntyUsers = [];
        antyUsersTbody.innerHTML =
            "<tr><td colspan='9'>Erro ao carregar usuários.</td></tr>";
        antyUsersMsg.textContent =
            "Erro ao carregar usuários: " + (err.message || String(err));
        antyUsersMsg.className = "msg msg-error";
    }
}

    if (btnRefreshUsers) {
        btnRefreshUsers.addEventListener("click", () => loadAntyUsers());
    }

    if (antyUsersFilter) {
        // atualiza a lista enquanto digita
        antyUsersFilter.addEventListener("input", () => {
            loadAntyUsers();
        });
    }


// Ordenação do "Tempo restante" (igual no VIP): clica e alterna 3 modos
const thSortRem = document.getElementById("anty-th-sort-rem");
if (thSortRem) {
    thSortRem.style.cursor = "pointer";
    thSortRem.addEventListener("click", () => {
        antySortMode = (antySortMode + 1) % 3;

        if (antySortMode === 0) thSortRem.textContent = "Tempo restante ⏳";
        if (antySortMode === 1) thSortRem.textContent = "Tempo restante ⏳ ↑";
        if (antySortMode === 2) thSortRem.textContent = "Tempo restante ⏳ ↓";

        renderAntyUsers();
    });
}


    if (antyEditCancel) {
        antyEditCancel.addEventListener("click", () => {
            closeAntyEditModal();
        });
    }

    if (antyEditModal) {
        antyEditModal.addEventListener("click", (ev) => {
            if (ev.target === antyEditModal) {
                closeAntyEditModal();
            }
        });
    }

    if (antyEditSave) {
        antyEditSave.addEventListener("click", async () => {
            if (!antyUserBeingEdited) return;
            let d = Number(antyEditDays.value || "0");
            let h = Number(antyEditHours.value || "0");

            if (d < 0) d = 0;
            if (h < 0) h = 0;
            if (h > 23) h = 23;

            const now = new Date();
            const ms = d * DAY_MS + h * HOUR_MS;
            let isActive = ms > 0;
            const exp = new Date(now.getTime() + ms);

            try {
                antyEditSave.disabled = true;
                await window.api.updateAntyUser({
                    id: antyUserBeingEdited.id,
                    planType: antyUserBeingEdited.plan_type,
                    isActive,
                    expiresAt: exp.toISOString(),
                });
                closeAntyEditModal();
                await loadAntyUsers();
            } catch (err) {
                console.error(err);
                alert("Erro ao atualizar expiração: " + (err.message || String(err)));
            } finally {
                antyEditSave.disabled = false;
            }
        });
    }

    // -----------------------------
    // TROCA DE ABAS (Keys / Usuários)
    // -----------------------------
    const antyTabsButtons = document.querySelectorAll(".tab-btn[data-anty-tab]");
    const sectionKeys = document.getElementById("anty-tab-keys");
    const sectionUsers = document.getElementById("anty-tab-users");

    function showAntyTab(tab) {
        antyTabsButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.antyTab === tab);
        });

        if (sectionKeys && sectionUsers) {
            sectionKeys.classList.toggle("anty-tab--hidden", tab !== "keys");
            sectionUsers.classList.toggle("anty-tab--hidden", tab !== "users");
        }

        if (tab === "keys") {
            loadAntyKeys();
        } else if (tab === "users") {
            loadAntyUsers();
        }
    }

    antyTabsButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.antyTab;
            showAntyTab(tab);
        });
    });

// Se veio do VIP (clicou no Anty do usuário), abre direto a aba Usuários e filtra
let jumpId = null;
try {
    jumpId = localStorage.getItem("anty_jump_user_id");
} catch (_) {
    jumpId = null;
}

if (jumpId) {
    try {
        localStorage.removeItem("anty_jump_user_id");
    } catch (_) {
        // ignore
    }

    if (antyUsersFilter) {
        antyUsersFilter.value = jumpId;
    }

    showAntyTab("users");
} else {
    // aba padrão
    showAntyTab("keys");
}
});