// es_ldcu returns money both as numbers and as "12,345.67" strings.
export const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export const formatCurrency = (value) => currency.format(toNumber(value));

export const formatNumber = (value) => new Intl.NumberFormat('en-US').format(toNumber(value));
