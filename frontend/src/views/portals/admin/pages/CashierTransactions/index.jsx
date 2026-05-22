import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '../../../../../lib/api';
import { Card, CardContent } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../components/ui/tabs';
import { Input } from '../../../../../components/ui/input';
import { CashierStats } from './components/cashier-stats';
import { TransactionTable } from './components/transaction-table';
import { RefreshCcw, Download } from 'lucide-react';

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function CashierTransactions() {
  const [summaryData, setSummaryData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [selectedSy, setSelectedSy] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [startDate, setStartDate] = useState(formatDateInput(new Date()));
  const [endDate, setEndDate] = useState(formatDateInput(new Date()));
  const [selectedPaymentType, setSelectedPaymentType] = useState('all');
  const [selectedTerminal, setSelectedTerminal] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [listLoading, setListLoading] = useState(false);
  const summaryAbortRef = useRef(null);
  const listAbortRef = useRef(null);
  const debounceRef = useRef(null);

  const selectedSchool = JSON.parse(localStorage.getItem('selectedSchool') || 'null');
  const token = localStorage.getItem('token');

  const schoolDbConfig = selectedSchool ? {
    db_host: selectedSchool.db_host || 'localhost',
    db_port: selectedSchool.db_port || 3306,
    db_name: selectedSchool.db_name,
    db_username: selectedSchool.db_username || 'root',
    db_password: selectedSchool.db_password || '',
  } : null;

  // Check if school uses finance_v1 to determine API routing
  const isFinanceV1 = selectedSchool?.finance_v1 == 1;
  const API_BASE = isFinanceV1 ? '/api/admin/finance-v1' : '/api/admin';

  // Fetch data on component mount
  useEffect(() => {
    if (!selectedSchool) {
      toast.error('No school selected');
      return;
    }
    fetchSchoolYears();
    fetchSemesters();
    fetchPaymentTypes();
    fetchTerminals();
  }, []);

  // Fetch summary and transactions when filters change
  useEffect(() => {
    if (selectedSy && selectedSem && startDate && endDate) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        fetchCashierSummary();
        fetchTransactions();
      }, 350);
    }
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [selectedSy, selectedSem, startDate, endDate, selectedPaymentType, selectedTerminal, selectedStatus]);

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
        const active = result.data.find(sy => sy.isactive === 1);
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
        const active = result.data.find(sem => sem.isactive === 1);
        if (active) {
          setSelectedSem(active.id.toString());
        } else if (result.data.length > 0) {
          setSelectedSem(result.data[0].id.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching semesters:', error);
    }
  };

  const fetchPaymentTypes = async () => {
    try {
      const response = await fetch(apiUrl(`${API_BASE}/cashier/payment-types`), {
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
        setPaymentTypes(result.data);
      }
    } catch (error) {
      console.error('Error fetching payment types:', error);
    }
  };

  const fetchTerminals = async () => {
    try {
      const response = await fetch(apiUrl(`${API_BASE}/cashier/terminals`), {
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
        setTerminals(result.data);
      }
    } catch (error) {
      console.error('Error fetching terminals:', error);
    }
  };

  const fetchCashierSummary = async () => {
    if (summaryAbortRef.current) {
      summaryAbortRef.current.abort();
    }
    const controller = new AbortController();
    summaryAbortRef.current = controller;
    try {
      setSummaryLoading(true);
      const response = await fetch(apiUrl(`${API_BASE}/cashier/summary`), {
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
          semid: selectedSem,
          startDate,
          endDate,
          paymentTypeId: selectedPaymentType === 'all' ? null : selectedPaymentType,
          terminalId: selectedTerminal === 'all' ? null : selectedTerminal,
          status: selectedStatus === 'all' ? null : selectedStatus,
        }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setSummaryData(result.data);
      } else {
        toast.error(result.message || 'Failed to fetch cashier summary');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error:', error);
        toast.error('An error occurred while fetching cashier summary');
      }
    } finally {
      if (summaryAbortRef.current === controller) {
        setSummaryLoading(false);
      }
    }
  };

  const fetchTransactions = async () => {
    if (listAbortRef.current) {
      listAbortRef.current.abort();
    }
    const controller = new AbortController();
    listAbortRef.current = controller;
    try {
      setListLoading(true);
      const response = await fetch(apiUrl(`${API_BASE}/cashier/transactions`), {
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
          semid: selectedSem,
          startDate,
          endDate,
          paymentTypeId: selectedPaymentType === 'all' ? null : selectedPaymentType,
          terminalId: selectedTerminal === 'all' ? null : selectedTerminal,
          status: selectedStatus === 'all' ? null : selectedStatus,
        }),
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        setTransactions(result.data);
      } else {
        toast.error(result.message || 'Failed to fetch transactions');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error:', error);
        toast.error('An error occurred while fetching transactions');
      }
    } finally {
      if (listAbortRef.current === controller) {
        setListLoading(false);
      }
    }
  };

  const handleExport = () => {
    if (!transactions || transactions.length === 0) {
      toast.error('No data to export');
      return;
    }

    const csvContent = convertToCSV(transactions);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `cashier_transactions_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Data exported successfully');
  };

  const convertToCSV = (data) => {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row) => Object.values(row).map((val) => `"${val || ''}"`).join(','));
    return [headers, ...rows].join('\n');
  };

  const handleRefresh = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    fetchCashierSummary();
    fetchTransactions();
  };

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cashier Transactions</h1>
          <p className="text-muted-foreground">
            Track and analyze cashier collections and transactions
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

      {/* Filters */}
      <Card data-watermark="FILTER">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-[220px]">
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Payment Type</label>
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

              <div className="w-[260px]">
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Terminal</label>
                <Select value={selectedTerminal} onValueChange={setSelectedTerminal}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="All terminals" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All terminals</SelectItem>
                    {terminals.map((term) => (
                      <SelectItem key={term.id} value={term.id.toString()}>
                        {term.description} ({term.owner})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-[180px]">
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
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
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block text-muted-foreground">End Date</label>
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

      {/* Main Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Summary & Analysis</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          {summaryLoading && !summaryData ? (
            <div className="flex items-center justify-center min-h-[240px]">
              <div className="text-center">
                <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Loading summary data...</p>
              </div>
            </div>
          ) : (
            <CashierStats data={summaryData} />
          )}
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card data-watermark="TABLE">
            <CardContent className="pt-6">
              <TransactionTable data={transactions} loading={listLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
