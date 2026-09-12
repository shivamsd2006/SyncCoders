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
} from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  task: Task;
}

export const TaskCard: React.FC<Props> = ({ task }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (newStatus === task.status) return;

    setIsUpdating(true);
    try {
      await api.patch(`/tasks/${task.id}`, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update task status');
    } finally {
      setIsUpdating(false);
    }
  };

  const isDev = user?.role === 'DEVELOPER';

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md dark:border-slate-800 dark:bg-slate-900 transition-all duration-200">
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

          {task.isOverdue && task.status !== 'DONE' && (
            <span className="flex items-center space-x-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 rounded-full animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              <span>OVERDUE</span>
            </span>
          )}
        </div>

        <span
          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${getStatusBadge(
            task.status
          )}`}
        >
          {task.status.replace('_', ' ')}
        </span>
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
          <div className="flex items-center space-x-1 font-medium text-slate-700 dark:text-slate-300">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span>{task.assignee.name}</span>
          </div>
        )}
      </div>

      {/* Status Transition Selector */}
      <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400 flex items-center space-x-1">
          <ArrowRight className="h-3 w-3" />
          <span>Move to:</span>
        </span>

        <select
          value={task.status}
          disabled={isUpdating}
          onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
          className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
        >
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="IN_REVIEW">In Review</option>
          {/* If Dev, option DONE can either be enabled or PM only per answer 5.A */}
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
  );
};
