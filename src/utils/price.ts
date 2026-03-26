export const toStoredPrice = (price: number): number => Math.round(price * 10_000);
export const fromStoredPrice = (stored: number): number => stored / 10_000;
export const formatPrice = (stored: number, currency = 'USD'): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(fromStoredPrice(stored));
export const formatPnl = (stored: number): string => {
  const value = fromStoredPrice(stored);
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatPrice(stored)}`;
};
