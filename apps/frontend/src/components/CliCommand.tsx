import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CliCommandProps {
  command: string;
}

export function CliCommand({ command }: CliCommandProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="inline-flex items-center gap-3 px-4 py-2.5 border border-[var(--color-border)] bg-[var(--color-muted)] rounded-md font-mono text-sm">
      <span className="text-[var(--color-muted-foreground)]">$</span>
      <span className="text-[var(--color-foreground)]">{command}</span>
      <button
        onClick={onCopy}
        aria-label="Copy command"
        className="ml-2 p-1 rounded text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-border)] transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
