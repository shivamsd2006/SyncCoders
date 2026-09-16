import React, { useState } from 'react';
import { Task, TaskPriority, TaskStatus } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api/client.js';
import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  AlertTriangle,
  User,
  CheckCircle2,
  Clock,
  ArrowRight,
  RotateCcw,
  X,
  Edit3,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { EditTaskModal } from './EditTaskModal.js';
import { DeleteTaskModal } from './DeleteTaskModal.js';
import { UserAvatar } from './UserAvatar.js';

interface Props {
  task: Task;
}

export const TaskCard: React.FC<Props> = ({ task }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const isOverdueActive = task.isOverdue && task.status !== 'DONE';

  const getPriorityStyle = (priority: TaskPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50';
      case 'MEDIUM':
        return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-900/50';
      case 'LOW':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800';
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'TODO':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
      case 'IN_REVIEW':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
      case 'DONE':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
    }
  };

  const executeStatusUpdate = async (newStatus: TaskStatus, reason?: string) => {
    setIsUpdating(true);
    try {
      await api.patch(`/tasks/${task.id}`, {
        status: newStatus,
        ...(reason ? { rejectionReason: reason } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setIsRejectionModalOpen(false);
      setRejectionReason('');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update task status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (newStatus === task.status) return;

    // Decision 2-A & 3-B: If moving from IN_REVIEW -> IN_PROGRESS, require reason modal
    if (task.status === 'IN_REVIEW' && newStatus === 'IN_PROGRESS') {
      setIsRejectionModalOpen(true);
      return;
    }

    await executeStatusUpdate(newStatus);
  };

  const isDev = user?.role === 'DEVELOPER';

  return (
    <>
      <div
        className={`group rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all duration-200 ${
          isOverdueActive
            ? 'border-rose-300 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30 ring-1 ring-rose-400/30'
            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
        }`}
      >
        {/* Top badges */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center space-x-2">
            <span
              className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${getPriorityStyle(
                task.priority
              )}`}
            >
              {task.priority}
            </span>

            {isOverdueActive && (
              <span className="flex items-center space-x-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 rounded-full animate-pulse">
                <AlertTriangle className="h-3 w-3" />
                <span>OVERDUE</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            {!isDev && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                title="Edit Task Details"
                className="p-1 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-sky-400 transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              title="Delete Task"
              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${getStatusBadge(
                task.status
              )}`}
            >
              {task.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Task Content */}
        <div className="pt-3 space-y-1.5">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
            {task.title}
          </h4>
          {task.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              {task.description}
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span>Due {format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
          </div>

          {task.assignee && (
            <div
              className="flex items-center space-x-1.5 font-medium text-slate-700 dark:text-slate-300"
              title={`${task.assignee.name}${task.assignee.username ? ` (@${task.assignee.username})` : ''}${task.assignee.headline ? ` • ${task.assignee.headline}` : ''}`}
            >
              <UserAvatar
                name={task.assignee.name}
                avatarUrl={task.assignee.avatarUrl}
                size="xs"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold leading-tight">{task.assignee.name}</span>
                {task.assignee.headline && (
                  <span className="text-[10px] text-slate-400 leading-tight truncate max-w-[120px]">
                    {task.assignee.headline}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Transition Selector */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-400 flex items-center space-x-1">
            <ArrowRight className="h-3 w-3" />
            <span>Move to:</span>
          </span>

          <div className="flex items-center space-x-2">
            {/* PM/Admin quick button to request changes on review tasks */}
            {!isDev && task.status === 'IN_REVIEW' && (
              <button
                type="button"
                onClick={() => setIsRejectionModalOpen(true)}
                className="flex items-center space-x-1 text-[11px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-2 py-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Request Changes</span>
              </button>
            )}

            <select
              value={task.status}
              disabled={isUpdating}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              {!isDev ? (
                <option value="DONE">Done (PM/Admin)</option>
              ) : (
                <option value="DONE" disabled>
                  Done (PM review req.)
                </option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Decision 3-B: Rejection Reason Modal */}
      {isRejectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Request Changes
                </h3>
              </div>
              <button
                onClick={() => setIsRejectionModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Move &ldquo;{task.title}&rdquo; back to <strong>In Progress</strong>. Please state what needs improvement so the developer can address it.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Rejection Reason / Feedback *
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Unit tests missing edge case for offline timeout. Please add coverage."
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="mt-5 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsRejectionModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdating || !rejectionReason.trim()}
                onClick={() => executeStatusUpdate('IN_PROGRESS', rejectionReason.trim())}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md shadow-rose-500/20 transition-all disabled:opacity-50"
              >
                {isUpdating ? 'Sending...' : 'Reject & Return to Dev'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {isEditModalOpen && (
        <EditTaskModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          task={task}
        />
      )}

      {/* Delete Task Modal */}
      {isDeleteModalOpen && (
        <DeleteTaskModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          task={task}
        />
      )}
    </>
  );
};
