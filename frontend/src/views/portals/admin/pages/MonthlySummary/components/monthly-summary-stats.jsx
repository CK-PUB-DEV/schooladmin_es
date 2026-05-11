import { Card, CardContent, CardHeader, CardTitle } from '../../../../../../components/ui/card';
import { Progress } from '../../../../../../components/ui/progress';

const toNumber = (value) => Number(value) || 0;

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(toNumber(value));

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(toNumber(value));

export function MonthlySummaryStats({ data, monthLabel }) {
  if (!data) return null;

  const summary = data.summary || {};
  const byItem = data.byItem || [];
  const byMonth = data.byMonth || [];

  const totalAmount = toNumber(summary.total_amount);
  const transactionCount = toNumber(summary.transaction_count);
  const itemCount = toNumber(summary.item_count);
  const lineCount = toNumber(summary.line_count);
  const averagePerTransaction = transactionCount > 0 ? totalAmount / transactionCount : 0;
  const averagePerItem = itemCount > 0 ? totalAmount / itemCount : 0;

  const topItems = byItem;
  const itemTotal = byItem.reduce((sum, item) => sum + toNumber(item.total_amount), 0);
  const monthMax = Math.max(0, ...byMonth.map((item) => toNumber(item.total_amount)));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card data-watermark="FIN">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Monthly Collections</CardTitle>
              <p className="text-xs text-muted-foreground">Summary for {monthLabel || 'this month'}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-500/5 p-4">
                <div className="text-xs text-muted-foreground">Total collected</div>
                <div className="text-3xl font-semibold tracking-tight">
                  {formatCurrency(totalAmount)}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {formatNumber(transactionCount)} transactions
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3" hidden>
                <div className="rounded-lg border bg-background/60 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Distinct items</div>
                  <div className="text-sm font-semibold">{formatNumber(itemCount)}</div>
                </div>
                <div className="rounded-lg border bg-background/60 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Line entries</div>
                  <div className="text-sm font-semibold">{formatNumber(lineCount)}</div>
                </div>
                <div className="rounded-lg border bg-background/60 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Avg per transaction</div>
                  <div className="text-sm font-semibold">
                    {formatCurrency(averagePerTransaction)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-watermark="LIST">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top Items</CardTitle>
              <p className="text-xs text-muted-foreground">Highest collections per item</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {topItems.length > 0 ? (
                topItems.map((item) => {
                  const percentage = itemTotal > 0 ? (toNumber(item.total_amount) / itemTotal) * 100 : 0;
                  return (
                    <div key={item.item} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate max-w-[200px]">
                          {item.item}
                        </span>
                        <span className="font-medium">{formatCurrency(item.total_amount)}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No item data</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card data-watermark="STAT">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Item Performance</CardTitle>
              <p className="text-xs text-muted-foreground">Average collections per item</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Average per item</div>
                <div className="text-2xl font-semibold">{formatCurrency(averagePerItem)}</div>
                <div className="text-xs text-muted-foreground">
                  {formatNumber(itemCount)} distinct items
                </div>
              </div>
              <div className="grid gap-2 text-xs">
                <div className="flex items-center justify-between rounded-md border bg-background/60 px-3 py-2">
                  <span className="text-muted-foreground">Transactions</span>
                  <span className="font-medium">{formatNumber(transactionCount)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background/60 px-3 py-2">
                  <span className="text-muted-foreground">Line entries</span>
                  <span className="font-medium">{formatNumber(lineCount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-watermark="CAL">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Monthly Totals</CardTitle>
              <p className="text-xs text-muted-foreground">Totals by month</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {byMonth.length > 0 ? (
                byMonth.map((month) => {
                  const percentage = monthMax > 0 ? (toNumber(month.total_amount) / monthMax) * 100 : 0;
                  return (
                    <div key={month.month_key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {month.month_label || month.month_key}
                        </span>
                        <span className="font-medium">{formatCurrency(month.total_amount)}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No monthly totals</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
