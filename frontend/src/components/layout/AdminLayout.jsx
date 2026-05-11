import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { getCookie } from '@/lib/cookies'
import { apiUrl } from '@/lib/api'
import ckLogo from '@/assets/ck-logo.png'
import { cacheBustedHref, setFavicon } from '@/lib/metadata'
import { ThemeProvider } from '@/context/theme-provider'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { SkipToMain } from '@/components/SkipToMain'
import { AppSidebar } from './AppSidebar'
import { Header } from './Header'
import { Main } from './Main'
import { Separator } from '@/components/ui/separator'

export function AdminLayout() {
  const navigate = useNavigate()
  const user = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), [])
  const selectedSchool = useMemo(
    () => JSON.parse(localStorage.getItem('selectedSchool') || 'null'),
    []
  )
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const appTitle = import.meta.env.VITE_APP_TITLE || 'School Admin'
  const [activePeriod, setActivePeriod] = useState({ sy: null, semester: null })

  // Check if school is selected, if not redirect to school selection
  useEffect(() => {
    if (!selectedSchool) {
      navigate('/admin/select-school')
    }
  }, [selectedSchool, navigate])

  useEffect(() => {
    let lastKey = null
    let lastKeyTime = 0

    const restoreSuperAdmin = async () => {
      const sessionRaw = localStorage.getItem('superadmin_session')
      if (!sessionRaw) return

      const session = JSON.parse(sessionRaw)
      if (!session?.token || !session?.user) return

      const applySession = (token, user) => {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
        localStorage.removeItem('impersonation_active')
        localStorage.removeItem('superadmin_session')
        localStorage.removeItem('selectedSchool')
        navigate('/super-admin/dashboard', { replace: true })
      }

      try {
        const response = await fetch(apiUrl('/api/super-admin/restore-session'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          credentials: 'include',
        })

        const result = await response.json()
        if (response.ok && result.status === 'success') {
          applySession(result.data.token || session.token, result.data.user || session.user)
          return
        }
      } catch (error) {
        console.error('Restore session error:', error)
      }

      applySession(session.token, session.user)
    }

    const handleKeyDown = (event) => {
      if (localStorage.getItem('impersonation_active') !== 'true') return

      const target = event.target
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      const key = event.key.toLowerCase()
      if (key === 'g') {
        lastKey = 'g'
        lastKeyTime = Date.now()
        return
      }

      if (key === '1' && lastKey === 'g' && Date.now() - lastKeyTime <= 1000) {
        restoreSuperAdmin()
        lastKey = null
        lastKeyTime = 0
        return
      }

      if (key !== 'g') {
        lastKey = null
        lastKeyTime = 0
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [navigate])

  // Fetch active school year and semester
  useEffect(() => {
    const fetchActivePeriod = async () => {
      if (!selectedSchool) return

      try {
        const token = localStorage.getItem('token')
        const response = await fetch(apiUrl('/api/admin/enrollment/summary'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({
            schoolDbConfig: {
              db_host: selectedSchool.db_host || 'localhost',
              db_port: selectedSchool.db_port || 3306,
              db_name: selectedSchool.db_name,
              db_username: selectedSchool.db_username || 'root',
              db_password: selectedSchool.db_password || '',
            },
          }),
        })

        const result = await response.json()
        if (response.ok && result.status === 'success') {
          setActivePeriod({
            sy: result.data.activeSchoolYear,
            semester: result.data.activeSemester,
          })
        }
      } catch (error) {
        console.error('Error fetching active period:', error)
      }
    }

    fetchActivePeriod()
  }, [
    selectedSchool?.id,
    selectedSchool?.db_host,
    selectedSchool?.db_port,
    selectedSchool?.db_name,
    selectedSchool?.db_username,
    selectedSchool?.db_password,
  ])

  useEffect(() => {
    const title = selectedSchool?.abbrv?.trim() || selectedSchool?.school_name?.trim() || appTitle
    document.title = title

    const baseIconHref = selectedSchool?.image_logo
      ? apiUrl(selectedSchool.image_logo)
      : ckLogo

    const faviconHref = cacheBustedHref(
      baseIconHref,
      selectedSchool?.id || selectedSchool?.school_name || 'default'
    )

    setFavicon(faviconHref)

    return () => {
      document.title = appTitle
      setFavicon(ckLogo)
    }
  }, [appTitle, selectedSchool?.id, selectedSchool?.image_logo, selectedSchool?.school_name, selectedSchool?.abbrv])

  return (
    <ThemeProvider>
      <LayoutProvider>
        <SearchProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <SkipToMain />
            <AppSidebar user={user} selectedSchool={selectedSchool} />
            <SidebarInset
              className={cn(
                '@container/content',
                'has-data-[layout=fixed]:h-svh',
                'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
              )}
            >
              <Header>
                <div className='flex min-w-0 items-center gap-2 sm:gap-3'>
                  <h1 className='truncate text-sm font-semibold sm:text-lg'>
                    <span className='sm:hidden'>
                      {selectedSchool?.abbrv || selectedSchool?.school_name || 'Dashboard'}
                    </span>
                    <span className='hidden sm:inline'>
                      {selectedSchool?.school_name || 'Dashboard'}
                    </span>
                  </h1>
                  {activePeriod.sy && (
                    <>
                      <Separator orientation='vertical' className='hidden md:block h-6 shrink-0' />
                      <div className='hidden md:block text-sm shrink-0'>
                        <span className='font-bold text-muted-foreground'>ACTIVE:</span>{' '}
                        <span className='font-semibold'>
                          {activePeriod.sy.sydesc}
                          {activePeriod.semester && ` - ${activePeriod.semester.semester}`}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </Header>
              <Main id='content' fluid>
                <Outlet />
              </Main>
            </SidebarInset>
          </SidebarProvider>
        </SearchProvider>
      </LayoutProvider>
    </ThemeProvider>
  )
}
