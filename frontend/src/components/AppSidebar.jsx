import { LogOut, Video, ListTodo, Repeat, Settings as SettingsIcon } from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';

import { NavLink, useNavigate, useLocation } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Meetings', end: true, icon: Video },
  { to: '/dashboard/action-items', label: 'Action Items', icon: ListTodo },
  { to: '/dashboard/patterns', label: 'Patterns', icon: Repeat },
  { to: '/dashboard/settings', label: 'Settings', icon: SettingsIcon },
];

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function AppSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';


  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
      localStorage.removeItem('token');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isLinkActive = (link) => {
    return link.end ? location.pathname === link.to : location.pathname.startsWith(link.to);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {!isCollapsed && (
          <div className="px-2 py-2 font-semibold text-lg truncate">MeetingMind</div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map(link => {
                const Icon = link.icon;
                const active = isLinkActive(link);
                return (
                  <SidebarMenuItem key={link.to}>
                    <SidebarMenuButton
                      tooltip={link.label}
                      isActive={active}
                      onClick={() => navigate(link.to)}
                      className={`cursor-pointer flex items-center gap-2 ${active ? 'font-medium text-primary' : ''}`}
                    >
                      <Icon size={18} className="shrink-0 pointer-events-none" />
                      {!isCollapsed && <span className="truncate pointer-events-none">{link.label}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 w-full py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-left">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                <AvatarFallback className="text-xs">{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{user?.name || 'Loading...'}</div>
                  <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" side="top" className="w-48">

            <DropdownMenuItem onClick={handleLogout} variant='destructive' className="cursor-pointer">
                <LogOut size={14} className="mr-2" />
                Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}