import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { AdminStats, Project, Task } from '../types/index.js';
import { ActivityFeed } from '../components/ActivityFeed.js';
import { TaskFilters } from '../components/TaskFilters.js';
import { TaskCard } from '../components/TaskCard.js';
import { CreateProjectModal } from '../components/CreateProjectModal.js';
import { CreateTaskModal } from '../components/CreateTaskModal.js';
import { useSocket } from '../context/SocketContext.js';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Plus,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { onlineCount } = useSocket();
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // 1. Fetch Dashboard Stats
  const { data: statsData } = useQuery<{ data: AdminStats }>({
    queryKey: ['stats', 'admin'],
    queryFn: async () => {
      const res = await api.get('/stats');
      return res.data;
    },
  });

  // 2. Fetch Projects
  const { data: projectsData } = useQuery<{ projects: Project[] }>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data.data;
    },
  });

  // 3. Fetch Tasks (reactive to URL search params!)
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

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Agency Control Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Global operational overview, live metrics, and real-time team activity.
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

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Projects
            </span>
            <FolderKanban className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {stats?.totalProjects ?? 0}
          </p>
          <span className="text-[10px] text-slate-400">Active client projects</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              In Progress
            </span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {stats?.tasksByStatus?.IN_PROGRESS ?? 0}
          </p>
          <span className="text-[10px] text-slate-400">Active development</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              In Review
            </span>
            <CheckCircle2 className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {stats?.tasksByStatus?.IN_REVIEW ?? 0}
          </p>
          <span className="text-[10px] text-slate-400">Pending PM approval</span>
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
          <span className="text-[10px] text-rose-500 font-medium">
            Flagged by scheduler
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Live Presence
            </span>
            <Users className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 flex items-center space-x-2">
            <span>{onlineCount}</span>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
          </p>
          <span className="text-[10px] text-slate-400">Connected WebSocket sockets</span>
        </div>
      </div>

      {/* Main Content Layout: Tasks & Projects + Global Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Projects & Filterable Task Stream */}
        <div className="lg:col-span-2 space-y-6">
          {/* Projects Quick Carousel / Cards */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <FolderKanban className="h-4 w-4 text-sky-500" />
                <span>Active Projects</span>
              </h3>
              <span className="text-xs text-slate-400">{projects.length} Total</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 hover:border-sky-300 dark:hover:border-sky-800 hover:bg-sky-50/20 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                      {p.client?.name}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-500 transition-colors" />
                  </div>
                  <h4 className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                    {p.title}
                  </h4>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{p.tasks?.length ?? 0} tasks</span>
                    <span>By {p.creator?.name?.split(' ')[0]}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Tasks Header & URL Filter Bar */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Global Task Management
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {tasks.length} tasks match current filters
                </p>
              </div>
            </div>

            <TaskFilters />

            {/* Tasks Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tasks.length === 0 ? (
                <div className="col-span-2 py-12 text-center text-xs text-slate-400 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  No tasks match the selected filters.
                </div>
              ) : (
                tasks.map((task) => <TaskCard key={task.id} task={task} />)
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Global Real-Time Activity Feed */}
        <div className="space-y-6">
          <ActivityFeed title="Global Activity Stream" maxItems={20} />
        </div>
      </div>

      {/* Modals */}
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
