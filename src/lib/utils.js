export function formatCurrency(value, decimals = 2) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatPercent(value, decimals = 2) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00%';
  return `${num >= 0 ? '+' : ''}${num.toFixed(decimals)}%`;
}

export function formatNumber(value, decimals = 0) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function getPLColor(value) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num > 0) return 'var(--color-profit)';
  if (num < 0) return 'var(--color-loss)';
  return 'var(--text-secondary)';
}

export function classNames(...args) {
  return args.filter(Boolean).join(' ');
}

export function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const SECTOR_MAP = {
  AAPL:'Tech', MSFT:'Tech', GOOGL:'Tech', GOOG:'Tech', META:'Tech', AMZN:'Tech',
  NVDA:'Tech', AMD:'Tech', CRM:'Tech', ORCL:'Tech', ADBE:'Tech', INTC:'Tech',
  PLTR:'Tech', SNOW:'Tech', DDOG:'Tech', NET:'Tech', SHOP:'Tech', CSCO:'Tech',
  AVGO:'Tech', QCOM:'Tech', NOW:'Tech', ZS:'Tech', MDB:'Tech',
  TSLA:'Auto', F:'Auto', GM:'Auto', RIVN:'Auto', LCID:'Auto',
  JPM:'Finance', BAC:'Finance', WFC:'Finance', GS:'Finance', MS:'Finance',
  V:'Finance', MA:'Finance', PYPL:'Finance', SQ:'Finance', COIN:'Finance',
  JNJ:'Health', UNH:'Health', PFE:'Health', ABBV:'Health', MRK:'Health',
  LLY:'Health', TMO:'Health', ABT:'Health', BMY:'Health', AMGN:'Health',
  NFLX:'Media', DIS:'Media', TTWO:'Media', EA:'Media', RBLX:'Media',
  WMT:'Retail', COST:'Retail', TGT:'Retail', HD:'Retail', LOW:'Retail',
  UBER:'Transport', ABNB:'Travel', MAR:'Travel', DAL:'Travel',
  XOM:'Energy', CVX:'Energy', COP:'Energy', SLB:'Energy',
  BA:'Industrial', CAT:'Industrial', HON:'Industrial', GE:'Industrial',
  KO:'Consumer', PEP:'Consumer', PG:'Consumer', MCD:'Consumer', SBUX:'Consumer',
};

export const SECTOR_COLORS = {
  Tech: '#667eea',
  Finance: '#f7b731',
  Health: '#00d4aa',
  Auto: '#ff4757',
  Media: '#a55eea',
  Retail: '#2ed573',
  Energy: '#ff6348',
  Consumer: '#1e90ff',
  Industrial: '#747d8c',
  Transport: '#ffa502',
  Travel: '#eccc68',
  Other: '#57606f',
};
