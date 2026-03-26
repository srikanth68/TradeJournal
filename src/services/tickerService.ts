export type TickerInfo = {
  companyName: string;
  logoUrl: string | null;
};

const cache = new Map<string, TickerInfo>();

export async function lookupTicker(ticker: string): Promise<TickerInfo | null> {
  const key = ticker.toUpperCase().trim();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(
      `https://api.polygon.io/v3/reference/tickers/${key}?apiKey=demo`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      results?: { name?: string; homepage_url?: string };
    };

    const name = data?.results?.name;
    if (!name) return null;

    const homepageUrl = data?.results?.homepage_url;
    let logoUrl: string | null = null;

    if (homepageUrl) {
      try {
        const domain = new URL(homepageUrl).hostname.replace(/^www\./, '');
        if (domain) logoUrl = `https://logo.clearbit.com/${domain}`;
      } catch {
        // malformed URL — skip logo
      }
    }

    const result: TickerInfo = { companyName: name, logoUrl };
    cache.set(key, result);
    return result;
  } catch {
    return null;
  }
}
