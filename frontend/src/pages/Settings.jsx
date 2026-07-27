import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
const BASE_URL = import.meta.env.VITE_API_URL;

export default function Settings() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteTitle, setInviteTitle] = useState('');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState(null);

  const loadWorkspaces = () => {
    api.get('/workspaces')
      .then(res => {
        setWorkspaces(res.data.workspaces);
        if (res.data.workspaces.length > 0 && !activeWorkspaceId) {
          setActiveWorkspaceId(res.data.workspaces[0]._id);
        }
        // if the previously active workspace no longer exists (e.g. just deleted),
        // fall back to the first remaining one, or null if none are left
        if (activeWorkspaceId && !res.data.workspaces.some(w => w._id === activeWorkspaceId)) {
          setActiveWorkspaceId(res.data.workspaces[0]?._id || null);
        }
      })
      .catch(() => toast.error('Failed to load workspaces'))
      .finally(() => setLoading(false));

    api.get('/workspaces/invites/pending')
      .then(res => setPendingInvites(res.data.invites))
      .catch(() => setPendingInvites([]));
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const handleAcceptInvite = async (workspaceId) => {
    try {
      await api.post(`/workspaces/${workspaceId}/accept-invite`);
      toast.success('Invitation accepted.');
      loadWorkspaces();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to accept invite');
    }
  };

  const handleDeclineInvite = async (workspaceId) => {
    try {
      await api.post(`/workspaces/${workspaceId}/decline-invite`);
      setPendingInvites(prev => prev.filter(i => i.workspaceId !== workspaceId));
      toast.success('Invitation declined.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to decline invite');
    }
  };

  const handleRemoveMember = async (memberEmail) => {
    if (!window.confirm(`Are you sure you want to remove ${memberEmail} from this workspace?`)) return;
    try {
      await api.delete(`/workspaces/${activeWorkspaceId}/members/${encodeURIComponent(memberEmail)}`);
      toast.success(`Removed ${memberEmail} from the workspace.`);
      loadWorkspaces();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleDisconnectJira = async () => {
    if (!window.confirm("Are you sure you want to disconnect Jira? You will not be able to push action items to Jira.")) return;
    try {
      await api.post('/auth/jira/disconnect');
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to disconnect Jira');
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    try {
      await api.post('/workspaces', { name: newWorkspaceName });
      setNewWorkspaceName('');
      toast.success('Workspace created.');
      loadWorkspaces();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create workspace');
    }
  };

  const handleDeleteWorkspace = async (workspaceId) => {
    setDeletingWorkspaceId(workspaceId);
    try {
      await api.delete(`/workspaces/${workspaceId}`);
      toast.success('Workspace deleted.');
      if (activeWorkspaceId === workspaceId) {
        setActiveWorkspaceId(null);
      }
      loadWorkspaces();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete workspace');
    } finally {
      setDeletingWorkspaceId(null);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeWorkspaceId) return;

    if (inviteEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      toast.error("You can't invite yourself — you're already a member.");
      return;
    }

    try {
      await api.post(`/workspaces/${activeWorkspaceId}/invite`, { email: inviteEmail, name: inviteName, title: inviteTitle, });
      setInviteEmail('');
      setInviteName('');
      setInviteTitle('')
      toast.success(`Invited ${inviteName || inviteEmail}`);
      loadWorkspaces();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to invite member');
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-[#5b21b6]" />
    </div>
  );

  const activeWorkspace = workspaces.find(w => w._id === activeWorkspaceId);
  const isJiraConnected = user?.integrations?.jira?.connected === true;
  const currentUserMember = activeWorkspace?.members.find(m => m.userId === user?._id || m.email === user?.email);
  const isAdmin = currentUserMember?.role === 'admin';

  return (
    <div className="max-w-4xl flex flex-col gap-8 w-full mx-auto p-4 md:p-8 font-sans">
      <div className="border-b border-[#ccc3d6]/50 pb-4 mb-2">
        <h2 className="text-3xl font-bold text-[#5b21b6] tracking-tight">Settings</h2>
        <p className="text-[#4a4453] text-sm mt-2">Manage your workspaces, team, and integrations.</p>
      </div>

      {pendingInvites.length > 0 && (
        <Card className="bg-white border border-[#ccc3d6] rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
          <CardContent className="p-6 md:p-8 flex flex-col gap-4">
            <div>
              <h3 className="text-xl font-semibold text-[#0b1c30] mb-1">Pending Invitations</h3>
              <p className="text-sm text-[#4a4453]">You have been invited to join the following workspaces.</p>
            </div>
            <div className="flex flex-col gap-3">
              {pendingInvites.map((invite, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-[#f8f9ff] border border-[#ccc3d6]/50 rounded-lg">
                  <div>
                    <span className="text-[#0b1c30] font-medium block">{invite.workspaceName}</span>
                    <span className="text-[#4a4453] text-sm capitalize">Role: {invite.role}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleDeclineInvite(invite.workspaceId)}
                      className="border-[#ccc3d6] text-[#4a4453] hover:bg-[#ffdad6]/30 hover:text-[#ba1a1a] hover:border-[#ffdad6]"
                    >
                      Decline
                    </Button>
                    <Button
                      onClick={() => handleAcceptInvite(invite.workspaceId)}
                      className="bg-[#5b21b6] text-white hover:bg-[#4a1b9b]"
                    >
                      Accept
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white border border-[#ccc3d6] rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
        <CardContent className="p-6 md:p-8 flex flex-col gap-6">
          <div>
            <h3 className="text-xl font-semibold text-[#0b1c30] mb-1">Your Workspaces</h3>
            <p className="text-sm text-[#4a4453]">Manage your current active workspace and preferences.</p>
          </div>

          {workspaces.length === 0 ? (
            <p className="text-[#4a4453] italic text-sm bg-[#f8f9ff] p-4 rounded-lg border border-[#ccc3d6]/50">You don't have a workspace yet — create one below.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {workspaces.map(w => {
                const isOwner = w.ownerId === user?._id;
                return (
                  <div key={w._id} className="flex items-center gap-1">
                    <Button
                      className={w._id === activeWorkspaceId ? "bg-[#5b21b6] text-white font-medium hover:bg-[#5b21b6]" : "bg-white border text-[#4a4453] border-[#ccc3d6] hover:bg-[#f8f9ff] font-medium"}
                      onClick={() => setActiveWorkspaceId(w._id)}
                      size="sm"
                    >
                      {w.name}
                    </Button>
                    {isOwner && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#4a4453] hover:text-red-600">
                            <Trash2 size={14} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{w.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes the workspace along with ALL its meetings, action items, commitments, and patterns — for every member. This can't be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteWorkspace(w._id)}
                              disabled={deletingWorkspaceId === w._id}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {deletingWorkspaceId === w._id ? 'Deleting...' : 'Delete Workspace'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-4 border-t border-[#ccc3d6]/30">
            <h4 className="text-sm font-medium text-[#0b1c30] mb-3">Create New Workspace</h4>
            <form onSubmit={handleCreateWorkspace} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Input
                type="text"
                placeholder="New workspace name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                className="w-full bg-white border border-[#ccc3d6] shadow-sm hover:border-gray-400 focus-visible:border-[#5b21b6] focus-visible:ring-0"
              />
              <Button type="submit" className="bg-[#5b21b6] text-white font-medium w-full sm:w-auto hover:bg-[#4a1b9b]">Create</Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {activeWorkspace && (
        <Card className="bg-white border border-[#ccc3d6] rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
          <CardContent className="p-0 flex flex-col">
            <div className="p-6 md:p-8 border-b border-[#ccc3d6]/50">
              <h3 className="text-xl font-semibold text-[#0b1c30] mb-1">Members — {activeWorkspace.name}</h3>
              <p className="text-sm text-[#4a4453]">Manage team access and roles.</p>
            </div>

            <div className="p-6 md:px-8 bg-[#e5eeff]/20 border-b border-[#ccc3d6]/50">
              <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="text"
                  placeholder="Name (e.g. Ayush P)"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full sm:max-w-50 bg-white border border-[#ccc3d6] shadow-sm hover:border-gray-400 focus-visible:border-[#5b21b6] focus-visible:ring-0"
                />
                <Input
                  type="email"
                  placeholder="teammate@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 bg-white border border-[#ccc3d6] shadow-sm hover:border-gray-400 focus-visible:border-[#5b21b6] focus-visible:ring-0"
                />
                <Input
                  type="text"
                  placeholder="Title (e.g. Developer)"
                  value={inviteTitle}
                  onChange={(e) => setInviteTitle(e.target.value)}
                  className="w-full sm:max-w-40 bg-white border border-[#ccc3d6] shadow-sm hover:border-gray-400 focus-visible:border-[#5b21b6] focus-visible:ring-0"
                />
                <Button type="submit" className="bg-[#5b21b6] text-white font-medium hover:bg-[#4a1b9b] w-full sm:w-auto">Send Invite</Button>
              </form>
            </div>

            <div className="flex flex-col">
              {activeWorkspace.members.map((m, i) => (
                <div key={i} className={`flex items-center justify-between p-4 md:px-8 bg-white hover:bg-[#f8f9ff] transition-colors ${i !== activeWorkspace.members.length - 1 ? 'border-b border-[#ccc3d6]/30' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#f8f9ff] text-[#5b21b6] flex border border-[#ccc3d6]/50 items-center justify-center font-bold text-xs uppercase shadow-sm">
                      {m.name ? m.name.substring(0, 2) : m.email.substring(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      {m.name && <span className="text-[#0b1c30] text-sm font-medium">{m.name}</span>}
                      <span className={`text-[#4a4453] text-${m.name ? 'xs' : 'sm font-medium'} truncate`}>{m.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={m.status === 'pending' ? 'bg-[#f0e6ff] text-[#5b21b6] font-medium hover:bg-[#f0e6ff] capitalize' : m.role === 'admin' ? 'bg-[#ffdad6] text-[#93000a] font-medium hover:bg-[#ffdad6] capitalize' : 'bg-[#e5eeff] text-[#420093] font-medium hover:bg-[#e5eeff] capitalize'}>
                      {m.status === 'pending' ? 'Pending' : m.role}
                    </Badge>
                    {isAdmin && m.email !== user?.email && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-[#4a4453] hover:text-[#0b1c30] hover:bg-[#ccc3d6]/30">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px] bg-white border-[#ccc3d6]">
                          <DropdownMenuItem
                            onClick={() => handleRemoveMember(m.email)}
                            variant='destructive'
                            className="cursor-pointer"
                          >
                            <Trash2 className="mr-2" />
                            Remove from workspace
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white border border-[#ccc3d6] rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
        <CardContent className="p-6 md:p-8 flex flex-col gap-6">
          <div>
            <h3 className="text-xl font-semibold text-[#0b1c30] mb-1">Integrations</h3>
            <p className="text-sm text-[#4a4453]">Connect your tools to automate meeting workflows.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-[#ccc3d6] rounded-lg p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#0b1c30]">Jira</h4>
                    {isJiraConnected ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full mt-1 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#4a4453] bg-[#f8f9ff] border border-[#ccc3d6]/50 px-2.5 py-0.5 rounded-full mt-1">
                        Not connected
                      </span>
                    )}
                  </div>
                </div>
                {isJiraConnected ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="cursor-pointer"
                    onClick={handleDisconnectJira}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="sm"
                    className="text-[#5b21b6] bg-transparent border border-[#5b21b6]/20 hover:bg-[#5b21b6]/5 font-medium"
                  >
                    <a href={`${BASE_URL}/auth/jira/connect`}>Connect</a>
                  </Button>
                )}
              </div>
              <p className="text-sm text-[#4a4453]">Automatically create Jira tickets from meeting action items.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}