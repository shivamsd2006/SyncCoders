import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { Project, TaskStatus } from '../types/index.js';
import { useSocket } from '../context/SocketContext.js';
import { useAuth } from '../context/AuthContext.js';
import { TaskCard } from '../components/TaskCard.js';
import { ActivityFeed } from '../components/ActivityFeed.js';
import { CreateTaskModal } from '../components/CreateTaskModal.js';
import {
  FolderKanban,
  User,
  Building,
  Calendar,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import { format } from 'date-fns';

const columns: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'TODO', label: 'To Do', color: 'border-slate-300 dark:border-slate-700' },
  { status: 'IN_PROGRESS', label: 'In Progress', color: 'border-blue-400 dark:border-blue-700' },
  { status: 'IN_REVIEW', label: 'In Review', color: 'border-amber-400 dark:border-amber-700' },
  { status: 'DONE', label: 'Done', color: 'border-emerald-400 dark:border-emerald-700' },
];

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { joinProject, leaveProject } = useSocket();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Join the project's WebSocket room on mount and leave on unmount
  useEffect(() => {
    if (id) {
      joinProject(id);
    }
    return () => {
      if (id) {
        leaveProject(id);
      }
    };
  }, [id, joinProject, leaveProject]);

  const { data, isLoading, error } = useQuery<{ project: Project }>({
    queryKey: ['project', id],
    queryFn: async () => {
      const res = await api.get(`/projects/${id}`);
      return res.data.data;
    },
    enabled: Boolean(id),
  });

  const project = data?.project;
  const canManageTasks = user?.role === 'ADMIN' || user?.role === 'PM';

  if (isLoading) {
    return (
      <div className="py-20 text-center text-xs text-slate-400">
        Loading project details...
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-500">
          Project not found or access denied.
        </p>
        <Link
          to="/"
          className="inline-flex items-center space-x-1.5 text-xs text-sky-600 dark:text-sky-400 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  const tasks = project.tasks || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/"
            className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
            <FolderKanban className="h-6 w-6 text-sky-500" />
            <span>{project.title}</span>
          </h1>
          {project.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              {project.description}
            </p>
          )}
        </div>

        {canManageTasks && (
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-500/20 transition-all self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Project Task</span>
          </button>
        )}
      </div>

      {/* Project Meta Bar */}
      <div className="flex flex-wrap items-center gap-6 p-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center space-x-2">
          <Building className="h-4 w-4 text-slate-400" />
          <span className="font-semibold">{project.client?.name}</span>
        </div>
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-slate-400" />
          <span>Managed by {project.creator?.name}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span>Created {format(new Date(project.createdAt), 'MMM d, yyyy')}</span>
        </div>
        <div className="ml-auto text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
          ⚡ Live WebSocket Room Active
        </div>
      </div>

      {/* Kanban / Task Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          return (
            <div
              key={col.status}
              className={`rounded-2xl border-t-4 border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40 flex flex-col space-y-3 ${col.color}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  {col.label}
                </h3>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {colTasks.length}
                </span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="py-8 text-center text-[11px] text-slate-400">
                    No tasks in {col.label}
                  </div>
                ) : (
                  colTasks.map((t) => <TaskCard key={t.id} task={t} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Project-Specific Live Activity Feed */}
      <div className="pt-4">
        <ActivityFeed
          projectId={id}
          title={`Live Activity for ${project.title}`}
          maxItems={20}
        />
      </div>

      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        defaultProjectId={id}
      />
    </div>
  );
};
