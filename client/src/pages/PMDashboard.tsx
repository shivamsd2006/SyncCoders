import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { PMStats, Project, Task } from '../types/index.js';
import { ActivityFeed } from '../components/ActivityFeed.js';
import { TaskFilters } from '../components/TaskFilters.js';
import { TaskCard } from '../components/TaskCard.js';
import { CreateProjectModal } from '../components/CreateProjectModal.js';
import { CreateTaskModal } from '../components/CreateTaskModal.js';
import {
  FolderKanban,
  Calendar,
  AlertTriangle,
  Plus,
  ArrowRight,
  ExternalLink,
  Flame,
} from 'lucide-react';
import { format } from 'date-fns';

export const PMDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // 1. Fetch PM Stats (scoped to current PM)
  const { data: statsData } = useQuery<{ data: PMStats }>({
    queryKey: ['stats', 'pm'],
    queryFn: async () => {
      const res = await api.get('/stats');
      return res.data;
    },
  });

  // 2. Fetch PM Projects
  const { data: projectsData } = useQuery<{ projects: Project[] }>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data.data;
    },
  });

  // 3. Fetch Scoped Tasks
  const { data: tasksData } = useQuery<{ tasks: Task[] }>({
    queryKey: ['tasks', searchParams.toString()],
    queryFn: async () => {
      const res = await api.get('/tasks', {
        params: Object.fromEntries(searchParams.entries()),
      });
      return res.data.data;
    },
  });

  const stats = statsData?.data;
  const projects = projectsData?.projects || [];
  const tasks = tasksData?.tasks || [];
  const upcomingTasks = stats?.upcomingDueThisWeek || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Project Manager Workspace
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Managing your client projects, priority distribution, and team deliverables.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-sky-500" />
            <span>New Task</span>
          </button>

          <button
            onClick={() => setIsProjectModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-500/20 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {/* Priority & Delivery Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              My Projects
            </span>
            <FolderKanban className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {stats?.projectsCount ?? 0}
          </p>
          <span className="text-[10px] text-slate-400">Owned by you</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Critical Priority
            </span>
            <Flame className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">
            {stats?.tasksByPriority?.CRITICAL ?? 0}
          </p>
          <span className="text-[10px] text-slate-400">Immediate focus</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Due This Week
            </span>
            <Calendar className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {upcomingTasks.length}
          </p>
          <span className="text-[10px] text-slate-400">Upcoming deadlines</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Overdue Tasks
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">
            {stats?.overdueTasksCount ?? 0}
          </p>
          <span className="text-[10px] text-rose-500 font-medium">Attention required</span>
        </div>
      </div>

      {/* Main Grid: Projects & Tasks + PM Scoped Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Projects Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              Your Managed Projects
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 hover:border-sky-300 dark:hover:border-sky-800 hover:bg-sky-50/20 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                      {p.client?.name}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-500 transition-colors" />
                  </div>
                  <h4 className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">
                    {p.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                    {p.description}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>{p.tasks?.length ?? 0} tasks total</span>
                    <span className="font-semibold text-sky-600 dark:text-sky-400 flex items-center space-x-1">
                      <span>View details</span>
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Upcoming Due Dates This Week */}
          {upcomingTasks.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-5 dark:border-amber-900/40 dark:bg-amber-950/10">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-2 mb-3">
                <Calendar className="h-4 w-4 text-amber-500" />
                <span>Deadlines Due This Week</span>
              </h3>
              <div className="space-y-2">
                {upcomingTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/30 flex items-center justify-between text-xs"
                  >
                    <div>
                      <h5 className="font-semibold text-slate-800 dark:text-slate-200">
                        {t.title}
                      </h5>
                      <span className="text-[11px] text-slate-400">
                        Assigned to {t.assignee?.name || 'Unassigned'} ·{' '}
                        {t.project?.title}
                      </span>
                    </div>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {format(new Date(t.dueDate), 'EEE, MMM d')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks with URL Filters */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Team Tasks in Your Projects
            </h3>
            <TaskFilters />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tasks.length === 0 ? (
                <div className="col-span-2 py-12 text-center text-xs text-slate-400 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  No tasks found matching these filters.
                </div>
              ) : (
                tasks.map((task) => <TaskCard key={task.id} task={task} />)
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Scoped Activity Feed */}
        <div className="space-y-6">
          <ActivityFeed title="Your Projects Live Activity" maxItems={20} />
        </div>
      </div>

      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />
      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
      />
    </div>
  );
};
