// --- Download page ---

const CLIENTS = [
  {
    platform: "Android",
    apps: [
      { name: "v2rayNG", url: "https://github.com/2dust/v2rayNG/releases/latest" },
      { name: "Hiddify", url: "https://github.com/hiddify/hiddify-app/releases/latest" },
      { name: "NekoBox", url: "https://github.com/MatsuriDayo/NekoBoxForAndroid/releases/latest" },
    ],
  },
  {
    platform: "iOS",
    apps: [
      { name: "Hiddify", url: "https://apps.apple.com/app/hiddify-proxy-vpn/id6596777532" },
      { name: "Streisand", url: "https://apps.apple.com/app/streisand/id6450534064" },
    ],
  },
  {
    platform: "Windows",
    apps: [
      { name: "Hiddify", url: "https://github.com/hiddify/hiddify-app/releases/latest" },
      { name: "v2rayN", url: "https://github.com/2dust/v2rayN/releases/latest" },
    ],
  },
  {
    platform: "macOS",
    apps: [
      { name: "Hiddify", url: "https://github.com/hiddify/hiddify-app/releases/latest" },
      { name: "V2RayXS", url: "https://github.com/tzmax/V2RayXS/releases/latest" },
    ],
  },
  {
    platform: "Linux",
    apps: [
      { name: "Hiddify", url: "https://github.com/hiddify/hiddify-app/releases/latest" },
    ],
  },
];

export function renderDownload(el) {
  el.innerHTML = `
    <div class="card">
      <h2>Скачать VPN-клиент</h2>
      <p class="text-muted mb-16">Выберите приложение для вашей платформы.</p>
      ${CLIENTS.map(g => `
        <div class="download-group">
          <h3>${g.platform}</h3>
          ${g.apps.map(a => `
            <div class="download-item">
              <span>${a.name}</span>
              <a href="${a.url}" target="_blank" rel="noopener">Скачать</a>
            </div>
          `).join("")}
        </div>
      `).join("")}
    </div>`;
}
