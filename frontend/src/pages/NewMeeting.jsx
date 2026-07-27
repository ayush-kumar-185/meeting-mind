import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export default function NewMeeting() {
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [members, setMembers] = useState([]);
  const [selectedAttendees, setSelectedAttendees] = useState(new Set());
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('30');
  const [transcript, setTranscript] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/workspaces').then(res => {
      setWorkspaces(res.data.workspaces);
      if (res.data.workspaces.length) setWorkspaceId(res.data.workspaces[0]._id);
    });
  }, []);

  useEffect(() => {
    const ws = workspaces.find(w => w._id === workspaceId);
    setMembers(ws?.members?.filter(m => m.status === 'active') || []);
    setSelectedAttendees(new Set()); // reset selection when workspace changes
  }, [workspaceId, workspaces]);

  // Detect duplicate names among this workspace's active members, and
  // build a disambiguated display/attribution name using their title
  // wherever a collision exists (e.g. two people both named "Ayush K").
  const nameCounts = members.reduce((acc, m) => {
    const key = m.name || m.email;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const membersWithDisambiguation = members.map(m => {
    const baseName = m.name || m.email.split('@')[0];
    const isDuplicate = nameCounts[m.name || m.email] > 1;
    return {
      ...m,
      displayName: isDuplicate && m.title ? `${baseName} (${m.title})` : baseName,
    };
  });

  const toggleAttendee = (email) => {
    setSelectedAttendees(prev => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !transcript.trim()) {
      setError('Title and transcript are both required.');
      return;
    }
    if (selectedAttendees.size === 0) {
      setError('Select at least one attendee from your workspace members.');
      return;
    }

    const attendees = membersWithDisambiguation
      .filter(m => selectedAttendees.has(m.email))
      .map(m => ({ name: m.displayName, email: m.email, userId: m.userId }));

    setSubmitting(true);
    try {
      const res = await api.post('/meetings', {
        title,
        rawTranscript: transcript,
        attendees,
        duration: Number(duration),
        workspaceId,
      });
      navigate(`/dashboard/meetings/${res.data.meeting._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 font-sans">
      <div className="mb-6 border-b border-border/50 pb-4">
        <h2 className="text-4xl font-bold text-foreground tracking-tight mb-2">Analyze New Meeting</h2>
        <p className="text-muted-foreground text-sm">Paste your transcript and select attendees to generate structured insights.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Metadata & Settings */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card className="bg-card border border-border rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)]">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-5 border-b border-border/50 pb-3">Details</h3>

              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label className="font-medium text-muted-foreground pb-1">Workspace</Label>
                  <Select
                    items={workspaces.map(w => ({ label: w.name, value: String(w._id) }))}
                    value={workspaceId || undefined}
                    onValueChange={(val) => setWorkspaceId(val)}
                  >
                    <SelectTrigger className="bg-card border border-border shadow-sm hover:border-[#7b7485] focus-within:!border-ring data-[state=open]:border-[#7b7485] h-10 w-full text-left">
                      <SelectValue placeholder="Select a workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map(w => (
                        <SelectItem key={w._id} value={String(w._id)}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="font-medium text-muted-foreground pb-1">
                    Meeting Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Q3 Roadmap Review"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="bg-card border border-border shadow-sm hover:border-[#7b7485] focus-within:!border-ring h-10 w-full"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="font-medium text-muted-foreground pb-1">Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    min={5}
                    step={5}
                    className="bg-card border border-border shadow-sm hover:border-[#7b7485] focus-within:!border-ring h-10 w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] flex flex-col">
            <CardContent className="p-6 flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-2 border-b border-border/50 pb-4">
                <h3 className="text-xl font-semibold text-foreground">Attendees</h3>
                <span className="bg-muted text-primary text-xs font-semibold px-2 py-1 rounded-full border border-primary/20">
                  {selectedAttendees.size} Selected
                </span>
              </div>

              {membersWithDisambiguation.length === 0 ? (
                <div className="mt-4 p-4 bg-muted border border-border rounded-lg text-sm text-muted-foreground text-center">
                  No members in this workspace yet. Invite teammates from Settings first.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-1">
                  {membersWithDisambiguation.map(m => (
                    <div
                      key={m.email}
                      className={`flex items-start gap-3 p-3 rounded-lg border border-transparent hover:bg-muted hover:border-primary/20 transition-all group ${selectedAttendees.has(m.email) ? 'bg-muted' : ''}`}
                    >
                      <Checkbox
                        id={`attendee-${m.email}`}
                        checked={selectedAttendees.has(m.email)}
                        onCheckedChange={() => toggleAttendee(m.email)}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`attendee-${m.email}`}
                        className="flex-1 text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-tight cursor-pointer"
                      >
                        {m.displayName}
                        <span className="text-xs text-muted-foreground font-normal block sm:inline mt-1 sm:mt-0 sm:ml-1">
                          ({m.email})
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Transcript Area */}
        <div className="lg:col-span-8 flex flex-col lg:h-[calc(100vh-160px)] lg:min-h-175 h-auto bg-card border border-border rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card shrink-0">
            <h3 className="text-headline-md font-bold text-foreground text-xl">Raw Transcript</h3>
            <span className="bg-muted text-muted-foreground text-xs font-semibold px-2.5 py-1 rounded-full border border-border/50">Auto-detecting language</span>
          </div>

          <div className="flex-1 relative bg-muted/50 min-h-75 hover:bg-muted transition-colors focus-within:bg-card! focus-within:shadow-[inset_0_0_0_1px_rgba(91,33,182,0.2)]">
            <Textarea
              placeholder={`Paste the raw meeting transcript here, or type notes...\n\nMeetingMind will extract:\n• Core decisions made\n• Assigned action items\n• Key recurring patterns`}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              required
              className="h-full w-full text-base font-medium text-foreground leading-relaxed resize-none focus:outline-none placeholder:text-muted-foreground bg-transparent hover:bg-transparent! focus-within:bg-transparent! shadow-none border-none border-0! p-6 items-start rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={15}
            />
          </div>

          <div className="p-5 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between shrink-0 gap-4">
            {error ? (
              <p className="text-sm font-medium text-destructive flex items-center gap-1.5 bg-destructive/30 px-3 py-2 rounded-lg border border-destructive">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-2 font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Analysis typically takes 15-30 seconds.
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary text-white font-semibold rounded-lg px-8 py-6 h-auto text-base shadow-sm hover:shadow-md hover:bg-primary/90 transition-all w-full sm:w-auto"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Analyze Meeting
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}