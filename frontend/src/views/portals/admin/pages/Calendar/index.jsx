import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiUrl } from '@/lib/api'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad2 = (value) => String(value).padStart(2, '0')

const dateKey = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

const normalizeDateKey = (value) => {
  if (!value) return ''
  if (value instanceof Date) return dateKey(value)
  return String(value).slice(0, 10)
}

const parseDateOnly = (value) => {
  if (!value) return null
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

const addDays = (date, amount) => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

const buildCalendarDays = (viewDate) => {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstOfMonth = new Date(year, month, 1)
  const startDay = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  return Array.from({ length: 42 }, (_, index) => {
    const dayOffset = index - startDay + 1

    if (dayOffset < 1) {
      const date = new Date(year, month - 1, daysInPrevMonth + dayOffset)
      return { date, inMonth: false }
    }

    if (dayOffset > daysInMonth) {
      const date = new Date(year, month + 1, dayOffset - daysInMonth)
      return { date, inMonth: false }
    }

    const date = new Date(year, month, dayOffset)
    return { date, inMonth: true }
  })
}

const getCalendarRange = (viewDate) => {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startDay = firstOfMonth.getDay()
  const startDate = new Date(year, month, 1 - startDay)
  const endDate = new Date(year, month, 1 - startDay + 41)
  return { startDate, endDate }
}

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long' })
const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

const formatTimeValue = (value) => {
  if (!value) return null
  const normalized = String(value).slice(0, 8)
  const date = new Date(`1970-01-01T${normalized}`)
  if (Number.isNaN(date.getTime())) return normalized
  return timeFormatter.format(date)
}

const getEventDotClass = (event) => {
  if (Number(event.holiday) === 1) return 'bg-rose-500'
  if (Number(event.isnoclass) === 1) return 'bg-amber-500'
  if (Number(event.type) === 2) return 'bg-blue-500'
  return 'bg-emerald-500'
}

const getEventBadges = (event) => {
  const badges = []
  if (Number(event.holiday) === 1) {
    badges.push(event.holidaytype ? `Holiday: ${event.holidaytype}` : 'Holiday')
  }
  if (Number(event.isnoclass) === 1) {
    badges.push('No class')
  }
  if (Number(event.withpay) === 1) {
    badges.push('With pay')
  }
  if (Number(event.allDay) === 1) {
    badges.push('All day')
  }
  return badges
}

export default function AdminCalendar() {
  const selectedSchool = useMemo(
    () => JSON.parse(localStorage.getItem('selectedSchool') || 'null'),
    []
  )
  const token = localStorage.getItem('token')

  const today = useMemo(() => new Date(), [])
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(() => new Date(today))
  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)

  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()

  const days = useMemo(() => buildCalendarDays(viewDate), [viewDate])
  const calendarRange = useMemo(() => getCalendarRange(viewDate), [viewDate])
  const todayKey = useMemo(() => dateKey(today), [today])
  const selectedKey = useMemo(() => dateKey(selectedDate), [selectedDate])

  const years = useMemo(() => {
    const start = viewYear - 10
    return Array.from({ length: 21 }, (_, index) => start + index)
  }, [viewYear])

  const monthLabel = useMemo(() => monthFormatter.format(viewDate), [viewDate])

  const eventsByDate = useMemo(() => {
    const map = new Map()

    events.forEach((event) => {
      const startKey = normalizeDateKey(event.start)
      const endKey = normalizeDateKey(event.end) || startKey
      const startDate = parseDateOnly(startKey)
      const endDate = parseDateOnly(endKey) || startDate
      if (!startDate || !endDate) return

      let current = startDate
      while (current <= endDate) {
        const key = dateKey(current)
        if (!map.has(key)) {
          map.set(key, [])
        }
        map.get(key).push(event)
        current = addDays(current, 1)
      }
    })

    return map
  }, [events])

  const selectedEvents = useMemo(() => {
    const dayEvents = eventsByDate.get(selectedKey) || []
    return dayEvents.sort((a, b) => String(a.start).localeCompare(String(b.start)))
  }, [eventsByDate, selectedKey])

  useEffect(() => {
    const fetchEvents = async () => {
      if (!selectedSchool) return

      try {
        setEventsLoading(true)
        const response = await fetch(apiUrl('/api/admin/calendar/events'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({
            schoolDbConfig: {
              db_name: selectedSchool.db_name,
            },
            startDate: dateKey(calendarRange.startDate),
            endDate: dateKey(calendarRange.endDate),
          }),
        })

        const result = await response.json()
        if (response.ok && result.status === 'success') {
          setEvents(result.data || [])
        } else {
          toast.error(result.message || 'Failed to fetch calendar events')
        }
      } catch (error) {
        console.error('Error fetching calendar events:', error)
        toast.error('An error occurred while fetching calendar events')
      } finally {
        setEventsLoading(false)
      }
    }

    fetchEvents()
  }, [calendarRange.endDate, calendarRange.startDate, selectedSchool, token])

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1))
  }

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1))
  }

  const handleYearChange = (value) => {
    const nextYear = Number(value)
    if (Number.isNaN(nextYear)) return
    setViewDate(new Date(nextYear, viewMonth, 1))
  }

  const handleToday = () => {
    const now = new Date()
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(now)
  }

  const handleSelectDate = (date, inMonth) => {
    setSelectedDate(date)
    if (!inMonth) {
      setViewDate(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }

  return (
    <div className='space-y-6 p-4 md:p-6'>
      {/* Header Section */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-1'>
          <h2 className='text-3xl font-bold tracking-tight'>Calendar</h2>
          <p className='text-sm text-muted-foreground'>
            {selectedSchool?.school_name
              ? `Plan and track activities for ${selectedSchool.school_name}`
              : 'Plan and track school activities'}
          </p>
        </div>
        <Button variant='default' size='default' onClick={handleToday} className='w-fit'>
          <CalendarDays className='mr-2 h-4 w-4' />
          Today
        </Button>
      </div>

      {/* Main Calendar Grid */}
      <div className='grid gap-6 lg:grid-cols-[1fr_380px]'>
        {/* Calendar Card */}
        <Card className='shadow-sm' data-watermark='CAL'>
          <CardHeader className='pb-4'>
            <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex items-center gap-3'>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={handlePrevMonth}
                  aria-label='Previous month'
                  className='h-9 w-9'
                >
                  <ChevronLeft className='h-5 w-5' />
                </Button>
                <CardTitle className='text-2xl font-semibold'>
                  {monthLabel} {viewYear}
                </CardTitle>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={handleNextMonth}
                  aria-label='Next month'
                  className='h-9 w-9'
                >
                  <ChevronRight className='h-5 w-5' />
                </Button>
              </div>

              <Select value={String(viewYear)} onValueChange={handleYearChange}>
                <SelectTrigger className='w-[130px]'>
                  <SelectValue placeholder='Year' />
                </SelectTrigger>
                <SelectContent align='end'>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className='pb-6'>
            {/* Weekday Headers */}
            <div className='mb-2 grid grid-cols-7 gap-2'>
              {WEEKDAYS.map((label) => (
                <div
                  key={label}
                  className='py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground'
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className='grid grid-cols-7 gap-2'>
              {days.map(({ date, inMonth }) => {
                const key = dateKey(date)
                const isToday = key === todayKey
                const isSelected = key === selectedKey
                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                const dayEvents = eventsByDate.get(key) || []
                const visibleEvents = dayEvents.slice(0, 2)
                const extraCount = Math.max(0, dayEvents.length - visibleEvents.length)

                return (
                  <button
                    key={key}
                    type='button'
                    onClick={() => handleSelectDate(date, inMonth)}
                    className={cn(
                      'group relative flex min-h-[60px] flex-col items-start justify-start rounded-lg border-2 p-2 text-sm transition-all',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      inMonth
                        ? 'border-border bg-card hover:border-primary/50 hover:bg-accent hover:shadow-sm'
                        : 'border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/50',
                      isWeekend && inMonth && 'bg-muted/20',
                      isToday && inMonth && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                      isSelected && 'border-primary bg-primary text-primary-foreground shadow-md hover:bg-primary hover:border-primary'
                    )}
                    aria-label={fullDateFormatter.format(date)}
                    aria-current={isToday ? 'date' : undefined}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-md text-sm font-semibold',
                        !inMonth && 'opacity-40',
                        isToday && !isSelected && 'bg-primary/10 text-primary',
                        isSelected && 'text-primary-foreground'
                      )}
                    >
                      {date.getDate()}
                    </span>

                    {dayEvents.length > 0 && (
                      <div className='mt-1 w-full space-y-1 text-xs'>
                        {visibleEvents.map((event) => (
                          <div
                            key={`${event.id}-${key}`}
                            className={cn(
                              'truncate rounded-md px-1.5 py-1 font-medium',
                              isSelected
                                ? 'bg-primary-foreground/25 text-primary-foreground'
                                : 'bg-muted/60 text-foreground'
                            )}
                          >
                            {event.title}
                          </div>
                        ))}
                        {extraCount > 0 && (
                          <div
                            className={cn(
                              'px-1 text-xs font-semibold',
                              isSelected ? 'text-primary-foreground/90' : 'text-muted-foreground'
                            )}
                          >
                            +{extraCount} more
                          </div>
                        )}
                      </div>
                    )}

                    {/* Event indicator dots */}
                    <div className='mt-auto flex items-center gap-1'>
                      {dayEvents.slice(0, 3).map((event, index) => (
                        <span
                          key={`${event.id}-${index}`}
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isSelected ? 'bg-primary-foreground' : getEventDotClass(event)
                          )}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span
                          className={cn(
                            'text-[10px] font-semibold',
                            isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                          )}
                        >
                          +{dayEvents.length - 3}
                        </span>
                      )}
                    </div>

                    <span className='sr-only'>{fullDateFormatter.format(date)}</span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className='space-y-6'>
          {/* Selected Date Card */}
          <Card className='shadow-sm' data-watermark='DATE'>
            <CardHeader>
              <CardTitle className='text-lg'>Selected Date</CardTitle>
              <CardDescription>View and manage events</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='rounded-lg border-2 border-primary/20 bg-primary/5 p-4'>
                <div className='mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className='text-2xl font-bold'>
                  {selectedDate.getDate()}
                </div>
                <div className='text-sm text-muted-foreground'>
                  {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
              </div>

              <div className='space-y-3'>
                <div className='flex items-center gap-2 text-sm font-medium'>
                  <CalendarDays className='h-4 w-4 text-muted-foreground' />
                  Events
                </div>
                {eventsLoading ? (
                  <div className='rounded-md border bg-muted/30 p-4 text-center'>
                    <p className='text-sm text-muted-foreground'>Loading events...</p>
                  </div>
                ) : selectedEvents.length > 0 ? (
                  <div className='space-y-3'>
                    {selectedEvents.map((event) => {
                      const badges = getEventBadges(event)
                      const timeLabel =
                        Number(event.allDay) === 1
                          ? 'All day'
                          : [formatTimeValue(event.stime), formatTimeValue(event.etime)]
                              .filter(Boolean)
                              .join(' - ')
                      return (
                        <div
                          key={event.id}
                          className='rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40'
                        >
                          <div className='flex items-start gap-3'>
                            <span className={cn('mt-1 h-2 w-2 rounded-full', getEventDotClass(event))} />
                            <div className='flex-1 space-y-1'>
                              <div className='text-sm font-semibold'>{event.title}</div>
                              {event.venue && (
                                <div className='text-xs text-muted-foreground'>{event.venue}</div>
                              )}
                              {timeLabel && (
                                <div className='text-xs text-muted-foreground'>{timeLabel}</div>
                              )}
                              {badges.length > 0 && (
                                <div className='flex flex-wrap gap-1 pt-1 text-[11px] text-muted-foreground'>
                                  {badges.map((badge) => (
                                    <span
                                      key={badge}
                                      className='rounded-full border bg-background px-2 py-0.5'
                                    >
                                      {badge}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className='rounded-md border bg-muted/30 p-4 text-center'>
                    <p className='text-sm text-muted-foreground'>No events scheduled</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions removed */}
        </div>
      </div>
    </div>
  )
}
