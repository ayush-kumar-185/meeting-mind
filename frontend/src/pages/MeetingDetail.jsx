import { useParams, Link } from 'react-router-dom';
import { useMeeting } from '../hooks/useMeeting';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export default function MeetingDetail() {
  const { id } = useParams();
  const { meeting, loading, error } = useMeeting(id);
  const { user } = useAuth();
  const [actionItems, setActionItems] = useState([]);
  const [sendingFollowups, setSendingFollowups] = useState(false);
  const [followupResults, setFollowupResults] = useState(null);
  const [commitments, setCommitments] = useState([]);

  useEffect(() => {
    if (meeting?.status === 'ready') {
      api.get('/commitments')
        .then(res => setCommitments(res.data.commitments.filter(c => c.meetingId === meeting._id)))
        .catch(err => console.error('Failed to load commitments:', err.message));

      api.get(`/action-items/meeting/${meeting._id}`)
        .then(res => setActionItems(res.data.actionItems))
        .catch(err => console.error('Failed to load action items:', err.message));
    }
  }, [meeting?.status, meeting?._id]);

  const handleSendFollowups = async () => {
    setSendingFollowups(true);
    try {
      const res = await api.post(`/meetings/${meeting._id}/send-followups`);
      setFollowupResults(res.data.results);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send follow-ups');
    } finally {
      setSendingFollowups(false);
    }
  };

  const handleStatusToggle = async (itemId, currentStatus) => {
    try {
      const next = currentStatus === 'done' ? 'pending' : 'done';
      const res = await api.patch(`/action-items/${itemId}/status`, { status: next });
      setActionItems(prev => prev.map(i => i._id === itemId ? res.data.actionItem : i));
    } catch (err) {
      console.error('Status toggle failed:', err.response?.data?.error || err.message);
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handlePushToJira = async (itemId) => {
    try {
      const res = await api.post(`/action-items/${itemId}/push/jira`);
      setActionItems(prev => prev.map(i => i._id === itemId ? res.data.actionItem : i));
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

  if (error) return (
    <div className="bg-destructive/10 text-destructive p-4 rounded-lg m-4 max-w-container-max mx-auto font-medium">
      {error}
    </div>
  );

  if (!meeting) return null;

  const missingEmailCount = meeting.attendees.filter(a => !a.email).length;
  const isJiraConnected = user?.integrations?.jira?.connected === true;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full max-w-[1280px] mx-auto font-sans relative">
      <div className="flex flex-col gap-10 pb-12">
        {/* Header & Actions */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <div className="flex items-center text-sm font-medium text-muted-foreground mb-2">
              <Link to="/dashboard" className="hover:text-primary transition-colors">Meetings</Link>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-foreground">{meeting.title}</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">{meeting.title}</h2>
            <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(meeting.date).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-secondary text-foreground rounded-md text-xs font-semibold whitespace-nowrap">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {meeting.attendees.length} Attendees
              </div>
              <div className="text-muted-foreground hidden sm:block">•</div>
              <div className="text-xs text-muted-foreground">{meeting.attendees.map(a => a.name).join(', ')}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {meeting.status === 'ready' && (
              <Button
                className="bg-primary text-white px-5 py-2.5 h-auto rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
                onClick={handleSendFollowups}
                disabled={sendingFollowups}
              >
                {sendingFollowups ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
                Send Follow-up Emails
              </Button>
            )}
          </div>
        </div>

        {/* Status Alerts */}
        {meeting.status === 'processing' && (
          <div className="bg-muted border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div>
              <h3 className="text-lg font-bold text-foreground">Extracting Insights</h3>
              <p className="text-sm font-medium text-muted-foreground mt-1">AI is processing your meeting transcript. Please check back shortly.</p>
            </div>
          </div>
        )}

        {meeting.status === 'failed' && (
          <div className="bg-destructive/20 border border-destructive/30 rounded-xl p-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-destructive">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <span className="font-bold block">AI Extraction Failed</span>
                <span className="text-sm text-destructive/80">Could not generate summary and action items.</span>
              </div>
            </div>
            <Button className="bg-destructive text-white hover:bg-destructive/90">Retry Analysis</Button>
          </div>
        )}

        {meeting.status === 'ready' && (
          <>
            {/* Followup Messages */}
            {(missingEmailCount > 0 || followupResults) && (
              <div className="flex flex-col gap-2">
                {missingEmailCount > 0 && !followupResults && (
                  <div className="flex items-center gap-2 p-3 bg-secondary/50 border border-border text-foreground rounded-xl text-sm font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Warning: {missingEmailCount} of {meeting.attendees.length} attendees have no email on file and will not receive follow-ups.
                  </div>
                )}
                {followupResults && (
                  <div className="flex flex-wrap gap-2">
                    {followupResults.map((r, i) => (
                      <Badge key={i} className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${r.sent ? 'bg-primary/10 text-primary-foreground border-none hover:bg-primary/20' : 'bg-destructive/10 text-destructive border-none hover:bg-destructive/10'}`} variant="secondary">
                        <span className="font-semibold mr-1">{r.attendee}:</span> {r.sent ? 'Sent' : r.skipped ? r.reason : `Failed — ${r.error}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}


            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left Column (2/3 width) */}
              <div className="lg:col-span-2 flex flex-col gap-6">

                {/* AI Summary Glass Card */}
                <div className="bg-card/70 backdrop-blur-md border border-border rounded-xl p-8 relative shadow-sm">
                  <div className="flex items-center gap-2 border-b border-border pb-4 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" />
                    </svg>
                    <h3 className="text-xl font-bold text-foreground">AI Summary</h3>
                  </div>
                  <p className="text-muted-foreground font-medium leading-relaxed whitespace-pre-wrap relative z-10">
                    {meeting.summary}
                  </p>
                </div>

                {/* Key Decisions */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col h-full">
                  <div className="flex items-center gap-2 border-b border-border pb-4 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                    <h3 className="text-xl font-bold text-foreground">Key Decisions</h3>
                  </div>

                  {meeting.decisions.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground font-medium italic min-h-[100px]">No key decisions recorded.</div>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {meeting.decisions.map((d, i) => (
                        <li key={i} className="flex gap-3 p-3 rounded-lg hover:bg-muted transition-colors group">
                          <div className="mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-foreground font-medium leading-relaxed">{d}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Commitments */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col h-full">
                  <div className="flex items-center gap-2 border-b border-border pb-4 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                    </svg>
                    <h3 className="text-xl font-bold text-foreground">Commitments</h3>
                  </div>

                  {commitments.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground font-medium italic min-h-[100px]">No verbal commitments detected.</div>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {commitments.map(c => (
                        <li key={c._id} className="flex gap-3 p-3 rounded-lg hover:bg-muted transition-colors group items-start">
                          <div className="mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-foreground font-medium leading-relaxed">
                              <strong className="text-primary">{c.madeBy.name}</strong> committed to: {c.commitment}
                            </p>
                            {c.deadline && <p className="text-xs text-muted-foreground mt-1 font-semibold">Due {new Date(c.deadline).toLocaleDateString()}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

              </div>

              {/* Right Column (1/3 width) */}
              <div className="flex flex-col gap-6">

                {/* Unresolved Issues */}
                {meeting.unresolvedIssues.length > 0 && (
                  <div className="bg-destructive/20 border border-destructive/20 rounded-xl p-6 border-l-[4px] border-l-[#ba1a1a]">
                    <div className="flex items-center gap-2 mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <h3 className="text-xl font-bold text-foreground">Unresolved Issues</h3>
                    </div>
                    <div className="flex flex-col gap-3">
                      {meeting.unresolvedIssues.map((issue, i) => (
                        <div key={i} className="bg-card rounded-lg p-3 border border-border shadow-sm">
                          <p className="text-sm font-medium text-foreground mb-2">{issue}</p>
                          <button className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                            Flag for review <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attendees (Instead of top contributors, matching the aesthetic) */}
                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Meeting Participants</h3>
                  <div className="flex flex-col gap-3">
                    {meeting.attendees.map((attendee, i) => (
                      <div key={i} className="flex items-center justify-between group cursor-pointer p-1.5 -mx-1.5 rounded-lg hover:bg-muted">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i % 3 === 0 ? 'bg-primary text-white' : i % 3 === 1 ? 'bg-secondary text-primary-foreground' : 'bg-secondary text-foreground'
                            }`}>
                            {attendee.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-foreground">{attendee.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          {attendee.email || 'No email'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw Transcript (Accordion style) */}
                <details className="bg-card border border-border rounded-xl overflow-hidden shadow-sm group [&_summary::-webkit-details-marker]:hidden">
                  <summary className="p-5 font-bold text-foreground cursor-pointer flex justify-between items-center bg-muted hover:bg-muted">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View Raw Transcript
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground transition duration-300 group-open:-rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </summary>
                  <div className="p-5 border-t border-border bg-card">
                    <div className="whitespace-pre-wrap font-mono text-xs max-h-96 overflow-y-auto text-muted-foreground leading-relaxed">
                      {meeting.rawTranscript}
                    </div>
                  </div>
                </details>

              </div>
            </div>

            {/* Action Items Full Width Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mt-6 mb-12">
              <div className="p-6 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center bg-muted gap-4">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <h3 className="text-xl font-bold text-foreground">Action Items ({actionItems.length})</h3>
                </div>
              </div>

              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-card text-xs font-semibold text-muted-foreground border-b border-border uppercase tracking-wider">
                      <th className="p-4 w-12 text-center">Status</th>
                      <th className="p-4 w-1/3">Task Description</th>
                      <th className="p-4 w-48">Assignee</th>
                      <th className="p-4 w-32">Due Date</th>
                      <th className="p-4 w-32 text-right">Integrations</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium text-foreground">
                    {actionItems.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-muted-foreground italic">No action items extracted.</td>
                      </tr>
                    ) : (
                      actionItems.map(item => (
                        <tr key={item._id} className="border-b border-border/50 hover:bg-muted transition-colors group">
                          <td className="p-4 text-center align-middle">
                            <Checkbox
                              checked={item.status === 'done'}
                              onCheckedChange={() => handleStatusToggle(item._id, item.status)}
                              className="mx-auto block"
                            />
                          </td>
                          <td className={`p-4 align-middle ${item.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                            {item.title}
                          </td>
                          <td className="p-4 align-middle">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-secondary text-foreground flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm border border-white">
                                {item.assignee?.name ? item.assignee.name.substring(0, 2).toUpperCase() : '?'}
                              </div>
                              <span className="truncate max-w-[120px]">{item.assignee?.name || 'Unassigned'}</span>
                            </div>
                          </td>
                          <td className="p-4 align-middle">
                            {item.deadline ? (
                              <span className={`px-2 py-1 rounded text-xs font-bold ${new Date(item.deadline) < new Date() && item.status !== 'done' ? 'text-destructive bg-destructive/10' : 'text-muted-foreground bg-secondary'}`}>
                                {new Date(item.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-4 align-middle text-right">
                            {item.pushedTo?.some(p => p.tool === 'jira') ? (
                              <a
                                href={item.pushedTo.find(p => p.tool === 'jira').externalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded text-xs font-bold text-primary hover:bg-secondary transition-colors shadow-sm ml-auto"
                                title="View in external tool"
                              >
                                View ↗
                              </a>
                            ) : isJiraConnected ? (
                              <button
                                onClick={() => handlePushToJira(item._id)}
                                className="inline-flex items-center gap-1px-3 py-1.5 bg-card border border-border rounded text-xs font-bold text-foreground hover:bg-muted transition-colors opacity-100 md:opacity-0 group-hover:opacity-100 ml-auto px-3"
                              >
                                + Jira
                              </button>
                            ) : (
                              <Link to="/dashboard/settings" className="text-xs text-muted-foreground hover:underline whitespace-nowrap">Connect Jira</Link>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}