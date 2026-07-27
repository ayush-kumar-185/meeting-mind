import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export default function ActionItemsList() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState(null);
  const [scope, setScope] = useState('mine'); // 'mine' | 'all'
  const loadItems = () => {
    setLoading(true);
    setError(null);
    const params = { scope };
    if (statusFilter !== 'all') params.status = statusFilter;
    api.get('/action-items', { params })
      .then(res => setItems(res.data.actionItems))
      .catch(err => {
        console.error('Failed to load action items:', err.message);
        setError('Failed to load action items.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadItems();
  }, [statusFilter, scope]);

  const handleStatusToggle = async (itemId, currentStatus) => {
    try {
      const next = currentStatus === 'done' ? 'pending' : 'done';
      const res = await api.patch(`/action-items/${itemId}/status`, { status: next });
      setItems(prev => prev.map(i => i._id === itemId ? res.data.actionItem : i));
    } catch (err) {
      console.error('Status toggle failed:', err.response?.data?.error || err.message);
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handlePushToJira = async (itemId) => {
    try {
      const res = await api.post(`/action-items/${itemId}/push/jira`);
      setItems(prev => prev.map(i => i._id === itemId ? res.data.actionItem : i));
    } catch (err) {
      console.error('Push to Jira failed:', err.response?.data?.error || err.message);
      toast.error(err.response?.data?.error || 'Failed to push to Jira');
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-[600px] w-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (error) {
    return (
      <div className="max-w-[1280px] mx-auto p-8 w-full">
        <div className="bg-destructive/30 text-destructive p-4 rounded-xl border border-destructive flex items-center justify-between">
          <span className="font-medium">{error}</span>
          <Button size="sm" className="bg-destructive text-white font-medium hover:bg-destructive/90" onClick={loadItems}>Retry</Button>
        </div>
      </div>
    );
  }

  const isJiraConnected = user?.integrations?.jira?.connected === true;

  const grouped = items.reduce((groups, item) => {
    const key = item.assignee?.name || 'Unassigned';
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});

  const renderTableRow = (item) => {
    const isDone = item.status === 'done';
    const isOverdue = new Date(item.deadline) < new Date() && !isDone;

    return (
      <tr key={item._id} className="hover:bg-muted transition-colors group">
        <td className="py-4 px-6 align-middle">
          <Checkbox
            checked={isDone}
            onCheckedChange={() => handleStatusToggle(item._id, item.status)}
            className="mt-0.5"
          />
        </td>
        <td className="py-4 px-6 align-middle">
          <span className={`font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {item.title}
          </span>
        </td>
        <td className="py-4 px-6 align-middle text-muted-foreground">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className={isDone ? 'line-through text-muted-foreground/70' : ''}>
              {item.meeting?.title || 'Unknown Meeting'}
            </span>
          </div>
        </td>
        <td className="py-4 px-6 align-middle">
          {item.deadline ? (
            <span className={isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground'}>
              {new Date(item.deadline).toLocaleDateString()}
            </span>
          ) : (
            <span className="text-muted-foreground italic font-normal text-xs">No deadline</span>
          )}
        </td>
        <td className="py-4 px-6 align-middle text-right">
          {item.pushedTo?.some(p => p.tool === 'jira') ? (
            <a
              href={item.pushedTo.find(p => p.tool === 'jira').externalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-primary hover:underline flex items-center justify-end gap-1"
            >
              View in Jira
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : isJiraConnected && !isDone ? (
            <Button
              size="sm"
              variant="outline"
              className="bg-muted text-primary font-semibold hover:bg-secondary h-8 px-3"
              onClick={() => handlePushToJira(item._id)}
            >
              Push to Jira
            </Button>
          ) : !isJiraConnected && !isDone ? (
            <div className="text-xs text-muted-foreground hover:text-primary transition-colors">
              <Link to="/dashboard/settings" title="Connect Jira in Settings">Connect Jira</Link>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex-1 p-4 md:p-8 w-full max-w-[1280px] mx-auto font-sans">
      {/* Page Header & Filters */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end justify-between border-b border-border/50 pb-6 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight mb-2">Action Items</h1>
          <p className="text-muted-foreground text-sm">Track and manage tasks across all your meetings.</p>
        </div>

        <div className="flex-shrink-0 w-full sm:w-auto flex flex-col sm:flex-row items-center gap-4">
          <Select
            value={scope}
            onValueChange={(val) => setScope(val)}
          >
            <SelectTrigger className="bg-card border border-border shadow-sm hover:border-[#7b7485] focus-within:!border-ring data-[state=open]:border-[#7b7485] h-10 w-full sm:w-40 text-left">
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mine">My Items</SelectItem>
              <SelectItem value="all">All Items</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val)}
          >
            <SelectTrigger className="bg-card border border-border shadow-sm hover:border-[#7b7485] focus-within:!border-ring data-[state=open]:border-[#7b7485] h-10 w-full sm:w-40 text-left">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 mt-4 bg-muted rounded-xl border-2 border-dashed border-border">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 13l4 4L19 7" />
          </svg>
          <h2 className="text-xl font-bold text-foreground mb-2">No action items found</h2>
          <p className="text-muted-foreground mb-6 font-medium text-sm">Tasks assigned to you and your team will appear here.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {scope === 'mine' ? (
            <div className="flex flex-col gap-4">
              {/* Group Header */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#5b21b6] text-white flex items-center justify-center text-xs font-bold">
                  ME
                </div>
                <h2 className="font-semibold  text-xl text-[#5b21b6] tracking-tight">My Action Items</h2>
                <span className="bg-secondary px-2.5 py-1 rounded-full text-xs font-bold text-muted-foreground">
                  {items.length} Task{items.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Table Layout */}
              <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      <th className="py-4 px-6 w-14"></th>
                      <th className="py-4 px-6">Task</th>
                      <th className="py-4 px-6">Source Meeting</th>
                      <th className="py-4 px-6">Deadline</th>
                      <th className="py-4 px-6 w-40 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-foreground divide-y divide-[#ccc3d6]/50">
                    {items.map(item => renderTableRow(item))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            Object.entries(grouped).map(([person, personItems]) => {
              const initials = person.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

              return (
                <div key={person} className="flex flex-col gap-4">
                  {/* Group Header */}
                  <div className="flex items-center gap-3">
                    {person === 'Unassigned' ? (
                      <div className="w-8 h-8 rounded-full bg-secondary text-foreground flex items-center justify-center text-xs font-bold">
                        ?
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                        {initials}
                      </div>
                    )}
                    <h2 className="font-semibold text-foreground text-xl tracking-tight">Assigned to {person}</h2>
                    <span className="bg-secondary px-2.5 py-1 rounded-full text-xs font-bold text-muted-foreground">
                      {personItems.length} Task{personItems.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Table Layout */}
                  <div className="bg-card border border-border rounded-xl overflow-x-auto shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                          <th className="py-4 px-6 w-14"></th>
                          <th className="py-4 px-6">Task</th>
                          <th className="py-4 px-6">Source Meeting</th>
                          <th className="py-4 px-6">Deadline</th>
                          <th className="py-4 px-6 w-40 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm text-foreground divide-y divide-[#ccc3d6]/50">
                        {personItems.map(item => renderTableRow(item))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}