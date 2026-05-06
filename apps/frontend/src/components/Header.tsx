import { Search, Plus, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
  onOpenSubmission: () => void;
}

export function Header({ onOpenSubmission }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border glass px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-black dark:bg-white rounded-md flex items-center justify-center">
          <ShieldCheck className="text-white dark:text-black w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Archon Marketplace</h1>
      </div>

      <nav className="hidden md:flex items-center gap-6">
        <a href="#" className="text-sm font-medium hover:text-accent transition-colors">Workflows</a>
        <a href="#" className="text-sm font-medium hover:text-accent transition-colors">Node Types</a>
        <a href="#" className="text-sm font-medium hover:text-accent transition-colors">Docs</a>
      </nav>

      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search workflows..." 
            className="pl-10 pr-4 py-2 bg-muted border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-accent w-64"
          />
        </div>
        <button 
          onClick={onOpenSubmission}
          className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Submit
        </button>
      </div>
    </header>
  );
}
