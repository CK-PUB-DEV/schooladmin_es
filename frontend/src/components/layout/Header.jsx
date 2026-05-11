import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearch } from '@/context/search-provider'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeSwitch } from '@/components/ThemeSwitch'
import { ConfigDrawer } from '@/components/ConfigDrawer'

export function Header({ className, fixed = true, children, ...props }) {
  const [offset, setOffset] = useState(0)
  const { setOpen } = useSearch()

  useEffect(() => {
    const onScroll = () => {
      setOffset(document.body.scrollTop || document.documentElement.scrollTop)
    }

    document.addEventListener('scroll', onScroll, { passive: true })
    return () => document.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'z-50 h-16',
        fixed && 'header-fixed peer/header sticky top-0 w-[inherit]',
        offset > 10 && fixed ? 'shadow' : 'shadow-none',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'relative flex h-full items-center gap-3 p-4 sm:gap-4',
          offset > 10 &&
            fixed &&
            'after:absolute after:inset-0 after:-z-10 after:bg-background/20 after:backdrop-blur-lg'
        )}
      >
        <SidebarTrigger variant='outline' className='max-md:scale-125 shrink-0' />
        <Separator orientation='vertical' className='h-6 shrink-0' />
        <div className='flex-1 min-w-0'>{children}</div>
        <div className='ms-auto flex shrink-0 items-center gap-2'>
          <Button
            variant='outline'
            className='relative h-9 w-9 justify-center rounded-md text-sm text-muted-foreground sm:w-auto sm:justify-start sm:pe-12 md:w-40 lg:w-64'
            onClick={() => setOpen(true)}
          >
            <Search className='h-4 w-4 shrink-0 sm:me-2' />
            <span className='hidden sm:inline-flex lg:hidden'>Search</span>
            <span className='hidden lg:inline-flex'>Search...</span>
            <kbd className='pointer-events-none absolute end-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex'>
              <span className='text-xs'>⌘</span>K
            </kbd>
          </Button>
          <ThemeSwitch />
          <ConfigDrawer />
        </div>
      </div>
    </header>
  )
}
