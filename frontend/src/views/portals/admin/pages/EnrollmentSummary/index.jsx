import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '../../../../../lib/api';
import { Card, CardContent } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../../components/ui/tabs';
import { Badge } from '../../../../../components/ui/badge';
import { EnrollmentStats } from './components/enrollment-stats';
import { EnrollmentTable } from './components/enrollment-table';
import { RefreshCcw, Users, GraduationCap, BookOpen } from 'lucide-react';

export default function EnrollmentSummary() {
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [enrollmentList, setEnrollmentList] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [selectedSy, setSelectedSy] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [activeTab, setActiveTab] = useState('gradeschool');
  const [listLoading, setListLoading] = useState(false);

  const selectedSchool = JSON.parse(localStorage.getItem('selectedSchool') || 'null');
  const token = localStorage.getItem('token');

  const schoolDbConfig = selectedSchool ? {
    db_host: selectedSchool.db_host || 'localhost',
    db_port: selectedSchool.db_port || 3306,
    db_name: selectedSchool.db_name,
    db_username: selectedSchool.db_username || 'root',
    db_password: selectedSchool.db_password || '',
  } : null;

  // Fetch enrollment summary on component mount
  useEffect(() => {
    if (!selectedSchool) {
      toast.error('No school selected');
      return;
    }
    fetchEnrollmentSummary();
    fetchSchoolYears();
    fetchSemesters();
  }, []);

  // Fetch summary and enrollment list when filters change
  useEffect(() => {
    if (selectedSy && (activeTab === 'gradeschool' || selectedSem)) {
      fetchEnrollmentSummary({ syncDefaults: false });
    }
  }, [selectedSy, selectedSem]);

  useEffect(() => {
    if (selectedSy && (activeTab === 'gradeschool' || selectedSem)) {
      fetchEnrollmentList();
    }
  }, [activeTab, selectedSy, selectedSem]);

  const fetchEnrollmentSummary = async ({ syncDefaults = true } = {}) => {
    try {
      setSummaryLoading(true);
      const payload = {
        schoolDbConfig,
      };

      if (selectedSy) {
        payload.syid = selectedSy;
      }
      if (selectedSem) {
        payload.semid = selectedSem;
      }

      const response = await fetch(apiUrl('/api/admin/enrollment/summary'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        setSummaryData(result.data);
        if (syncDefaults && result.data.activeSchoolYear) {
          setSelectedSy(result.data.activeSchoolYear.id.toString());
        }
        if (syncDefaults && result.data.activeSemester) {
          setSelectedSem(result.data.activeSemester.id.toString());
        }
      } else {
        toast.error(result.message || 'Failed to fetch enrollment summary');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred while fetching enrollment summary');
    } finally {
      setSummaryLoading(false);
    }
  };

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
        setSchoolYears(result.data);
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
        setSemesters(result.data);
      }
    } catch (error) {
      console.error('Error fetching semesters:', error);
    }
  };

  const fetchEnrollmentList = async () => {
    try {
      setListLoading(true);
      const response = await fetch(apiUrl('/api/admin/enrollment/list'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          schoolDbConfig,
          level: activeTab,
          syid: selectedSy,
          semid: selectedSem,
        }),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        setEnrollmentList(result.data);
      } else {
        toast.error(result.message || 'Failed to fetch enrollment list');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred while fetching enrollment list');
    } finally {
      setListLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enrollment Summary</h1>
          <p className="text-muted-foreground">
            Overview of student enrollments across all levels
          </p>
        </div>
        <div className="flex items-center gap-3">
          {summaryLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
              Updating...
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEnrollmentSummary({ syncDefaults: false })}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Filters */}
      <div className="flex items-center gap-2">
        <Select value={selectedSy} onValueChange={setSelectedSy}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Select school year" />
          </SelectTrigger>
          <SelectContent>
            {schoolYears.map((sy) => (
              <SelectItem key={sy.id} value={sy.id.toString()}>
                {sy.sydesc}
                {sy.isactive === 1 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Active
                  </Badge>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedSem} onValueChange={setSelectedSem}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select semester" />
          </SelectTrigger>
          <SelectContent>
            {semesters.map((sem) => (
              <SelectItem key={sem.id} value={sem.id.toString()}>
                {sem.semester}
                {sem.isactive === 1 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Active
                  </Badge>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="list">Enrollment List</TabsTrigger>
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
            <EnrollmentStats summary={summaryData?.summary} breakdown={summaryData?.breakdown} />
          )}
        </TabsContent>

        {/* List Tab */}
        <TabsContent value="list" className="space-y-4">
          {/* Level Tabs */}
          <Card data-watermark="LIST">
            <CardContent className="pt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="gradeschool">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Grade School
                  </TabsTrigger>
                  <TabsTrigger value="shs">
                    <Users className="h-4 w-4 mr-2" />
                    Senior High School
                  </TabsTrigger>
                  <TabsTrigger value="college">
                    <GraduationCap className="h-4 w-4 mr-2" />
                    College
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="gradeschool" className="mt-0">
                  <EnrollmentTable data={enrollmentList} loading={listLoading} level="gradeschool" />
                </TabsContent>

                <TabsContent value="shs" className="mt-0">
                  <EnrollmentTable data={enrollmentList} loading={listLoading} level="shs" />
                </TabsContent>

                <TabsContent value="college" className="mt-0">
                  <EnrollmentTable data={enrollmentList} loading={listLoading} level="college" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
