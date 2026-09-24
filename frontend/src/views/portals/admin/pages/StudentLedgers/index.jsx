import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCcw, Search } from 'lucide-react';
import { apiUrl } from '../../../../../lib/api';
import { Card, CardContent } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import { Badge } from '../../../../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../components/ui/select';
import { LedgerSheet } from './components/ledger-sheet';
import { formatCurrency, formatNumber, toNumber } from './components/format';

const PER_PAGE = 25;

function FilterSelect({ label, value, onChange, allLabel, options, width = 'w-[200px]' }) {
  return (
    <div className={width}>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full">
          <SelectValue placeholder={allLabel || label} />
        </SelectTrigger>
        <SelectContent>
          {allLabel && <SelectItem value="all">{allLabel}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function StudentLedgers() {
  const selectedSchool = JSON.parse(localStorage.getItem('selectedSchool') || 'null');
  const token = localStorage.getItem('token');
  const isFinanceV1 = selectedSchool?.finance_v1 == 1;

  const schoolDbConfig = selectedSchool
    ? {
        db_host: selectedSchool.db_host || 'localhost',
        db_port: selectedSchool.db_port || 3306,
        db_name: selectedSchool.db_name,
        db_username: selectedSchool.db_username || 'root',
        db_password: selectedSchool.db_password || '',
        finance_v1: selectedSchool.finance_v1 || 0,
      }
    : null;

  const [filters, setFilters] = useState(null);
  const [filtersError, setFiltersError] = useState('');
  const [selectedSy, setSelectedSy] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeStudent, setActiveStudent] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const listAbortRef = useRef(null);

  const post = (path, body, signal) =>
    fetch(apiUrl(`/api/admin/student-ledgers${path}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'include',
      signal,
      body: JSON.stringify({ schoolDbConfig, ...body }),
    }).then((r) => r.json());

  useEffect(() => {
    if (!selectedSchool) { toast.error('No school selected'); return; }
    if (isFinanceV1) return;
    post('/filters', {})
      .then((result) => {
        if (result.status !== 'success') { setFiltersError(result.message || 'Failed to load filters'); return; }
        const data = result.data;
        setFilters(data);
        const activeSy = data.schoolYears.find((sy) => Number(sy.isactive) === 1) || data.schoolYears[0];
        const activeSem = data.semesters.find((s) => Number(s.isactive) === 1) || data.semesters[0];
        if (activeSy) setSelectedSy(String(activeSy.id));
        if (activeSem) setSelectedSem(String(activeSem.id));
      })
      .catch(() => setFiltersError('Error loading filters'));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [selectedSy, selectedSem, selectedProgram, selectedLevel, selectedStatus, debouncedSearch]);

  useEffect(() => {
    if (!selectedSy) return;
    if (listAbortRef.current) listAbortRef.current.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;
    setLoading(true);
    post(
      '/students',
      {
        syid: selectedSy,
        semid: selectedSem || null,
        programId: selectedProgram === 'all' ? null : selectedProgram,
        levelId: selectedLevel === 'all' ? null : selectedLevel,
        status: selectedStatus === 'all' ? null : selectedStatus,
        search: debouncedSearch || null,
        page,
        perPage: PER_PAGE,
      },
      controller.signal
    )
      .then((result) => {
        if (result.status === 'success') {
          setStudents(result.data.students || []);
          setPagination(result.data.pagination || null);
        } else {
          toast.error(result.message || 'Failed to load students');
          setStudents([]);
          setPagination(null);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') toast.error('Error loading students');
      })
      .finally(() => {
        if (listAbortRef.current === controller) setLoading(false);
      });
    return () => controller.abort();
  }, [selectedSy, selectedSem, selectedProgram, selectedLevel, selectedStatus, debouncedSearch, page, reloadKey]);

  useEffect(() => {
    if (selectedProgram === 'all' || selectedLevel === 'all' || !filters) return;
    const level = filters.gradeLevels.find((l) => String(l.id) === selectedLevel);
    if (level && String(level.acadprogid) !== selectedProgram) setSelectedLevel('all');
  }, [selectedProgram]);

  const levelOptions = useMemo(() => {
    const levels = (filters?.gradeLevels || []).filter(
      (l) => selectedProgram === 'all' || String(l.acadprogid) === selectedProgram
    );
    return [...levels]
      .sort((a, b) => (Number(a.sortid) || 0) - (Number(b.sortid) || 0) || a.levelname.localeCompare(b.levelname))
      .map((l) => ({ value: String(l.id), label: l.levelname }));
  }, [filters, selectedProgram]);

  const pageTotals = students.reduce(
    (acc, s) => ({
      fees: acc.fees + toNumber(s.totals?.total_fees),
      payment: acc.payment + toNumber(s.totals?.total_payment),
      balance: acc.balance + toNumber(s.totals?.full_balance),
    }),
    { fees: 0, payment: 0, balance: 0 }
  );

  if (isFinanceV1) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold tracking-tight">Student Ledgers</h1>
        <Card className="mt-4">
          <CardContent className="py-10 text-center text-muted-foreground">
            Student Ledgers is only available for Finance V2 schools.
          </CardContent>
        </Card>
      </div>
    );
  }

  const describeProgram = (s) =>
    [s.course_name || s.strandcode, s.section_name].filter(Boolean).join(' · ');

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Ledgers</h1>
          <p className="text-muted-foreground">Per-student assessment, payments and balances</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)} disabled={loading || !selectedSy}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {filtersError && (
        <div className="rounded-md border border-rose-200 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{filtersError}</div>
      )}

      <Card data-watermark="FILTER">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <FilterSelect
              label="School Year"
              value={selectedSy}
              onChange={setSelectedSy}
              options={(filters?.schoolYears || []).map((sy) => ({ value: String(sy.id), label: sy.sydesc }))}
              width="w-[170px]"
            />
            <FilterSelect
              label="Semester"
              value={selectedSem}
              onChange={setSelectedSem}
              options={(filters?.semesters || []).map((s) => ({ value: String(s.id), label: s.semester }))}
              width="w-[170px]"
            />
            <FilterSelect
              label="Academic Program"
              value={selectedProgram}
              onChange={setSelectedProgram}
              allLabel="All programs"
              options={(filters?.programs || []).map((p) => ({ value: String(p.id), label: p.progname }))}
            />
            <FilterSelect
              label="Grade Level"
              value={selectedLevel}
              onChange={setSelectedLevel}
              allLabel="All levels"
              options={levelOptions}
            />
            <FilterSelect
              label="Status"
              value={selectedStatus}
              onChange={setSelectedStatus}
              allLabel="All statuses"
              options={(filters?.statuses || []).map((s) => ({ value: String(s.id), label: s.description }))}
              width="w-[180px]"
            />
            <div className="w-[260px]">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name, ID or LRN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-watermark="TABLE">
        <CardContent className="pt-6">
          <div className="max-h-[calc(100vh-360px)] overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b bg-muted/40 text-xs text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Student</th>
                  <th className="px-3 py-2 text-left font-medium">Level</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Total Fees</th>
                  <th className="px-3 py-2 text-right font-medium">Payments</th>
                  <th className="px-3 py-2 text-right font-medium">Discount / Credit</th>
                  <th className="px-3 py-2 text-right font-medium">Current Due</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading && students.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <RefreshCcw className="mx-auto h-6 w-6 animate-spin text-primary" />
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No students found</td>
                  </tr>
                ) : (
                  students.map((s) => {
                    const t = s.totals || {};
                    const balance = toNumber(t.full_balance);
                    const over = toNumber(t.total_overpayment);
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setActiveStudent(s)}
                        className={`cursor-pointer border-b last:border-0 hover:bg-muted/40 ${loading ? 'opacity-60' : ''}`}
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium">{s.fullname}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.sid}
                            {describeProgram(s) && ` · ${describeProgram(s)}`}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">{s.academic_level || '—'}</td>
                        <td className="px-3 py-2">
                          <Badge variant={s.is_enrolled ? 'secondary' : 'outline'} className="text-[10px]">
                            {s.status || (s.is_enrolled ? 'ENROLLED' : 'NOT ENROLLED')}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(t.total_fees)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{formatCurrency(t.total_payment)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(t.total_discount_credit)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(t.current_balance)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${balance > 0 ? 'font-medium text-rose-600' : ''}`}>
                          {formatCurrency(balance)}
                          {over > 0 && <div className="text-[10px] text-amber-600">Overpaid {formatCurrency(over)}</div>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {students.length > 0 && (
                <tfoot className="sticky bottom-0 border-t bg-muted/60 text-xs font-semibold backdrop-blur">
                  <tr>
                    <td className="px-3 py-2" colSpan={3}>Page total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(pageTotals.fees)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{formatCurrency(pageTotals.payment)}</td>
                    <td colSpan={2} />
                    <td className="px-3 py-2 text-right tabular-nums text-rose-600">{formatCurrency(pageTotals.balance)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {pagination && (
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {pagination.total > 0
                  ? `Showing ${formatNumber(pagination.from)}–${formatNumber(pagination.to)} of ${formatNumber(pagination.total)} students`
                  : 'No results'}
              </span>
              <div className="flex items-center gap-2">
                <span>Page {pagination.current_page} of {pagination.last_page}</span>
                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= (pagination.last_page || 1) || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <LedgerSheet
        student={activeStudent}
        open={!!activeStudent}
        onOpenChange={(open) => { if (!open) setActiveStudent(null); }}
        schoolDbConfig={schoolDbConfig}
        token={token}
        syid={selectedSy}
        semid={selectedSem || null}
      />
    </div>
  );
}
