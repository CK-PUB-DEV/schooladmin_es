import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '../../../../../lib/api';
import { Card, CardContent } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../components/ui/select';
import { Input } from '../../../../../components/ui/input';
import { RefreshCcw, Download } from 'lucide-react';
import { ReceivablesTable } from './components/receivables-table';

const PER_PAGE = 200;

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value) || 0);

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(Number(value) || 0);

function SnapshotCard({ label, value, tone = 'default' }) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'danger'
          ? 'text-rose-700'
          : 'text-foreground';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold tracking-tight ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

export default function AccountReceivables() {
  const selectedSchool = JSON.parse(localStorage.getItem('selectedSchool') || 'null');
  const token = localStorage.getItem('token');

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

  // Check if school uses finance_v1 to determine API routing
  const isFinanceV1 = selectedSchool?.finance_v1 == 1;
  const API_BASE = isFinanceV1 ? '/api/admin/finance-v1' : '/api/admin';

  const [summaryData, setSummaryData] = useState(null);
  const [receivables, setReceivables] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [sections, setSections] = useState([]);
  const [grantees, setGrantees] = useState([]);
  const [modes, setModes] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(isFinanceV1);

  const [selectedSy, setSelectedSy] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedSection, setSelectedSection] = useState('all');
  const [selectedGrantee, setSelectedGrantee] = useState('all');
  const [selectedMode, setSelectedMode] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const summaryAbortRef = useRef(null);
  const listAbortRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!selectedSchool) {
      toast.error('No school selected');
      return;
    }
    fetchSchoolYears();
    fetchSemesters();
    fetchFilters();
  }, []);

  useEffect(() => {
    if (!selectedSy || !selectedSem) return;

    if (isFinanceV1 && ((startDate && !endDate) || (!startDate && endDate))) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchReceivablesSummary();
      if (isFinanceV1 || detailsLoaded) {
        fetchReceivablesList();
      } else {
        setReceivables([]);
      }
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [
    isFinanceV1,
    selectedSy,
    selectedSem,
    selectedProgram,
    selectedLevel,
    selectedSection,
    selectedGrantee,
    selectedMode,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    return () => {
      if (summaryAbortRef.current) {
        summaryAbortRef.current.abort();
      }
      if (listAbortRef.current) {
        listAbortRef.current.abort();
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isFinanceV1) return;
    if (selectedProgram === 'all') return;
    const programId = Number(selectedProgram);
    const validLevels = gradeLevels.filter((level) => Number(level.acadprogid) === programId);
    if (selectedLevel !== 'all' && !validLevels.some((level) => `${level.id}` === selectedLevel)) {
      setSelectedLevel('all');
    }
  }, [isFinanceV1, selectedProgram, gradeLevels, selectedLevel]);

  const fetchSchoolYears = async () => {
    try {
      const response = await fetch(apiUrl('/api/admin/enrollment/school-years'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ schoolDbConfig }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setSchoolYears(result.data || []);
        const active = result.data.find((sy) => sy.isactive === 1);
        if (active) {
          setSelectedSy(active.id.toString());
        } else if (result.data.length > 0) {
          setSelectedSy(result.data[0].id.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching school years:', error);
    }
  };

  const fetchSemesters = async () => {
    try {
      const response = await fetch(apiUrl('/api/admin/enrollment/semesters'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ schoolDbConfig }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setSemesters(result.data || []);
        const active = result.data.find((sem) => sem.isactive === 1);
        if (active) {
          setSelectedSem(active.id.toString());
        } else if (result.data.length > 0) {
          setSelectedSem(result.data[0].id.toString());
        } else if (isFinanceV1) {
          setSelectedSem('all');
        }
      }
    } catch (error) {
      console.error('Error fetching semesters:', error);
    }
  };

  const fetchFilters = async () => {
    try {
      const response = await fetch(apiUrl(`${API_BASE}/receivables/filters`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ schoolDbConfig }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setPrograms(result.data.programs || []);
        setGradeLevels(result.data.gradeLevels || []);
        setGrantees(result.data.grantees || []);
        setModes(result.data.modes || []);
      }
    } catch (error) {
      console.error('Error fetching receivable filters:', error);
    }
  };

  const fetchSectionsByLevel = async (levelId) => {
    try {
      const response = await fetch(apiUrl(`${API_BASE}/receivables/sections`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ schoolDbConfig, levelId }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setSections(result.data || []);
      } else {
        setSections([]);
      }
    } catch (error) {
      console.error('Error fetching receivable sections:', error);
      setSections([]);
    }
  };

  useEffect(() => {
    if (!isFinanceV1) return;

    if (!selectedLevel || selectedLevel === 'all') {
      setSections([]);
      setSelectedSection('all');
      return;
    }

    setSelectedSection('all');
    fetchSectionsByLevel(selectedLevel);
  }, [isFinanceV1, selectedLevel]);

  const buildReceivablePayload = (extra = {}) => {
    const payload = {
      schoolDbConfig,
      syid: selectedSy,
      semid: selectedSem === 'all' ? null : selectedSem,
      programId: selectedProgram === 'all' ? null : selectedProgram,
      levelId: selectedLevel === 'all' ? null : selectedLevel,
    };

    if (isFinanceV1) {
      payload.sectionId = selectedSection === 'all' ? null : selectedSection;
      payload.granteeId = selectedGrantee === 'all' ? null : selectedGrantee;
      payload.modeId = selectedMode === 'all' ? null : selectedMode;
      payload.dateFilter = null;
      payload.startDate = startDate || null;
      payload.endDate = endDate || null;
    } else {
      payload.dateFilter = null;
      payload.startDate = null;
      payload.endDate = null;
    }

    return { ...payload, ...extra };
  };

  const fetchReceivablesSummary = async () => {
    if (summaryAbortRef.current) {
      summaryAbortRef.current.abort();
    }
    const controller = new AbortController();
    summaryAbortRef.current = controller;

    try {
      setSummaryLoading(true);
      const response = await fetch(apiUrl(`${API_BASE}/receivables/summary`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify(buildReceivablePayload()),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setSummaryData(result.data);
      } else {
        toast.error(result.message || 'Failed to fetch receivables summary');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching receivables summary:', error);
        toast.error('An error occurred while fetching summary');
      }
    } finally {
      if (summaryAbortRef.current === controller) {
        setSummaryLoading(false);
      }
    }
  };

  const fetchReceivablesList = async () => {
    if (listAbortRef.current) {
      listAbortRef.current.abort();
    }
    const controller = new AbortController();
    listAbortRef.current = controller;

    try {
      setListLoading(true);
      const response = await fetch(apiUrl(`${API_BASE}/receivables/list`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify(
          buildReceivablePayload({
            page: 1,
            perPage: isFinanceV1 ? 0 : PER_PAGE,
          })
        ),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setReceivables(result.data || []);
        if (!isFinanceV1) {
          setDetailsLoaded(true);
        }
      } else {
        toast.error(result.message || 'Failed to fetch receivables list');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching receivables list:', error);
        toast.error('An error occurred while fetching receivables list');
      }
    } finally {
      if (listAbortRef.current === controller) {
        setListLoading(false);
      }
    }
  };

  const handleExport = () => {
    if (!isFinanceV1 && !detailsLoaded) {
      toast.error('Load details before exporting');
      return;
    }

    if (!receivables || receivables.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(receivables[0]).join(',');
    const rows = receivables.map((row) =>
      Object.values(row).map((val) => `"${val ?? ''}"`).join(',')
    );
    const csvContent = [headers, ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `account_receivables_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Data exported successfully');
  };

  const handleGenerate = () => {
    if (!selectedSy || (!selectedSem && !isFinanceV1) || (isFinanceV1 && !selectedSem)) {
      toast.error('Select school year');
      return;
    }

    if (isFinanceV1 && ((startDate && !endDate) || (!startDate && endDate))) {
      toast.error('Select both start and end dates');
      return;
    }

    fetchReceivablesSummary();
    if (isFinanceV1 || detailsLoaded) {
      fetchReceivablesList();
    }
  };

  const handleRefresh = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (isFinanceV1) {
      handleGenerate();
      return;
    }
    fetchReceivablesSummary();
    if (detailsLoaded) {
      fetchReceivablesList();
    }
  };

  const handleLoadDetails = () => {
    fetchReceivablesList();
  };

  const sortGradeLevels = (levels) => {
    return [...levels].sort((a, b) => {
      const aProg = Number(a.acadprogid);
      const bProg = Number(b.acadprogid);
      const aKey = Number.isFinite(aProg) ? (aProg === 1 ? 0 : aProg) : 999;
      const bKey = Number.isFinite(bProg) ? (bProg === 1 ? 0 : bProg) : 999;

      if (aKey !== bKey) {
        return aKey - bKey;
      }

      const aName = a.levelname || '';
      const bName = b.levelname || '';
      return aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' });
    });
  };

  const sortedLevels = sortGradeLevels(gradeLevels);
  const filteredLevels = isFinanceV1
    ? sortedLevels
    : selectedProgram === 'all'
      ? sortedLevels
      : sortedLevels.filter((level) => `${level.acadprogid}` === selectedProgram);
  const summary = summaryData?.summary || {};
  const totalReceivable = Number(summary.total_receivable) || 0;
  const totalPayment = Number(summary.total_payment) || 0;
  const outstandingBalance = Number(summary.total_balance ?? summary.total_receivable) || 0;
  const totalStudents = Number(summary.total_students) || 0;
  const studentsWithBalance = Number(summary.students_with_balance) || 0;
  const totalOverpayment = Number(summary.total_overpayment) || 0;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Account Receivables</h1>
          <p className="text-muted-foreground">Monitor outstanding balances across programs</p>
        </div>
        <div className="flex items-center gap-3">
          {summaryLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
              Updating...
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Card data-watermark="FILTER">
        <CardContent className="pt-6">
          {isFinanceV1 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-[200px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    School Year
                  </label>
                  <Select value={selectedSy} onValueChange={setSelectedSy}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Select school year" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolYears.length === 0 && (
                        <SelectItem value="none" disabled>
                          No school years
                        </SelectItem>
                      )}
                      {schoolYears.map((sy) => (
                        <SelectItem key={sy.id} value={sy.id.toString()}>
                          {sy.sydesc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[260px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Date Range
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-9"
                    />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="w-[200px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Department
                  </label>
                  <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {programs.map((program) => (
                        <SelectItem key={program.id} value={program.id.toString()}>
                          {program.acadprogcode || program.progname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[200px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Grade Level
                  </label>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="All levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filteredLevels.map((level) => (
                        <SelectItem key={level.id} value={level.id.toString()}>
                          {level.levelname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="w-[200px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Semester
                  </label>
                  <Select value={selectedSem} onValueChange={setSelectedSem}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {isFinanceV1 && <SelectItem value="all">All</SelectItem>}
                      {semesters.length === 0 && (
                        <SelectItem value="none" disabled>
                          No semesters
                        </SelectItem>
                      )}
                      {semesters.map((sem) => (
                        <SelectItem key={sem.id} value={sem.id.toString()}>
                          {sem.semester}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[200px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Sections
                  </label>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="All sections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id.toString()}>
                          {section.sectionname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[200px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Grantee
                  </label>
                  <Select value={selectedGrantee} onValueChange={setSelectedGrantee}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="All grantees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {grantees.map((grantee) => (
                        <SelectItem key={grantee.id} value={grantee.id.toString()}>
                          {grantee.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[200px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    MOL
                  </label>
                  <Select value={selectedMode} onValueChange={setSelectedMode}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="All modes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {modes.map((mode) => (
                        <SelectItem key={mode.id} value={mode.id.toString()}>
                          {mode.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={detailsLoaded ? handleExport : handleLoadDetails}
                  className="h-9"
                  disabled={listLoading}
                >
                  {detailsLoaded ? (
                    <Download className="h-4 w-4 mr-2" />
                  ) : (
                    <RefreshCcw className={`h-4 w-4 mr-2 ${listLoading ? 'animate-spin' : ''}`} />
                  )}
                  {detailsLoaded ? 'Export' : 'Load Details'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-[200px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    School Year
                  </label>
                  <Select value={selectedSy} onValueChange={setSelectedSy}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Select school year" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolYears.length === 0 && (
                        <SelectItem value="none" disabled>
                          No school years
                        </SelectItem>
                      )}
                      {schoolYears.map((sy) => (
                        <SelectItem key={sy.id} value={sy.id.toString()}>
                          {sy.sydesc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[200px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Semester
                  </label>
                  <Select value={selectedSem} onValueChange={setSelectedSem}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {semesters.length === 0 && (
                        <SelectItem value="none" disabled>
                          No semesters
                        </SelectItem>
                      )}
                      {semesters.map((sem) => (
                        <SelectItem key={sem.id} value={sem.id.toString()}>
                          {sem.semester}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[220px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Academic Program
                  </label>
                  <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="All programs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All programs</SelectItem>
                      {programs.map((program) => (
                        <SelectItem key={program.id} value={program.id.toString()}>
                          {program.progname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[220px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Grade Level
                  </label>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="All levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All levels</SelectItem>
                      {filteredLevels.map((level) => (
                        <SelectItem key={level.id} value={level.id.toString()}>
                          {level.levelname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {summaryLoading && !summaryData ? (
        <div className="flex min-h-[140px] items-center justify-center rounded-md border bg-background">
          <div className="text-center">
            <RefreshCcw className="mx-auto mb-2 h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading receivables...</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SnapshotCard label="Total Receivables" value={formatCurrency(totalReceivable)} />
          <SnapshotCard label="Payments" value={formatCurrency(totalPayment)} tone="good" />
          <SnapshotCard label="Outstanding Balance" value={formatCurrency(outstandingBalance)} tone="danger" />
          <SnapshotCard label="Students" value={formatNumber(totalStudents)} />
          <SnapshotCard label="With Balance" value={formatNumber(studentsWithBalance)} tone="warn" />
        </div>
      )}

      {totalOverpayment > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-500/10 px-4 py-2 text-sm text-amber-800">
          Overpayments: <span className="font-semibold">{formatCurrency(totalOverpayment)}</span>
        </div>
      )}

      <Card data-watermark="TABLE">
        <CardContent className="pt-6">
          {!isFinanceV1 && !detailsLoaded ? (
            <div className="flex min-h-[180px] items-center justify-center">
              <div className="text-center">
                <div className="text-sm font-medium">Student details are not loaded</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  The totals above are loaded directly from student transactions.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadDetails}
                  disabled={listLoading}
                  className="mt-4"
                >
                  <RefreshCcw className={`h-4 w-4 mr-2 ${listLoading ? 'animate-spin' : ''}`} />
                  Load Details
                </Button>
              </div>
            </div>
          ) : (
            <ReceivablesTable
              data={receivables}
              loading={listLoading}
              isFinanceV1={isFinanceV1}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
