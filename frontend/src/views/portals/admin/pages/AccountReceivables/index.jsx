import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '../../../../../lib/api';
import { Card, CardContent } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../components/ui/select';
import { Input } from '../../../../../components/ui/input';
import { RefreshCcw, Download, BookOpen, LayoutList } from 'lucide-react';
import { ReceivablesTable } from './components/receivables-table';

const PER_PAGE = 200;
const TX_PER_PAGE = 100;

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(Number(value) || 0);

function SnapshotCard({ label, value, tone = 'default', sub }) {
  const toneClass =
    tone === 'good'   ? 'text-emerald-600' :
    tone === 'warn'   ? 'text-amber-600'   :
    tone === 'danger' ? 'text-rose-600'    : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function BreakdownCards({ breakdown }) {
  if (!breakdown || breakdown.length === 0) return null;

  // Group by acadprog
  const byProg = {};
  for (const row of breakdown) {
    const key = row.acadprog_id ?? 'other';
    if (!byProg[key]) byProg[key] = { name: row.program_name || 'Unknown', levels: [] };
    byProg[key].levels.push(row);
  }

  return (
    <div className="space-y-3">
      {Object.entries(byProg).map(([progKey, prog]) => (
        <Card key={progKey}>
          <CardContent className="pt-4 pb-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {prog.name}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-1.5 text-left font-medium">Grade / Year Level</th>
                    <th className="py-1.5 text-right font-medium">Total Payables</th>
                    <th className="py-1.5 text-right font-medium">Payments</th>
                    <th className="py-1.5 text-right font-medium">Balance</th>
                    <th className="py-1.5 text-right font-medium">Students</th>
                  </tr>
                </thead>
                <tbody>
                  {prog.levels.map((row) => (
                    <tr key={row.level_id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-1.5">{row.levelname}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatCurrency(row.total_payables)}</td>
                      <td className="py-1.5 text-right tabular-nums text-emerald-600">{formatCurrency(row.total_payment)}</td>
                      <td className="py-1.5 text-right tabular-nums text-rose-600 font-medium">{formatCurrency(row.total_balance)}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatNumber(row.student_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TransactionsTab({ schoolDbConfig, syid, semid, token }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage]       = useState(1);
  const [meta, setMeta]       = useState(null);
  const [search, setSearch]   = useState('');
  const abortRef              = useRef(null);
  const debounceRef           = useRef(null);

  const fetchTransactions = async (p = 1, q = search) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/receivables/transactions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({ schoolDbConfig, syid, semid, search: q || null, page: p, perPage: TX_PER_PAGE }),
      });
      const result = await res.json();
      if (result.status === 'success') {
        setRows(result.data || []);
        setMeta(result.meta || null);
        setPage(p);
      } else {
        toast.error(result.message || 'Failed to load transactions');
      }
    } catch (err) {
      if (err.name !== 'AbortError') toast.error('Error loading transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(1);
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [syid, semid]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchTransactions(1, val), 400);
  };

  const TYPE_LABELS = {
    charge: { label: 'Charge', cls: 'text-rose-600' },
    payment: { label: 'Payment', cls: 'text-emerald-600' },
    discount: { label: 'Discount', cls: 'text-amber-600' },
    refund: { label: 'Refund', cls: 'text-blue-600' },
    fee_change: { label: 'Fee Change', cls: 'text-muted-foreground' },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search student name or ID..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-9 max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={() => fetchTransactions(page)} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        {meta && (
          <span className="text-xs text-muted-foreground ml-auto">
            {formatNumber(meta.total)} transactions
          </span>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex min-h-[160px] items-center justify-center">
          <RefreshCcw className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-md border overflow-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b bg-muted/40">
              <tr className="text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Student</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-right font-medium">Balance After</th>
                <th className="px-3 py-2 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No transactions found
                  </td>
                </tr>
              ) : rows.map((row) => {
                const t = TYPE_LABELS[row.type] || { label: row.type, cls: '' };
                return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-1.5">
                      <div className="font-medium">{row.full_name}</div>
                      <div className="text-xs text-muted-foreground">{row.sid}</div>
                    </td>
                    <td className={`px-3 py-1.5 text-xs font-medium ${t.cls}`}>{t.label}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground max-w-[260px] truncate">{row.description}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {row.amount != null ? formatCurrency(row.amount) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-rose-600">
                      {formatCurrency(row.updated_balance)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {row.created_at ? new Date(row.created_at).toLocaleDateString('en-PH') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {meta.page} of {meta.pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={meta.page <= 1 || loading}
              onClick={() => fetchTransactions(meta.page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={meta.page >= meta.pages || loading}
              onClick={() => fetchTransactions(meta.page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountReceivables() {
  const selectedSchool = JSON.parse(localStorage.getItem('selectedSchool') || 'null');
  const token = localStorage.getItem('token');

  const schoolDbConfig = selectedSchool ? {
    db_host:     selectedSchool.db_host     || 'localhost',
    db_port:     selectedSchool.db_port     || 3306,
    db_name:     selectedSchool.db_name,
    db_username: selectedSchool.db_username || 'root',
    db_password: selectedSchool.db_password || '',
    finance_v1:  selectedSchool.finance_v1  || 0,
  } : null;

  const isFinanceV1 = selectedSchool?.finance_v1 == 1;
  const API_BASE    = isFinanceV1 ? '/api/admin/finance-v1' : '/api/admin';

  const [activeTab, setActiveTab]       = useState('overview');
  const [summaryData, setSummaryData]   = useState(null);
  const [receivables, setReceivables]   = useState([]);
  const [programs, setPrograms]         = useState([]);
  const [gradeLevels, setGradeLevels]   = useState([]);
  const [sections, setSections]         = useState([]);
  const [grantees, setGrantees]         = useState([]);
  const [modes, setModes]               = useState([]);
  const [schoolYears, setSchoolYears]   = useState([]);
  const [semesters, setSemesters]       = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [listLoading, setListLoading]   = useState(false);

  const [selectedSy,      setSelectedSy]      = useState('');
  const [selectedSem,     setSelectedSem]     = useState('');
  const [selectedProgram, setSelectedProgram] = useState('all');
  const [selectedLevel,   setSelectedLevel]   = useState('all');
  const [selectedSection, setSelectedSection] = useState('all');
  const [selectedGrantee, setSelectedGrantee] = useState('all');
  const [selectedMode,    setSelectedMode]    = useState('all');
  const [startDate,       setStartDate]       = useState('');
  const [endDate,         setEndDate]         = useState('');

  const summaryAbortRef = useRef(null);
  const listAbortRef    = useRef(null);
  const debounceRef     = useRef(null);

  useEffect(() => {
    if (!selectedSchool) { toast.error('No school selected'); return; }
    fetchSchoolYears();
    fetchSemesters();
    fetchFilters();
  }, []);

  useEffect(() => {
    if (!selectedSy || !selectedSem) return;
    if (isFinanceV1 && ((startDate && !endDate) || (!startDate && endDate))) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchReceivablesSummary();
      if (isFinanceV1) fetchReceivablesList();
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [isFinanceV1, selectedSy, selectedSem, selectedProgram, selectedLevel,
      selectedSection, selectedGrantee, selectedMode, startDate, endDate]);

  useEffect(() => {
    return () => {
      if (summaryAbortRef.current) summaryAbortRef.current.abort();
      if (listAbortRef.current)    listAbortRef.current.abort();
      clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (isFinanceV1) return;
    if (selectedProgram === 'all') return;
    const programId = Number(selectedProgram);
    const validLevels = gradeLevels.filter((l) => Number(l.acadprogid) === programId);
    if (selectedLevel !== 'all' && !validLevels.some((l) => `${l.id}` === selectedLevel)) {
      setSelectedLevel('all');
    }
  }, [isFinanceV1, selectedProgram, gradeLevels, selectedLevel]);

  const fetchSchoolYears = async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/enrollment/school-years'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ schoolDbConfig }),
      });
      const result = await res.json();
      if (result.status === 'success') {
        setSchoolYears(result.data || []);
        const active = result.data.find((sy) => sy.isactive === 1);
        const first  = result.data[0];
        if (active) setSelectedSy(active.id.toString());
        else if (first) setSelectedSy(first.id.toString());
      }
    } catch {}
  };

  const fetchSemesters = async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/enrollment/semesters'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ schoolDbConfig }),
      });
      const result = await res.json();
      if (result.status === 'success') {
        setSemesters(result.data || []);
        const active = result.data.find((s) => s.isactive === 1);
        const first  = result.data[0];
        if (active) setSelectedSem(active.id.toString());
        else if (first) setSelectedSem(first.id.toString());
        else if (isFinanceV1) setSelectedSem('all');
      }
    } catch {}
  };

  const fetchFilters = async () => {
    try {
      const res = await fetch(apiUrl(`${API_BASE}/receivables/filters`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ schoolDbConfig }),
      });
      const result = await res.json();
      if (result.status === 'success') {
        setPrograms(result.data.programs    || []);
        setGradeLevels(result.data.gradeLevels || []);
        setGrantees(result.data.grantees    || []);
        setModes(result.data.modes          || []);
      }
    } catch {}
  };

  useEffect(() => {
    if (!isFinanceV1) return;
    if (!selectedLevel || selectedLevel === 'all') { setSections([]); setSelectedSection('all'); return; }
    setSelectedSection('all');
    fetch(apiUrl(`${API_BASE}/receivables/sections`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'include',
      body: JSON.stringify({ schoolDbConfig, levelId: selectedLevel }),
    })
      .then((r) => r.json())
      .then((result) => setSections(result.status === 'success' ? result.data || [] : []))
      .catch(() => setSections([]));
  }, [isFinanceV1, selectedLevel]);

  const buildPayload = (extra = {}) => {
    const payload = {
      schoolDbConfig,
      syid:      selectedSy,
      semid:     selectedSem === 'all' ? null : selectedSem,
      programId: selectedProgram === 'all' ? null : selectedProgram,
      levelId:   selectedLevel  === 'all' ? null : selectedLevel,
    };
    if (isFinanceV1) {
      payload.sectionId = selectedSection === 'all' ? null : selectedSection;
      payload.granteeId = selectedGrantee === 'all' ? null : selectedGrantee;
      payload.modeId    = selectedMode    === 'all' ? null : selectedMode;
      payload.startDate = startDate || null;
      payload.endDate   = endDate   || null;
    }
    return { ...payload, ...extra };
  };

  const fetchReceivablesSummary = async (bust = false) => {
    if (summaryAbortRef.current) summaryAbortRef.current.abort();
    const controller = new AbortController();
    summaryAbortRef.current = controller;
    setSummaryLoading(true);
    try {
      const res = await fetch(apiUrl(`${API_BASE}/receivables/summary`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify(buildPayload(bust ? { bustCache: true } : {})),
      });
      const result = await res.json();
      if (result.status === 'success') setSummaryData(result.data);
      else toast.error(result.message || 'Failed to fetch summary');
    } catch (err) {
      if (err.name !== 'AbortError') toast.error('Error fetching summary');
    } finally {
      if (summaryAbortRef.current === controller) setSummaryLoading(false);
    }
  };

  const fetchReceivablesList = async () => {
    if (listAbortRef.current) listAbortRef.current.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;
    setListLoading(true);
    try {
      const res = await fetch(apiUrl(`${API_BASE}/receivables/list`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify(buildPayload({ page: 1, perPage: isFinanceV1 ? 0 : PER_PAGE })),
      });
      const result = await res.json();
      if (result.status === 'success') setReceivables(result.data || []);
      else toast.error(result.message || 'Failed to fetch list');
    } catch (err) {
      if (err.name !== 'AbortError') toast.error('Error fetching list');
    } finally {
      if (listAbortRef.current === controller) setListLoading(false);
    }
  };

  const handleExport = () => {
    if (!receivables || receivables.length === 0) { toast.error('No data to export'); return; }
    const headers = Object.keys(receivables[0]).join(',');
    const rows = receivables.map((row) => Object.values(row).map((v) => `"${v ?? ''}"`).join(','));
    const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `account_receivables_${Date.now()}.csv`,
      style: 'display:none',
    });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported');
  };

  const handleRefresh = () => {
    clearTimeout(debounceRef.current);
    fetchReceivablesSummary(true);
    if (isFinanceV1) fetchReceivablesList();
  };

  const sortGradeLevels = (levels) =>
    [...levels].sort((a, b) => {
      const ak = Number(a.acadprogid) || 999;
      const bk = Number(b.acadprogid) || 999;
      return ak !== bk ? ak - bk : (a.levelname || '').localeCompare(b.levelname || '', undefined, { numeric: true });
    });

  const sortedLevels   = sortGradeLevels(gradeLevels);
  const filteredLevels = isFinanceV1 || selectedProgram === 'all'
    ? sortedLevels
    : sortedLevels.filter((l) => `${l.acadprogid}` === selectedProgram);

  // V2: flat format with total_payables key
  // V1: nested { summary: { total_assessment, total_payment, total_receivable, ... } }
  const isV2Data         = summaryData && 'total_payables' in summaryData;
  const v1s              = summaryData?.summary || {};
  const totalPayables    = isV2Data ? Number(summaryData.total_payables)    || 0 : Number(v1s.total_assessment)                    || 0;
  const totalPayment     = isV2Data ? Number(summaryData.total_payment)     || 0 : Number(v1s.total_payment)                       || 0;
  const totalBalance     = isV2Data ? Number(summaryData.total_balance)     || 0 : Number(v1s.total_receivable ?? v1s.total_balance)|| 0;
  const totalOverpayment = isV2Data ? Number(summaryData.total_overpayment) || 0 : Number(v1s.total_overpayment)                   || 0;
  const totalStudents    = isV2Data ? Number(summaryData.student_count)     || 0 : Number(v1s.total_students)                      || 0;
  const withBalance      = isV2Data ? Number(summaryData.students_with_balance) || 0 : Number(v1s.students_with_balance)           || 0;
  const breakdown        = isV2Data ? (summaryData.breakdown || []) : [];

  const tabs = isFinanceV1
    ? [{ id: 'overview', label: 'Overview', icon: LayoutList }]
    : [
        { id: 'overview',      label: 'Overview',     icon: LayoutList },
        { id: 'transactions',  label: 'Transactions', icon: BookOpen   },
      ];

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Account Receivables</h1>
          <p className="text-muted-foreground">Monitor outstanding balances across programs</p>
        </div>
        <div className="flex items-center gap-3">
          {summaryLoading && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> Updating...
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card data-watermark="FILTER">
        <CardContent className="pt-6">
          {isFinanceV1 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-[200px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">School Year</label>
                  <Select value={selectedSy} onValueChange={setSelectedSy}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="School year" /></SelectTrigger>
                    <SelectContent>
                      {schoolYears.map((sy) => <SelectItem key={sy.id} value={sy.id.toString()}>{sy.sydesc}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[260px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Date Range</label>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
                    <Input type="date" value={endDate}   onChange={(e) => setEndDate(e.target.value)}   className="h-9" />
                  </div>
                </div>
                <div className="w-[180px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Department</label>
                  <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {programs.map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.acadprogcode || p.progname}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[180px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Grade Level</label>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filteredLevels.map((l) => <SelectItem key={l.id} value={l.id.toString()}>{l.levelname}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-[180px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Semester</label>
                  <Select value={selectedSem} onValueChange={setSelectedSem}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="Semester" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {semesters.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.semester}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[180px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Section</label>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {sections.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.sectionname}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[180px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Grantee</label>
                  <Select value={selectedGrantee} onValueChange={setSelectedGrantee}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {grantees.map((g) => <SelectItem key={g.id} value={g.id.toString()}>{g.description}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[180px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">MOL</label>
                  <Select value={selectedMode} onValueChange={setSelectedMode}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {modes.map((m) => <SelectItem key={m.id} value={m.id.toString()}>{m.description}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} className="h-9 ml-auto">
                  <Download className="h-4 w-4 mr-2" /> Export
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-[200px]">
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">School Year</label>
                <Select value={selectedSy} onValueChange={setSelectedSy}>
                  <SelectTrigger className="w-full h-9"><SelectValue placeholder="School year" /></SelectTrigger>
                  <SelectContent>
                    {schoolYears.map((sy) => <SelectItem key={sy.id} value={sy.id.toString()}>{sy.sydesc}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[200px]">
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Semester</label>
                <Select value={selectedSem} onValueChange={setSelectedSem}>
                  <SelectTrigger className="w-full h-9"><SelectValue placeholder="Semester" /></SelectTrigger>
                  <SelectContent>
                    {semesters.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.semester}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[220px]">
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Academic Program</label>
                <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                  <SelectTrigger className="w-full h-9"><SelectValue placeholder="All programs" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All programs</SelectItem>
                    {programs.map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.progname}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[220px]">
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Grade Level</label>
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger className="w-full h-9"><SelectValue placeholder="All levels" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All levels</SelectItem>
                    {filteredLevels.map((l) => <SelectItem key={l.id} value={l.id.toString()}>{l.levelname}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Snapshot cards */}
      {summaryLoading && !summaryData ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-md border bg-background">
          <RefreshCcw className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-sm text-muted-foreground">Loading receivables...</span>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SnapshotCard label={isFinanceV1 ? 'Total Assessment' : 'Total Payables'} value={formatCurrency(totalPayables)} sub={`${formatNumber(totalStudents)} students`} />
          <SnapshotCard label="Payments"    value={formatCurrency(totalPayment)}  tone="good" />
          <SnapshotCard label="Outstanding" value={formatCurrency(totalBalance)}  tone="danger" sub={`${formatNumber(withBalance)} with balance`} />
          <SnapshotCard label="Students"    value={formatNumber(totalStudents)} />
          <SnapshotCard label="With Balance" value={formatNumber(withBalance)}   tone="warn" />
        </div>
      )}

      {totalOverpayment > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-500/10 px-4 py-2 text-sm text-amber-800">
          Overpayments: <span className="font-semibold">{formatCurrency(totalOverpayment)}</span>
        </div>
      )}

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex gap-1 border-b">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Per-level breakdown cards (V2 only) */}
          {!isFinanceV1 && breakdown.length > 0 && (
            <BreakdownCards breakdown={breakdown} />
          )}

          {/* V1 detail table */}
          {isFinanceV1 && (
            <Card data-watermark="TABLE">
              <CardContent className="pt-6">
                <ReceivablesTable data={receivables} loading={listLoading} isFinanceV1={isFinanceV1} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'transactions' && !isFinanceV1 && (
        <Card data-watermark="TXN">
          <CardContent className="pt-6">
            <TransactionsTab
              schoolDbConfig={schoolDbConfig}
              syid={selectedSy}
              semid={selectedSem === 'all' ? null : selectedSem}
              token={token}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
