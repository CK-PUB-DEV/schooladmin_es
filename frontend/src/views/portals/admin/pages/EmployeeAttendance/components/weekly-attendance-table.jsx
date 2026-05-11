import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const formatHours = (value) => {
  if (!value || Number.isNaN(Number(value))) return '0.00h';
  return `${Number(value).toFixed(2)}h`;
};

const formatTime = (value) => {
  if (!value) return '-';
  try {
    return value.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch (error) {
    return '-';
  }
};

export function WeeklyAttendanceTable({ rows, days, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading weekly attendance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-background/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[220px]">Employee Name</TableHead>
            {days.map((day) => (
              <TableHead key={day.key}>
                <div className="flex flex-col text-xs">
                  <span className="font-medium">{day.label}</span>
                  <span className="text-muted-foreground">{day.dateLabel}</span>
                </div>
              </TableHead>
            ))}
            <TableHead className="text-right">Total Hours (Week)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows?.length ? (
            rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{row.full_name}</div>
                    <div className="text-xs text-muted-foreground">{row.identifier}</div>
                  </div>
                </TableCell>
                {days.map((day) => {
                  const summary = row.dailySummary?.[day.key];
                  const inTime = summary?.firstIn ? formatTime(summary.firstIn) : '-';
                  const outTime = summary?.lastOut ? formatTime(summary.lastOut) : '-';
                  const hours = summary?.hours || 0;

                  return (
                    <TableCell key={`${row.key}-${day.key}`}>
                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap gap-2">
                          <span className="text-muted-foreground">In:</span>
                          <span className="font-medium">{inTime}</span>
                          <span className="text-muted-foreground">Out:</span>
                          <span className="font-medium">{outTime}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Hours: <span className="font-medium text-foreground">{formatHours(hours)}</span>
                        </div>
                      </div>
                    </TableCell>
                  );
                })}
                <TableCell className="text-right font-semibold">
                  {formatHours(row.totalHours || 0)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={days.length + 2} className="h-24 text-center">
                <div className="text-muted-foreground">
                  <p>No attendance records found for this week</p>
                  <p className="text-sm mt-1">Try selecting a different week</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
