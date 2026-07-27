import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

export function useMeeting(meetingId) {
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMeeting() {
      try {
        const res = await api.get(`/meetings/${meetingId}`);
        if (cancelled) return;

        setMeeting(res.data.meeting);
        setLoading(false);

        // Stop polling once processing is done
        if (res.data.meeting.status !== 'processing' && intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.error || 'Failed to load meeting');
        setLoading(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }

    fetchMeeting(); // initial fetch
    intervalRef.current = setInterval(fetchMeeting, 3000); // poll every 3s while processing

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [meetingId]);

  return { meeting, loading, error };
}