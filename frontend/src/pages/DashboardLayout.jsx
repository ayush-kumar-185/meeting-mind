import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '../components/AppSidebar';

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-y-auto bg-neutral-50">
        <div className="p-4 border-b bg-white flex items-center">
          <SidebarTrigger />
        </div>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  );
}