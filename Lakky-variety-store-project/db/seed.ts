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
  { name: '4L Borosilicate Cooking Pot', description: 'A durable borosilicate cooking pot designed for convenient everyday cooking and serving.', basePrice: 20000, status: '', category: 'Kitchen, Cookware', emoji: '🍲', badge: '', image: '4L_borosilicate_pot.jpg', driveId: '1dQomo5sPkyJdRnGP6SBBeZcAYmKzEB9V', variants: [
    { attrs: { Option: 'Standard' }, price: 20000, available: 5 },
  ]},
  { name: '6-in-1 Sieve', description: 'A versatile 6-in-1 sieve that makes straining, washing, and food preparation easier.', basePrice: 18000, status: '', category: 'Kitchen, Utensils', emoji: '🧺', badge: '', image: '6in1_sieve.jpg', driveId: '1WCEoc0Pk5vNr4ZDnlCwQ4aaNJn4Wj3-u', variants: [
    { attrs: { Option: 'Standard' }, price: 18000, available: 5 },
  ]},
  { name: 'Big Rose Decor', description: 'A beautiful rose decor piece that adds a soft and elegant touch to your space.', basePrice: 10000, status: '', category: 'Home, Decor', emoji: '🌹', badge: '', image: 'Big_rose_decor.jpg', driveId: '1ZLytg45j8l1k_IRXlVAi7RApzpbUuB-u', variants: [
    { attrs: { Option: 'Standard' }, price: 10000, available: 5 },
  ]},
  { name: 'Double Soap Holder', description: 'A practical double soap holder that keeps your soaps neatly organized and your bathroom tidy.', basePrice: 2000, status: '', category: 'Home, Bathroom', emoji: '🧼', badge: '', image: 'Double_soap_holder.jpg', driveId: '1Rz0DjPg6XnYdg98VGxpq3ChetGIFGCx7', variants: [
    { attrs: { Colour: 'green' }, price: 2000, available: 5 },
    { attrs: { Colour: 'blue' }, price: 2000, available: 5 },
    { attrs: { Colour: 'white' }, price: 2000, available: 5 },
  ]},
  { name: 'Electric Cooking Pot', description: 'A convenient electric cooking pot made for quick and easy everyday meal preparation.', basePrice: 12000, status: '', category: 'Kitchen, Appliances', emoji: '🍳', badge: '', image: 'Electric_cooking_pot.jpg', driveId: '11Z2bKCQ6lDW8hVGv17RqpnZY7SkMkpq8', variants: [
    { attrs: { Colour: 'yellow' }, price: 12000, available: 5 },
  ]},
  { name: 'Face Handkerchief', description: 'A soft and handy face handkerchief that is perfect for everyday personal care.', basePrice: 3000, status: '', category: 'Beauty, Accessories', emoji: '🤧', badge: '', image: 'Face_handerchief.jpg', driveId: '1b-UyHlEPvJ7KDtXsPGYA3DApBuf6w2LS', variants: [
    { attrs: { Colour: 'mixed designs' }, price: 3000, available: 5 },
  ]},
  { name: 'Fancy Sippy Cup', description: 'A cute and practical sippy cup designed for convenient, spill-friendly everyday drinking.', basePrice: 8000, status: '', category: 'Kitchen, Drinkware', emoji: '🥤', badge: '', image: 'Fancy_sippy_cup.jpg', driveId: '1uxGQLNO8BvhEXRLqWLJoWNS8gk6UX_CH', variants: [
    { attrs: { Colour: 'purple' }, price: 8000, available: 5 },
    { attrs: { Colour: 'green' }, price: 8000, available: 5 },
    { attrs: { Colour: 'blue' }, price: 8000, available: 5 },
  ]},
  { name: 'Foldable Jug', description: 'A space-saving foldable jug that is easy to store, carry, and use at home or on the go.', basePrice: 10000, status: '', category: 'Kitchen, Drinkware', emoji: '🫙', badge: '', image: 'Foldable_jug.jpg', driveId: '1NBYArSDRR377V3dNvtePqlzpo-HyqOYI', variants: [
    { attrs: { Colour: 'whitte' }, price: 10000, available: 5 },
    { attrs: { Colour: 'blue' }, price: 10000, available: 5 },
  ]},
  { name: 'Insulated Ball Straw Cup', description: 'A stylish insulated straw cup designed to help keep your drinks at a comfortable temperature while you are on the go.', basePrice: 10000, status: '', category: 'Kitchen, Drinkware', emoji: '🥤', badge: '', image: 'Insulated_ball_straw_cup.jpg', driveId: '1XgZFMZjDZfMFT1I0cE3oERbfcNmnaO_c', variants: [
    { attrs: { Colour: 'red' }, price: 10000, available: 5 },
    { attrs: { Colour: 'green' }, price: 10000, available: 5 },
    { attrs: { Colour: 'pink' }, price: 10000, available: 5 },
  ]},
  { name: 'LED Flowery Decor', description: 'A charming LED flowery decor piece that brings a warm and beautiful glow to your space.', basePrice: 6000, status: '', category: 'Home, Decor', emoji: '💡', badge: '', image: 'Led_flowery_decor.jpg', driveId: '1SbEXjEo0rnJx8WGYe6OkuzIzNEL4Nm7_', variants: [
    { attrs: { Option: 'Standard' }, price: 6000, available: 5 },
  ]},
  { name: 'Reusable Kitchen Tissue', description: 'A reusable kitchen tissue option that helps keep surfaces clean while reducing everyday waste.', basePrice: 3000, status: '', category: 'Kitchen, Household', emoji: '🧻', badge: '', image: 'Reusable_kitchen_tissue.jpg', driveId: '1VpZeDyEcn-U1PQxZO9eS0acVAZXeoA6p', variants: [
    { attrs: { Option: 'Standard' }, price: 3000, available: 5 },
  ]},
  { name: '4 in 1 toilet gel', description: 'A fresh-scented toilet gel designed to help keep your toilet clean, fresh, and pleasant-smelling.', basePrice: 6000, status: '', category: 'Home, Bathroom', emoji: '🧴', badge: '', image: 'Toilet_gel.jpg', driveId: '1hRmC-em-NY2VVPA9CJML88pha-E_3f9B', variants: [
    { attrs: { Option: 'Standard' }, price: 6000, available: 5 },
  ]},
];
export const seedCategories = ['Skincare', 'Perfume', 'Hair', 'Fashion', 'Jewellery', 'Footwear', 'Kitchen', 'School'];
export const seedAddons = [{ name: 'Gift box', price: 2000 }];
export const FALLBACK_DESCRIPTION = 'Quality authentic product available at Lakky Variety Store.';
export const driveImage = (driveId: string) => `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
export const seedSettings = {
  bankDetails: { bank: 'FILL-IN', accountNumber: 'FILL-IN', accountName: 'Lakky Variety Store' },
  globalDailyFee: 500, freeHoldDays: 14, overpaymentThreshold: 50000,
  underpaymentExpiryDays: 7, abandonDays: 60, fulfilmentDays: ['Mon', 'Thu', 'Sat'], pickupNote: 'FILL-IN — enter in Admin Settings',
};
