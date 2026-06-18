const ALPACA_BASE = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets';
const ALPACA_DATA = process.env.ALPACA_DATA_URL || 'https://data.alpaca.markets';
const HEADERS = {
  'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
  'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET,
  'Content-Type': 'application/json',
};

export async function alpacaFetch(endpoint, options = {}) {
  const base = endpoint.startsWith('/v2/stocks') ? ALPACA_DATA : ALPACA_BASE;
  const res = await fetch(`${base}${endpoint}`, {
    headers: HEADERS,
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Alpaca API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getAccount() {
  return alpacaFetch('/v2/account');
}

export async function getPositions() {
  return alpacaFetch('/v2/positions');
}

export async function getOrders(params = {}) {
  const query = new URLSearchParams(params).toString();
  return alpacaFetch(`/v2/orders?${query}`);
}

export async function getPortfolioHistory(params = {}) {
  const query = new URLSearchParams(params).toString();
  return alpacaFetch(`/v2/account/portfolio/history?${query}`);
}
