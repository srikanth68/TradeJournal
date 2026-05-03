export const toStoredPrice = (price: number): number => Math.round(price * 10_000);
export const fromStoredPrice = (stored: number): number => stored / 10_000;

export const formatPrice = (stored: number, currency = 'USD'): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(fromStoredPrice(stored));

// Absolute value — callers use color to convey direction
export const formatPnl = (stored: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Math.abs(fromStoredPrice(stored))
  );

// Includes + / - prefix — for contexts where color alone is insufficient
export const formatPnlSigned = (stored: number): string => {
  const value = fromStoredPrice(stored);
  const abs = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Math.abs(value)
  );
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
};
