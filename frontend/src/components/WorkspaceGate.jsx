import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useWorkspace } from '../hooks/useWorkspace';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function WorkspaceGate({ children }) {
  const { hasWorkspace, loading, refresh } = useWorkspace();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('create'); // 'create' | 'join'
  const [pendingInvites, setPendingInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [inviteActionId, setInviteActionId] = useState(null);

  useEffect(() => {
    if (!hasWorkspace && !loading) {
      api.get('/workspaces/invites/pending')
        .then(res => setPendingInvites(res.data.invites))
        .catch(() => setPendingInvites([]))
        .finally(() => setInvitesLoading(false));
    }
  }, [hasWorkspace, loading]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#f8f9ff] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-[#5b21b6]" />
        <p className="text-[#5b21b6] font-medium">Loading your workspace...</p>
      </div>
    );
  }

  if (!hasWorkspace) {
    const handleCreate = async (e) => {
      e.preventDefault();
      if (!name.trim()) return;
      setSubmitting(true);
      setError(null);
      try {
        await api.post('/workspaces', { name });
        refresh();
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to create workspace');
      } finally {
        setSubmitting(false);
      }
    };

    const handleAccept = async (workspaceId) => {
      setInviteActionId(workspaceId);
      try {
        await api.post(`/workspaces/${workspaceId}/accept-invite`);
        toast.success('Joined workspace.');
        refresh(); // hasWorkspace flips true, gate closes automatically
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to accept invite');
      } finally {
        setInviteActionId(null);
      }
    };

    const handleDecline = async (workspaceId) => {
      setInviteActionId(workspaceId);
      try {
        await api.post(`/workspaces/${workspaceId}/decline-invite`);
        setPendingInvites(prev => prev.filter(i => i.workspaceId !== workspaceId));
        toast.success('Invitation declined.');
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to decline invite');
      } finally {
        setInviteActionId(null);
      }
    };

    return (
      <div className="bg-[#f8f9ff] text-[#0b1c30] h-screen flex flex-col items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center">
          <div className="w-[800px] h-[800px] bg-[#5b21b6]/5 rounded-full blur-3xl absolute top-[-200px] right-[-200px]"></div>
          <div className="w-[600px] h-[600px] bg-[#464476]/5 rounded-full blur-3xl absolute bottom-[-100px] left-[-100px]"></div>
        </div>

        <main className="relative z-10 w-full max-w-[480px] px-6">
          <div className="flex justify-center mb-10">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#5b21b6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-2xl font-semibold text-[#5b21b6] tracking-tight">MeetingMind</span>
            </div>
          </div>

          <Card className="bg-white rounded-xl border border-[#e0e3e5]/50 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_10px_15px_-3px_rgba(0,0,0,0.02)]">
            <CardContent className="p-8">
              {view === 'create' ? (
                <>
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-semibold text-[#0b1c30] mb-2 mt-2">Set up your workspace</h1>
                    <p className="text-base text-[#4a4453] max-w-[320px] mx-auto mt-2">
                      Workspaces keep your team's meetings, action items, and patterns organized in one place.
                    </p>
                  </div>

                  <form onSubmit={handleCreate} className="flex flex-col gap-10">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="workspace-name" className="text-sm text-[#0b1c30] font-medium">
                          Workspace Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#4a4453]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <Input
                            id="workspace-name"
                            placeholder="e.g. Acme Corp Engineering"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="pl-10 h-14 bg-white border hover:border-gray-400 border-[#e0e3e5] shadow-sm rounded-lg text-base text-[#0b1c30] placeholder:text-[#4a4453]/40"
                          />
                        </div>
                      </div>
                      {error && <p className="text-sm text-[#ba1a1a] mt-1">{error}</p>}
                    </div>

                    <div className="flex flex-col gap-3">
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-[#5b21b6] text-white font-medium text-sm h-14 rounded-lg hover:bg-[#5b21b6]/90 hover:shadow-[0_4px_12px_rgba(91,33,182,0.15)] transition-all duration-200 group"
                      >
                        {submitting ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            Create Workspace
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </>
                        )}
                      </Button>

                      {!invitesLoading && pendingInvites.length > 0 && (
                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); setView('join'); }}
                          className="w-full text-center py-2 text-sm text-[#4a4453] hover:text-[#5b21b6] transition-colors"
                        >
                          Join an existing workspace instead
                        </a>
                      )}
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-semibold text-[#0b1c30] mb-2 mt-2">Pending Invitations</h1>
                    <p className="text-base text-[#4a4453] max-w-[320px] mx-auto mt-2">
                      You've been invited to join the following workspaces.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {pendingInvites.map(invite => (
                      <div
                        key={invite.workspaceId}
                        className="flex items-center justify-between p-4 bg-[#f8f9ff] border border-[#e0e3e5] rounded-lg"
                      >
                        <div>
                          <div className="text-[#0b1c30] font-medium text-sm">{invite.workspaceName}</div>
                          <div className="text-[#4a4453] text-xs capitalize mt-0.5">Role: {invite.role}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant='destructive'
                            disabled={inviteActionId === invite.workspaceId}
                            onClick={() => handleDecline(invite.workspaceId)}
                            // className="bg-white hover:text-[#ba1a1a] "
                          >
                            Declin
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={inviteActionId === invite.workspaceId}
                            onClick={() => handleAccept(invite.workspaceId)}
                            className="bg-[#5b21b6] text-white hover:bg-[#5b21b6]/90"
                          >
                            {inviteActionId === invite.workspaceId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Accept'
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); setView('create'); }}
                    className="w-full text-center py-2 mt-6 block text-sm text-[#4a4453] hover:text-[#5b21b6] transition-colors"
                  >
                    Create a new workspace instead
                  </a>
                </>
              )}
            </CardContent>
          </Card>

          <div className="mt-10 flex justify-center gap-4 text-center">
            <a href="#" className="text-xs text-[#4a4453]/60 hover:text-[#4a4453] transition-colors">Privacy Policy</a>
            <span className="text-[#4a4453]/30">•</span>
            <a href="#" className="text-xs text-[#4a4453]/60 hover:text-[#4a4453] transition-colors">Terms of Service</a>
          </div>
        </main>
      </div>
    );
  }

  return children;
}