// მცირე დამხმარეები ბანკების API-სთვის: JSON მოთხოვნა შეცდომის დამუშავებით და ტოკენის ქეში.

const requestJson = async (url, { method = 'GET', headers = {}, body, form } = {}) => {
  const init = { method, headers: { Accept: 'application/json', ...headers } };
  if (form) {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Payment provider error ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
};

// OAuth access token-ის ქეში (ვადის გასვლამდე 60 წამით ადრე განახლდება)
const createTokenCache = (fetchToken) => {
  let cached = null;
  return async () => {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const { token, expiresIn } = await fetchToken();
    cached = { token, expiresAt: Date.now() + (expiresIn || 300) * 1000 };
    return token;
  };
};

module.exports = { requestJson, createTokenCache };
