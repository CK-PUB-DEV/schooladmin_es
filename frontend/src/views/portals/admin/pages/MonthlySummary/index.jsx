import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '../../../../../lib/api';
import { Card, CardContent } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../components/ui/tabs';
import { Input } from '../../../../../components/ui/input';
import { RefreshCcw, Download } from 'lucide-react';
import { MonthlySummaryStats } from './components/monthly-summary-stats';
import { MonthlySummaryTable } from './components/monthly-summary-table';

const formatMonthInput = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function MonthlySummary() {
  const [summaryData, setSummaryData] = useState(null);
  const [items, setItems] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(formatMonthInput(new Date()));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPaymentType, setSelectedPaymentType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const summaryAbortRef = useRef(null);
  const listAbortRef = useRef(null);
  const debounceRef = useRef(null);

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
    if (!selectedMonth) return;
    const [year, month] = selectedMonth.split('-').map(Number);
    if (!year || !month) return;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    setStartDate(formatDateInput(start));
    setEndDate(formatDateInput(end));
  }, [selectedMonth]);

  useEffect(() => {
    if (!startDate || !endDate) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchMonthlySummary();
      fetchMonthlyItems();
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [startDate, endDate, selectedPaymentType, selectedStatus]);

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

  const fetchMonthlySummary = async () => {
    if (summaryAbortRef.current) {
      summaryAbortRef.current.abort();
    }
    const controller = new AbortController();
    summaryAbortRef.current = controller;

    try {
      setSummaryLoading(true);
      const response = await fetch(apiUrl(`${API_BASE}/monthly-summary/summary`), {
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
          paymentTypeId: selectedPaymentType === 'all' ? null : selectedPaymentType,
          status: selectedStatus === 'all' ? null : selectedStatus,
        }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setSummaryData(result.data);
      } else {
        toast.error(result.message || 'Failed to fetch monthly summary');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching monthly summary:', error);
        toast.error('An error occurred while fetching summary');
      }
    } finally {
      if (summaryAbortRef.current === controller) {
        setSummaryLoading(false);
      }
    }
  };

  const fetchMonthlyItems = async () => {
    if (listAbortRef.current) {
      listAbortRef.current.abort();
    }
    const controller = new AbortController();
    listAbortRef.current = controller;

    try {
      setListLoading(true);
      const response = await fetch(apiUrl(`${API_BASE}/monthly-summary/items`), {
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
          paymentTypeId: selectedPaymentType === 'all' ? null : selectedPaymentType,
          status: selectedStatus === 'all' ? null : selectedStatus,
        }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setItems(result.data || []);
      } else {
        toast.error(result.message || 'Failed to fetch monthly items');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching monthly items:', error);
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
    fetchMonthlySummary();
    fetchMonthlyItems();
  };

  const handleExport = () => {
    if (!items || items.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(items[0]).join(',');
    const rows = items.map((row) =>
      Object.values(row).map((val) => `"${val ?? ''}"`).join(',')
    );
    const csvContent = [headers, ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `monthly_summary_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Data exported successfully');
  };

  const monthLabel = selectedMonth
    ? new Date(`${selectedMonth}-01`).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monthly Summary</h1>
          <p className="text-muted-foreground">
            Track total collections per item for {monthLabel || 'the selected month'}
          </p>
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
              <div className="w-[220px]">
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                  Report Month
                </label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="w-[220px]">
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
              <div className="w-[180px]">
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                  Status
                </label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Summary & Analysis</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
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
            <MonthlySummaryStats data={summaryData} monthLabel={monthLabel} />
          )}
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <Card data-watermark="TABLE">
            <CardContent className="pt-6">
              <MonthlySummaryTable data={items} loading={listLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
