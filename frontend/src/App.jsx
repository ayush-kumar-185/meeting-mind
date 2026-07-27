import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './pages/DashboardLayout';
import MeetingsList from './pages/MeetingsList';
import ActionItemsList from './pages/ActionItemsList';
import Patterns from './pages/Patterns';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import NewMeeting from './pages/NewMeeting';
import MeetingDetail from './pages/MeetingDetail';
import WorkspaceGate from './components/WorkspaceGate';
import { Toaster } from '@/components/ui/sonner';





export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <WorkspaceGate>
                <DashboardLayout />
              </WorkspaceGate>
            </ProtectedRoute>
          }
        >
          <Route index element={<MeetingsList />} />
          <Route path="action-items" element={<ActionItemsList />} />
          <Route path="patterns" element={<Patterns />} />
          <Route path="settings" element={<Settings />} />
          <Route path="new" element={<NewMeeting />} />
          <Route path="meetings/:id" element={<MeetingDetail />} />
        </Route>
        <Route path="*" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}