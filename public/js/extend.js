// --- Extend page ---

import { api, getClientUuid } from "./api.js";
import { toast } from "./toast.js";

function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

const PERIODS = [
  { months: 1, label: "1 месяц" },
  { months: 2, label: "2 месяца" },
  { months: 3, label: "3 месяца" },
  { months: 6, label: "6 месяцев" },
  { months: 12, label: "12 месяцев" },
];

export function renderExtend(el) {
  let selected = 1;

  function render() {
    el.innerHTML = `
      <div class="card">
        <h2>Продление подписки</h2>
        <p class="text-muted mb-16">Выберите период и отправьте запрос. Администратор обработает его.</p>
        <div class="grid-2">
          ${PERIODS.map(p => `
            <button class="btn ${selected === p.months ? "btn-primary" : "btn-secondary"} period-btn" data-months="${p.months}">
              ${p.label}
            </button>
          `).join("")}
        </div>
        <button class="btn btn-success btn-block mt-12" id="btnExtend">Запросить продление</button>
      </div>
    `;

    el.querySelectorAll(".period-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        selected = parseInt(btn.dataset.months);
        render();
      });
    });

    document.getElementById("btnExtend").addEventListener("click", async () => {
      const uuid = getClientUuid();
      if (!uuid) return;
      try {
        await api("POST", "/api/extension-requests/create", {
          client_uuid: uuid,
          requested_months: selected,
        });
        toast("Запрос отправлен");
      } catch (err) {
        toast("Ошибка: " + err.message, "error");
      }
    });
  }

  render();
}
