import { pgTable, serial, text, integer, boolean, timestamp, date, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

// Better Auth core (minimal email+password admin V1)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  name: text('name'),
  role: text('role').default('admin'),
  createdAt: timestamp('created_at').defaultNow(),
});
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
});
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash'),
});

// Catalogue
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').default(''),
  basePrice: integer('base_price').notNull(),
  status: text('status').default('New'),
  active: boolean('active').default(true),
  feeOverride: integer('fee_override'),
});
export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  sort: integer('sort').default(0),
});
export const variantSkus = pgTable('variant_skus', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  attrs: jsonb('attrs').notNull(),
  price: integer('price').notNull(),
  available: integer('available').default(0),
  reserved: integer('reserved').default(0),
  active: boolean('active').default(true),
}, (t) => [uniqueIndex('variant_product_attrs').on(t.productId, t.attrs)]);
export const addons = pgTable('addons', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  active: boolean('active').default(true),
});

// Customers: phone = contact/matching ID, NOT auth
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull().unique(),
  creditBalance: integer('credit_balance').default(0),
});

// Pending (never fulfilable, never reserves stock)
export const pendingRefs = pgTable('pending_refs', {
  id: serial('id').primaryKey(),
  ref: text('ref').notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id),
  fulfilment: jsonb('fulfilment'),
  expectedTotal: integer('expected_total').notNull(),
  creditApplied: integer('credit_applied').default(0),
  status: text('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});
export const pendingItems = pgTable('pending_items', {
  id: serial('id').primaryKey(),
  pendingId: integer('pending_id').notNull().references(() => pendingRefs.id, { onDelete: 'cascade' }),
  variantSkuId: integer('variant_sku_id').references(() => variantSkus.id),
  addonId: integer('addon_id').references(() => addons.id),
  qty: integer('qty').notNull(),
  unitPriceSnapshot: integer('unit_price_snapshot').notNull(),
});
export const paymentSubmissions = pgTable('payment_submissions', {
  id: serial('id').primaryKey(),
  pendingId: integer('pending_id').notNull().references(() => pendingRefs.id, { onDelete: 'cascade' }),
  amountClaimed: integer('amount_claimed').notNull(),
  transferDate: date('transfer_date'),
  transferTime: text('transfer_time'),
  reference: text('reference'),
  proofUrl: text('proof_url'),
  status: text('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Confirmed orders LVS-001...
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: integer('order_number').notNull().unique(),
  displayId: text('display_id').notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id),
  pendingId: integer('pending_id').references(() => pendingRefs.id),
  total: integer('total').notNull(),
  paidAmount: integer('paid_amount').notNull(),
  paymentStatus: text('payment_status').default('confirmed'),
  fulfilmentMethod: text('fulfilment_method'),
  fulfilmentDetails: jsonb('fulfilment_details'),
  fulfilmentStatus: text('fulfilment_status').default('processing'),
  confirmedAt: timestamp('confirmed_at').defaultNow(),
  freeUntil: date('free_until'),
  stockpileStatus: text('stockpile_status').default('held'),
});
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  variantSkuId: integer('variant_sku_id').references(() => variantSkus.id),
  addonId: integer('addon_id').references(() => addons.id),
  qty: integer('qty').notNull(),
  unitPriceSnapshot: integer('unit_price_snapshot').notNull(),
});

// Money trail
export const creditLedger = pgTable('credit_ledger', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  orderId: integer('order_id').references(() => orders.id),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  createdByAdmin: text('created_by_admin'),
  createdAt: timestamp('created_at').defaultNow(),
});
export const feePayments = pgTable('fee_payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  proofUrl: text('proof_url'),
  status: text('status').default('pending'),
  verifiedBy: text('verified_by'),
});

// Configurable business rules — no hard-code
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  bankDetails: jsonb('bank_details'),
  globalDailyFee: integer('global_daily_fee').default(500),
  freeHoldDays: integer('free_hold_days').default(14),
  overpaymentThreshold: integer('overpayment_threshold').default(50000),
  underpaymentExpiryDays: integer('underpayment_expiry_days').default(7),
  fulfilmentDays: jsonb('fulfilment_days'),
  pickupNote: text('pickup_note'),
});
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id),
  orderId: integer('order_id').references(() => orders.id),
  type: text('type').notNull(),
  message: text('message').notNull(),
  read: boolean('read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
