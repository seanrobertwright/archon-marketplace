import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Loader2, Github, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const submissionSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  owner: z.string().min(1, 'GitHub owner is required'),
  repo: z.string().min(1, 'GitHub repository is required'),
  path: z.string().optional().default('archon.yaml'),
});

type SubmissionForm = z.infer<typeof submissionSchema>;

interface SubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubmissionModal({ isOpen, onClose }: SubmissionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<SubmissionForm>({
    resolver: zodResolver(submissionSchema)
  });

  if (!isOpen) return null;

  const onSubmit = async (data: SubmissionForm) => {
    setLoading(true);
    setError(null);
    try {
      // In a real app, this would hit our backend
      // For the demo, we log the intent
      console.log('Submitting workflow:', data);
      await axios.post('http://localhost:4000/workflows', data, { withCredentials: true });
      reset();
      onClose();
      alert('Workflow submitted! It will appear after security evaluation.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit workflow. Make sure you are logged in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-950 border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-xl font-bold">Submit Workflow</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold">Workflow Name</label>
            <input 
              {...register('name')}
              placeholder="e.g. Docker Image Optimizer"
              className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Description</label>
            <textarea 
              {...register('description')}
              placeholder="What does this workflow do?"
              className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent h-24"
            />
            {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Github className="w-3.5 h-3.5" /> GitHub Owner
              </label>
              <input 
                {...register('owner')}
                placeholder="e.g. vercel"
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {errors.owner && <p className="text-xs text-red-500">{errors.owner.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Github className="w-3.5 h-3.5" /> Repository
              </label>
              <input 
                {...register('repo')}
                placeholder="e.g. ai-sdk"
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {errors.repo && <p className="text-xs text-red-500">{errors.repo.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">YAML Path (optional)</label>
            <input 
              {...register('path')}
              placeholder="archon.yaml"
              className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing Security...
              </>
            ) : (
              'Submit for Evaluation'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
