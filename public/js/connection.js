// --- Connection page ---

import { api, getClientUuid } from "./api.js";
import { toast } from "./toast.js";

function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

export async function renderConnection(el) {
  const uuid = getClientUuid();
  if (!uuid) { el.innerHTML = '<p class="text-muted">UUID не найден</p>'; return; }

  el.innerHTML = '<p class="text-muted">Загрузка...</p>';

  try {
    const res = await api("GET", `/api/subscription/${uuid}`);
    const subUrl = `https://1xbetlineboom.xyz/subscription/${uuid}`;
    const links = res?.links || "";

    let html = `
      <div class="card">
        <h2>Ссылка подключения</h2>
        <div class="form-group">
          <label>URL подписки</label>
          <div class="flex gap-8">
            <input type="text" class="form-control" id="subUrl" value="${esc(subUrl)}" readonly>
            <button class="btn btn-sm btn-success" id="btnCopySub">Копировать</button>
          </div>
        </div>
        <div class="qr-box" id="qrBox"></div>
      </div>

      <div class="card">
        <h2>Как подключиться</h2>
        <div class="steps">
          <div class="step"><div class="step-num">1</div><div>Скачайте VPN-клиент из раздела <b>"Скачать"</b></div></div>
          <div class="step"><div class="step-num">2</div><div>Откройте приложение и нажмите <b>"Добавить"</b> или <b>"+"</b></div></div>
          <div class="step"><div class="step-num">3</div><div>Выберите <b>"Из ссылки"</b> или <b>"По URL"</b> и вставьте ссылку</div></div>
          <div class="step"><div class="step-num">4</div><div>Нажмите <b>"Подключить"</b> — готово!</div></div>
        </div>
      </div>
    `;

    el.innerHTML = html;

    // Generate QR
    if (typeof QRCode !== "undefined") {
      const qrBox = document.getElementById("qrBox");
      new QRCode(qrBox, { text: subUrl, width: 200, height: 200 });
    }

    // Copy button
    document.getElementById("btnCopySub").addEventListener("click", () => {
      navigator.clipboard.writeText(subUrl).then(() => toast("Ссылка скопирована"));
    });
  } catch (err) {
    el.innerHTML = `<p class="text-muted">Ошибка: ${esc(err.message)}</p>`;
  }
}
