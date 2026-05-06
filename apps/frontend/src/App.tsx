import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { WorkflowCard } from './components/WorkflowCard';

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
  },
  {
    id: '3',
    name: 'Docker Image Optimizer',
    description: 'Multi-stage build analyzer that suggests optimizations to reduce Docker image size by up to 80%.',
    owner: 'docker',
    repo: 'optimizer',
    securityScore: 92,
    installCount: 45000,
    stars: 1200,
    author: {
      username: 'docker',
      avatarUrl: 'https://github.com/docker.png'
    }
  },
  {
    id: '4',
    name: 'PR Description Assistant',
    description: 'Generates detailed pull request descriptions by analyzing git diffs and commit messages.',
    owner: 'anthropic',
    repo: 'pr-help',
    securityScore: 75,
    installCount: 3400,
    stars: 88,
    author: {
      username: 'anthropic',
      avatarUrl: 'https://github.com/anthropic.png'
    }
  }
];

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      
      <main className="max-w-7xl mx-auto px-6 pb-24">
        <Hero />
        
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Trending Workflows</h2>
          <div className="flex gap-2">
            <button className="px-4 py-1.5 text-xs font-bold bg-black text-white dark:bg-white dark:text-black rounded-full">All Time</button>
            <button className="px-4 py-1.5 text-xs font-bold bg-muted hover:bg-border transition-colors rounded-full">Trending</button>
            <button className="px-4 py-1.5 text-xs font-bold bg-muted hover:bg-border transition-colors rounded-full">New</button>
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
    </div>
  );
}

export default App;
