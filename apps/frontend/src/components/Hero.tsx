import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

export function Hero() {
  const [copied, setCopied] = useState(false);
  const command = "archon add user/workflow";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-24 px-6 flex flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
          The Open Archon <br /> Workflow Ecosystem
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
          Discover, share, and install production-grade AI workflows with a single command. 
          Vetted by a multi-stage security scoring pipeline.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <div 
          onClick={copyToClipboard}
          className="group relative cursor-pointer bg-black text-white dark:bg-zinc-900 rounded-xl p-4 font-mono text-sm md:text-base flex items-center justify-between border border-zinc-800 hover:border-accent transition-all shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <span className="text-zinc-500">$</span>
            <span>{command}</span>
          </div>
          {copied ? (
            <Check className="w-5 h-5 text-green-500" />
          ) : (
            <Copy className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
          )}
          
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-accent text-white px-3 py-1 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Click to copy
          </div>
        </div>
      </motion.div>
    </section>
  );
}
