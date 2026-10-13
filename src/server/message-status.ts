type Row = { status: string };
const rank: Record<string, number> = { queued: 0, sending: 1, failed: 1, sent: 2, delivered: 3, read: 4 };
export function advanceReceipt(row: Row, status: 'delivered' | 'read'): boolean {
  if ((rank[row.status] ?? 0) >= rank[status]) return false;
  row.status = status;
  return true;
}
export function finishSend(row: Row): void {
  if ((rank[row.status] ?? 0) < rank.sent) row.status = 'sent';
}
