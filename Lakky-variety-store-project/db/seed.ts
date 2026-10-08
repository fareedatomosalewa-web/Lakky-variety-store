// Free local seeds — catalogue across one coherent brand (categories share one design).
export const seedProducts = [
  { name: 'Handbag', description: 'Lakky handbag', basePrice: 10000, status: 'New', category: 'Fashion', emoji: '👜', badge: 'NEW', variants: [
    { attrs: { colour: 'Black', size: '4"' }, price: 10000, available: 5 },
    { attrs: { colour: 'Black', size: '9"' }, price: 12000, available: 5 },
    { attrs: { colour: 'White', size: '4"' }, price: 10000, available: 2 },
    { attrs: { colour: 'White', size: '5"' }, price: 10000, available: 0 },
  ]},
  { name: 'Shea Body Cream', description: 'Smooth everyday skin cream', basePrice: 3500, status: 'New', category: 'Skincare', emoji: '🧴', badge: 'NEW', variants: [
    { attrs: { colour: 'Natural', size: '250ml' }, price: 3500, available: 12 },
    { attrs: { colour: 'Natural', size: '500ml' }, price: 6000, available: 8 },
  ]},
  { name: 'Long-lasting Perfume', description: 'Fresh daily scent', basePrice: 8500, status: '', category: 'Perfume', emoji: '🌸', badge: '', variants: [
    { attrs: { colour: 'Gold', size: '50ml' }, price: 8500, available: 6 },
    { attrs: { colour: 'Gold', size: '100ml' }, price: 14000, available: 4 },
  ]},
  { name: 'Stainless Cooking Pot', description: 'Strong pot for every kitchen', basePrice: 15000, status: '', category: 'Kitchen', emoji: '🍲', badge: '', variants: [
    { attrs: { colour: 'Silver', size: 'Small' }, price: 15000, available: 5 },
    { attrs: { colour: 'Silver', size: 'Large' }, price: 22000, available: 3 },
  ]},
  { name: 'Notebook Pack', description: 'Pack of 6 school notebooks', basePrice: 3000, status: '', category: 'School', emoji: '📚', badge: '', variants: [
    { attrs: { colour: 'Mixed', size: 'Pack of 6' }, price: 3000, available: 20 },
  ]},
  { name: 'Satin Hair Bonnet', description: 'Keeps hair neat overnight', basePrice: 2500, status: '', category: 'Hair', emoji: '💆', badge: '', variants: [
    { attrs: { colour: 'Black', size: 'Free' }, price: 2500, available: 15 },
    { attrs: { colour: 'Wine', size: 'Free' }, price: 2500, available: 0 },
  ]},
  { name: 'Hoop Earrings', description: 'Simple everyday hoops', basePrice: 4000, status: '', category: 'Jewellery', emoji: '💍', badge: '', variants: [
    { attrs: { colour: 'Gold', size: 'Medium' }, price: 4000, available: 10 },
  ]},
  { name: 'Comfy Slides', description: 'Easy everyday wear', basePrice: 7000, status: 'Restocked', category: 'Footwear', emoji: '🥿', badge: '', variants: [
    { attrs: { colour: 'Black', size: '40' }, price: 7000, available: 6 },
    { attrs: { colour: 'Black', size: '42' }, price: 7000, available: 0 },
    { attrs: { colour: 'Brown', size: '40' }, price: 7000, available: 5 },
  ]},
];
export const seedCategories = ['Skincare', 'Perfume', 'Hair', 'Fashion', 'Jewellery', 'Footwear', 'Kitchen', 'School'];
export const seedAddons = [{ name: 'Gift box', price: 2000 }];
export const seedSettings = {
  bankDetails: { bank: 'FILL-IN', accountNumber: 'FILL-IN', accountName: 'Lakky Variety Store' },
  globalDailyFee: 500, freeHoldDays: 14, overpaymentThreshold: 50000,
  underpaymentExpiryDays: 7, abandonDays: 60, fulfilmentDays: ['Mon', 'Thu', 'Sat'], pickupNote: 'FILL-IN — enter in Admin Settings',
};
