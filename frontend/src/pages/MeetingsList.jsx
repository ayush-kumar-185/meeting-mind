import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


export default function MeetingsList() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/meetings/${id}`);
      setMeetings(meetings.filter(m => m._id !== id));
    } catch (err) {
      console.error('Failed to delete meeting', err);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    api.get('/meetings')
      .then(res => setMeetings(res.data.meetings))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-[#5b21b6]" />
    </div>
  );

  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 mt-12 bg-[#f8f9ff] rounded-2xl border border-dashed border-[#ccc3d6]">
        <h2 className="text-xl font-bold text-[#0b1c30] mb-2">No meetings yet</h2>
        <p className="text-[#4a4453] mb-6 font-medium">Paste a transcript to get started.</p>
        <Button className="bg-[#5b21b6] text-white font-medium hover:bg-[#4a1b9b]" onClick={() => navigate('/dashboard/new')}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Meeting
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-[1280px] mx-auto p-6 lg:p-10 flex flex-col gap-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#ccc3d6]/50 pb-4 mb-2">
        <div>
          <h2 className="text-3xl font-bold text-[#0b1c30] tracking-tight">Recent Meetings</h2>
          <p className="text-[#4a4453] text-sm mt-1">Review transcripts, summaries, and pending action items.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button 
            className="bg-[#5b21b6] text-white font-medium shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:bg-[#4a1b9b] w-full sm:w-auto px-4"
            onClick={() => navigate('/dashboard/new')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Meeting
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {meetings.map(m => (
          <div key={m._id} className="relative group">
          <Card 
            onClick={() => navigate(`/dashboard/meetings/${m._id}`)}
            className={`h-full shadow-[0_2px_5px_-1px_rgba(0,0,0,0.05)] transition-all hover:bg-[#eff4ff] cursor-pointer ${m.status === 'failed' ? 'border-l-4 border-l-[#ba1a1a] border-y border-r border-[#ccc3d6]' : 'border border-[#ccc3d6] hover:border-[#5b21b6]'}`}
          >
            <CardContent className="p-6 flex flex-col gap-4 w-full">
              <div className="flex justify-between items-start mb-2 w-full gap-2">
                <div className="flex flex-col text-left">
                  <h3 className="text-lg font-bold text-[#0b1c30] mb-1 line-clamp-1">{m.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-[#4a4453]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{new Date(m.date).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="shrink-0">
                  {m.status === 'ready' ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ebddff] text-[#250059] border border-[#d3bbff]">
                      Ready
                    </span>
                  ) : m.status === 'failed' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Failed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e5eeff] text-[#0b1c30] border border-[#ccc3d6]">
                      <span className="w-2 h-2 rounded-full bg-[#5b21b6] animate-pulse"></span>
                      Processing
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-2 pt-4 border-t border-[#ccc3d6]/50">
                <div className="text-sm font-medium text-[#4a4453] bg-[#f8f9ff] px-2 py-1 rounded-md border border-[#ccc3d6]/50">
                  {m.attendees.length} attendees
                </div>
                
                {m.status === 'ready' && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[#4a4453]">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-medium">Actions</span>
                    </div>
                  </div>
                )}
                {m.status === 'processing' && (
                  <div className="w-25 bg-[#e5eeff] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#5b21b6] h-1.5 rounded-full w-[65%]"></div>
                  </div>
                )}
              </div>
            </CardContent>

          </Card>
          <AlertDialog>
              <AlertDialogTrigger
                className="absolute top-3 right-3 text-muted-foreground hover:text-red-600"
                render={<Button variant="ghost" size="icon" />}
              >
                <Trash2 size={16} />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete "{m.title}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the meeting along with all its extracted action items and commitments. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDelete(m._id)}
                    disabled={deletingId === m._id}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deletingId === m._id ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
      </div>
    </div>
  );
}