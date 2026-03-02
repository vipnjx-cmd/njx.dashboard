const dotenv = require("dotenv");
const path = require("path");

// =========================
// ENV
// =========================
dotenv.config({
  path: process.env.RAILWAY_ENVIRONMENT
    ? undefined
    : path.join(__dirname, ".env"),
});

// =========================
// Detecta se está no Railway
// =========================
const IS_SERVER = !!process.env.RAILWAY_ENVIRONMENT;

const { Pool } = require("pg");

// =========================
// DB
// =========================
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definido.");
}

const antyPool = new Pool({
  connectionString: process.env.ANTY_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// =========================
// SERVER MODE (Railway)
// =========================
if (IS_SERVER) {
  const express = require("express");
  const app = express();

  app.use(express.json());

  app.get("/", async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT NOW()");
      res.json({
        status: "running",
        time: rows[0],
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const port = process.env.PORT || 3000;

  app.listen(port, () => {
    console.log("Servidor rodando na porta", port);
  });

  return;
}

// =========================
// ELECTRON MODE (LOCAL)
// =========================
const { app, BrowserWindow, ipcMain, Menu, shell } = require("electron");

let mainWindow = null;
let isAuthenticated = false;

function createWindow() {
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

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// =========================
// IPC TEST (mantive mínimo para não quebrar)
// =========================
ipcMain.handle("ping-db", async () => {
  const { rows } = await pool.query("SELECT NOW()");
  return rows[0];
});
