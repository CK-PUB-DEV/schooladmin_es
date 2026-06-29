import { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  DollarSign,
  FileText,
  GraduationCap,
  LineChart,
  Megaphone,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Users,
  UsersRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { apiUrl } from '@/lib/api'

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(
    toNumber(value)
  )

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(toNumber(value))

const formatPercent = (value) =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(toNumber(value))}%`

const formatSignedPercent = (value) => {
  const safe = toNumber(value)
  const sign = safe > 0 ? '+' : ''
  return `${sign}${formatPercent(safe)}`
}

function TrendBadge({ value, label }) {
  if (value === null || value === undefined) return null

  const safe = toNumber(value)
  const positive = safe >= 0

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${
        positive
          ? 'bg-teal-500/10 text-teal-600 dark:text-teal-300'
          : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
      }`}
    >
      {formatSignedPercent(safe)}
      {positive ? <ArrowUpRight className='h-3 w-3' /> : <TrendingDown className='h-3 w-3' />}
      {label ? <span className='text-muted-foreground'>{label}</span> : null}
    </span>
  )
}
function BarChart({ data, height = 200 }) {
  if (!data || data.length === 0) {
    return (
      <div
        className='flex h-full items-center justify-center text-muted-foreground text-sm'
        style={{ height: `${height}px` }}
      >
        No data available
      </div>
    )
  }

  const maxValue = Math.max(...data.map((d) => toNumber(d.value)), 1)

  return (
    <div className='flex h-full items-end justify-between gap-2' style={{ height: `${height}px` }}>
      {data.map((item, index) => {
        const barHeight = (toNumber(item.value) / maxValue) * 100
        return (
          <div key={index} className='flex flex-1 flex-col items-center gap-2'>
            <div className='flex w-full flex-1 items-end'>
              <div
                className='w-full rounded-t-md bg-primary transition-all hover:opacity-80'
                style={{ height: `${barHeight}%` }}
                title={`${item.label}: ${item.value}`}
              />
            </div>
            <div className='text-xs font-medium text-muted-foreground truncate w-full text-center'>
              {item.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SalesVolumeChart({ data = [], labels = [] }) {
  const visible = data.slice(-7).map(toNumber)
  const visibleLabels = labels.slice(-7)
  const offset = Math.max(data.length - visible.length, 0)
  const previous = visible.map((_, index) => toNumber(data[offset + index - 1]))
  const maxValue = Math.max(...visible, ...previous, 1)
  const latestIndex = visible.length - 1
  const latestValue = visible[latestIndex] || 0
  const latestPrevious = previous[latestIndex] || 0
  const latestChange = latestPrevious > 0 ? ((latestValue - latestPrevious) / latestPrevious) * 100 : null

  if (visible.length === 0) {
    return (
      <div className='flex h-64 items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground'>
        No collection history yet.
      </div>
    )
  }

  return (
    <div className='rounded-lg border bg-background p-4'>
      <div className='mb-4 flex flex-wrap items-start justify-between gap-3'>
        <div className='space-y-2'>
          <div className='text-sm font-semibold'>Sales Volume</div>
          <div className='flex flex-wrap items-center gap-4 text-xs text-muted-foreground'>
            <span className='inline-flex items-center gap-1.5'>
              <span className='h-2.5 w-2.5 rounded-sm bg-sky-400' />
              Previous
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <span className='h-2.5 w-2.5 rounded-sm bg-blue-600' />
              Collections
            </span>
          </div>
        </div>
        <div className='flex gap-2 text-[10px] text-muted-foreground'>
          <span className='font-medium text-foreground'>Monthly</span>
          <span>Quarterly</span>
          <span>Yearly</span>
        </div>
      </div>

      <div className='relative h-56'>
        <div className='absolute inset-x-0 bottom-8 top-1 grid grid-rows-4'>
          {[0, 1, 2, 3].map((line) => (
            <div key={line} className='border-t border-border/60' />
          ))}
        </div>
        {latestChange !== null ? (
          <div className='absolute left-[50%] top-7 z-10 -translate-x-1/2 rounded-sm bg-slate-900 px-2 py-1 text-center text-[10px] font-medium text-white shadow-sm dark:bg-white dark:text-slate-900'>
            <div>{formatSignedPercent(latestChange)}</div>
            <div className='font-normal opacity-75'>Collections</div>
          </div>
        ) : null}
        <div
          className='relative grid h-full items-end gap-2 pb-8'
          style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
        >
          {visible.map((amount, index) => {
            const previousAmount = previous[index]
            const currentHeight = Math.max((amount / maxValue) * 150, amount > 0 ? 14 : 0)
            const previousHeight = Math.max((previousAmount / maxValue) * 150, previousAmount > 0 ? 14 : 0)
            const label = visibleLabels[index] || `M${index + 1}`
            const isLatest = index === latestIndex

            return (
              <div key={`${label}-${index}`} className='flex min-w-0 flex-col items-center justify-end gap-2'>
                <div className='flex h-[158px] w-full max-w-[58px] items-end justify-center gap-1.5'>
                  <div
                    className='w-full rounded-t-sm bg-sky-400 transition-opacity hover:opacity-80'
                    style={{ height: `${previousHeight}px` }}
                    title={`${label} previous: ${formatCurrency(previousAmount)}`}
                  />
                  <div
                    className='relative w-full rounded-t-sm bg-blue-600 transition-opacity hover:opacity-80'
                    style={{ height: `${currentHeight}px` }}
                    title={`${label} collections: ${formatCurrency(amount)}`}
                  >
                    {isLatest ? (
                      <span className='absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-foreground'>
                        {formatCurrency(amount)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className='w-full truncate text-center text-xs text-muted-foreground'>{label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DonutChart({ data, size = 120 }) {
  if (!data || data.length === 0 || data.every((d) => toNumber(d.value) === 0)) {
    return (
      <div className='flex items-center justify-center text-muted-foreground text-sm' style={{ width: size, height: size }}>
        No data
      </div>
    )
  }

  const total = data.reduce((sum, item) => sum + toNumber(item.value), 0)
  const radius = size / 2 - 10
  const circumference = 2 * Math.PI * radius
  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ]
  const slices = data.reduce(
    (items, item) => {
      const percentage = (toNumber(item.value) / total) * 100
      const rotation = items.angle

      items.angle += (percentage / 100) * 360
      items.values.push({
        item,
        percentage,
        rotation,
        dashOffset: circumference - (percentage / 100) * circumference,
      })

      return items
    },
    { angle: -90, values: [] }
  ).values

  return (
    <div className='flex items-center gap-4'>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill='none'
          stroke='hsl(var(--muted))'
          strokeWidth='16'
        />
        {slices.map((slice, index) => (
          <circle
            key={`${slice.item.label}-${index}`}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill='none'
            stroke={colors[index % colors.length]}
            strokeWidth='16'
            strokeDasharray={circumference}
            strokeDashoffset={slice.dashOffset}
            transform={`rotate(${slice.rotation} ${size / 2} ${size / 2})`}
            className='transition-all'
          />
        ))}
      </svg>
      <div className='flex-1 space-y-2'>
        {data.map((item, index) => {
          const percentage = ((toNumber(item.value) / total) * 100).toFixed(1)
          return (
            <div key={index} className='flex items-center gap-2 text-sm'>
              <div
                className='h-3 w-3 rounded-sm'
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className='flex-1 text-muted-foreground'>{item.label}</span>
              <span className='font-medium'>{percentage}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
function ProgressRing({ value, max, label, size = 100 }) {
  const safeValue = toNumber(value)
  const safeMax = toNumber(max)
  const percentage = safeMax > 0 ? (safeValue / safeMax) * 100 : 0
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference

  return (
    <div className='flex flex-col items-center gap-2'>
      <div className='relative'>
        <svg width={size} height={size} className='-rotate-90'>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill='none'
            stroke='hsl(var(--muted))'
            strokeWidth='8'
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill='none'
            stroke='hsl(var(--primary))'
            strokeWidth='8'
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap='round'
            className='transition-all duration-500'
          />
        </svg>
        <div className='absolute inset-0 flex items-center justify-center'>
          <div className='text-center'>
            <div className='text-lg font-bold'>{Math.min(percentage, 100).toFixed(0)}%</div>
          </div>
        </div>
      </div>
      <div className='text-center text-sm font-medium text-muted-foreground'>{label}</div>
    </div>
  )
}

function ReportLink({ icon, title, description, href }) {
  return (
    <Link
      to={href}
      className='group flex items-center justify-between gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/30'
    >
      <div className='flex min-w-0 items-center gap-3'>
        <div className='flex h-9 w-9 items-center justify-center rounded-md bg-muted/40 text-primary'>
          {createElement(icon, { className: 'h-4 w-4' })}
        </div>
        <div className='min-w-0'>
          <div className='text-sm font-medium truncate'>{title}</div>
          <div className='text-xs text-muted-foreground truncate'>{description}</div>
        </div>
      </div>
      <ArrowUpRight className='h-4 w-4 text-muted-foreground group-hover:text-foreground' />
    </Link>
  )
}

function StatCard({ title, value, helper, trendValue, href, format, watermark, icon: Icon, loading }) {
  const formattedValue = (() => {
    if (loading) return '...'
    if (format === 'currency') return formatCurrency(value)
    if (format === 'percent') return formatPercent(value)
    return formatNumber(value)
  })()

  return (
    <Card className='gap-0 rounded-lg py-0 transition-colors hover:bg-muted/20' data-watermark={watermark}>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 px-4 pb-0 pt-4'>
        <div className='flex items-center gap-2'>
          {Icon ? (
            <span className='flex h-6 w-6 items-center justify-center rounded-md bg-muted/50 text-muted-foreground'>
              <Icon className='h-3.5 w-3.5' />
            </span>
          ) : null}
          <CardTitle className='text-sm font-medium text-muted-foreground'>{title}</CardTitle>
        </div>
        <AlertCircle className='h-3.5 w-3.5 text-muted-foreground/70' />
      </CardHeader>
      <CardContent className='px-4 pb-4 pt-3'>
        <div className='flex min-h-[54px] flex-col justify-between gap-2'>
          <div className='min-w-0'>
            <div className='whitespace-normal break-words text-[clamp(1.35rem,1.9vw,1.875rem)] font-semibold leading-tight tracking-normal'>
              {formattedValue}
            </div>
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              <TrendBadge value={trendValue} />
              <p className='text-xs text-muted-foreground'>{helper}</p>
            </div>
          </div>
        </div>
        {href ? (
          <Button asChild variant='ghost' size='sm' className='px-0 justify-start'>
            <Link to={href}>View details</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function LoadingState() {
  return (
    <div className='flex items-center justify-center min-h-[400px]'>
      <div className='text-center'>
        <RefreshCcw className='h-8 w-8 animate-spin mx-auto mb-2 text-primary' />
        <p className='text-sm text-muted-foreground'>Loading dashboard data...</p>
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className='flex items-center justify-center min-h-[400px]'>
      <div className='text-center'>
        <AlertCircle className='h-8 w-8 mx-auto mb-2 text-destructive' />
        <p className='text-sm text-muted-foreground mb-4'>{message}</p>
        <Button variant='outline' size='sm' onClick={onRetry}>
          <RefreshCcw className='h-4 w-4 mr-2' />
          Retry
        </Button>
      </div>
    </div>
  )
}
export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const selectedSchool = useMemo(
    () => JSON.parse(localStorage.getItem('selectedSchool') || 'null'),
    []
  )
  const token = localStorage.getItem('token')

  const schoolDbConfig = useMemo(
    () =>
      selectedSchool
        ? {
            db_host: selectedSchool.db_host || 'localhost',
            db_port: selectedSchool.db_port || 3306,
            db_name: selectedSchool.db_name,
            db_username: selectedSchool.db_username || 'root',
            db_password: selectedSchool.db_password || '',
            finance_v1: selectedSchool.finance_v1,
          }
        : null,
    [selectedSchool]
  )

  const fetchDashboardData = useCallback(async () => {
    if (!selectedSchool) {
      setError('No school selected')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(apiUrl('/api/admin/dashboard'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ schoolDbConfig }),
      })

      const result = await response.json()

      if (response.ok && result.status === 'success') {
        setDashboardData(result.data)
        setLastUpdated(new Date())
      } else {
        setError(result.message || 'Failed to fetch dashboard data')
        toast.error(result.message || 'Failed to fetch dashboard data')
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('An error occurred while fetching dashboard data')
      toast.error('An error occurred while fetching dashboard data')
    } finally {
      setLoading(false)
    }
  }, [schoolDbConfig, selectedSchool, token])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  if (loading && !dashboardData) {
    return (
      <div className='space-y-6 p-4 md:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='space-y-1'>
            <h2 className='text-3xl font-bold tracking-tight'>School Dashboard</h2>
            <p className='text-sm text-muted-foreground'>
              {selectedSchool?.school_name || 'Your school'} - Comprehensive analytics and insights
            </p>
          </div>
        </div>
        <LoadingState />
      </div>
    )
  }

  if (error && !dashboardData) {
    return (
      <div className='space-y-6 p-4 md:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='space-y-1'>
            <h2 className='text-3xl font-bold tracking-tight'>School Dashboard</h2>
            <p className='text-sm text-muted-foreground'>
              {selectedSchool?.school_name || 'Your school'} - Comprehensive analytics and insights
            </p>
          </div>
        </div>
        <ErrorState message={error} onRetry={fetchDashboardData} />
      </div>
    )
  }

  const data = dashboardData || {
    kpis: {},
    finance: { monthLabels: [], collectionsData: [] },
    charts: { studentGender: [], gradeLevels: [], departments: [] },
    lists: { events: [], memos: [] },
  }
  const collectionsSeries = (data.finance.collectionsData || []).map(toNumber)
  const monthLabels = data.finance.monthLabels || []
  const avgMonthly =
    collectionsSeries.length > 0
      ? collectionsSeries.reduce((sum, value) => sum + value, 0) / collectionsSeries.length
      : 0
  const lastMonthIndex = collectionsSeries.length - 1
  const lastMonthCollections = collectionsSeries[lastMonthIndex] || 0
  const prevMonthCollections = collectionsSeries[lastMonthIndex - 1] || 0
  const momChange =
    prevMonthCollections > 0 ? ((lastMonthCollections - prevMonthCollections) / prevMonthCollections) * 100 : null
  const mtdVsAvg = avgMonthly > 0 ? ((toNumber(data.kpis.collectionsMTD) - avgMonthly) / avgMonthly) * 100 : null
  const bestMonthValue = collectionsSeries.length ? Math.max(...collectionsSeries) : 0
  const bestMonthIndex = collectionsSeries.length ? collectionsSeries.indexOf(bestMonthValue) : -1
  const bestMonthLabel = bestMonthIndex >= 0 ? monthLabels[bestMonthIndex] : null

  const enrolledStudents = toNumber(data.kpis.enrolledStudents)
  const pendingEnrollments = toNumber(data.kpis.pendingEnrollments)
  const employees = toNumber(data.kpis.employees)
  const collectionsToday = toNumber(data.kpis.collectionsToday)
  const collectionsMTD = toNumber(data.kpis.collectionsMTD)
  const receivables = toNumber(data.kpis.receivables)
  const upcomingEvents = toNumber(data.kpis.upcomingEvents)
  const memosThisWeek = toNumber(data.kpis.memosThisWeek)

  const enrollmentTotal = enrolledStudents + pendingEnrollments
  const enrollmentRate = enrollmentTotal > 0 ? (enrolledStudents / enrollmentTotal) * 100 : 0
  const pendingRate = enrollmentTotal > 0 ? (pendingEnrollments / enrollmentTotal) * 100 : 0
  const collectionCoverage = receivables > 0 ? (collectionsMTD / receivables) * 100 : 0
  const collectionCoverageClamped = Math.min(collectionCoverage, 100)
  const todayVsMtd = collectionsMTD > 0 ? (collectionsToday / collectionsMTD) * 100 : null

  const departments = data.charts.departments || []
  const departmentsTotal = departments.reduce((sum, dept) => sum + toNumber(dept.value), 0)
  const topDepartment = departments[0]
  const topDepartmentShare =
    departmentsTotal > 0 && topDepartment ? (toNumber(topDepartment.value) / departmentsTotal) * 100 : 0

  const activeSyLabel = data.activeSchoolYear?.sydesc || data.activeSchoolYear?.syname || ''
  const activeSemLabel = data.activeSemester?.semester || ''
  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Not synced'

  const primaryKpis = [
    {
      key: 'collections-today',
      title: 'Collections Today',
      watermark: 'FIN',
      value: collectionsToday,
      helper: 'Cashier totals',
      icon: DollarSign,
      trendValue: todayVsMtd,
      format: 'currency',
    },
    {
      key: 'collections-mtd',
      title: 'Collections MTD',
      watermark: 'FIN',
      value: collectionsMTD,
      helper: 'Month-to-date total',
      icon: LineChart,
      trendValue: mtdVsAvg,
      format: 'currency',
    },
    {
      key: 'receivables',
      title: 'Receivables',
      watermark: 'AR',
      value: receivables,
      helper: 'Outstanding balance',
      icon: FileText,
      trendValue: collectionCoverage,
      format: 'currency',
    },
    {
      key: 'enrolled',
      title: 'Enrolled Students',
      watermark: 'ENR',
      value: enrolledStudents,
      helper: 'Active enrollments',
      icon: GraduationCap,
      trendValue: enrollmentRate,
    },
    {
      key: 'pending',
      title: 'Pending Enrollments',
      watermark: 'REG',
      value: pendingEnrollments,
      helper: 'Awaiting confirmation',
      icon: Users,
      trendValue: pendingRate,
    },
    {
      key: 'employees',
      title: 'Active Employees',
      watermark: 'HR',
      value: employees,
      helper: 'On record',
      icon: UsersRound,
    },
    {
      key: 'events',
      title: 'Upcoming Events',
      watermark: 'EVENT',
      value: upcomingEvents,
      helper: 'Next 30 days',
      icon: CalendarDays,
    },
    {
      key: 'memos',
      title: 'Memos This Week',
      watermark: 'MEMO',
      value: memosThisWeek,
      helper: 'Latest communications',
      icon: Megaphone,
    },
  ]

  const financeReports = [
    {
      key: 'cashier',
      title: 'Cashier Transactions',
      description: 'Daily transaction log',
      href: '/admin/finance/cashier-transactions',
      icon: DollarSign,
    },
    {
      key: 'daily',
      title: 'Daily Cash Progress',
      description: 'End-of-day totals',
      href: '/admin/finance/daily-cash-progress',
      icon: CalendarDays,
    },
    {
      key: 'monthly',
      title: 'Monthly Summary',
      description: 'Month-to-month trends',
      href: '/admin/finance/monthly-summary',
      icon: BarChart3,
    },
    {
      key: 'yearly',
      title: 'Yearly Summary',
      description: 'Year-over-year totals',
      href: '/admin/finance/yearly-summary',
      icon: LineChart,
    },
    {
      key: 'receivables',
      title: 'Account Receivables',
      description: 'Outstanding balances',
      href: '/admin/finance/account-receivables',
      icon: FileText,
    },
  ]
  return (
    <div className='space-y-6 p-4 md:p-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-2'>
          <div className='space-y-1'>
            <h2 className='text-3xl font-bold tracking-tight'>School Dashboard</h2>
            <p className='text-sm text-muted-foreground'>
              {selectedSchool?.school_name || 'Your school'} - Comprehensive analytics and insights
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2 text-xs'>
            {activeSyLabel ? <Badge variant='secondary'>School Year: {activeSyLabel}</Badge> : null}
            {activeSemLabel ? <Badge variant='secondary'>Semester: {activeSemLabel}</Badge> : null}
            <Badge variant='outline'>Last sync: {lastUpdatedLabel}</Badge>
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' size='sm' onClick={fetchDashboardData} disabled={loading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild variant='outline' size='sm'>
            <Link to='/admin/memo-board'>
              <Megaphone className='mr-2 h-4 w-4' />
              Memos
            </Link>
          </Button>
          <Button asChild variant='outline' size='sm'>
            <Link to='/admin/calendar'>
              <CalendarDays className='mr-2 h-4 w-4' />
              Calendar
            </Link>
          </Button>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {primaryKpis.map((item) => (
          <StatCard key={item.key} {...item} loading={loading} />
        ))}
      </div>
      <div className='grid gap-4 lg:grid-cols-12'>
        <Card className='gap-0 rounded-lg py-0 shadow-sm lg:col-span-7' data-watermark='FIN'>
          <CardHeader className='flex flex-col gap-2 px-5 pb-0 pt-5 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle>Sales Overview</CardTitle>
              <CardDescription>Collections and cash flow signals</CardDescription>
            </div>
            <Button asChild variant='outline' size='sm'>
              <Link to='/admin/finance/monthly-summary'>Open finance reports</Link>
            </Button>
          </CardHeader>
          <CardContent className='space-y-5 px-5 pb-5 pt-4'>
            <div className='flex flex-wrap items-center gap-3'>
              <div className='text-3xl font-semibold tracking-normal'>{formatCurrency(collectionsMTD)}</div>
              <TrendBadge value={mtdVsAvg} label='vs avg' />
              <span className='text-xs text-muted-foreground'>
                {momChange === null ? 'No previous month comparison' : `${formatCurrency(lastMonthCollections - prevMonthCollections)} from previous month`}
              </span>
            </div>
            <SalesVolumeChart data={collectionsSeries} labels={monthLabels} />
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              <div className='rounded-lg border bg-background p-3'>
                <div className='text-xs text-muted-foreground'>Collections today</div>
                <div className='whitespace-normal break-words text-lg font-semibold leading-tight'>{formatCurrency(collectionsToday)}</div>
                <p className='text-xs text-muted-foreground'>Cashier totals</p>
              </div>
              <div className='rounded-lg border bg-background p-3'>
                <div className='text-xs text-muted-foreground'>Collections MTD</div>
                <div className='whitespace-normal break-words text-lg font-semibold leading-tight'>{formatCurrency(collectionsMTD)}</div>
                <p className='text-xs text-muted-foreground'>
                  {mtdVsAvg === null ? 'Vs 12-mo avg: N/A' : `Vs 12-mo avg: ${formatSignedPercent(mtdVsAvg)}`}
                </p>
              </div>
              <div className='rounded-lg border bg-background p-3'>
                <div className='text-xs text-muted-foreground'>12-mo average</div>
                <div className='whitespace-normal break-words text-lg font-semibold leading-tight'>{formatCurrency(avgMonthly)}</div>
                <p className='text-xs text-muted-foreground'>Monthly baseline</p>
              </div>
              <div className='rounded-lg border bg-background p-3'>
                <div className='flex items-center justify-between text-xs text-muted-foreground'>
                  <span>MoM change</span>
                  {momChange === null ? null : momChange >= 0 ? (
                    <TrendingUp className='h-3 w-3 text-emerald-500' />
                  ) : (
                    <TrendingDown className='h-3 w-3 text-rose-500' />
                  )}
                </div>
                <div className='whitespace-normal break-words text-lg font-semibold leading-tight'>
                  {momChange === null ? 'N/A' : formatSignedPercent(momChange)}
                </div>
                <p className='text-xs text-muted-foreground'>Vs previous month</p>
              </div>
            </div>
            <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
              <span>Best month: {bestMonthLabel || 'N/A'}</span>
              <span>|</span>
              <span>Peak: {formatCurrency(bestMonthValue)}</span>
              <span>|</span>
              <span>Last month: {monthLabels[lastMonthIndex] || 'N/A'}</span>
            </div>
            {monthLabels.length > 0 ? (
              <div className='grid grid-cols-6 gap-2 text-[10px] uppercase text-muted-foreground'>
                {monthLabels.slice(-6).map((label) => (
                  <span key={label} className='text-center'>
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <p className='text-xs text-muted-foreground'>No collection history yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className='gap-0 rounded-lg py-0 shadow-sm lg:col-span-5' data-watermark='LIST'>
          <CardHeader className='px-5 pb-0 pt-5'>
            <CardTitle>Finance Reports</CardTitle>
            <CardDescription>Shortcuts to detailed reports</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 px-5 pb-5 pt-4'>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='rounded-lg border bg-background p-3'>
                <div className='text-xs text-muted-foreground'>Receivables</div>
                <div className='whitespace-normal break-words text-lg font-semibold leading-tight'>{formatCurrency(receivables)}</div>
                <p className='text-xs text-muted-foreground'>Outstanding balance</p>
              </div>
              <div className='rounded-lg border bg-background p-3'>
                <div className='text-xs text-muted-foreground'>Collections MTD</div>
                <div className='whitespace-normal break-words text-lg font-semibold leading-tight'>{formatCurrency(collectionsMTD)}</div>
                <p className='text-xs text-muted-foreground'>Month-to-date</p>
              </div>
            </div>
            <div className='space-y-2'>
              {financeReports.map((report) => (
                <ReportLink
                  key={report.key}
                  icon={report.icon}
                  title={report.title}
                  description={report.description}
                  href={report.href}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className='gap-0 rounded-lg py-0 shadow-sm lg:col-span-7' data-watermark='REG'>
          <CardHeader className='flex flex-col gap-2 px-5 pb-0 pt-5 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle>Registrar Insights</CardTitle>
              <CardDescription>Enrollment status and student mix</CardDescription>
            </div>
            <Button asChild variant='outline' size='sm'>
              <Link to='/admin/registrar/enrollment-summary'>Enrollment report</Link>
            </Button>
          </CardHeader>
          <CardContent className='space-y-4 px-5 pb-5 pt-4'>
            <div className='grid gap-3 sm:grid-cols-3'>
              <div className='rounded-lg border bg-background p-3'>
                <div className='text-xs text-muted-foreground'>Enrolled students</div>
                <div className='whitespace-normal break-words text-lg font-semibold leading-tight'>{formatNumber(enrolledStudents)}</div>
                <p className='text-xs text-muted-foreground'>Active enrollments</p>
              </div>
              <div className='rounded-lg border bg-background p-3'>
                <div className='text-xs text-muted-foreground'>Pending enrollments</div>
                <div className='whitespace-normal break-words text-lg font-semibold leading-tight'>{formatNumber(pendingEnrollments)}</div>
                <p className='text-xs text-muted-foreground'>Awaiting confirmation</p>
              </div>
              <div className='rounded-lg border bg-background p-3'>
                <div className='text-xs text-muted-foreground'>Enrollment rate</div>
                <div className='whitespace-normal break-words text-lg font-semibold leading-tight'>{formatPercent(enrollmentRate)}</div>
                <p className='text-xs text-muted-foreground'>Share of total</p>
              </div>
            </div>
            <div className='space-y-2'>
              <div className='flex items-center justify-between text-xs'>
                <span className='text-muted-foreground'>Enrollment progress</span>
                <span className='font-medium'>{formatPercent(enrollmentRate)}</span>
              </div>
              <Progress value={enrollmentRate} className='h-2' />
            </div>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <div className='text-sm font-medium'>Enrollment by grade</div>
                <BarChart data={data.charts.gradeLevels || []} height={200} />
              </div>
              <div className='space-y-2'>
                <div className='text-sm font-medium'>Gender mix</div>
                <DonutChart data={data.charts.studentGender || []} size={140} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='gap-0 rounded-lg py-0 shadow-sm lg:col-span-5' data-watermark='HR'>
          <CardHeader className='flex flex-col gap-2 px-5 pb-0 pt-5 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle>HR Snapshot</CardTitle>
              <CardDescription>Headcount and department mix</CardDescription>
            </div>
            <Button asChild variant='outline' size='sm'>
              <Link to='/admin/hr/employee-profile'>View HR</Link>
            </Button>
          </CardHeader>
          <CardContent className='space-y-4 px-5 pb-5 pt-4'>
            <div className='flex items-center justify-between gap-3'>
              <div>
                <div className='whitespace-normal break-words text-2xl font-bold leading-tight'>{formatNumber(employees)}</div>
                <p className='text-xs text-muted-foreground'>Active employees</p>
              </div>
              <div className='rounded-lg border bg-background p-3 text-right'>
                <div className='text-xs text-muted-foreground'>Largest department</div>
                <div className='text-sm font-semibold'>{topDepartment?.label || 'N/A'}</div>
                <div className='text-xs text-muted-foreground'>
                  {topDepartment ? formatPercent(topDepartmentShare) : 'N/A'}
                </div>
              </div>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <DonutChart data={departments} size={120} />
              <div className='space-y-2'>
                {departments.length === 0 ? (
                  <p className='text-xs text-muted-foreground'>No department data yet.</p>
                ) : (
                  departments.map((dept, index) => {
                    const percent =
                      departmentsTotal > 0 ? (toNumber(dept.value) / departmentsTotal) * 100 : 0
                    return (
                      <div key={`${dept.label}-${index}`} className='space-y-1'>
                        <div className='flex items-center justify-between text-xs'>
                          <span className='text-muted-foreground'>{dept.label}</span>
                          <span className='font-medium'>{formatNumber(dept.value)}</span>
                        </div>
                        <Progress value={percent} className='h-2' />
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className='gap-0 rounded-lg py-0 shadow-sm lg:col-span-7' data-watermark='EVENT'>
          <CardHeader className='flex flex-col gap-2 px-5 pb-0 pt-5 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle>Communications</CardTitle>
              <CardDescription>Events, memos, and announcements</CardDescription>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Badge variant='secondary'>{formatNumber(upcomingEvents)} events</Badge>
              <Badge variant='secondary'>{formatNumber(memosThisWeek)} memos</Badge>
            </div>
          </CardHeader>
          <CardContent className='grid gap-4 px-5 pb-5 pt-4 md:grid-cols-2'>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <p className='text-sm font-medium'>Upcoming events</p>
                <Button asChild variant='ghost' size='sm'>
                  <Link to='/admin/calendar'>View all</Link>
                </Button>
              </div>
              {(data.lists.events || []).length === 0 ? (
                <div className='rounded-lg border bg-background p-4 text-center'>
                  <p className='text-sm text-muted-foreground'>No upcoming events</p>
                </div>
              ) : (
                (data.lists.events || []).map((event) => (
                  <div
                    key={event.id}
                    className='flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/30'
                  >
                    <CalendarDays className='mt-0.5 h-4 w-4 text-primary' />
                    <div className='flex-1 space-y-1 min-w-0'>
                      <div className='text-sm font-medium truncate' title={event.title}>
                        {event.title}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {event.when}
                        {event.venue ? ` - ${event.venue}` : ''}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <p className='text-sm font-medium'>Recent memos</p>
                <Button asChild variant='ghost' size='sm'>
                  <Link to='/admin/memo-board'>View all</Link>
                </Button>
              </div>
              {(data.lists.memos || []).length === 0 ? (
                <div className='rounded-lg border bg-background p-4 text-center'>
                  <p className='text-sm text-muted-foreground'>No recent memos</p>
                </div>
              ) : (
                (data.lists.memos || []).map((memo) => (
                  <div
                    key={memo.id}
                    className='flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/30'
                  >
                    <Megaphone className='mt-0.5 h-4 w-4 text-primary' />
                    <div className='flex-1 space-y-1 min-w-0'>
                      <div className='text-sm font-medium truncate' title={memo.title}>
                        {memo.title}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        Audience: {memo.audience || 'All'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className='gap-0 rounded-lg py-0 shadow-sm lg:col-span-5' data-watermark='STAT'>
          <CardHeader className='px-5 pb-0 pt-5'>
            <CardTitle>Operational Signals</CardTitle>
            <CardDescription>Enrollment pressure and cash coverage</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 px-5 pb-5 pt-4'>
            <div className='grid gap-4 sm:grid-cols-3'>
              <ProgressRing value={enrollmentRate} max={100} label='Enrollment rate' size={90} />
              <ProgressRing value={pendingRate} max={100} label='Pending share' size={90} />
              <ProgressRing value={collectionCoverageClamped} max={100} label='MTD vs receivables' size={90} />
            </div>
            <div className='space-y-2 text-sm'>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground'>Active employees</span>
                <span className='font-semibold'>{formatNumber(employees)}</span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground'>Upcoming events</span>
                <span className='font-semibold'>{formatNumber(upcomingEvents)}</span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-muted-foreground'>Memos this week</span>
                <span className='font-semibold'>{formatNumber(memosThisWeek)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
