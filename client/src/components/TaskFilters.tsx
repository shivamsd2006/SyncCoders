import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, RotateCcw } from 'lucide-react';
import { TaskPriority, TaskStatus } from '../types/index.js';

export const TaskFilters: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentStatus = searchParams.get('status') || '';
  const currentPriority = searchParams.get('priority') || '';
  const currentOverdue = searchParams.get('isOverdue') || '';

  const updateFilter = (key: string, value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
    setSearchParams(nextParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = Boolean(currentStatus || currentPriority || currentOverdue);

  return (
    <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-colors">
      <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <Filter className="h-4 w-4 text-sky-500" />
        <span>Filters (URL Synced):</span>
      </div>

      {/* Status Filter */}
      <select
        value={currentStatus}
        onChange={(e) => updateFilter('status', e.target.value)}
        className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
      >
        <option value="">All Statuses</option>
        <option value="TODO">To Do</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="IN_REVIEW">In Review</option>
        <option value="DONE">Done</option>
      </select>

      {/* Priority Filter */}
      <select
        value={currentPriority}
        onChange={(e) => updateFilter('priority', e.target.value)}
        className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
      >
        <option value="">All Priorities</option>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>

      {/* Overdue Filter */}
      <select
        value={currentOverdue}
        onChange={(e) => updateFilter('isOverdue', e.target.value)}
        className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
      >
        <option value="">All Tasks</option>
        <option value="true">Overdue Only</option>
        <option value="false">On Schedule</option>
      </select>

      {/* Reset button */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center space-x-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset</span>
        </button>
      )}
    </div>
  );
};
