import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { Header } from './Header';
import { AsciiLogo } from './AsciiLogo';
import { CliCommand } from './CliCommand';
import { Leaderboard, type LeaderboardItem } from './Leaderboard';
import { SubmissionModal } from './SubmissionModal';
import { API_URL } from '../lib/api';

export function HomeIsland() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [workflows, setWorkflows] = useState<LeaderboardItem[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [workflowsError, setWorkflowsError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const res = await axios.get(`${API_URL}/workflows`);
      const items: LeaderboardItem[] = res.data.map((w: any) => ({
        id: w.id,
        name: w.name,
        description: w.description ?? '',
        owner: w.owner,
        repo: w.repo,
        installCount: w.installCount,
        stars: w._count?.stars,
        securityScore: w.securityScore,
      }));
      setWorkflows(items);
    } catch {
      setWorkflowsError('Failed to load workflows');
    } finally {
      setWorkflowsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchWorkflows();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  return (
    <>
      <Header onOpenSubmission={() => setIsModalOpen(true)} />
      <main className="max-w-5xl mx-auto px-6">
        <section className="pt-20 pb-16 flex flex-col items-center text-center">
          <AsciiLogo />
          <p className="mt-8 text-[var(--color-muted-foreground)] font-mono text-sm">
            The Open Workflow Ecosystem
          </p>
          <div className="mt-8">
            <CliCommand command="archon add owner/repo" />
          </div>
        </section>
        <section className="pb-24">
          {workflowsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)]" />
            </div>
          ) : workflowsError ? (
            <div className="font-mono text-sm text-red-500 text-center py-12">
              {workflowsError}
            </div>
          ) : (
            <Leaderboard items={workflows} />
          )}
        </section>
      </main>
      <footer className="border-t border-[var(--color-border)] py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between font-mono text-xs text-[var(--color-muted-foreground)]">
          <span>archon — open workflow ecosystem</span>
          <span>{user ? `@${user.username}` : 'anonymous'}</span>
        </div>
      </footer>
      <SubmissionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={user}
        onRefreshUser={fetchUser}
      />
    </>
  );
}
