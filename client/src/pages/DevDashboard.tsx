import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { DevStats, Task } from '../types/index.js';
import { ActivityFeed } from '../components/ActivityFeed.js';
import { TaskFilters } from '../components/TaskFilters.js';
import { TaskCard } from '../components/TaskCard.js';
import { CheckSquare, AlertTriangle, Clock, ShieldCheck } from 'lucide-react';

export const DevDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();

  // 1. Fetch Developer Stats
  const { data: statsData } = useQuery<{ data: DevStats }>({
    queryKey: ['stats', 'dev'],
    queryFn: async () => {
      const res = await api.get('/stats');
      return res.data;
    },
  });

  // 2. Fetch Tasks assigned to this Developer (sorted by Priority > Due Date)
  const { data: tasksData } = useQuery<{ tasks: Task[] }>({
    queryKey: ['tasks', 'dev', searchParams.toString()],
    queryFn: async () => {
      const res = await api.get('/tasks', {
        params: Object.fromEntries(searchParams.entries()),
      });
      return res.data.data;
    },
  });

  const stats = statsData?.data;
  const tasks = tasksData?.tasks || [];

  const showCompleted = searchParams.get('showCompleted') === 'true';
  const currentStatus = searchParams.get('status') || '';

  // 1-B: Completed tasks hidden by default unless toggle is ON or DONE status explicitly selected
  let processedTasks = [...tasks];
  if (!showCompleted && currentStatus !== 'DONE') {
    processedTasks = processedTasks.filter((t) => t.status !== 'DONE');
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Developer Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Assigned Tasks
            </span>
            <CheckSquare className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {stats?.assignedTasksCount ?? 0}
          </p>
          <span className="text-[10px] text-slate-400">Total assigned to you</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Pending Action
            </span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400">
            {stats?.pendingTasksCount ?? 0}
          </p>
          <span className="text-[10px] text-slate-400">To Do / In Progress / In Review</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Overdue
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">
            {stats?.overdueTasksCount ?? 0}
          </p>
          <span className="text-[10px] text-rose-500 font-medium">Attention needed</span>
        </div>
      </div>

      {/* Main Grid: Developer Tasks + Dev Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Your Assigned Tasks ({processedTasks.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sorted by Priority (Critical → Low) then Due Date
              </p>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full font-medium">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>RBAC Scoped to You</span>
            </div>
          </div>

          <TaskFilters tasksToExport={processedTasks} showUrgencySort={false} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {processedTasks.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-xs text-slate-400 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                No tasks assigned matching current filters.
              </div>
            ) : (
              processedTasks.map((task) => <TaskCard key={task.id} task={task} />)
            )}
          </div>
        </div>

        {/* Right 1 Column: Dev-scoped activity feed */}
        <div className="space-y-6">
          <ActivityFeed title="Your Task Updates" maxItems={20} />
        </div>
      </div>
    </div>
  );
};
