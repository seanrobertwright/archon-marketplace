import { Shield, Star, Download, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

interface WorkflowCardProps {
  workflow: {
    id: string;
    name: string;
    description: string;
    owner: string;
    repo: string;
    securityScore: number;
    installCount: number;
    stars: number;
    author: {
      username: string;
      avatarUrl: string;
    };
  };
  index: number;
}

export function WorkflowCard({ workflow, index }: WorkflowCardProps) {
  const isVerified = workflow.securityScore >= 80;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index, duration: 0.4 }}
      className="group relative bg-white dark:bg-zinc-950 border border-border rounded-2xl p-6 hover:shadow-xl hover:border-accent/30 transition-all flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
            {workflow.author.avatarUrl ? (
              <img src={workflow.author.avatarUrl} alt={workflow.author.username} className="w-full h-full object-cover" />
            ) : (
              <div className="bg-accent text-white font-bold">{workflow.author.username[0].toUpperCase()}</div>
            )}
          </div>
          {isVerified && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">
              <Shield className="w-3 h-3" />
              Verified Safe
            </div>
          )}
        </div>

        <h3 className="text-lg font-bold mb-2 group-hover:text-accent transition-colors">
          {workflow.name}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-6 leading-relaxed">
          {workflow.description}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
          <div className="flex items-center gap-1">
            <Download className="w-3.5 h-3.5" />
            {workflow.installCount.toLocaleString()}
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5" />
            {workflow.stars}
          </div>
          <div className="flex items-center gap-1 text-accent">
            <ExternalLink className="w-3.5 h-3.5" />
            {workflow.owner}/{workflow.repo}
          </div>
        </div>

        <button className="w-full py-2.5 bg-muted hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all rounded-lg text-sm font-bold border border-border">
          View Workflow
        </button>
      </div>
    </motion.div>
  );
}
