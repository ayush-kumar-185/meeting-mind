import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const typeLabels = {
  recurring_blocker: 'Recurring Blocker',
  unresolved_topic: 'Unresolved Topic',
  repeated_commitment: 'Repeated Commitment',
};

const mapPatternTypeStyles = (type) => {
  switch(type) {
    case 'recurring_blocker':
      return {
        badgeBg: 'bg-[#ffdad6]',
        badgeText: 'text-[#93000a]',
        borderL: 'border-l-[3px] border-l-[#ba1a1a]',
        cornerBg: 'bg-[#ba1a1a]/5',
        icon: 'warning'
      };
    case 'unresolved_topic':
      return {
        badgeBg: 'bg-[#e5eeff]',
        badgeText: 'text-[#0b1c30]',
        borderL: 'border-l-[3px] border-l-[#420093]',
        cornerBg: 'bg-[#420093]/5',
        icon: 'description'
      };
    case 'repeated_commitment':
    default:
      return {
        badgeBg: 'bg-[#464476]',
        badgeText: 'text-white',
        borderL: 'border-l-[3px] border-l-[#302d5d]',
        cornerBg: 'bg-[#302d5d]/5',
        icon: 'lightbulb'
      };
  }
};

export default function Patterns() {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [message, setMessage] = useState(null);

  const loadPatterns = () => {
    api.get('/patterns').then(res => setPatterns(res.data.patterns)).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPatterns();
    api.get('/workspaces').then(res => {
      if (res.data.workspaces.length) setWorkspaceId(res.data.workspaces[0]._id);
    });
  }, []);

  const handleScanNow = async () => {
    if (!workspaceId) return;
    setScanning(true);
    setMessage(null);
    try {
      const res = await api.post(`/patterns/scan/${workspaceId}`);
      if (res.data.skipped) {
        setMessage({ type: 'warning', text: res.data.reason });
      } else {
        setMessage({ type: 'success', text: 'Scan completed successfully.' });
        loadPatterns();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Scan failed' });
    } finally {
      setScanning(false);
    }
  };

  const handleResolve = async (id) => {
    try {
      await api.patch(`/patterns/${id}/resolve`);
      // Update UI by filtering out the resolved pattern (or we could show it as resolved)
      setPatterns(prev => prev.filter(p => p._id !== id));
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to resolve pattern' });
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-[600px] w-full">
      <Loader2 className="w-8 h-8 animate-spin text-[#5b21b6]" />
    </div>
  );

  return (
    <div className="flex-1 p-4 md:p-8 w-full max-w-[1280px] mx-auto font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-[#0b1c30] tracking-tight mb-2">Cross-Meeting Patterns</h1>
          <p className="text-[#4a4453] font-medium mt-1">AI-detected recurring topics and blockages across your workspace.</p>
        </div>
        <Button 
          className="bg-[#420093] text-white px-6 py-2.5 h-auto rounded-lg font-semibold hover:bg-[#340073] transition-colors flex items-center gap-2 shadow-sm"
          onClick={handleScanNow} 
          disabled={scanning}
        >
          {scanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning...
            </>
          ) : (
            'Scan Now'
          )}
        </Button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-medium border mb-8 flex items-center gap-3 ${
          message.type === 'error' ? 'bg-[#ffdad6]/30 text-[#ba1a1a] border-[#ffdad6]' : 
          message.type === 'warning' ? 'bg-[#dce9ff]/50 text-[#0b1c30] border-[#dce9ff]' :
          'bg-[#e3dfff]/50 text-[#181445] border-[#e3dfff]'
        }`}>
          {message.text}
        </div>
      )}

      {patterns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 mt-4 bg-[#f8f9ff] rounded-2xl border-2 border-dashed border-[#ccc3d6]">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[#7b7485] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
           </svg>
          <h2 className="text-xl font-bold text-[#0b1c30] mb-2">No patterns detected</h2>
          <p className="text-[#4a4453] font-medium text-center max-w-md">
            Needs at least 3 processed meetings. Runs automatically every Monday, or click "Scan Now."
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {patterns.map(p => {
            const styles = mapPatternTypeStyles(p.type);
            return (
              <div key={p._id} className={`bg-white border border-[#ccc3d6] rounded-xl p-6 flex flex-col hover:shadow-sm transition-shadow relative overflow-hidden group ${styles.borderL}`}>
                {/* Decorative corner */}
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full -z-0 transition-transform group-hover:scale-110 ${styles.cornerBg}`}></div>
                
                <div className="relative z-10 flex justify-between items-start mb-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${styles.badgeBg} ${styles.badgeText}`}>
                    {typeLabels[p.type] || p.type}
                  </span>
                  
                  <span className="text-xs font-medium text-[#4a4453] flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-[#7b7485]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Mentioned in {p.meetingIds.length} meetings
                  </span>
                </div>
                
                <h3 className="text-2xl font-bold text-[#0b1c30] mb-3 relative z-10">{p.description.split('.')[0]}</h3>
                <p className="text-sm font-medium text-[#4a4453] flex-1 mb-8 relative z-10 leading-relaxed">
                  {p.description}
                </p>
                
                <div className="flex justify-between items-center mt-auto pt-5 border-t border-[#ccc3d6]/70 relative z-10">
                  <div className="flex -space-x-2">
                     <div className="w-8 h-8 rounded-full border-2 border-white bg-[#e0e3e5] flex items-center justify-center text-xs font-bold text-[#191c1e]">
                        {p.meetingIds.length}
                     </div>
                     <div className="w-8 h-8 rounded-full border-2 border-white bg-[#5b21b6] flex items-center justify-center text-xs font-bold text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                     </div>
                  </div>
                  <button 
                    onClick={() => handleResolve(p._id)}
                    className="text-[#420093] hover:text-[#340073] text-sm font-bold flex items-center gap-1 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Mark Resolved
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}