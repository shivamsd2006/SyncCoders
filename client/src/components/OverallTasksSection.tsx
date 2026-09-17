import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { Task } from '../types/index.js';
import { UserAvatar } from './UserAvatar.js';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
  Search,
  ArrowUpRight,
  Layers,
  Calendar,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export type TaskSectionTab = 'ALL' | 'IN_PROGRESS' | 'IN_REVIEW' | 'OVERDUE';

interface Props {
  activeTab: TaskSectionTab;
  onTabChange: (tab: TaskSectionTab) => void;
  title?: string;
}

export const OverallTasksSection: React.FC<Props> = ({
  activeTab,
  onTabChange,
  title = 'Overall Tasks Across All Projects',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all tasks combining all available projects
  const { data: tasksData, isLoading } = useQuery<{ data: { tasks: Task[] } }>({
    queryKey: ['tasks', 'overall'],
    queryFn: async () => {
      const res = await api.get('/tasks');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const allTasks = tasksData?.data?.tasks || [];
  const now = new Date();

  // Groupings across all projects
  const isTaskOverdue = (t: Task) =>
    t.status !== 'DONE' && (t.isOverdue || new Date(t.dueDate) < now);

  const inProgressTasks = allTasks.filter((t) => t.status === 'IN_PROGRESS');
  const inReviewTasks = allTasks.filter((t) => t.status === 'IN_REVIEW');
  const overdueTasks = allTasks.filter(isTaskOverdue);
  const allActiveTasks = allTasks.filter((t) => t.status !== 'DONE');

  // Filter tasks based on activeTab
  const getTabTasks = () => {
    switch (activeTab) {
      case 'IN_PROGRESS':
        return inProgressTasks;
      case 'IN_REVIEW':
        return inReviewTasks;
      case 'OVERDUE':
        return overdueTasks;
      case 'ALL':
      default:
        return allActiveTasks;
    }
  };

  const currentTabTasks = getTabTasks();

  // Search filter
  const filteredTasks = currentTabTasks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = t.title.toLowerCase().includes(q);
    const descMatch = t.description?.toLowerCase().includes(q);
    const projectMatch = t.project?.title?.toLowerCase().includes(q);
    const assigneeMatch = t.assignee?.name?.toLowerCase().includes(q);
    return titleMatch || descMatch || projectMatch || assigneeMatch;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50';
      case 'MEDIUM':
        return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/50';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
      {/* Section Header with Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <Layers className="h-5 w-5 text-sky-500" />
            <span>{title}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Combined tasks across all agency projects, sorted by delivery urgency
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => onTabChange('ALL')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span>All Active</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
              {allActiveTasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('IN_PROGRESS')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'IN_PROGRESS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>In Progress</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-200/60 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
              {inProgressTasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('IN_REVIEW')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'IN_REVIEW'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>In Review</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
              {inReviewTasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('OVERDUE')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'OVERDUE'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Overdue</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-200/60 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
              {overdueTasks.length}
            </span>
          </button>
        </div>
      </div>

      {/* Quick Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter overall tasks by title, project, or assignee..."
          className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 dark:border-slate-800 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        />
      </div>

      {/* Tasks List */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400">
          Loading overall tasks from all projects...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
          {searchQuery ? (
            <p>No tasks found matching "{searchQuery}" in {activeTab.replace('_', ' ')}.</p>
          ) : activeTab === 'OVERDUE' ? (
            <p className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4" />
              <span>Great job! There are currently no overdue tasks across all projects.</span>
            </p>
          ) : (
            <p>No tasks currently found in {activeTab.replace('_', ' ')} across all projects.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredTasks.map((t) => {
            const isOverdue = isTaskOverdue(t);
            const dueDateObj = new Date(t.dueDate);
            const isPastDue = dueDateObj < now;

            return (
              <Link
                key={t.id}
                to={`/projects/${t.projectId}`}
                className={`p-4 rounded-xl border transition-all group flex flex-col justify-between ${
                  isOverdue
                    ? 'border-rose-200 bg-rose-50/40 hover:border-rose-300 dark:border-rose-900/60 dark:bg-rose-950/20'
                    : 'border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-800/30 hover:border-sky-300 dark:hover:border-sky-800'
                }`}
              >
                <div>
                  {/* Top Badges: Project tag & Status/Overdue */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 truncate max-w-[180px]">
                      <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t.project?.title || 'Unknown Project'}</span>
                    </span>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      {isOverdue && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white animate-pulse flex items-center space-x-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>OVERDUE</span>
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${
                          t.status === 'IN_PROGRESS'
                            ? 'bg-blue-500/10 text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-900/50'
                            : t.status === 'IN_REVIEW'
                            ? 'bg-amber-500/10 text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-900/50'
                            : t.status === 'DONE'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Task Title */}
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors line-clamp-2">
                    {t.title}
                  </h4>

                  {t.description && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {t.description}
                    </p>
                  )}
                </div>

                {/* Bottom Row: Assignee, Priority, Due Date & Link */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs">
                  {/* Assignee */}
                  <div className="flex items-center space-x-2">
                    <UserAvatar
                      name={t.assignee?.name || 'Unassigned'}
                      avatarUrl={t.assignee?.avatarUrl}
                      size="sm"
                    />
                    <div className="leading-tight">
                      <span className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {t.assignee?.name || 'Unassigned'}
                      </span>
                      {t.assignee?.headline && (
                        <span className="block text-[9px] text-slate-400 truncate max-w-[120px]">
                          {t.assignee.headline}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Priority & Due Date */}
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${getPriorityBadge(
                        t.priority
                      )}`}
                    >
                      {t.priority}
                    </span>

                    <span
                      className={`flex items-center space-x-1 text-[11px] font-semibold ${
                        isPastDue
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Calendar className="h-3 w-3" />
                      <span>{format(dueDateObj, 'MMM d')}</span>
                    </span>

                    <span className="p-1 text-slate-400 group-hover:text-sky-600 transition-colors">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
