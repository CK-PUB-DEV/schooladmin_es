import {
  LayoutDashboard,
  Users,
  School,
  Calendar,
  Megaphone,
  DollarSign,
  UsersRound,
  GraduationCap,
  ChevronRight,
  Database,
  Settings,
  LifeBuoy,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useLayout } from '@/context/layout-provider'
import { apiUrl } from '@/lib/api'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { NavUser } from './NavUser'
import ckLogo from '@/assets/ck-logo.png'

// Navigation items based on user role
const getNavItems = (role, selectedSchool) => {
  const superAdminItems = [
    {
      title: 'Dashboard',
      url: '/super-admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'User Management',
      url: '/super-admin/users',
      icon: Users,
    },
    {
      title: 'School Management',
      url: '/super-admin/schools',
      icon: School,
    },
    {
      title: 'Bucket Monitoring',
      url: '/super-admin/bucket',
      icon: Database,
    },
  ]

  const adminItems = [
    {
      title: 'School Dashboard',
      url: '/admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Calendar',
      url: '/admin/calendar',
      icon: Calendar,
    },
    {
      title: 'Memo Board',
      url: '/admin/memo-board',
      icon: Megaphone,
    },
    {
      title: 'Finance Reports',
      icon: DollarSign,
      items: [
        { title: 'Cashier Transactions', url: '/admin/finance/cashier-transactions' },
        { title: 'Daily Cash Progress Report', url: '/admin/finance/daily-cash-progress' },
        { title: 'Monthly Summary', url: '/admin/finance/monthly-summary' },
        { title: 'Yearly Summary', url: '/admin/finance/yearly-summary' },
        { title: 'Account Receivables', url: '/admin/finance/account-receivables' },
        ...(Number(selectedSchool?.finance_v1) === 1
          ? []
          : [{ title: 'Student Ledgers', url: '/admin/finance/student-ledgers' }]),
      ],
    },
    {
      title: 'HR Reports',
      icon: UsersRound,
      items: [
        { title: 'Employee Profile', url: '/admin/hr/employee-profile' },
        { title: 'Employee Attendance', url: '/admin/hr/employee-attendance' },
      ],
    },
    {
      title: 'Registrar Reports',
      icon: GraduationCap,
      items: [
        { title: 'Enrollment Summary', url: '/admin/registrar/enrollment-summary' },
      ],
    },
  ]

  return role === 'super-admin' ? superAdminItems : adminItems
}

export function AppSidebar({ user, selectedSchool }) {
  const navItems = getNavItems(user?.role, selectedSchool)
  const adminOtherItems = [
    {
      title: 'Settings',
      icon: Settings,
      items: [
        { title: 'Profile', url: '/admin/settings/profile' },
        { title: 'Account', url: '/admin/settings/account' },
      ],
    },
    {
      title: 'Help Center',
      url: '/admin/help-center',
      icon: LifeBuoy,
    },
  ]
  const { collapsible, variant } = useLayout()
  const location = useLocation()

  const isPathActive = (path) =>
    typeof path === 'string' &&
    (location.pathname === path || location.pathname.startsWith(`${path}/`))

  const isItemActive = (item) => {
    if (item?.url) return isPathActive(item.url)
    if (Array.isArray(item?.items)) return item.items.some((sub) => isPathActive(sub.url))
    return false
  }

  const renderMenu = (items) => (
    <SidebarMenu>
      {items.map((item) =>
        item.items ? (
          // Collapsible menu item with submenu
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={isItemActive(item)}
            className='group/collapsible'
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={item.title} isActive={isItemActive(item)}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  <ChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild isActive={isPathActive(subItem.url)}>
                        <Link to={subItem.url}>
                          <span>{subItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ) : (
          // Regular menu item
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild tooltip={item.title} isActive={isItemActive(item)}>
              <Link to={item.url}>
                <item.icon />
                <span className='group-data-[collapsible=icon]:hidden'>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      )}
    </SidebarMenu>
  )

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <div className='flex items-center gap-2 px-4 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2'>
          {user?.role === 'admin' && selectedSchool?.image_logo ? (
            <div className='h-8 w-8 flex items-center justify-center rounded-lg overflow-hidden bg-muted'>
              <img
                src={apiUrl(selectedSchool.image_logo)}
                alt={selectedSchool.school_name}
                className='h-full w-full object-contain'
                onError={(e) => {
                  e.target.src = ckLogo
                }}
              />
            </div>
          ) : (
            <img src={ckLogo} alt='Logo' className='h-8 w-8' />
          )}
          <div className='flex flex-col group-data-[collapsible=icon]:hidden'>
            <span className='text-lg font-semibold'>
              {user?.role === 'admin' && selectedSchool?.abbrv
                ? selectedSchool.abbrv
                : 'System Admin'}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {user?.role === 'admin' ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>General</SidebarGroupLabel>
              <SidebarGroupContent>{renderMenu(navItems)}</SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Other</SidebarGroupLabel>
              <SidebarGroupContent>{renderMenu(adminOtherItems)}</SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupContent>{renderMenu(navItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} selectedSchool={selectedSchool} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
