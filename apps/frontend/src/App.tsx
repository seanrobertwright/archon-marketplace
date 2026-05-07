import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { WorkflowCard } from './components/WorkflowCard';
import { SubmissionModal } from './components/SubmissionModal';
import { AdminDashboard } from './components/AdminDashboard';
import { Plus, Loader2 } from 'lucide-react';
import axios from 'axios';

const DUMMY_WORKFLOWS = [
  {
    id: '1',
    name: 'GitHub Issue Auto-Triage',
    description: 'Automatically labels and assigns GitHub issues based on content using AI analysis.',
    owner: 'archon-community',
    repo: 'issue-triage',
    securityScore: 95,
    installCount: 12400,
    stars: 450,
    author: {
      username: 'archon',
      avatarUrl: 'https://github.com/github.png'
    }
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
    author: {
      username: 'vercel',
      avatarUrl: 'https://github.com/vercel.png'
    }
  }
];

function MarketplaceHome({ user, onRefreshUser }: { user: any, onRefreshUser: () => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onOpenSubmission={() => setIsModalOpen(true)} />
      
      <main className="max-w-7xl mx-auto px-6 pb-24">
        <Hero />
        
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Trending Workflows</h2>
          <div className="flex gap-4">
            <div className="flex gap-2">
              <button className="px-4 py-1.5 text-xs font-bold bg-black text-white dark:bg-white dark:text-black rounded-full">All Time</button>
              <button className="px-4 py-1.5 text-xs font-bold bg-muted hover:bg-border transition-colors rounded-full">Trending</button>
              <button className="px-4 py-1.5 text-xs font-bold bg-muted hover:bg-border transition-colors rounded-full">New</button>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-accent text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-accent-hover transition-colors flex items-center gap-1.5 shadow-lg shadow-accent/20"
            >
              <Plus className="w-3.5 h-3.5" />
              {user?.submissionStatus === 'APPROVED' ? 'Submit Workflow' : 'Request Access'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {DUMMY_WORKFLOWS.map((workflow, i) => (
            <WorkflowCard key={workflow.id} workflow={workflow} index={i} />
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-12 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; 2026 Archon Workflow Marketplace. Built for the future of agentic workflows.
        </p>
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
      const response = await axios.get('http://localhost:4000/auth/me', { withCredentials: true });
      setUser(response.data);
    } catch (err) {
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
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
