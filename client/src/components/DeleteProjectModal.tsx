import React, { useState } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { api } from '../api/client.js';
import { useQueryClient } from '@tanstack/react-query';
import { getCleanErrorMessage } from '../utils/errors.js';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    title: string;
  } | null;
  onSuccess?: () => void;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !project) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const res = await api.delete(`/projects/${project.id}`);
      if (res.data.success) {
        // Invalidate relevant queries so UI reflects deletion immediately
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['projects'] }),
          queryClient.invalidateQueries({ queryKey: ['stats'] }),
          queryClient.invalidateQueries({ queryKey: ['tasks'] }),
          queryClient.invalidateQueries({ queryKey: ['activity'] }),
        ]);

        onSuccess?.();
        onClose();
      } else {
        setError('Request is not acceptable');
      }
    } catch (err: any) {
      setError(getCleanErrorMessage(err, 'Failed to delete project. Please check permissions.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-900/50 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Project
              </h3>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                Irreversible Action
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="mt-4 flex items-start space-x-2.5 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>
            This action will delete <strong>"{project.title}"</strong> and all associated tasks.
          </span>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md shadow-rose-500/25 transition-all disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Deleting Project...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Completely Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
