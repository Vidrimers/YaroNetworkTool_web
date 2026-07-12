// --- Requests page ---

import { api, getClientUuid } from "./api.js";

function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

const STATUS_MAP = {
  pending: ["badge-expired", "Ожидает"],
  approved: ["badge-active", "Одобрено"],
  denied: ["badge-blocked", "Отклонено"],
};

export async function renderRequests(el) {
  const uuid = getClientUuid();
  if (!uuid) { el.innerHTML = '<p class="text-muted">UUID не найден</p>'; return; }

  el.innerHTML = '<p class="text-muted">Загрузка...</p>';

  try {
    const res = await api("GET", `/api/extension-requests?client_uuid=${uuid}`);
    const requests = res?.requests || res || [];

    if (!requests.length) {
      el.innerHTML = `
        <div class="card">
          <h2>Мои запросы</h2>
          <p class="text-muted">У вас пока нет запросов на продление.</p>
        </div>`;
      return;
    }

    const rows = requests.map(r => {
      const [cls, label] = STATUS_MAP[r.status] || ["", r.status];
      const days = r.approved_days || r.requested_days || (r.requested_months ? r.requested_months * 30 : "?");
      return `
        <div class="card-row">
          <span class="label">${new Date(r.created_at).toLocaleDateString("ru-RU")}</span>
          <span class="value">${days} дн. <span class="badge ${cls}">${label}</span></span>
        </div>`;
    }).join("");

    el.innerHTML = `
      <div class="card">
        <h2>Мои запросы</h2>
        ${rows}
      </div>`;
  } catch (err) {
    el.innerHTML = `<p class="text-muted">Ошибка: ${esc(err.message)}</p>`;
  }
}
