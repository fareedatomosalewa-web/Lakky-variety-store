// v1.2 Reports — pure functions, source = own DB. No hard-coded values.
export type ReportOrder = {
  status: string; // placed/approved/rejected/under/over/cancelled + fulfilment
  paymentStatus?: string;
  fulfilmentMethod?: string; // Pickup | Delivery
  stockpileStatus?: string; // held/active
  feeDue?: number; feePaid?: number;
  total?: number; paidAmount?: number;
  creditIssued?: number; creditUsed?: number;
  date: string; // YYYY-MM-DD
};

export function buildReport(orders: ReportOrder[], from: string, to: string) {
  const inRange = orders.filter(o => o.date >= from && o.date <= to);
  const count = (fn: (o: ReportOrder) => boolean) => inRange.filter(fn).length;
  const sum = (fn: (o: ReportOrder) => number) => inRange.reduce((s, o) => s + (fn(o) || 0), 0);
  return {
    from, to,
    ordersPlaced: inRange.length,
    approved: count(o => o.status === 'approved' || o.paymentStatus === 'confirmed'),
    rejected: count(o => o.status === 'rejected'),
    under: count(o => o.paymentStatus === 'underpayment'),
    over: count(o => o.paymentStatus === 'overpayment'),
    cancelled: count(o => o.status === 'cancelled'),
    pickup: count(o => o.fulfilmentMethod === 'Pickup'),
    delivery: count(o => o.fulfilmentMethod === 'Delivery'),
    stockpileActive: count(o => o.stockpileStatus === 'held' || o.stockpileStatus === 'active'),
    feesDue: sum(o => o.feeDue || 0),
    feesPaid: sum(o => o.feePaid || 0),
    totalVerified: sum(o => o.paidAmount || 0),
    creditIssued: sum(o => o.creditIssued || 0),
    creditUsed: sum(o => o.creditUsed || 0),
  };
}

export function reportToCSV(r: ReturnType<typeof buildReport>): string {
  const rows = Object.entries(r).map(([k, v]) => `${k},${v}`);
  return `metric,value\n${rows.join('\n')}\n`;
}
