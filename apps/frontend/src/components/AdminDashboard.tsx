import { useState, useEffect } from 'react';
import { Users, Shield, Package, Check, X, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'workflows' | 'users'>('workflows');
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'workflows') {
        const res = await axios.get('http://localhost:4000/admin/quarantined-workflows', { withCredentials: true });
        setWorkflows(res.data);
      } else {
        const res = await axios.get('http://localhost:4000/admin/pending-users', { withCredentials: true });
        setUsers(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch admin data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const resolveUser = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await axios.post(`http://localhost:4000/admin/users/${id}/resolve`, { status }, { withCredentials: true });
      fetchData();
    } catch (err) {
      alert('Failed to resolve user');
    }
  };

  const resolveWorkflow = async (id: string, status: 'PUBLISHED' | 'REJECTED') => {
    try {
      await axios.post(`http://localhost:4000/admin/workflows/${id}/resolve`, { status }, { withCredentials: true });
      fetchData();
    } catch (err) {
      alert('Failed to resolve workflow');
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 pt-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Admin Control Panel</h2>
            <p className="text-muted-foreground text-sm mt-1">Manage users, workflows, and security reviews.</p>
          </div>
          <div className="flex bg-white dark:bg-zinc-950 border border-border p-1 rounded-xl shadow-sm">
            <button 
              onClick={() => setActiveTab('workflows')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'workflows' ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-muted"
              )}
            >
              <Shield className="w-4 h-4" />
              Workflows ({workflows.length})
            </button>
            <button 
              onClick={() => setActiveTab('users')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'users' ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-muted"
              )}
            >
              <Users className="w-4 h-4" />
              Users ({users.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground font-medium">Loading control panel...</p>
          </div>
        ) : activeTab === 'workflows' ? (
          <div className="grid gap-4">
            {workflows.length === 0 && (
              <div className="bg-white dark:bg-zinc-950 border border-border p-12 text-center rounded-2xl">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground font-medium">No workflows awaiting review.</p>
              </div>
            )}
            {workflows.map(wf => (
              <div key={wf.id} className="bg-white dark:bg-zinc-950 border border-border p-6 rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center border border-orange-100 font-bold">
                    {wf.securityScore}
                  </div>
                  <div>
                    <h4 className="font-bold">{wf.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Submitted by {wf.author.username} • {wf.owner}/{wf.repo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => resolveWorkflow(wf.id, 'PUBLISHED')}
                    className="p-2 bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => resolveWorkflow(wf.id, 'REJECTED')}
                    className="p-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {users.length === 0 && (
              <div className="bg-white dark:bg-zinc-950 border border-border p-12 text-center rounded-2xl">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground font-medium">No pending registration requests.</p>
              </div>
            )}
            {users.map(u => (
              <div key={u.id} className="bg-white dark:bg-zinc-950 border border-border p-6 rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <img src={u.avatarUrl} className="w-12 h-12 rounded-full border border-border" alt={u.username} />
                  <div>
                    <h4 className="font-bold">@{u.username}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 tracking-wide uppercase font-bold text-accent">Developer Request</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => resolveUser(u.id, 'APPROVED')}
                    className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    Approve Access
                  </button>
                  <button 
                    onClick={() => resolveUser(u.id, 'REJECTED')}
                    className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-bold hover:bg-border transition-colors"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
