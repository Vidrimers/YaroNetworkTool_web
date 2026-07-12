// --- API client ---

let _token = localStorage.getItem("vpn_token");
let _clientUuid = null;
let _isAdmin = false;

export function getToken() { return _token; }
export function setToken(t) { _token = t; localStorage.setItem("vpn_token", t); }
export function clearAuth() { _token = null; _clientUuid = null; _isAdmin = false; localStorage.removeItem("vpn_token"); }
export function getClientUuid() { return _clientUuid; }
export function setClientUuid(uuid) { _clientUuid = uuid; }
export function isAdmin() { return _isAdmin; }
export function setAdmin(v) { _isAdmin = v; }
export function getTelegramId() {
  if (!_token) return null;
  try { return JSON.parse(atob(_token.split(".")[1])).telegram_id; } catch { return null; }
}

export async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (_token) opts.headers["Authorization"] = `Bearer ${_token}`;
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(path, opts);
  if (resp.status === 401) {
    clearAuth();
    location.reload();
    return null;
  }
  return resp.json();
}
