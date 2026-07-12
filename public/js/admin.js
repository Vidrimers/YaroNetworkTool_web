// --- Admin panel ---

import { api } from "./api.js";
import { toast } from "./toast.js";
import { getTelegramId } from "./api.js";

function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

let allClients = [];
let currentSort = "name";

// --- Modal helpers ---
function showModal(title, bodyHtml, buttons) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box" style="position:relative">
        <h2>${esc(title)}</h2>
        <button class="modal-close" data-idx="-1">&times;</button>
        <div>${bodyHtml}</div>
        <div class="flex gap-8 mt-12 flex-wrap">
          ${(buttons || [{ text: "Закрыть", cls: "btn-secondary" }]).map((b, i) =>
            `<button class="btn btn-sm ${b.cls}" data-idx="${i}">${esc(b.text)}</button>`
          ).join("")}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", e => {
      const btn = e.target.closest("[data-idx]");
      if (btn) { overlay.remove(); resolve(parseInt(btn.dataset.idx)); }
      else if (e.target === overlay) { overlay.remove(); resolve(-1); }
    });
  });
}

async function promptModal(title, placeholder, def = "") {
  const idx = await showModal(title, `
    <input type="text" class="form-control" id="_modalInput" value="${esc(def)}" placeholder="${esc(placeholder)}">
  `, [{ text: "Отмена", cls: "btn-secondary" }, { text: "OK", cls: "btn-success" }]);
  if (idx !== 1) return null;
  return document.getElementById("_modalInput")?.value || null;
}

async function confirmModal(title, msg) {
  const idx = await showModal(title, msg ? `<p>${esc(msg)}</p>` : "", [
    { text: "Отмена", cls: "btn-secondary" },
    { text: "Да", cls: "btn-danger" },
  ]);
  return idx === 1;
}

function clientPicker(title, clients) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const render = (filter = "") => {
      const filtered = filter ? clients.filter(c => (c.name || c.email || "").toLowerCase().includes(filter.toLowerCase())) : clients;
      if (!filtered.length) return '<p class="text-muted mt-12">Нет результатов</p>';
      return filtered.map(c => `
        <div class="client-row" data-uuid="${esc(c.uuid)}">
          <span>${c.status === "blocked" ? "🔴" : "🟢"}</span>
          <span style="flex:1;font-weight:500">${esc(c.name || c.email)}</span>
        </div>`).join("");
    };
    overlay.innerHTML = `
      <div class="modal-box" style="position:relative">
        <h2>${esc(title)}</h2>
        <button class="modal-close" data-close>&times;</button>
        <input type="text" class="form-control mb-8" id="_pickerSearch" placeholder="Поиск...">
        <div id="_pickerList" style="max-height:350px;overflow-y:auto">${render()}</div>
      </div>`;
    document.body.appendChild(overlay);
    const search = overlay.querySelector("#_pickerSearch");
    const list = overlay.querySelector("#_pickerList");
    search.focus();
    search.addEventListener("input", () => { list.innerHTML = render(search.value); });
    overlay.addEventListener("click", e => {
      if (e.target.closest("[data-close]") || e.target === overlay) { overlay.remove(); resolve(null); return; }
      const row = e.target.closest(".client-row");
      if (row) { overlay.remove(); resolve(clients.find(c => c.uuid === row.dataset.uuid)); }
    });
  });
}

// --- API helper for admin ---
async function adminAPI(method, path, body) {
  return api(method, `/api${path}`, body);
}

// --- Render ---
export async function renderAdmin(el) {
  el.innerHTML = '<p class="text-muted">Загрузка...</p>';

  try {
    const data = await adminAPI("GET", "/clients");
    allClients = data.clients || data || [];
  } catch { allClients = []; }

  renderAdminPanel(el);
}

function renderAdminPanel(el) {
  el.innerHTML = `
    <!-- Service status -->
    <div class="card">
      <h2>Управление сервисом</h2>
      <div class="flex gap-8 flex-wrap" id="adminServiceBtns">
        <button class="admin-action" data-action="check-status">Проверить статус</button>
        <button class="admin-action" data-action="start">Запустить</button>
        <button class="admin-action" data-action="restart">Перезапустить</button>
        <button class="admin-action" data-action="stop">Остановить</button>
        <button class="admin-action" data-action="logs">Логи</button>
      </div>
      <div id="adminServiceResult" class="mt-12"></div>
    </div>

    <!-- Clients -->
    <div class="card">
      <div class="flex justify-between items-center mb-8">
        <h2 style="margin-bottom:0">Клиенты (${allClients.length})</h2>
        <select class="form-control" style="width:auto" id="adminSortSelect">
          <option value="name">По имени</option>
          <option value="traffic-desc">Трафик ↓</option>
          <option value="traffic-asc">Трафик ↑</option>
          <option value="status">По статусу</option>
        </select>
      </div>
      <div class="client-list" id="adminClientList"></div>
    </div>

    <!-- Admin actions -->
    <div class="card">
      <h2>Админ-панель</h2>
      <div class="admin-grid" id="adminActionsGrid">
        <div class="admin-action" data-act="add">Добавить клиента</div>
        <div class="admin-action" data-act="remove">Удалить клиента</div>
        <div class="admin-action" data-act="rename">Переименовать</div>
        <div class="admin-action" data-act="extend">Продлить</div>
        <div class="admin-action" data-act="limit">Лимит трафика</div>
        <div class="admin-action" data-act="limit-all">Лимит для всех</div>
        <div class="admin-action" data-act="bans">Баны и предупр.</div>
        <div class="admin-action" data-act="check-sub">Проверить подписки</div>
        <div class="admin-action" data-act="check-traffic">Проверить трафик</div>
        <div class="admin-action" data-act="check-devices">Устройства</div>
        <div class="admin-action" data-act="requests">Запросы</div>
      </div>
      <div id="adminActionResult" class="mt-12"></div>
    </div>

    <!-- Logs modal placeholder -->
    <div id="adminLogsModal" style="display:none" class="modal-overlay">
      <div class="modal-box" style="position:relative;max-width:700px">
        <h2>Логи Xray</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').style.display='none'">&times;</button>
        <pre id="adminLogsContent" style="background:rgba(0,0,0,.3);padding:12px;border-radius:8px;max-height:400px;overflow:auto;font-size:.85em;color:#a0a0a0;white-space:pre-wrap;word-break:break-all"></pre>
      </div>
    </div>
  `;

  // Sort select
  document.getElementById("adminSortSelect").addEventListener("change", e => {
    currentSort = e.target.value;
    renderClientList();
  });
  document.getElementById("adminSortSelect").value = currentSort;

  renderClientList();
  bindServiceButtons();
  bindAdminActions();
}

async function renderClientList() {
  const list = document.getElementById("adminClientList");
  if (!list) return;

  // Fetch traffic stats for all clients
  const statsMap = {};
  await Promise.all(allClients.map(async c => {
    try {
      const res = await adminAPI("GET", `/clients/${c.uuid}/traffic-stats`);
      statsMap[c.uuid] = res?.stats || {};
    } catch { statsMap[c.uuid] = {}; }
  }));

  const sorted = [...allClients];
  if (currentSort === "name") sorted.sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || ""));
  else if (currentSort === "traffic-desc") sorted.sort((a, b) => ((statsMap[b.uuid]?.month) || 0) - ((statsMap[a.uuid]?.month) || 0));
  else if (currentSort === "traffic-asc") sorted.sort((a, b) => ((statsMap[a.uuid]?.month) || 0) - ((statsMap[b.uuid]?.month) || 0));
  else if (currentSort === "status") {
    const order = { blocked: 0, active: 1 };
    sorted.sort((a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2));
  }

  list.innerHTML = sorted.map(c => {
    const status = c.status || "active";
    const icon = status === "active" ? "🟢" : status === "blocked" ? "🔴" : "🟡";
    const limit = c.traffic_limit_gb || 100;
    const month = statsMap[c.uuid]?.month ?? 0;
    return `
      <div class="client-row" data-uuid="${esc(c.uuid)}">
        <span>${icon}</span>
        <span style="flex:1;font-weight:500">${esc(c.name || c.email)}</span>
        <span class="text-muted" style="font-size:.85em">${month.toFixed(2)} / ${limit} GB</span>
        <span style="font-size:1.1em">ℹ️</span>
      </div>`;
  }).join("");

  list.querySelectorAll(".client-row").forEach(row => {
    row.addEventListener("click", () => showClientModal(row.dataset.uuid));
  });
}

async function showClientModal(uuid) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = '<div class="modal-box"><p class="text-muted">Загрузка...</p></div>';
  document.body.appendChild(modal);

  try {
    const [clientRes, subRes, statsRes] = await Promise.all([
      adminAPI("GET", `/clients/${uuid}`),
      adminAPI("GET", `/clients/${uuid}/subscription`),
      adminAPI("GET", `/clients/${uuid}/traffic-stats`).catch(() => null),
    ]);

    const c = clientRes?.client || clientRes || {};
    const sub = subRes?.subscription || subRes || {};
    const ts = statsRes?.stats || {};

    const status = c.status || "active";
    const statusColor = status === "active" ? "#4caf50" : status === "blocked" ? "#f44336" : "#ff9800";
    const daysLeft = sub.subscription_days_remaining ?? sub.days_remaining ?? "N/A";
    const limitGB = c.traffic_limit_gb || 100;
    const monthPct = limitGB > 0 ? ((ts.month || 0) / limitGB * 100).toFixed(1) : 0;

    modal.innerHTML = `
      <div class="modal-box" style="position:relative">
        <h2>${esc(c.name || c.email)}</h2>
        <button class="modal-close" data-close>&times;</button>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="card-row"><span class="label">UUID</span><span class="value mono">${esc(c.uuid)}</span></div>
          <div class="card-row"><span class="label">Email</span><span class="value">${esc(c.email || "N/A")}</span></div>
          <div class="card-row"><span class="label">Telegram ID</span><span class="value">${c.telegram_id || "N/A"}</span></div>
          <div class="card-row"><span class="label">Статус</span><span class="value" style="color:${statusColor};font-weight:600">${status}</span></div>
          <div class="card-row"><span class="label">Подписка</span><span class="value">${daysLeft} дн.</span></div>
          <div class="card-row"><span class="label">Трафик (день)</span><span class="value">${(ts.day || 0).toFixed(2)} GB</span></div>
          <div class="card-row"><span class="label">Трафик (неделя)</span><span class="value">${(ts.week || 0).toFixed(2)} GB</span></div>
          <div class="card-row"><span class="label">Трафик (месяц)</span><span class="value">${(ts.month || 0).toFixed(2)} / ${limitGB} GB (${monthPct}%)</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${monthPct}%;background:${monthPct > 90 ? '#f44336' : monthPct > 70 ? '#ff9800' : '#4caf50'}"></div></div>
          <div class="card-row"><span class="label">Устройства</span><span class="value">${c.max_devices || 2}</span></div>
          <div class="card-row"><span class="label">Предупреждения</span><span class="value">${c.warnings_count || 0} / 3</span></div>
        </div>
        <div class="flex gap-8 mt-12 flex-wrap" id="modalClientBtns"></div>
      </div>`;

    const btns = document.getElementById("modalClientBtns");
    if (status === "blocked") {
      btns.innerHTML += `<button class="btn btn-sm btn-success" data-act="unblock">Разблокировать</button>`;
    } else {
      btns.innerHTML += `<button class="btn btn-sm btn-danger" data-act="block">Заблокировать</button>`;
    }
    btns.innerHTML += `
      <button class="btn btn-sm btn-primary" data-act="sub-url">Подписка URL</button>
      <button class="btn btn-sm btn-primary" data-act="sub-links">Ссылки</button>
      <button class="btn btn-sm btn-primary" data-act="extend">Продлить</button>
      <button class="btn btn-sm btn-secondary" data-act="warn">Предупреждение</button>
      <button class="btn btn-sm btn-secondary" data-act="reset-warnings">Сброс предупр.</button>
      <button class="btn btn-sm btn-secondary" data-act="reset-traffic">Сброс трафика</button>
      <button class="btn btn-sm btn-primary" data-act="set-limit">Лимит</button>
      <button class="btn btn-sm btn-secondary" data-act="close">Закрыть</button>`;

    btns.addEventListener("click", async e => {
      const act = e.target.dataset.act;
      if (!act || act === "close") { modal.remove(); return; }

      if (act === "unblock") {
        await adminAPI("POST", `/clients/${uuid}/unblock`);
        toast("Клиент разблокирован");
        modal.remove(); refreshClients();
      } else if (act === "block") {
        const reason = await promptModal("Причина блокировки", "Причина");
        if (reason === null) return;
        await adminAPI("POST", `/clients/${uuid}/block`, { reason });
        toast("Клиент заблокирован");
        modal.remove(); refreshClients();
      } else if (act === "sub-url") {
        const subUrl = `https://${location.hostname}/subscription/${uuid}`;
        navigator.clipboard.writeText(subUrl).then(() => toast("Ссылка скопирована"));
      } else if (act === "sub-links") {
        const data = await adminAPI("GET", `/subscription/${uuid}`);
        await showModal("Ссылки подключения", `
          <textarea class="form-control" readonly style="height:100px;font-family:monospace;font-size:.85em">${esc(data?.links || "")}</textarea>
        `, [{ text: "Закрыть", cls: "btn-secondary" }]);
      } else if (act === "extend") {
        const days = await promptModal("Дней для продления", "30");
        if (!days) return;
        await adminAPI("POST", `/clients/${uuid}/extend`, { days: parseInt(days) });
        toast("Продлено");
        modal.remove(); refreshClients();
      } else if (act === "warn") {
        const reason = await promptModal("Причина предупреждения", "Причина");
        if (reason === null) return;
        await adminAPI("POST", `/clients/${uuid}/warn`, { reason });
        toast("Предупреждение отправлено");
        modal.remove(); refreshClients();
      } else if (act === "reset-warnings") {
        await adminAPI("POST", `/clients/${uuid}/reset-warnings`);
        toast("Предупреждения сброшены");
        modal.remove(); refreshClients();
      } else if (act === "reset-traffic") {
        if (!await confirmModal("Сбросить трафик?", "Трафик будет обнулён.")) return;
        await adminAPI("POST", `/stats/clients/${uuid}/reset`);
        toast("Трафик сброшен");
        modal.remove(); refreshClients();
      } else if (act === "set-limit") {
        const limit = await promptModal("Лимит трафика (GB)", "100", String(c.traffic_limit_gb || 100));
        if (!limit) return;
        await adminAPI("PUT", `/clients/${uuid}`, { traffic_limit_gb: parseInt(limit) });
        toast("Лимит обновлён");
        modal.remove(); refreshClients();
      }
    });

    modal.addEventListener("click", e => {
      if (e.target.dataset?.close || e.target === modal) modal.remove();
    });
  } catch (err) {
    modal.innerHTML = `<div class="modal-box"><p class="text-muted">Ошибка: ${esc(err.message)}</p></div>`;
  }
}

async function refreshClients() {
  try {
    const data = await adminAPI("GET", "/clients");
    allClients = data.clients || data || [];
  } catch { allClients = []; }
  renderClientList();
}

function bindServiceButtons() {
  document.getElementById("adminServiceBtns")?.addEventListener("click", async e => {
    const action = e.target.dataset.action;
    if (!action) return;
    const result = document.getElementById("adminServiceResult");

    if (action === "check-status") {
      result.innerHTML = '<p class="text-muted">Проверка...</p>';
      try {
        const data = await adminAPI("GET", "/clients");
        result.innerHTML = `<div class="alert alert-info">API доступен. Клиентов: ${(data.clients || []).length}</div>`;
      } catch (err) {
        result.innerHTML = `<div class="alert alert-danger">Ошибка: ${esc(err.message)}</div>`;
      }
    } else if (action === "logs") {
      const modal = document.getElementById("adminLogsModal");
      modal.style.display = "flex";
      document.getElementById("adminLogsContent").textContent = "Загрузка...";
      try {
        const resp = await adminAPI("GET", "/xray/logs");
        document.getElementById("adminLogsContent").textContent = resp?.logs || "Нет логов";
      } catch (err) {
        document.getElementById("adminLogsContent").textContent = "Ошибка: " + err.message;
      }
    } else {
      try {
        await adminAPI("POST", `/xray/service/${action}`);
        toast(`Действие "${action}" выполнено`);
      } catch (err) {
        toast("Ошибка: " + err.message, "error");
      }
    }
  });
}

function bindAdminActions() {
  document.getElementById("adminActionsGrid")?.addEventListener("click", async e => {
    const act = e.target.dataset.act;
    if (!act) return;
    const result = document.getElementById("adminActionResult");

    if (act === "add") {
      const name = await promptModal("Имя клиента", "Введите имя");
      if (!name) return;
      const telegramId = await promptModal("Telegram ID", "0", "0");
      if (telegramId === null) return;
      const days = await promptModal("Дней подписки", "30");
      if (!days) return;
      await adminAPI("POST", "/clients", { name, telegram_id: parseInt(telegramId) || 0, subscription_days: parseInt(days) || 30 });
      toast(`Клиент ${name} добавлен`);
      refreshClients();
    } else if (act === "remove") {
      if (!allClients.length) { toast("Нет клиентов", "error"); return; }
      const client = await clientPicker("Выберите клиента для удаления", allClients);
      if (!client) return;
      if (!await confirmModal("Удалить?", `${client.name || client.email} будет удалён навсегда.`)) return;
      await adminAPI("DELETE", `/clients/${client.uuid}`);
      toast("Клиент удалён");
      refreshClients();
    } else if (act === "rename") {
      if (!allClients.length) { toast("Нет клиентов", "error"); return; }
      const client = await clientPicker("Выберите клиента", allClients);
      if (!client) return;
      const newName = await promptModal("Новое имя", "", client.name || "");
      if (!newName || newName === client.name) return;
      await adminAPI("PUT", `/clients/${client.uuid}`, { name: newName });
      toast("Переименован");
      refreshClients();
    } else if (act === "extend") {
      if (!allClients.length) { toast("Нет клиентов", "error"); return; }
      const client = await clientPicker("Выберите клиента", allClients);
      if (!client) return;
      const days = await promptModal("Дней для продления", "30");
      if (!days) return;
      await adminAPI("POST", `/clients/${client.uuid}/extend`, { days: parseInt(days) });
      toast("Продлено");
      refreshClients();
    } else if (act === "limit") {
      if (!allClients.length) { toast("Нет клиентов", "error"); return; }
      const client = await clientPicker("Выберите клиента", allClients);
      if (!client) return;
      const limit = await promptModal("Лимит (GB)", "100", String(client.traffic_limit_gb || 100));
      if (!limit) return;
      await adminAPI("PUT", `/clients/${client.uuid}`, { traffic_limit_gb: parseInt(limit) });
      toast("Лимит обновлён");
      refreshClients();
    } else if (act === "limit-all") {
      const limit = await promptModal("Лимит для всех (GB)", "100");
      if (!limit) return;
      let count = 0;
      for (const c of allClients) {
        await adminAPI("PUT", `/clients/${c.uuid}`, { traffic_limit_gb: parseInt(limit) });
        count++;
      }
      toast(`Лимит изменён для ${count} клиентов`);
      refreshClients();
    } else if (act === "bans") {
      const blocked = allClients.filter(c => c.status === "blocked" || c.warnings_count > 0);
      if (!blocked.length) { result.innerHTML = '<p class="text-muted">Нет заблокированных или предупреждённых</p>'; return; }
      result.innerHTML = blocked.map(c => `
        <div class="card-row">
          <span>${c.status === "blocked" ? "🚫" : "⚠️"} ${esc(c.name)} — ${c.status} (${c.warnings_count || 0}/3)</span>
          ${c.status === "blocked" ? `<button class="btn btn-sm btn-success" data-unblock="${esc(c.uuid)}">Разблокировать</button>` : ""}
        </div>`).join("");
      result.querySelectorAll("[data-unblock]").forEach(btn => {
        btn.addEventListener("click", async () => {
          await adminAPI("POST", `/clients/${btn.dataset.unblock}/unblock`);
          toast("Разблокирован");
          refreshClients();
        });
      });
    } else if (act === "check-sub") {
      result.innerHTML = '<p class="text-muted">Проверка подписок...</p>';
      try {
        const resp = await api("POST", "/api/xray/checkers/subscription-checker");
        result.innerHTML = `<pre style="background:rgba(0,0,0,.3);padding:12px;border-radius:8px;max-height:300px;overflow:auto;font-size:.85em;color:#a0a0a0;white-space:pre-wrap">${esc(resp?.output || "Нет вывода")}</pre>`;
      } catch (err) { result.innerHTML = `<p class="text-muted">Ошибка: ${esc(err.message)}</p>`; }
    } else if (act === "check-traffic") {
      result.innerHTML = '<p class="text-muted">Проверка трафика...</p>';
      try {
        const resp = await api("POST", "/api/xray/checkers/traffic-checker");
        result.innerHTML = `<pre style="background:rgba(0,0,0,.3);padding:12px;border-radius:8px;max-height:300px;overflow:auto;font-size:.85em;color:#a0a0a0;white-space:pre-wrap">${esc(resp?.output || "Нет вывода")}</pre>`;
      } catch (err) { result.innerHTML = `<p class="text-muted">Ошибка: ${esc(err.message)}</p>`; }
    } else if (act === "check-devices") {
      result.innerHTML = '<p class="text-muted">Проверка устройств...</p>';
      try {
        const resp = await api("POST", "/api/xray/checkers/device-monitor");
        result.innerHTML = `<pre style="background:rgba(0,0,0,.3);padding:12px;border-radius:8px;max-height:300px;overflow:auto;font-size:.85em;color:#a0a0a0;white-space:pre-wrap">${esc(resp?.output || "Нет вывода")}</pre>`;
      } catch (err) { result.innerHTML = `<p class="text-muted">Ошибка: ${esc(err.message)}</p>`; }
    } else if (act === "requests") {
      result.innerHTML = '<p class="text-muted">Загрузка запросов...</p>';
      try {
        const data = await adminAPI("GET", "/extension-requests");
        const requests = data?.requests || [];
        const pending = requests.filter(r => r.status === "pending");
        const approved = requests.filter(r => r.status === "approved");
        const denied = requests.filter(r => r.status === "denied");

        let html = `
          <div class="flex gap-8 flex-wrap mb-8">
            <span class="badge badge-expired">Ожидают: ${pending.length}</span>
            <span class="badge badge-active">Одобрено: ${approved.length}</span>
            <span class="badge badge-blocked">Отклонено: ${denied.length}</span>
          </div>`;

        if (pending.length) {
          html += '<h3 style="font-size:1em;margin-bottom:10px;color:#ff9800">Ожидают обработки</h3>';
          html += pending.slice(0, 10).map(r => `
            <div class="card-row" style="flex-direction:column;gap:8px">
              <div class="flex justify-between items-center">
                <span><b>${esc(r.client_name || "Unknown")}</b> — ${r.requested_days || r.requested_months * 30} дн.</span>
                <span class="text-muted" style="font-size:.8em">${new Date(r.created_at).toLocaleDateString("ru-RU")}</span>
              </div>
              <div class="flex gap-8">
                <button class="btn btn-sm btn-success" data-approve="${r.id}">Одобрить</button>
                <button class="btn btn-sm btn-secondary" data-approve-custom="${r.id}">Свой срок</button>
                <button class="btn btn-sm btn-danger" data-deny="${r.id}">Отклонить</button>
              </div>
            </div>`).join("");
        }

        if (approved.length) {
          html += '<h3 style="font-size:1em;margin:15px 0 10px;color:#4caf50">Одобренные (последние 5)</h3>';
          html += approved.slice(0, 5).map(r => `
            <div class="card-row">
              <span>${esc(r.client_name || "Unknown")} — ${r.approved_days || r.requested_days} дн.</span>
              <span class="text-muted" style="font-size:.8em">${new Date(r.processed_at).toLocaleDateString("ru-RU")}</span>
            </div>`).join("");
        }

        if (denied.length) {
          html += '<h3 style="font-size:1em;margin:15px 0 10px;color:#f44336">Отклонённые (последние 5)</h3>';
          html += denied.slice(0, 5).map(r => `
            <div class="card-row">
              <span>${esc(r.client_name || "Unknown")} — ${r.denial_reason || "Без причины"}</span>
              <span class="text-muted" style="font-size:.8em">${new Date(r.processed_at).toLocaleDateString("ru-RU")}</span>
            </div>`).join("");
        }

        result.innerHTML = html;

        // Bind approve/deny buttons
        result.querySelectorAll("[data-approve]").forEach(btn => {
          btn.addEventListener("click", async () => {
            console.log("[APPROVE] clicked, id=", btn.dataset.approve, "telegram_id=", getTelegramId());
            if (!await confirmModal("Одобрить запрос?", "")) { console.log("[APPROVE] cancelled"); return; }
            try {
              const body = { admin_telegram_id: getTelegramId() };
              console.log("[APPROVE] sending:", JSON.stringify(body));
              const resp = await adminAPI("POST", `/extension-requests/${btn.dataset.approve}/approve`, body);
              console.log("[APPROVE] response:", resp);
              if (resp?.success) { toast("Запрос одобрен"); } else { toast("Ошибка: " + (resp?.error || resp?.message || "неизвестно"), "error"); }
              refreshClients();
            } catch(e) { console.error("[APPROVE] error:", e); toast("Ошибка: " + e.message, "error"); }
          });
        });
        result.querySelectorAll("[data-approve-custom]").forEach(btn => {
          btn.addEventListener("click", async () => {
            const days = await promptModal("Сколько дней?", "30");
            if (!days) return;
            try {
              const resp = await adminAPI("POST", `/extension-requests/${btn.dataset.approveCustom}/approve`, { approved_days: parseInt(days), admin_telegram_id: getTelegramId() });
              if (resp?.success) { toast("Одобрено"); } else { toast("Ошибка: " + (resp?.error || resp?.message || "неизвестно"), "error"); }
              refreshClients();
            } catch(e) { toast("Ошибка: " + e.message, "error"); }
          });
        });
        result.querySelectorAll("[data-deny]").forEach(btn => {
          btn.addEventListener("click", async () => {
            console.log("[DENY] clicked, id=", btn.dataset.deny, "telegram_id=", getTelegramId());
            const reason = await promptModal("Причина отклонения", "", "Отклонено");
            if (reason === null) { console.log("[DENY] cancelled"); return; }
            try {
              const body = { reason, admin_telegram_id: getTelegramId() };
              console.log("[DENY] sending:", JSON.stringify(body));
              const resp = await adminAPI("POST", `/extension-requests/${btn.dataset.deny}/deny`, body);
              console.log("[DENY] response:", resp);
              if (resp?.success) { toast("Запрос отклонён"); } else { toast("Ошибка: " + (resp?.error || resp?.message || "неизвестно"), "error"); }
              refreshClients();
            } catch(e) { console.error("[DENY] error:", e); toast("Ошибка: " + e.message, "error"); }
          });
        });
      } catch (err) { result.innerHTML = `<p class="text-muted">Ошибка: ${esc(err.message)}</p>`; }
    }
  });
}
