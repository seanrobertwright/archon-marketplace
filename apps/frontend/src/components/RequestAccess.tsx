import { useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../lib/api';

interface RequestAccessProps {
  onSuccess: () => void;
}

export function RequestAccess({ onSuccess }: RequestAccessProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async () => {
    setLoading(true);
    setError(null);
    try {
      await axios.post(`${API_URL}/auth/request-access`, {}, { withCredentials: true });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request access.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 text-center space-y-6">
      <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto">
        <ShieldCheck className="w-8 h-8" />
      </div>
      <div>
        <h3 className="text-xl font-bold mb-2">Developer Access Required</h3>
        <p className="text-sm text-muted-foreground">
          To maintain a high security standard, we require users to be approved before they can submit workflows to the marketplace.
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>
      )}

      <button 
        onClick={handleRequest}
        disabled={loading}
        className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Request Developer Access'}
      </button>
      
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
        Expect a response within 24-48 hours
      </p>
    </div>
  );
}
