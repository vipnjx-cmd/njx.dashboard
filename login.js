// login.js
window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const userInput = document.getElementById("username");
  const passInput = document.getElementById("password");
  const rememberInput = document.getElementById("remember");
  const msgEl = document.getElementById("login-msg");
  const btn = document.getElementById("btn-login");

  if (!form) {
    console.error("login.js: form #login-form não encontrado");
    return;
  }

  function setMessage(text, type = "") {
    msgEl.textContent = text || "";
    msgEl.className = "login-msg" + (type ? " " + type : "");
  }

  console.log("login.js carregado");

  // 🔹 Carregar usuário + senha salvos
  try {
    const savedUser = localStorage.getItem("panel_admin_username");
    const savedPass = localStorage.getItem("panel_admin_password");
    const savedRemember = localStorage.getItem("panel_admin_remember");

    console.log("login.js: carregando salvos", {
      savedUser,
      savedPass,
      savedRemember,
    });

    if (savedUser) {
      userInput.value = savedUser;
    }

    if (savedPass) {
      passInput.value = savedPass;
    }

    if (rememberInput) {
      rememberInput.checked = savedRemember === "1";
    }
  } catch (e) {
    console.warn("Não foi possível acessar localStorage:", e);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("login.js: submit disparado");

    const username = userInput.value.trim();
    const password = passInput.value;
    const remember = rememberInput?.checked ?? false;

    if (!username || !password) {
      setMessage("Preencha usuário e senha.", "error");
      return;
    }

    // 🔥 IMPORTANTE: salvar ANTES de chamar o backend
    try {
      if (remember) {
        localStorage.setItem("panel_admin_username", username);
        localStorage.setItem("panel_admin_password", password);
        localStorage.setItem("panel_admin_remember", "1");
        console.log("login.js: dados salvos no localStorage");
      } else {
        localStorage.removeItem("panel_admin_username");
        localStorage.removeItem("panel_admin_password");
        localStorage.setItem("panel_admin_remember", "0");
        console.log("login.js: dados removidos do localStorage");
      }
    } catch (e) {
      console.warn("Erro ao mexer no localStorage:", e);
    }

    btn.disabled = true;
    btn.textContent = "Entrando...";
    setMessage("");

    if (!window.api || !window.api.adminLogin) {
      console.error("window.api.adminLogin não encontrado");
      setMessage("Erro interno: API de login não disponível.", "error");
      btn.disabled = false;
      btn.textContent = "Entrar";
      return;
    }

    try {
      const resp = await window.api.adminLogin({ username, password, remember });
      console.log("Resposta adminLogin:", resp);

      if (!resp || !resp.success) {
        setMessage(resp?.error || "Usuário ou senha inválidos.", "error");
        btn.disabled = false;
        btn.textContent = "Entrar";
        return;
      }

      setMessage("Login realizado. Carregando painel...", "success");
      // depois disso o main.js carrega index.html
    } catch (err) {
      console.error("Erro no submit do login:", err);
      setMessage("Erro ao logar: " + (err.message || err), "error");
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });
});
