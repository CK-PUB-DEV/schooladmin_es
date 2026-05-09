import { Card, CardContent, CardHeader, CardTitle } from '../../../../../../components/ui/card';
import { Progress } from '../../../../../../components/ui/progress';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value) || 0);

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(Number(value) || 0);

export function ReceivablesStats({ data }) {
  if (!data) {
    return null;
  }

  const summary = data.summary || {};
  const byProgram = data.byProgram || [];
  const byGradeLevel = data.byGradeLevel || [];
  const balanceTiers = data.balanceTiers || [];
  const bySchoolYear = data.bySchoolYear || [];

  const hasAssessmentTotals = summary.total_assessment !== undefined;
  const totalAssessment = Number(summary.total_assessment) || 0;
  const totalPayment = Number(summary.total_payment) || 0;
  const totalReceivable = Number(summary.total_receivable) || 0;
  const totalStudents = Number(summary.total_students) || 0;
  const studentsWithBalance = Number(summary.students_with_balance) || 0;
  const averageBalance = Number(summary.average_balance) || 0;
  const totalOverpayment = Number(summary.total_overpayment) || 0;
  const overpaidCount = Number(summary.overpaid_count) || 0;

  const balanceRate = totalStudents > 0 ? (studentsWithBalance / totalStudents) * 100 : 0;

  const topPrograms = [...byProgram]
    .sort((a, b) => Number(b.total_balance) - Number(a.total_balance))
    .slice(0, 4);
  const topLevels = [...byGradeLevel]
    .sort((a, b) => Number(b.total_balance) - Number(a.total_balance))
    .slice(0, 5);
  const maxSyReceivable = Math.max(
    0,
    ...bySchoolYear.map((entry) => Number(entry.total_receivable) || 0)
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card data-watermark="AR">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Receivables Overview</CardTitle>
              <p className="text-xs text-muted-foreground">
                {hasAssessmentTotals ? 'Assessment and payment totals' : 'Outstanding balances across students'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-500/5 p-4">
                <div className="text-xs text-muted-foreground">
                  {hasAssessmentTotals ? 'Total assessment' : 'Total receivables'}
                </div>
                <div className="text-3xl font-semibold tracking-tight">
                  {formatCurrency(hasAssessmentTotals ? totalAssessment : totalReceivable)}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {hasAssessmentTotals
                    ? `${formatNumber(totalStudents)} students`
                    : `${formatNumber(studentsWithBalance)} students with balance`}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-background/60 px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    {hasAssessmentTotals ? 'Total payment' : 'Total students'}
                  </div>
                  <div className="text-sm font-semibold">
                    {hasAssessmentTotals ? formatCurrency(totalPayment) : formatNumber(totalStudents)}
                  </div>
                </div>
                <div className="rounded-lg border bg-background/60 px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    {hasAssessmentTotals ? 'Balance' : 'Average balance'}
                  </div>
                  <div className="text-sm font-semibold">
                    {hasAssessmentTotals ? formatCurrency(totalReceivable) : formatCurrency(averageBalance)}
                  </div>
                </div>
                <div className="rounded-lg border bg-background/60 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Overpayments</div>
                  <div className="text-sm font-semibold text-amber-700">
                    {formatCurrency(totalOverpayment)}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Balance penetration</span>
                  <span className="font-medium">{balanceRate.toFixed(1)}%</span>
                </div>
                <Progress value={balanceRate} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card data-watermark="TYPE">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">By Academic Program</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Highest receivable exposure</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {topPrograms.length > 0 ? (
                topPrograms.map((program) => {
                  const programBalance = Number(program.total_balance) || 0;
                  const percentage =
                    totalReceivable > 0 ? (programBalance / totalReceivable) * 100 : 0;
                  return (
                    <div key={program.program_id || program.program_name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{program.program_name}</span>
                        <span className="font-medium">
                          {formatCurrency(programBalance)} ({formatNumber(program.student_count)})
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No program data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card data-watermark="STAT">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Balance Health</CardTitle>
              <p className="text-xs text-muted-foreground">Clear vs outstanding accounts</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Cleared students</div>
                <div className="text-2xl font-semibold">
                  {formatNumber(totalStudents - studentsWithBalance)}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Overpaid accounts</span>
                  <span className="font-medium">{formatNumber(overpaidCount)}</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {formatCurrency(totalOverpayment)} total overpayment
                </div>
              </div>
              <div className="grid gap-2 text-xs">
                <div className="flex items-center justify-between rounded-md border bg-background/60 px-3 py-2">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="font-medium">{formatNumber(studentsWithBalance)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background/60 px-3 py-2">
                  <span className="text-muted-foreground">Receivable per student</span>
                  <span className="font-medium">{formatCurrency(averageBalance)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-watermark="LEVELS">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">By Grade Level</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Top levels by balance</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {topLevels.length > 0 ? (
                topLevels.map((level) => {
                  const levelBalance = Number(level.total_balance) || 0;
                  const percentage =
                    totalReceivable > 0 ? (levelBalance / totalReceivable) * 100 : 0;
                  return (
                    <div key={level.level_id || level.level_name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{level.level_name}</span>
                        <span className="font-medium">{formatCurrency(levelBalance)}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No level data available</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card data-watermark="LIST">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Balance Tiers</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Distribution by receivable size</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {balanceTiers.length > 0 ? (
            balanceTiers.map((tier) => {
              const tierPercentage =
                summary.total_receivable > 0
                  ? (Number(tier.total_balance || 0) / summary.total_receivable) * 100
                  : 0;
              return (
                <div key={tier.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{tier.label}</span>
                    <span className="font-medium">
                      {formatCurrency(tier.total_balance)} ({formatNumber(tier.count)})
                    </span>
                  </div>
                  <Progress value={tierPercentage} className="h-2" />
                </div>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground">No balance tiers available</p>
          )}
        </CardContent>
      </Card>

      <Card data-watermark="CAL">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Receivables by School Year</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Compare outstanding balances across SY</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {bySchoolYear.length > 0 ? (
            bySchoolYear.map((item) => {
              const total = Number(item.total_receivable) || 0;
              const percentage = maxSyReceivable > 0 ? (total / maxSyReceivable) * 100 : 0;
              return (
                <div key={item.syid || item.sydesc} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.sydesc || 'Unknown SY'}</span>
                    <span className="font-medium">
                      {formatCurrency(total)} ({formatNumber(item.students_with_balance || 0)})
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground">No school year comparison available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
