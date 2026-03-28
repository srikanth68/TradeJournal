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
    // Yahoo Finance search — no API key, works in React Native (no CORS)
    const res = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(key)}&quotesCount=5&newsCount=0&enableFuzzyQuery=false`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      quotes?: Array<{ symbol?: string; shortname?: string; longname?: string; quoteType?: string }>;
    };

    // Find the exact symbol match (prefer equity)
    const match =
      data.quotes?.find(q => q.symbol === key && q.quoteType === 'EQUITY') ??
      data.quotes?.find(q => q.symbol === key) ??
      data.quotes?.[0];

    const name = match?.shortname ?? match?.longname;
    if (!name) return null;

    // FMP symbol logo — free, no API key, works for all major US equities/ETFs
    const logoUrl = `https://images.financialmodelingprep.com/symbol/${key}.png`;

    const result: TickerInfo = { companyName: name, logoUrl };
    cache.set(key, result);
    return result;
  } catch {
    return null;
  }
}
