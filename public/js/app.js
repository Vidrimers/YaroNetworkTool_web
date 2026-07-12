// --- Main app entry ---

import { getToken, clearAuth, getClientUuid, isAdmin, api } from "./api.js";
import { initAuth } from "./auth.js";
import { renderDashboard } from "./dashboard.js";
import { renderConnection } from "./connection.js";
import { renderExtend } from "./extend.js";
import { renderRequests } from "./requests.js";
import { renderDownload } from "./download.js";
import { renderHelp } from "./help.js";
import { renderAdmin } from "./admin.js";
import { toast } from "./toast.js";

const pages = {
  dashboard: renderDashboard,
  connection: renderConnection,
  extend: renderExtend,
  requests: renderRequests,
  download: renderDownload,
  help: renderHelp,
  admin: renderAdmin,
};

let currentPage = null;

async function init() {
  // Try to restore session from localStorage
  const token = getToken();
  if (token) {
    const data = await api("POST", "/api/auth/token", { token });
    if (data && data.client_uuid) {
      const { setClientUuid, setAdmin } = await import("./api.js");
      setClientUuid(data.client_uuid);
      setAdmin(data.admin);
      showApp();
      return;
    }
    clearAuth();
  }

  // Try deep-link / OAuth
  const ok = await initAuth();
  if (ok) {
    showApp();
  } else {
    showAuth();
  }
}

function showAuth() {
  document.getElementById("authScreen").style.display = "flex";
  document.getElementById("app").style.display = "none";

  // Telegram OAuth button
  const btn = document.getElementById("btnTelegramLogin");
  if (btn && !btn._bound) {
    btn._bound = true;
    btn.addEventListener("click", async () => {
      try {
        const resp = await fetch("/api/auth/telegram-url?origin=" + encodeURIComponent(location.origin));
        const data = await resp.json();
        if (data.url) location.href = data.url;
      } catch {
        alert("Ошибка подключения к серверу");
      }
    });
  }
}

function showApp() {
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("app").style.display = "block";

  // Show/hide admin nav
  if (isAdmin()) {
    document.getElementById("navAdmin").style.display = "";
  }

  // Set up nav
  document.querySelectorAll(".nav-links a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(a.dataset.page);
      // Close mobile menu after nav
      document.getElementById("navLinks").classList.remove("open");
    });
  });

  // Hamburger toggle
  document.getElementById("hamburger").addEventListener("click", () => {
    document.getElementById("navLinks").classList.toggle("open");
  });

  // Logout
  document.getElementById("btnLogout").addEventListener("click", () => {
    clearAuth();
    location.reload();
  });

  navigate("dashboard");
}

function navigate(page) {
  if (!pages[page]) return;
  currentPage = page;

  // Update nav
  document.querySelectorAll(".nav-links a").forEach((a) => {
    a.classList.toggle("active", a.dataset.page === page);
  });

  // Hide all pages, show target
  document.querySelectorAll(".page").forEach((p) => (p.style.display = "none"));
  const target = document.getElementById(`page-${page}`);
  target.style.display = "block";

  // Render
  pages[page](target);
}

init();
