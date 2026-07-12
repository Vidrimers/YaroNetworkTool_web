// --- Auth: deep-link token + Telegram OAuth ---

import { setToken, setClientUuid, setAdmin, api } from "./api.js";

export async function initAuth() {
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  const tgId = params.get("tg");

  if (token) {
    const body = { token };
    if (tgId) body.telegram_id = tgId;
    const data = await api("POST", "/api/auth/token", body);
    if (data && data.client_uuid) {
      setToken(token);
      setClientUuid(data.client_uuid);
      setAdmin(data.admin);
      history.replaceState(null, "", location.pathname);
      return true;
    }
  }

  // Telegram OAuth callback: #tgAuthResult=...
  const tgMatch = location.hash.match(/^#tgAuthResult=(.+)/);
  if (tgMatch) {
    try {
      const decoded = JSON.parse(decodeURIComponent(atob(tgMatch[1])));
      const telegramId = decoded.id;
      if (telegramId) {
        const res = await fetch("/api/auth/find-by-telegram/" + telegramId);
        if (res.ok) {
          const data = await res.json();
          if (data.token && data.client_uuid) {
            setToken(data.token);
            setClientUuid(data.client_uuid);
            setAdmin(data.admin);
            history.replaceState(null, "", location.pathname);
            return true;
          }
        }
      }
    } catch {}
    history.replaceState(null, "", location.pathname);
    // Show "not found" message
    const el = document.getElementById("authContent");
    if (el) {
      el.innerHTML = `
        <div style="text-align:center">
          <p style="font-size:1.1em;margin-bottom:12px">Аккаунт не найден</p>
          <p class="text-muted" style="font-size:0.9em">
            Отправьте команду <code>/start</code> боту <b>@YaroAutoAdminPCbot</b>,<br>
            затем вернитесь сюда и войдите снова.
          </p>
          <button class="btn btn-telegram" onclick="location.reload()" style="margin-top:16px">
            Попробовать снова
          </button>
        </div>`;
    }
  }

  return false;
}
