import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { AsciiLogo } from './components/AsciiLogo';
import { CliCommand } from './components/CliCommand';
import { Leaderboard, type LeaderboardItem } from './components/Leaderboard';
import { SubmissionModal } from './components/SubmissionModal';
import { AdminDashboard } from './components/AdminDashboard';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from './lib/api';

const DUMMY_WORKFLOWS: LeaderboardItem[] = [
  {
    id: '1',
    name: 'GitHub Issue Auto-Triage',
    description: 'Automatically labels and assigns GitHub issues based on content using AI analysis.',
    owner: 'archon-community',
    repo: 'issue-triage',
    securityScore: 95,
    installCount: 12400,
    stars: 450,
  },
  {
    id: '2',
    name: 'TypeScript API Generator',
    description: 'Scans your database schema and generates a complete TypeScript Express API with validation.',
    owner: 'vercel-labs',
    repo: 'api-gen',
    securityScore: 88,
    installCount: 8900,
    stars: 320,
  },
];

function MarketplaceHome({ user, onRefreshUser }: { user: any; onRefreshUser: () => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
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
          <Leaderboard items={DUMMY_WORKFLOWS} />
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
        onRefreshUser={onRefreshUser}
      />
    </div>
  );
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MarketplaceHome user={user} onRefreshUser={fetchUser} />} />
        <Route
          path="/admin"
          element={user?.isAdmin ? <AdminDashboard /> : <Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
