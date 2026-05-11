import { Card, CardContent, CardHeader, CardTitle } from '../../../../../../components/ui/card';
import { Progress } from '../../../../../../components/ui/progress';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(Number(value) || 0);

export function DailyCashStats({ data }) {
  if (!data) {
    return null;
  }

  const summary = data.summary || {};
  const byDay = data.byDay || [];
  const byClassification = data.byClassification || [];
  const byPaymentType = data.byPaymentType || [];

  const totalCollections = Number(summary.total_collections) || 0;
  const totalTransactions = Number(summary.total_transactions) || 0;
  const totalItems = Number(summary.total_items) || 0;
  const averagePerTransaction = Number(summary.average_per_transaction) || 0;
  const averagePerItem = Number(summary.average_per_item) || 0;
  const totalOverpayment = Number(summary.total_overpayment) || 0;
  const overpaymentCount = Number(summary.overpayment_count) || 0;

  const topClassifications = byClassification;
  const topPaymentTypes = byPaymentType.slice(0, 4);
  const maxDailyAmount = Math.max(
    0,
    ...byDay.map((item) => Number(item.total_amount) || 0)
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card data-watermark="CASH">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Daily Collections Overview</CardTitle>
              <p className="text-xs text-muted-foreground">Progress for the selected day</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-500/5 p-4">
                <div className="text-xs text-muted-foreground">Total collected</div>
                <div className="text-3xl font-semibold tracking-tight">
                  {formatCurrency(totalCollections)}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {formatNumber(totalTransactions)} transactions
                </div>
              </div>
              {/* Stats grid hidden temporarily */}
            </CardContent>
          </Card>

          <Card data-watermark="CLASS">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Collections by Classification</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Top fee buckets</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {topClassifications.length > 0 ? (
                topClassifications.map((item) => {
                  const percentage =
                    totalCollections > 0
                      ? (Number(item.total_amount) / totalCollections) * 100
                      : 0;
                  return (
                    <div key={item.classid || item.classification} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {item.classification || 'Uncategorized'}
                        </span>
                        <span className="font-medium">{formatCurrency(item.total_amount)}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No classification data</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card data-watermark="OVER">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Overpayment Watch</CardTitle>
              <p className="text-xs text-muted-foreground">Excess payment tracking</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Total overpayment</div>
                <div className="text-2xl font-semibold">{formatCurrency(totalOverpayment)}</div>
                <div className="text-xs text-muted-foreground">
                  {formatNumber(overpaymentCount)} transactions
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                Overpayments are computed from amount paid minus item totals and change.
              </div>
            </CardContent>
          </Card>

          <Card data-watermark="TYPE">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Payment Type Mix</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Collections by channel</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {topPaymentTypes.length > 0 ? (
                topPaymentTypes.map((item) => {
                  const percentage =
                    totalCollections > 0
                      ? (Number(item.total_amount) / totalCollections) * 100
                      : 0;
                  return (
                    <div key={item.payment_type} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{item.payment_type}</span>
                        <span className="font-medium">
                          {formatCurrency(item.total_amount)} ({formatNumber(item.transaction_count)})
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No payment type data</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card data-watermark="DAILY">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Daily Cash Progress</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Collections by day</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {byDay.length > 0 ? (
            byDay.map((day) => {
              const percentage =
                maxDailyAmount > 0 ? (Number(day.total_amount) / maxDailyAmount) * 100 : 0;
              return (
                <div key={day.date} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{day.date}</span>
                    <span className="font-medium">
                      {formatCurrency(day.total_amount)} ({formatNumber(day.transaction_count)})
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground">No daily data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
