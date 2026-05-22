import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCcw, Download } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceTable } from './components/attendance-table';
import { WeeklyAttendanceTable } from './components/weekly-attendance-table';

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00`);
};

const getWeekStart = (date) => {
  const current = new Date(date);
  const day = current.getDay(); // 0=Sunday, 1=Monday
  const diff = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diff);
  current.setHours(0, 0, 0, 0);
  return current;
};

const formatWeekRangeLabel = (startDate, endDate) => {
  if (!startDate || !endDate) return '';
  const sameMonth =
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear();
  const startMonth = startDate.toLocaleDateString('en-US', { month: 'long' });
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'long' });
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  if (sameMonth) {
    return `${startMonth} ${startDay}-${endDay}, ${startDate.getFullYear()}`;
  }

  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startDate.getFullYear()}`;
  }

  return `${startMonth} ${startDay}, ${startDate.getFullYear()} - ${endMonth} ${endDay}, ${endDate.getFullYear()}`;
};

const buildWeekDays = (startDate) => {
  if (!startDate) return [];
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const key = formatDateInput(date);
    return {
      key,
      label: date.toLocaleDateString('en-US', { weekday: 'long' }),
      shortLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  });
};

const computeDailyHours = (logs) => {
  if (!logs || logs.length === 0) return 0;
  const events = logs
    .map((log) => {
      const timeValue = log.ttime ? `${log.tdate}T${log.ttime}` : log.createddatetime;
      if (!timeValue) return null;
      const timestamp = new Date(timeValue);
      if (Number.isNaN(timestamp.getTime())) return null;
      return {
        tapstate: (log.tapstate || '').toUpperCase(),
        timestamp,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

  let totalMs = 0;
  let openIn = null;

  for (const event of events) {
    if (event.tapstate === 'IN') {
      openIn = event.timestamp;
    } else if (event.tapstate === 'OUT' && openIn) {
      if (event.timestamp > openIn) {
        totalMs += event.timestamp - openIn;
      }
      openIn = null;
    }
  }

  return Number((totalMs / 36e5).toFixed(2));
};

const computeDailySummary = (logs) => {
  if (!logs || logs.length === 0) {
    return {
      hours: 0,
      firstIn: null,
      lastOut: null,
    };
  }

  const events = logs
    .map((log) => {
      const timeValue = log.ttime ? `${log.tdate}T${log.ttime}` : log.createddatetime;
      if (!timeValue) return null;
      const timestamp = new Date(timeValue);
      if (Number.isNaN(timestamp.getTime())) return null;
      return {
        tapstate: (log.tapstate || '').toUpperCase(),
        timestamp,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

  let firstIn = null;
  let lastOut = null;
  for (const event of events) {
    if (event.tapstate === 'IN' && !firstIn) {
      firstIn = event.timestamp;
    }
    if (event.tapstate === 'OUT') {
      lastOut = event.timestamp;
    }
  }

  return {
    hours: computeDailyHours(logs),
    firstIn,
    lastOut,
  };
};

export default function EmployeeAttendance() {
  const [activeTab, setActiveTab] = useState('stats');
  const [attendance, setAttendance] = useState([]);
  const [userTypes, setUserTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState('all');
  const [selectedTapState, setSelectedTapState] = useState('all');
  const [startDate, setStartDate] = useState(formatDateInput(new Date()));
  const [endDate, setEndDate] = useState(formatDateInput(new Date()));

  const [weeklyLogs, setWeeklyLogs] = useState([]);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyUserType, setWeeklyUserType] = useState('all');
  const [weekAnchor, setWeekAnchor] = useState(formatDateInput(getWeekStart(new Date())));

  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const weeklyAbortRef = useRef(null);

  const selectedSchool = JSON.parse(localStorage.getItem('selectedSchool') || 'null');
  const token = localStorage.getItem('token');

  const schoolDbConfig = selectedSchool
    ? {
        db_host: selectedSchool.db_host || 'localhost',
        db_port: selectedSchool.db_port || 3306,
        db_name: selectedSchool.db_name,
        db_username: selectedSchool.db_username || 'root',
        db_password: selectedSchool.db_password || '',
      }
    : null;

  useEffect(() => {
    if (!selectedSchool) {
      toast.error('No school selected');
      return;
    }
    fetchUserTypes();
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchAttendance();
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [startDate, endDate, selectedUserType, selectedTapState]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (weeklyAbortRef.current) {
        weeklyAbortRef.current.abort();
      }
    };
  }, []);

  const fetchUserTypes = async () => {
    try {
      if (!schoolDbConfig) {
        return;
      }
      const response = await fetch(apiUrl('/api/admin/user-types'), {
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
        const types = (result.data || []).filter((type) => type.id !== 7);
        setUserTypes(types);
      }
    } catch (error) {
      console.error('Error fetching user types:', error);
    }
  };

  const fetchAttendance = async () => {
    if (!schoolDbConfig) {
      toast.error('No school selected');
      return;
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      const response = await fetch(apiUrl('/api/admin/employee-attendance'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          schoolDbConfig,
          startDate,
          endDate,
          usertypeId: selectedUserType === 'all' ? null : selectedUserType,
          tapstate: selectedTapState === 'all' ? null : selectedTapState,
          includeStudents: false,
        }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setAttendance(result.data || []);
      } else {
        toast.error(result.message || 'Failed to fetch attendance data');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching attendance:', error);
        toast.error('An error occurred while fetching attendance data');
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  };

  const weekStartDate = useMemo(() => {
    const anchorDate = parseDateInput(weekAnchor) || new Date();
    return getWeekStart(anchorDate);
  }, [weekAnchor]);

  const weekEndDate = useMemo(() => {
    if (!weekStartDate) return null;
    const end = new Date(weekStartDate);
    end.setDate(weekStartDate.getDate() + 5);
    return end;
  }, [weekStartDate]);

  const weekDays = useMemo(() => buildWeekDays(weekStartDate), [weekStartDate]);

  const weekLabel = useMemo(
    () => formatWeekRangeLabel(weekStartDate, weekEndDate),
    [weekStartDate, weekEndDate]
  );

  const fetchWeeklyAttendance = async () => {
    if (!schoolDbConfig) {
      toast.error('No school selected');
      return;
    }
    if (!weekStartDate || !weekEndDate) return;

    if (weeklyAbortRef.current) {
      weeklyAbortRef.current.abort();
    }
    const controller = new AbortController();
    weeklyAbortRef.current = controller;

    try {
      setWeeklyLoading(true);
      const response = await fetch(apiUrl('/api/admin/employee-attendance'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          schoolDbConfig,
          startDate: formatDateInput(weekStartDate),
          endDate: formatDateInput(weekEndDate),
          usertypeId: weeklyUserType === 'all' ? null : weeklyUserType,
          includeStudents: false,
        }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setWeeklyLogs(result.data || []);
      } else {
        toast.error(result.message || 'Failed to fetch weekly attendance');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching weekly attendance:', error);
        toast.error('An error occurred while fetching weekly attendance');
      }
    } finally {
      if (weeklyAbortRef.current === controller) {
        setWeeklyLoading(false);
      }
    }
  };

  useEffect(() => {
    if (activeTab !== 'weekly') return;
    fetchWeeklyAttendance();
  }, [activeTab, weekAnchor, weeklyUserType]);

  const stats = useMemo(() => {
    const total = attendance.length;
    const inCount = attendance.filter((row) => row.tapstate === 'IN').length;
    const outCount = attendance.filter((row) => row.tapstate === 'OUT').length;
    const uniqueEmployees = new Set(
      attendance.map((row) => row.person_id ?? row.identifier ?? row.id)
    ).size;

    return {
      total,
      inCount,
      outCount,
      uniqueEmployees,
    };
  }, [attendance]);

  const weeklyRows = useMemo(() => {
    if (!weekDays.length) return [];
    const dayKeys = weekDays.map((day) => day.key);
    const daySet = new Set(dayKeys);
    const grouped = new Map();

    for (const log of weeklyLogs) {
      if (!log?.tdate || !daySet.has(log.tdate)) continue;
      const key =
        log.person_id ?? log.identifier ?? log.full_name ?? log.id ?? `${log.tdate}-${log.ttime}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          full_name: log.full_name || 'Unknown',
          identifier: log.identifier || log.person_id || '-',
          usertype_name: log.usertype_name || 'Unknown',
          dayLogs: new Map(),
        });
      }
      const entry = grouped.get(key);
      if (!entry.dayLogs.has(log.tdate)) {
        entry.dayLogs.set(log.tdate, []);
      }
      entry.dayLogs.get(log.tdate).push(log);
    }

    const rows = [];
    for (const entry of grouped.values()) {
      const dailyHours = {};
      const dailySummary = {};
      let totalHours = 0;
      for (const dayKey of dayKeys) {
        const summary = computeDailySummary(entry.dayLogs.get(dayKey));
        dailyHours[dayKey] = summary.hours;
        dailySummary[dayKey] = summary;
        totalHours += summary.hours;
      }
      rows.push({
        ...entry,
        dailyHours,
        dailySummary,
        totalHours: Number(totalHours.toFixed(2)),
      });
    }

    rows.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    return rows;
  }, [weeklyLogs, weekDays]);

  const handleWeekChange = (value) => {
    const parsed = parseDateInput(value);
    if (!parsed) return;
    const monday = getWeekStart(parsed);
    setWeekAnchor(formatDateInput(monday));
  };

  const handleWeekShift = (offset) => {
    const baseDate = parseDateInput(weekAnchor) || new Date();
    baseDate.setDate(baseDate.getDate() + offset * 7);
    setWeekAnchor(formatDateInput(getWeekStart(baseDate)));
  };

  const handleRefresh = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (activeTab === 'weekly') {
      fetchWeeklyAttendance();
    } else {
      fetchAttendance();
    }
  };

  const handleExport = () => {
    if (!attendance || attendance.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(attendance[0]).join(',');
    const rows = attendance.map((row) =>
      Object.values(row).map((val) => `"${val ?? ''}"`).join(',')
    );
    const csvContent = [headers, ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `employee_attendance_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Data exported successfully');
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Attendance</h1>
          <p className="text-muted-foreground">Track tap-in and tap-out records for staff</p>
        </div>
        <div className="flex items-center gap-3">
          {(loading || weeklyLoading) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
              Updating...
            </div>
          )}
          <TabsList className="h-9">
            <TabsTrigger value="stats" className="px-4 text-xs">
              Stats
            </TabsTrigger>
            <TabsTrigger value="weekly" className="px-4 text-xs">
              Columns
            </TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <TabsContent value="stats" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <Card data-watermark="TOTAL">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">Total Records</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{stats.total}</CardContent>
          </Card>
          <Card data-watermark="EMP">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">Unique Employees</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{stats.uniqueEmployees}</CardContent>
          </Card>
          <Card data-watermark="IN">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">Tap In</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-emerald-600">
              {stats.inCount}
            </CardContent>
          </Card>
          <Card data-watermark="OUT">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium">Tap Out</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-destructive">
              {stats.outCount}
            </CardContent>
          </Card>
        </div>

        <Card data-watermark="FILTER">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-[220px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    User Type
                  </label>
                  <Select value={selectedUserType} onValueChange={setSelectedUserType}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="All user types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All user types</SelectItem>
                      {userTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.utype}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-[180px]">
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Tap State
                  </label>
                  <Select value={selectedTapState} onValueChange={setSelectedTapState}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="All states" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All states</SelectItem>
                      <SelectItem value="IN">IN</SelectItem>
                      <SelectItem value="OUT">OUT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-watermark="TABLE">
          <CardContent className="pt-6">
            <AttendanceTable data={attendance} loading={loading} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="weekly" className="space-y-4">
        <Card data-watermark="WEEK">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Attendance for the Week {weekLabel}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Monday to Saturday summary with rendered hours
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-[220px]">
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                  User Type
                </label>
                <Select value={weeklyUserType} onValueChange={setWeeklyUserType}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="All user types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All user types</SelectItem>
                    {userTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.utype}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[220px]">
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                  Week of (Monday)
                </label>
                <Input
                  type="date"
                  value={weekAnchor}
                  onChange={(e) => handleWeekChange(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleWeekShift(-1)}>
                  Previous Week
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleWeekShift(1)}>
                  Next Week
                </Button>
              </div>
            </div>

            <WeeklyAttendanceTable rows={weeklyRows} days={weekDays} loading={weeklyLoading} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
