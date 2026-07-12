import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const VPS_API_URL = process.env.VPS_API_URL || "http://127.0.0.1:333";
const VPS_API_KEY = process.env.VPS_API_KEY || "";
const ADMINUI_URL = process.env.ADMINUI_URL || "";
const ADMINUI_JWT_SECRET = process.env.ADMINUI_JWT_SECRET || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_ADMIN_ID = process.env.TELEGRAM_ADMIN_ID || "";

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not set in .env");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Helper: proxy request to VPS Management API ---
async function vpsAPI(method, apiPath, body) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${VPS_API_KEY}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${VPS_API_URL}${apiPath}`, opts);
  return resp.json();
}

// --- Helper: proxy request to AdminUI API ---
function getAdminUIToken() {
  if (!ADMINUI_JWT_SECRET) return "";
  return jwt.sign({ username: "portal", device: "portal" }, ADMINUI_JWT_SECRET, { expiresIn: "1h" });
}
async function adminUIAPI(method, apiPath, body) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${getAdminUIToken()}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${ADMINUI_URL}${apiPath}`, opts);
  return resp.json();
}

// --- JWT middleware ---
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

// --- Auth: Telegram OAuth URL ---
app.get("/api/auth/telegram-url", (req, res) => {
  if (!TELEGRAM_BOT_TOKEN) return res.status(500).json({ message: "Bot token not configured" });
  const botId = TELEGRAM_BOT_TOKEN.split(":")[0];
  const origin = req.query.origin || `https://${req.headers.host}`;
  const url = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(origin)}&request_access=write`;
  res.json({ url });
});

// --- Auth: exchange JWT deep-link token for session ---
app.post("/api/auth/token", (req, res) => {
  const { token, telegram_id } = req.body;
  if (!token) return res.status(400).json({ message: "Token required" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.telegram_id && telegram_id && String(decoded.telegram_id) !== String(telegram_id)) {
      return res.status(403).json({ message: "Token belongs to another user" });
    }
    res.json({ client_uuid: decoded.client_uuid, admin: decoded.admin || false });
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

// --- Auth: create deep-link token (called by Telegram bot) ---
app.post("/api/auth/create-token", verifyToken, (req, res) => {
  const { client_uuid, admin, telegram_id } = req.body;
  if (!client_uuid) return res.status(400).json({ message: "client_uuid required" });
  const payload = { client_uuid, admin: admin || false };
  if (telegram_id) payload.telegram_id = telegram_id;
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token });
});

// --- Auth: find client by telegram_id and issue JWT (for OAuth flow) ---
app.get("/api/auth/find-by-telegram/:telegramId", async (req, res) => {
  try {
    const data = await vpsAPI("GET", "/api/clients");
    const clients = data.clients || data || [];
    const client = Array.isArray(clients)
      ? clients.find((c) => String(c.telegram_id) === String(req.params.telegramId))
      : null;
    if (!client) return res.status(404).json({ message: "Client not found" });
    const isAdminUser = String(client.telegram_id) === String(TELEGRAM_ADMIN_ID);
    const token = jwt.sign({ client_uuid: client.uuid, admin: isAdminUser, telegram_id: client.telegram_id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, client_uuid: client.uuid, admin: isAdminUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- Proxy: all client API calls to VPS ---

// Client info
app.get("/api/clients/:uuid", verifyToken, async (req, res) => {
  try {
    res.json(await vpsAPI("GET", `/api/clients/${req.params.uuid}`));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// All clients (admin)
app.get("/api/clients", verifyToken, async (req, res) => {
  try {
    res.json(await vpsAPI("GET", "/api/clients"));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Traffic stats
app.get("/api/clients/:uuid/traffic-stats", verifyToken, async (req, res) => {
  try {
    res.json(await vpsAPI("GET", `/api/clients/${req.params.uuid}/traffic-stats`));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Subscription
app.get("/api/clients/:uuid/subscription", verifyToken, async (req, res) => {
  try {
    res.json(await vpsAPI("GET", `/api/clients/${req.params.uuid}/subscription`));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Subscription URL (returns base64, decoded here)
app.get("/api/subscription/:uuid", verifyToken, async (req, res) => {
  try {
    const resp = await fetch(`${VPS_API_URL}/subscription/${req.params.uuid}`, {
      headers: { Authorization: `Bearer ${VPS_API_KEY}` },
    });
    const text = await resp.text();
    try {
      const decoded = Buffer.from(text.trim(), "base64").toString("utf8");
      res.json({ success: true, links: decoded });
    } catch {
      res.json({ success: true, links: text });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- Admin-only proxy routes ---

// Client CRUD
app.post("/api/clients", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("POST", "/api/clients", req.body)); } catch (err) { res.status(500).json({ message: err.message }); }
});
app.put("/api/clients/:uuid", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("PUT", `/api/clients/${req.params.uuid}`, req.body)); } catch (err) { res.status(500).json({ message: err.message }); }
});
app.delete("/api/clients/:uuid", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("DELETE", `/api/clients/${req.params.uuid}`)); } catch (err) { res.status(500).json({ message: err.message }); }
});

// Client actions
app.post("/api/clients/:uuid/extend", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("POST", `/api/clients/${req.params.uuid}/extend`, req.body)); } catch (err) { res.status(500).json({ message: err.message }); }
});
app.post("/api/clients/:uuid/block", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("POST", `/api/clients/${req.params.uuid}/block`, req.body)); } catch (err) { res.status(500).json({ message: err.message }); }
});
app.post("/api/clients/:uuid/unblock", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("POST", `/api/clients/${req.params.uuid}/unblock`)); } catch (err) { res.status(500).json({ message: err.message }); }
});
app.post("/api/clients/:uuid/warn", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("POST", `/api/clients/${req.params.uuid}/warn`, req.body)); } catch (err) { res.status(500).json({ message: err.message }); }
});
app.post("/api/clients/:uuid/reset-warnings", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("POST", `/api/clients/${req.params.uuid}/reset-warnings`)); } catch (err) { res.status(500).json({ message: err.message }); }
});

// Traffic reset
app.post("/api/stats/clients/:uuid/reset", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("POST", `/api/stats/clients/${req.params.uuid}/reset`)); } catch (err) { res.status(500).json({ message: err.message }); }
});

// Extension requests
app.get("/api/extension-requests", verifyToken, async (req, res) => {
  try {
    const qs = req.query.client_uuid ? `?client_uuid=${req.query.client_uuid}` : "";
    res.json(await vpsAPI("GET", `/api/extension-requests${qs}`));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
app.post("/api/extension-requests/create", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("POST", "/api/extension-requests/create", req.body)); } catch (err) { res.status(500).json({ message: err.message }); }
});
app.post("/api/extension-requests/:id/approve", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("POST", `/api/extension-requests/${req.params.id}/approve`, req.body)); } catch (err) { res.status(500).json({ message: err.message }); }
});
app.post("/api/extension-requests/:id/deny", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("POST", `/api/extension-requests/${req.params.id}/deny`, req.body)); } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- Xray service management (proxied to VPS) ---
app.get("/api/xray/status", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("GET", "/api/xray/status")); } catch (err) { res.status(500).json({ message: err.message }); }
});
app.post("/api/xray/service/:action", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("POST", `/api/xray/service/${req.params.action}`)); } catch (err) { res.status(500).json({ message: err.message }); }
});
app.get("/api/xray/logs", verifyToken, async (req, res) => {
  try { res.json(await vpsAPI("GET", "/api/xray/logs")); } catch (err) { res.status(500).json({ message: err.message }); }
});
app.post("/api/xray/checkers/:script", verifyToken, async (req, res) => {
  try { res.json(await adminUIAPI("POST", `/api/xray/checkers/${req.params.script}`)); } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- SPA fallback ---
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Yaro Network Tool Portal started on http://localhost:${PORT}`);
});
