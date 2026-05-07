import { Moon, Sun, Plus } from 'lucide-react';
import { useTheme } from '../lib/theme';

interface HeaderProps {
  onOpenSubmission: () => void;
}

export function Header({ onOpenSubmission }: HeaderProps) {
  const { theme, toggle } = useTheme();

  return (
    <header className="w-full border-b border-[var(--color-border)] bg-[var(--color-background)]">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="/" className="font-mono text-sm font-semibold tracking-tight text-[var(--color-foreground)]">
          archon
        </a>

        <nav className="flex items-center gap-6">
          <a
            href="https://github.com"
            className="hidden sm:inline font-mono text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
          >
            github
          </a>
          <a
            href="#"
            className="hidden sm:inline font-mono text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
          >
            docs
          </a>

          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="p-1.5 rounded text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenSubmission}
            className="font-mono text-xs px-3 py-1.5 border border-[var(--color-foreground)] text-[var(--color-foreground)] hover:bg-[var(--color-foreground)] hover:text-[var(--color-background)] transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3 h-3" />
            submit
          </button>
        </nav>
      </div>
    </header>
  );
}
