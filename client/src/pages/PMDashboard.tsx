import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { PMStats, Project } from '../types/index.js';
import { ActivityFeed } from '../components/ActivityFeed.js';
import { CreateProjectModal } from '../components/CreateProjectModal.js';
import { DeleteProjectModal } from '../components/DeleteProjectModal.js';
import {
  FolderKanban,
  Calendar,
  AlertTriangle,
  Plus,
  ArrowRight,
  ExternalLink,
  Trash2,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';

export const PMDashboard: React.FC = () => {
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

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

  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('ALL');

  const stats = statsData?.data;
  const projects = projectsData?.projects || [];
  const upcomingTasks = stats?.upcomingDueThisWeek || [];

  const filteredProjects =
    projectStatusFilter === 'ALL'
      ? projects
      : projects.filter((p) => p.status === projectStatusFilter);

  const getProjectStatusStyle = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50';
      case 'ON_HOLD':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50';
      case 'COMPLETED':
        return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-900/50';
      default:
        return 'bg-slate-500/10 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Quick Actions */}
      <div className="flex items-center justify-end space-x-2.5">
        <button
          onClick={() => setIsProjectModalOpen(true)}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-500/20 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Create Project</span>
        </button>
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
              Tasks In Progress
            </span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {stats?.tasksByStatus?.IN_PROGRESS ?? 0}
          </p>
          <span className="text-[10px] text-slate-400">Across all projects</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Tasks In Review
            </span>
            <CheckCircle2 className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {stats?.tasksByStatus?.IN_REVIEW ?? 0}
          </p>
          <span className="text-[10px] text-slate-400">Pending PM review</span>
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
          <span className="text-[10px] text-rose-500 font-medium">
            Past due date across all projects
          </span>
        </div>
      </div>

      {/* Main Grid: Projects & Tasks + PM Scoped Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Projects Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <FolderKanban className="h-5 w-5 text-sky-500" />
                <span>Your Managed Projects</span>
              </h3>

              {/* Decision 16-B: Status Filter */}
              <div className="flex items-center space-x-1.5 text-xs">
                {(['ALL', 'ACTIVE', 'ON_HOLD', 'COMPLETED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setProjectStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      projectStatusFilter === st
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredProjects.length === 0 ? (
                <div className="col-span-2 py-6 text-center text-xs text-slate-400">
                  No projects with status {projectStatusFilter}.
                </div>
              ) : (
                filteredProjects.map((p) => (
                  <Link
                    key={p.id}
                    to={`/projects/${p.id}`}
                    className="p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 hover:border-sky-300 dark:hover:border-sky-800 hover:bg-sky-50/20 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                        {p.client?.name}
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${getProjectStatusStyle(
                            p.status
                          )}`}
                        >
                          {p.status.replace('_', ' ')}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setProjectToDelete(p);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all"
                          title="Completely delete project"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
                ))
              )}
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
        </div>

        {/* Right 1 Column: Scoped Activity Feed */}
        <div className="space-y-6">
          <ActivityFeed title="Your Projects Live Activity" maxItems={25} />
        </div>
      </div>

      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />

      <DeleteProjectModal
        isOpen={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        project={projectToDelete}
      />
    </div>
  );
};
