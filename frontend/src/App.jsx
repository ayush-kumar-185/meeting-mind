import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './pages/DashboardLayout';
import MeetingsList from './pages/MeetingsList';
import ActionItemsList from './pages/ActionItemsList';
import Patterns from './pages/Patterns';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<MeetingsList />} />
          <Route path="action-items" element={<ActionItemsList />} />
          <Route path="patterns" element={<Patterns />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}