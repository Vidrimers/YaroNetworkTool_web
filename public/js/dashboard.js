// --- Dashboard page ---

import { api, getClientUuid } from "./api.js";
import { toast } from "./toast.js";

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

export async function renderDashboard(el) {
  const uuid = getClientUuid();
  if (!uuid) { el.innerHTML = '<p class="text-muted">Ошибка: UUID не найден</p>'; return; }

  el.innerHTML = '<p class="text-muted">Загрузка...</p>';

  try {
    const [clientRes, subRes, statsRes] = await Promise.all([
      api("GET", `/api/clients/${uuid}`),
      api("GET", `/api/clients/${uuid}/subscription`),
      api("GET", `/api/clients/${uuid}/traffic-stats`).catch(() => null),
    ]);

    const c = clientRes?.client || clientRes || {};
    const sub = subRes?.subscription || subRes || {};
    const ts = statsRes?.stats || {};

    const status = c.status || "active";
    const statusMap = { active: ["active", "Активен"], blocked: ["blocked", "Заблокирован"], expired: ["expired", "Истёк"] };
    const [badgeClass, statusText] = statusMap[status] || ["expired", status];

    const daysLeft = sub.subscription_days_remaining ?? sub.days_remaining ?? "N/A";
    const limitGB = c.traffic_limit_gb || 100;
    const monthGB = ts.month || 0;
    const monthPct = limitGB > 0 ? Math.min((monthGB / limitGB) * 100, 100).toFixed(1) : 0;
    const barColor = monthPct > 90 ? "#f44336" : monthPct > 70 ? "#ff9800" : "#4caf50";

    let html = "";

    // Warning banner
    if (daysLeft !== "N/A" && daysLeft <= 7) {
      html += `<div class="alert alert-warning">Подписка истекает через ${daysLeft} дн. Продлите чтобы не потерять доступ.</div>`;
    }

    html += `
      <div class="card">
        <h2>${esc(c.name || c.email || "Пользователь")}</h2>
        <div class="card-row"><span class="label">UUID</span><span class="value mono">${esc(uuid)}</span></div>
        <div class="card-row"><span class="label">Статус</span><span class="value"><span class="badge badge-${badgeClass}">${statusText}</span></span></div>
        <div class="card-row"><span class="label">Подписка</span><span class="value">${daysLeft} дн. осталось</span></div>
      </div>

      <div class="card">
        <h2>Трафик</h2>
        <div class="card-row"><span class="label">За день</span><span class="value">${(ts.day || 0).toFixed(2)} GB</span></div>
        <div class="card-row"><span class="label">За неделю</span><span class="value">${(ts.week || 0).toFixed(2)} GB</span></div>
        <div class="card-row"><span class="label">За месяц</span><span class="value">${monthGB.toFixed(2)} / ${limitGB} GB (${monthPct}%)</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${monthPct}%;background:${barColor}"></div></div>
        ${c.traffic_reset_date ? `<div class="card-row mt-12"><span class="label">Сброс трафика</span><span class="value">${new Date(c.traffic_reset_date).toLocaleDateString("ru-RU")}</span></div>` : ""}
      </div>

      <div class="card">
        <div class="card-row"><span class="label">Устройства</span><span class="value">${c.active_devices ?? "N/A"} / ${c.max_devices || 2}</span></div>
        <div class="card-row"><span class="label">Предупреждения</span><span class="value">${c.warnings_count || 0} / 3</span></div>
      </div>
    `;

    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<p class="text-muted">Ошибка загрузки: ${esc(err.message)}</p>`;
  }
}
