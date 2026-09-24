import { Fragment, useEffect, useState } from 'react';
import { ChevronRight, RefreshCcw } from 'lucide-react';
import { apiUrl } from '../../../../../../lib/api';
import { Badge } from '../../../../../../components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../../../../../components/ui/sheet';
import { formatCurrency, toNumber } from './format';

function Stat({ label, value, tone }) {
  const toneClass =
    tone === 'good' ? 'text-emerald-600' : tone === 'danger' ? 'text-rose-600' : tone === 'warn' ? 'text-amber-600' : '';
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-base font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function LedgerItemsTable({ items, totals, overpayment }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (i) => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  const sums = items.reduce(
    (acc, item) => ({
      amount: acc.amount + toNumber(item.amount),
      payment: acc.payment + toNumber(item.payment),
      deduction: acc.deduction + toNumber(item.discount_credit),
      balance: acc.balance + Math.max(0, toNumber(item.balance)),
      overpayment: acc.overpayment + toNumber(item.overpayment),
    }),
    { amount: 0, payment: 0, deduction: 0, balance: 0, overpayment: 0 }
  );

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="w-6 px-2 py-2" />
            <th className="px-2 py-2 text-left font-medium">Particulars</th>
            <th className="px-2 py-2 text-left font-medium">Schedule of Fees</th>
            <th className="px-2 py-2 text-right font-medium">Amount</th>
            <th className="px-2 py-2 text-right font-medium">Payment</th>
            <th className="px-2 py-2 text-right font-medium">Discount / Credit</th>
            <th className="px-2 py-2 text-right font-medium">Balance</th>
            <th className="px-2 py-2 text-right font-medium">Overpayment</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No fees assessed for this term</td>
            </tr>
          ) : (
            items.map((item, i) => {
              const subItems = item.items || [];
              const hasSub = subItems.length > 0;
              const label = item.is_rle
                ? (item.particulars || item.classification || '').replace(/^Laboratory Fee/, 'RLE FEE')
                : item.particulars || item.classification || '';
              const balance = Math.max(0, toNumber(item.balance));
              return (
                <Fragment key={`${item.source_key || item.classid}-${i}`}>
                  <tr
                    className={`border-b hover:bg-muted/30 ${hasSub ? 'cursor-pointer' : ''}`}
                    onClick={hasSub ? () => toggle(i) : undefined}
                  >
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {hasSub && (
                        <ChevronRight className={`h-4 w-4 transition-transform ${expanded[i] ? 'rotate-90' : ''}`} />
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-medium">
                      {label}
                      {item.is_old_account && <Badge variant="outline" className="ml-2 text-[10px]">Old Account</Badge>}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{item.schedule_of_fees || '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(item.amount)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600">{formatCurrency(item.payment)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(item.discount_credit)}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${balance > 0 ? 'text-rose-600 font-medium' : ''}`}>
                      {formatCurrency(balance)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(item.overpayment)}</td>
                  </tr>
                  {expanded[i] &&
                    subItems.map((sub, j) => {
                      const subDeduction = toNumber(sub.discount) + toNumber(sub.credit_adjustment);
                      const subBalance = Math.max(0, toNumber(sub.balance));
                      return (
                        <tr key={`${i}-${j}`} className="border-b bg-muted/20 text-xs">
                          <td />
                          <td className="px-2 py-1 pl-6 text-muted-foreground">{sub.particulars}</td>
                          <td className="px-2 py-1 text-muted-foreground">{sub.schedule_description || ''}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(sub.amount)}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-emerald-600">{formatCurrency(sub.payment)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(subDeduction)}</td>
                          <td className={`px-2 py-1 text-right tabular-nums ${subBalance > 0 ? 'text-rose-600' : ''}`}>
                            {formatCurrency(subBalance)}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(sub.overpayment)}</td>
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot className="border-t bg-muted/40 font-semibold">
            <tr>
              <td />
              <td className="px-2 py-2" colSpan={2}>Total</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(totals?.amount ?? sums.amount)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-emerald-600">{formatCurrency(sums.payment)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(sums.deduction)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-rose-600">{formatCurrency(totals?.balance ?? sums.balance)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(overpayment ?? sums.overpayment)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function AdjustmentsTable({ rows }) {
  const TYPE_CLASS = { discount: 'text-amber-600', credit: 'text-emerald-600', debit: 'text-rose-600' };
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-2 py-2 text-left font-medium">Date</th>
            <th className="px-2 py-2 text-left font-medium">Type</th>
            <th className="px-2 py-2 text-left font-medium">Particulars</th>
            <th className="px-2 py-2 text-right font-medium">Amount</th>
            <th className="px-2 py-2 text-left font-medium">By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const type = String(row.type || '').toLowerCase();
            const voided = Number(row.is_voided) === 1 || String(row.adjstatus || '').toUpperCase() === 'VOIDED';
            const sign = type === 'debit' ? '+' : '-';
            return (
              <tr key={i} className={`border-b last:border-0 ${voided ? 'opacity-50 line-through' : ''}`}>
                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-muted-foreground">
                  {row.transaction_date ? new Date(row.transaction_date).toLocaleDateString('en-PH') : '—'}
                </td>
                <td className={`px-2 py-1.5 text-xs font-medium capitalize ${TYPE_CLASS[type] || ''}`}>
                  {type || '—'}
                  {voided && ' (voided)'}
                </td>
                <td className="px-2 py-1.5">{row.particulars}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {sign}
                  {formatCurrency(row.amount)}
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">{row.created_by || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsTable({ rows }) {
  const total = rows.filter((r) => !Number(r.is_refunded)).reduce((sum, r) => sum + toNumber(r.amount), 0);
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-2 py-2 text-left font-medium">Date</th>
            <th className="px-2 py-2 text-left font-medium">OR / Particulars</th>
            <th className="px-2 py-2 text-left font-medium">Applied To</th>
            <th className="px-2 py-2 text-right font-medium">Amount</th>
            <th className="px-2 py-2 text-left font-medium">Cashier</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const refunded = Number(row.is_refunded) === 1;
            return (
              <tr key={i} className="border-b last:border-0 align-top">
                <td className="px-2 py-1.5 whitespace-nowrap text-xs text-muted-foreground">
                  {row.transaction_date ? new Date(row.transaction_date).toLocaleString('en-PH') : '—'}
                </td>
                <td className="px-2 py-1.5">
                  {row.particulars}
                  {refunded && <Badge variant="outline" className="ml-2 text-[10px] text-rose-600">Refunded</Badge>}
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">
                  {(row.items || []).map((it, j) => (
                    <div key={j} className="flex justify-between gap-3">
                      <span>{it.particulars}</span>
                      <span className="tabular-nums">{formatCurrency(it.amount)}</span>
                    </div>
                  ))}
                  {(row.discounts_applied || []).map((d, j) => (
                    <div key={`d${j}`} className="flex justify-between gap-3 text-amber-600">
                      <span>{d.particulars}</span>
                      <span className="tabular-nums">-{formatCurrency(d.amount)}</span>
                    </div>
                  ))}
                </td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${refunded ? 'line-through opacity-60' : 'text-emerald-600'}`}>
                  {formatCurrency(row.amount)}
                </td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">{row.created_by || '—'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t bg-muted/40 font-semibold">
          <tr>
            <td className="px-2 py-2" colSpan={3}>Total Payments</td>
            <td className="px-2 py-2 text-right tabular-nums text-emerald-600">{formatCurrency(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function LedgerSheet({ student, open, onOpenChange, schoolDbConfig, token, syid, semid }) {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !student) return;
    const controller = new AbortController();
    setLedger(null);
    setError('');
    setLoading(true);
    fetch(apiUrl('/api/admin/student-ledgers/ledger'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({ schoolDbConfig, studid: student.id, syid, semid }),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result.status === 'success') setLedger(result.data);
        else setError(result.message || 'Failed to load ledger');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError('Error loading ledger');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, student?.id, syid, semid]);

  const info = ledger?.student;
  const totals = ledger?.totals;
  const oldBalance = toNumber(ledger?.old_account_balance);
  const overpayment = toNumber(ledger?.total_overpayment);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-4xl">
        <SheetHeader className="border-b">
          <SheetTitle>{info?.fullname || student?.fullname || 'Student Ledger'}</SheetTitle>
          <SheetDescription>
            {[info?.sid || student?.sid, info?.levelname || student?.academic_level, info?.section_name || student?.section_name, info?.grantee_description]
              .filter(Boolean)
              .join(' · ')}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {loading && (
            <div className="flex min-h-[200px] items-center justify-center">
              <RefreshCcw className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-md border border-rose-200 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}

          {ledger && !loading && (
            <>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Stat label="Total Fees" value={formatCurrency(totals?.amount)} />
                <Stat label="Discounts / Credits" value={formatCurrency(totals?.deductions)} tone="warn" />
                <Stat label="Payments" value={formatCurrency(totals?.payment)} tone="good" />
                <Stat label="Balance" value={formatCurrency(totals?.balance)} tone="danger" />
                <Stat label="Overpayment" value={formatCurrency(overpayment)} />
              </div>

              {(oldBalance > 0 || Number(ledger.is_refunded) === 1) && (
                <div className="flex flex-wrap gap-2 text-sm">
                  {oldBalance > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-500/10 px-3 py-1.5 text-amber-800">
                      Old account balance: <span className="font-semibold">{formatCurrency(oldBalance)}</span>
                    </div>
                  )}
                  {Number(ledger.is_refunded) === 1 && (
                    <div className="rounded-md border border-rose-200 bg-rose-500/10 px-3 py-1.5 text-rose-700">Refunded for this term</div>
                  )}
                </div>
              )}

              <Section title="Assessment">
                <LedgerItemsTable items={ledger.ledger_items || []} totals={totals} overpayment={overpayment} />
              </Section>

              {(ledger.discounts_adjustments || []).length > 0 && (
                <Section title="Discounts & Adjustments">
                  <AdjustmentsTable rows={ledger.discounts_adjustments} />
                </Section>
              )}

              <Section title="Payment History">
                {(ledger.or_payments || []).length > 0 ? (
                  <PaymentsTable rows={ledger.or_payments} />
                ) : (
                  <div className="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">No payments recorded</div>
                )}
              </Section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
