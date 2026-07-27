import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    api.get('/workspaces')
      .then(res => setWorkspaces(res.data.workspaces))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { workspaces, loading, hasWorkspace: workspaces.length > 0, refresh };
}