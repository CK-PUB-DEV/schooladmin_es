import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '../../../../../lib/api';
import { Card, CardContent } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../components/ui/tabs';
import { RefreshCcw, Download } from 'lucide-react';
import { YearlySummaryStats } from './components/yearly-summary-stats';
import { YearlySummaryTable } from './components/yearly-summary-table';

export default function YearlySummary() {
  const [summaryData, setSummaryData] = useState(null);
  const [tableData, setTableData] = useState({ months: [], items: [] });
  const [schoolYears, setSchoolYears] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  const [selectedSy, setSelectedSy] = useState('');
  const [selectedPaymentType, setSelectedPaymentType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const summaryAbortRef = useRef(null);
  const tableAbortRef = useRef(null);
  const debounceRef = useRef(null);

  const selectedSchool = JSON.parse(localStorage.getItem('selectedSchool') || 'null');
  const token = localStorage.getItem('token');

  const schoolDbConfig = selectedSchool
    ? {
        db_name: selectedSchool.db_name,
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
    fetchSchoolYears();
    fetchPaymentTypes();
  }, []);

  useEffect(() => {
    if (!selectedSy) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchYearlySummary();
      fetchYearlyTable();
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [selectedSy, selectedPaymentType, selectedStatus]);

  useEffect(() => {
    return () => {
      if (summaryAbortRef.current) {
        summaryAbortRef.current.abort();
      }
      if (tableAbortRef.current) {
        tableAbortRef.current.abort();
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

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

  const fetchYearlySummary = async () => {
    if (summaryAbortRef.current) {
      summaryAbortRef.current.abort();
    }
    const controller = new AbortController();
    summaryAbortRef.current = controller;

    try {
      setSummaryLoading(true);
      const response = await fetch(apiUrl(`${API_BASE}/yearly-summary/summary`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          schoolDbConfig,
          syid: selectedSy,
          paymentTypeId: selectedPaymentType === 'all' ? null : selectedPaymentType,
          status: selectedStatus === 'all' ? null : selectedStatus,
        }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setSummaryData(result.data);
      } else {
        toast.error(result.message || 'Failed to fetch yearly summary');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching yearly summary:', error);
        toast.error('An error occurred while fetching summary');
      }
    } finally {
      if (summaryAbortRef.current === controller) {
        setSummaryLoading(false);
      }
    }
  };

  const fetchYearlyTable = async () => {
    if (tableAbortRef.current) {
      tableAbortRef.current.abort();
    }
    const controller = new AbortController();
    tableAbortRef.current = controller;

    try {
      setTableLoading(true);
      const response = await fetch(apiUrl(`${API_BASE}/yearly-summary/table`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          schoolDbConfig,
          syid: selectedSy,
          paymentTypeId: selectedPaymentType === 'all' ? null : selectedPaymentType,
          status: selectedStatus === 'all' ? null : selectedStatus,
        }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setTableData(result.data || { months: [], items: [] });
      } else {
        toast.error(result.message || 'Failed to fetch yearly table');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching yearly table:', error);
        toast.error('An error occurred while fetching table');
      }
    } finally {
      if (tableAbortRef.current === controller) {
        setTableLoading(false);
      }
    }
  };

  const handleRefresh = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    fetchYearlySummary();
    fetchYearlyTable();
  };

  const handleExport = () => {
    if (!tableData.items || tableData.items.length === 0) {
      toast.error('No data to export');
      return;
    }

    const monthHeaders = (tableData.months || []).map((month) => month.label);
    const headers = ['Item', ...monthHeaders, 'Total'];
    const rows = tableData.items.map((row) => {
      const values = [
        row.item,
        ...(tableData.months || []).map((month) => row.monthly?.[month.key] ?? 0),
        row.total_amount ?? 0,
      ];
      return values.map((val) => `"${val}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `yearly_summary_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Data exported successfully');
  };

  const schoolYearLabel = summaryData?.schoolYear?.sydesc || '';

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Yearly Summary</h1>
          <p className="text-muted-foreground">
            Item collections overview for {schoolYearLabel || 'the selected school year'}
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
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[220px]">
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">
                School Year
              </label>
              <Select value={selectedSy} onValueChange={setSelectedSy}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Select school year" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((sy) => (
                    <SelectItem key={sy.id} value={sy.id.toString()}>
                      {sy.sydesc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <YearlySummaryStats data={summaryData} />
          )}
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <Card data-watermark="TABLE">
            <CardContent className="pt-6">
              <YearlySummaryTable
                months={tableData.months || []}
                items={tableData.items || []}
                loading={tableLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
