import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '../../../../../lib/api';
import { Card, CardContent } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../components/ui/tabs';
import { Input } from '../../../../../components/ui/input';
import { RefreshCcw, Download, Calendar as CalendarIcon } from 'lucide-react';
import { DailyCashStats } from './components/daily-cash-stats';
import { DailyCashTable } from './components/daily-cash-table';

const DATE_PRESETS = [
  { label: 'Today', value: 'today', offset: 0 },
  { label: 'Yesterday', value: 'yesterday', offset: 1 },
];

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DailyCashProgress() {
  const [summaryData, setSummaryData] = useState(null);
  const [items, setItems] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const [selectedDatePreset, setSelectedDatePreset] = useState('today');
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));
  const [selectedPaymentType, setSelectedPaymentType] = useState('all');

  const summaryAbortRef = useRef(null);
  const listAbortRef = useRef(null);
  const debounceRef = useRef(null);
  const dateInputRef = useRef(null);

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

  // Check if school uses finance_v1 to determine API routing
  const isFinanceV1 = selectedSchool?.finance_v1 == 1;
  const API_BASE = isFinanceV1 ? '/api/admin/finance-v1' : '/api/admin';

  useEffect(() => {
    if (!selectedSchool) {
      toast.error('No school selected');
      return;
    }
    fetchPaymentTypes();
  }, []);

  useEffect(() => {
    if (selectedDatePreset === 'custom') return;

    const preset = DATE_PRESETS.find((item) => item.value === selectedDatePreset);
    if (preset) {
      const date = new Date();
      date.setDate(date.getDate() - preset.offset);
      setSelectedDate(formatDateInput(date));
    }
  }, [selectedDatePreset]);

  useEffect(() => {
    if (!selectedDate) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchDailySummary();
      fetchDailyItems();
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [selectedDate, selectedPaymentType]);

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

  const fetchPaymentTypes = async () => {
    try {
      const response = await fetch(apiUrl('/api/admin/cashier/payment-types'), {
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
        setPaymentTypes(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching payment types:', error);
    }
  };

  const fetchDailySummary = async () => {
    if (summaryAbortRef.current) {
      summaryAbortRef.current.abort();
    }
    const controller = new AbortController();
    summaryAbortRef.current = controller;

    try {
      setSummaryLoading(true);
      const response = await fetch(apiUrl(`${API_BASE}/cash-progress/summary`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          schoolDbConfig,
          date: selectedDate,
          paymentTypeId: selectedPaymentType === 'all' ? null : selectedPaymentType,
        }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setSummaryData(result.data);
      } else {
        toast.error(result.message || 'Failed to fetch daily summary');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching daily summary:', error);
        toast.error('An error occurred while fetching summary');
      }
    } finally {
      if (summaryAbortRef.current === controller) {
        setSummaryLoading(false);
      }
    }
  };

  const fetchDailyItems = async () => {
    if (listAbortRef.current) {
      listAbortRef.current.abort();
    }
    const controller = new AbortController();
    listAbortRef.current = controller;

    try {
      setListLoading(true);
      const response = await fetch(apiUrl(`${API_BASE}/cash-progress/items`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          schoolDbConfig,
          date: selectedDate,
          paymentTypeId: selectedPaymentType === 'all' ? null : selectedPaymentType,
        }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setItems(result.data || []);
      } else {
        toast.error(result.message || 'Failed to fetch daily items');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching daily items:', error);
        toast.error('An error occurred while fetching items');
      }
    } finally {
      if (listAbortRef.current === controller) {
        setListLoading(false);
      }
    }
  };

  const handleRefresh = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    fetchDailySummary();
    fetchDailyItems();
  };

  const handleExport = () => {
    if (!items || items.length === 0) {
      toast.error('No data to export');
      return;
    }

    const columns = [
      { label: 'OR Number', key: 'ornum' },
      { label: 'Date & Time', key: 'transdate' },
      { label: 'Student Name', key: 'student_name' },
      { label: 'SID', key: 'sid' },
      { label: 'Classification', key: 'classification' },
      { label: 'Particulars', key: 'particulars' },
      { label: 'Amount', key: 'amount' },
      { label: 'Paid Amount', key: 'paid_amount' },
      { label: 'Overpayment', key: 'overpayment' },
      { label: 'Payment Type', key: 'payment_type' },
    ];

    const formatExportDate = (val) => {
      if (!val) return '';
      const d = new Date(val);
      if (isNaN(d)) return val;
      return d.toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
    };

    const headers = columns.map((col) => `"${col.label}"`).join(',');
    const rows = items.map((row) =>
      columns.map((col) => {
        const val = row[col.key] ?? '';
        if (col.key === 'ornum' || col.key === 'sid') return `="${val}"`;
        if (col.key === 'transdate') return `"${formatExportDate(val)}"`;
        return `"${val}"`;
      }).join(',')
    );
    const csvContent = [headers, ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `daily_cash_progress_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Data exported successfully');
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Cash Progress Report</h1>
          <p className="text-muted-foreground">Track collections and payments per item each day</p>
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
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-[240px]">
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                  Payment Type
                </label>
                <Select value={selectedPaymentType} onValueChange={setSelectedPaymentType}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="All payment types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All payment types</SelectItem>
                    {paymentTypes.map((pt) => (
                      <SelectItem key={pt.id} value={pt.id.toString()}>
                        {pt.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[220px]">
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                  Report Date
                </label>
                <Input
                  type="date"
                  ref={dateInputRef}
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDatePreset('custom');
                    setSelectedDate(e.target.value);
                  }}
                  className="h-9"
                />
              </div>

              <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Quick Date:</span>
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant={selectedDatePreset === preset.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDatePreset(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
              <Button
                variant={selectedDatePreset === 'custom' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectedDatePreset('custom');
                  const input = dateInputRef.current;
                  if (input?.showPicker) {
                    input.showPicker();
                  } else {
                    input?.focus();
                  }
                }}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Pick date
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Summary & Analysis</TabsTrigger>
          <TabsTrigger value="items">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {summaryLoading && !summaryData ? (
            <div className="flex items-center justify-center min-h-[240px]">
              <div className="text-center">
                <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Loading summary data...</p>
              </div>
            </div>
          ) : (
            <DailyCashStats data={summaryData} />
          )}
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <Card data-watermark="TABLE">
            <CardContent className="pt-6">
              <DailyCashTable data={items} loading={listLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
