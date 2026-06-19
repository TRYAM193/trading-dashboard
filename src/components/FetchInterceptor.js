'use client';

if (typeof window !== 'undefined' && !window.__fetch_intercepted) {
  window.__fetch_intercepted = true;
  const originalFetch = window.fetch;
  window.fetch = function (url, options) {
    if (typeof url === 'string' && url.startsWith('/api/')) {
      const baseUrl = window.localStorage.getItem('trading_copilot_server_url') || '';
      // Remove double slashes if any, ensure proper routing
      const cleanUrl = `${baseUrl.replace(/\/$/, '')}${url}`;
      return originalFetch(cleanUrl, options);
    }
    return originalFetch(url, options);
  };
}

export default function FetchInterceptor() {
  return null;
}
