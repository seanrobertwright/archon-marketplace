import { useMemo, useState } from 'react';
import { Search, ShieldCheck, Star } from 'lucide-react';

export interface LeaderboardItem {
  id: string;
  name: string;
  description: string;
  owner: string;
  repo: string;
  installCount: number;
  stars?: number;
  securityScore?: number;
}

interface LeaderboardProps {
  items: LeaderboardItem[];
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function Leaderboard({ items }: LeaderboardProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.owner.toLowerCase().includes(q) ||
        i.repo.toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <section className="w-full max-w-3xl mx-auto">
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted-foreground)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search workflows..."
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-muted)] border border-[var(--color-border)] rounded-md text-sm font-mono placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        />
      </div>

      <div className="border-t border-[var(--color-border)]">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--color-muted-foreground)] font-mono">
            No workflows match "{query}"
          </div>
        ) : (
          filtered.map((item, idx) => (
            <a
              key={item.id}
              href={`https://github.com/${item.owner}/${item.repo}`}
              target="_blank"
              rel="noreferrer"
              className="group grid grid-cols-[3rem_1fr_auto] gap-4 items-center py-3.5 px-2 border-b border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors"
            >
              <span className="font-mono text-sm text-[var(--color-muted-foreground)] tabular-nums">
                #{String(idx + 1).padStart(2, '0')}
              </span>

              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[15px] font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-accent)] transition-colors truncate">
                    {item.owner}/{item.repo}
                  </span>
                  {typeof item.securityScore === 'number' && item.securityScore >= 80 && (
                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
                  )}
                </div>
                <p className="text-sm text-[var(--color-muted-foreground)] truncate">
                  {item.description}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-[var(--color-muted-foreground)] tabular-nums">
                {typeof item.stars === 'number' && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    {formatCount(item.stars)}
                  </span>
                )}
                <span className="text-[var(--color-foreground)] font-semibold">
                  {formatCount(item.installCount)}
                </span>
              </div>
            </a>
          ))
        )}
      </div>
    </section>
  );
}
