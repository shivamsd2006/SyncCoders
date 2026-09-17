import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, RotateCcw, Flame, CheckCircle2 } from 'lucide-react';
import { TaskPriority, TaskStatus } from '../types/index.js';

interface Props {
  showUrgencySort?: boolean;
}

export const TaskFilters: React.FC<Props> = ({
  showUrgencySort = true,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentStatus = searchParams.get('status') || '';
  const currentPriority = searchParams.get('priority') || '';
  const currentOverdue = searchParams.get('isOverdue') || '';
  const showCompleted = searchParams.get('showCompleted') === 'true';
  const isUrgencySort = searchParams.get('sort') === 'urgency';

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

  const hasActiveFilters = Boolean(
    currentStatus || currentPriority || currentOverdue || showCompleted || isUrgencySort
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-colors">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Filter className="h-4 w-4 text-sky-500" />
          <span>Filters:</span>
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
          <option value="">All Deadlines</option>
          <option value="true">Overdue Only</option>
          <option value="false">On Schedule</option>
        </select>

        {/* Decision 1-B: Show Completed Toggle */}
        <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => updateFilter('showCompleted', e.target.checked ? 'true' : '')}
            className="rounded text-sky-600 focus:ring-sky-500 h-3.5 w-3.5 border-slate-300 dark:border-slate-600"
          />
          <span className="flex items-center space-x-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>Show Completed</span>
          </span>
        </label>

        {/* Decision 19-B: Sort by Urgency Toggle */}
        {showUrgencySort && (
          <button
            type="button"
            onClick={() => updateFilter('sort', isUrgencySort ? '' : 'urgency')}
            className={`flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-all ${
              isUrgencySort
                ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300 shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <Flame className={`h-3.5 w-3.5 ${isUrgencySort ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
            <span>Sort by Urgency</span>
          </button>
        )}

        {/* Reset button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center space-x-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
};
