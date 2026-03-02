const { app, BrowserWindow, ipcMain, Menu, shell } = require("electron");
const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

// =========================
// Railway / Server mode
// =========================
const isServer = process.env.RAILWAY_ENVIRONMENT || process.env.PORT;

// se estiver no Railway, NÃO inicia Electron
if (isServer) {
  console.log("Rodando no Railway (modo servidor). Electron desativado.");
}

// dev vs build
if (app && app.isPackaged) {
  dotenv.config({ path: path.join(process.resourcesPath, ".env") });
} else {
  dotenv.config();
}

let mainWindow = null;
let isAuthenticated = false;
let currentAdminId = null;
let adminStatusInterval = null;

function ensureAuthenticated() {
  if (!isAuthenticated || !currentAdminId) {
    throw new Error("Acesso negado: administrador não autenticado.");
  }
}

// =========================
// Conexões Postgres
// =========================
const antyPool = new Pool({
  connectionString: process.env.ANTY_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// =========================
// Criar janela (somente local)
// =========================
function createWindow() {
  if (isServer) return;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("login.html");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// =========================
// Inicialização
// =========================
if (!isServer) {
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
}
