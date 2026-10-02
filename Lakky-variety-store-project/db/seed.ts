// Free local seeds — Handbag variants + Gift box + default settings (all editable in Admin)
export const seedProducts = [
  { name: 'Handbag', description: 'Lakky handbag', basePrice: 10000, status: 'New', variants: [
    { attrs: { colour: 'Black', size: '4"' }, price: 10000, available: 5 },
    { attrs: { colour: 'Black', size: '9"' }, price: 12000, available: 5 },
    { attrs: { colour: 'White', size: '4"' }, price: 10000, available: 2 },
    { attrs: { colour: 'White', size: '5"' }, price: 10000, available: 0 },
  ]},
];
export const seedAddons = [{ name: 'Gift box', price: 2000 }];
export const seedSettings = {
  bankDetails: { bank: 'FILL-IN', accountNumber: 'FILL-IN', accountName: 'Lakky Variety Store' },
  globalDailyFee: 500, freeHoldDays: 14, overpaymentThreshold: 50000,
  underpaymentExpiryDays: 7, fulfilmentDays: ['Mon', 'Thu', 'Sat'], pickupNote: 'Call before pickup',
};
