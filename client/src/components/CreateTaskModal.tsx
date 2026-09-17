import React, { useState } from 'react';
import { api } from '../api/client.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Project, TaskPriority, User } from '../types/index.js';
import { X, CheckSquare, Plus, Check, AlertTriangle } from 'lucide-react';
import { getCleanErrorMessage } from '../utils/errors.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
}

export const CreateTaskModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultProjectId,
}) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Developer write and delete states
  const [devMode, setDevMode] = useState<'select' | 'write'>('select');
  const [newDevName, setNewDevName] = useState('');
  const [newDevHeadline, setNewDevHeadline] = useState('');
  const [isSavingDev, setIsSavingDev] = useState(false);
  const [devSuccessMsg, setDevSuccessMsg] = useState('');
  const [devToDelete, setDevToDelete] = useState<User | null>(null);
  const [isDeletingDev, setIsDeletingDev] = useState(false);
  const [showManageDevs, setShowManageDevs] = useState(false);

  const { data: projectsData } = useQuery<{ projects: Project[] }>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get('/projects');
      return res.data.data;
    },
    enabled: isOpen && !defaultProjectId,
  });

  const { data: devsData } = useQuery<{ developers: User[] }>({
    queryKey: ['developers'],
    queryFn: async () => {
      const res = await api.get('/users/developers');
      return res.data.data;
    },
    enabled: isOpen,
  });

  const developers = devsData?.developers || [];
  const selectedDev = developers.find((d) => d.id === assignedTo);

  if (!isOpen) return null;

  const targetProjectId = defaultProjectId || projectId;

  const handleSaveNewDeveloper = async () => {
    if (isSavingDev) return;
    if (!newDevName.trim()) {
      setError('Please provide a developer name');
      return;
    }

    setIsSavingDev(true);
    setError('');
    setDevSuccessMsg('');

    try {
      const res = await api.post('/users/developers', {
        name: newDevName.trim(),
        headline: newDevHeadline.trim() || undefined,
      });

      const created = res.data?.data?.developer;
      await queryClient.invalidateQueries({ queryKey: ['developers'] });

      if (created?.id) {
        setAssignedTo(created.id);
      }
      setNewDevName('');
      setNewDevHeadline('');
      setDevMode('select');
      setDevSuccessMsg(`Developer "${created?.name}" saved and selected!`);
      setTimeout(() => setDevSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(getCleanErrorMessage(err, 'Failed to save developer'));
    } finally {
      setIsSavingDev(false);
    }
  };

  const handleDeleteDeveloper = async () => {
    if (!devToDelete || isDeletingDev) return;

    setIsDeletingDev(true);
    setError('');

    try {
      const name = devToDelete.name;
      await api.delete(`/users/developers/${devToDelete.id}`);
      if (assignedTo === devToDelete.id) {
        setAssignedTo('');
      }
      await queryClient.invalidateQueries({ queryKey: ['developers'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['stats'] });
      setDevToDelete(null);
      setDevSuccessMsg(`Developer "${name}" deleted from dropdown.`);
      setTimeout(() => setDevSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(getCleanErrorMessage(err, 'Failed to delete developer'));
    } finally {
      setIsDeletingDev(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !targetProjectId || !dueDate) {
      setError('Please provide a title, project, and due date');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      let finalAssignedTo = assignedTo;

      // If user typed a developer and directly clicked Create Task, save them first
      if (devMode === 'write' && newDevName.trim()) {
        const devRes = await api.post('/users/developers', {
          name: newDevName.trim(),
          headline: newDevHeadline.trim() || undefined,
        });
        finalAssignedTo = devRes.data?.data?.developer?.id || null;
        queryClient.invalidateQueries({ queryKey: ['developers'] });
      }

      await api.post('/tasks', {
        title: title.trim(),
        description: description.trim() || undefined,
        projectId: targetProjectId,
        assignedTo: finalAssignedTo || null,
        priority,
        dueDate: new Date(dueDate).toISOString(),
      });

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      onClose();
    } catch (err: any) {
      setError(getCleanErrorMessage(err, 'Failed to create task'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <CheckSquare className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Create & Assign Task
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {devSuccessMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5">
            <Check className="h-4 w-4 shrink-0" />
            <span>{devSuccessMsg}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Integrate GPS Webhook Ingestion"
              className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          {!defaultProjectId && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Project *
              </label>
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="">Select Project</option>
                {projectsData?.projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Developer Assignment: Select or Write New */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assign Developer
              </label>
              <button
                type="button"
                onClick={() => {
                  setDevMode(devMode === 'select' ? 'write' : 'select');
                  setError('');
                  setDevSuccessMsg('');
                }}
                className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 flex items-center space-x-1 py-0.5 px-1.5 rounded-md hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
              >
                {devMode === 'select' ? (
                  <>
                    <Plus className="h-3 w-3" />
                    <span>Write New Developer</span>
                  </>
                ) : (
                  <span>Select Existing Developer</span>
                )}
              </button>
            </div>

            {devMode === 'select' ? (
              <div className="space-y-1.5">
                <div className="flex items-center space-x-1.5">
                  <select
                    value={assignedTo}
                    onChange={(e) => {
                      setAssignedTo(e.target.value);
                      setError('');
                      setDevSuccessMsg('');
                    }}
                    className="flex-1 text-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  >
                    <option value="">Unassigned</option>
                    {developers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.headline ? `• ${d.headline}` : ''}
                      </option>
                    ))}
                  </select>

                  {assignedTo && selectedDev && (
                    <button
                      type="button"
                      onClick={() => setDevToDelete(selectedDev)}
                      className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                      title={`Delete "${selectedDev.name}" from dropdown`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {developers.length > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span>
                      {selectedDev
                        ? `Selected: ${selectedDev.name}`
                        : 'Select a developer or write a new one'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowManageDevs(!showManageDevs)}
                      className="hover:text-slate-600 dark:hover:text-slate-200 underline font-medium"
                    >
                      {showManageDevs ? 'Hide list' : `Manage / Delete developers (${developers.length})`}
                    </button>
                  </div>
                )}

                {/* Expandable Developer Management List with cross icons */}
                {showManageDevs && developers.length > 0 && (
                  <div className="space-y-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-1">
                      Click developer to select, or click cross (✕) to delete from dropdown:
                    </div>
                    <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900">
                      {developers.map((d) => (
                        <div
                          key={d.id}
                          className={`flex items-center justify-between p-2 text-xs transition-colors ${
                            assignedTo === d.id
                              ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div
                            className="flex-1 cursor-pointer pr-2"
                            onClick={() => {
                              setAssignedTo(d.id);
                              setError('');
                            }}
                          >
                            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                              <span>{d.name}</span>
                              {assignedTo === d.id && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                                  Assigned
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {d.headline || 'Software Engineer'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDevToDelete(d);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                            title={`Delete ${d.name} from dropdown`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Write New Developer Form */
              <div className="p-3.5 rounded-xl border border-sky-200/80 bg-sky-50/30 dark:border-sky-900/50 dark:bg-sky-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-sky-800 dark:text-sky-300">
                    Write New Developer Details
                  </div>
                  <span className="text-[10px] text-slate-400">Will appear in dropdown</span>
                </div>
                <div>
                  <input
                    type="text"
                    value={newDevName}
                    onChange={(e) => setNewDevName(e.target.value)}
                    placeholder="Developer Full Name *"
                    className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={newDevHeadline}
                    onChange={(e) => setNewDevHeadline(e.target.value)}
                    placeholder="Role / Title (e.g. Backend Specialist - Optional)"
                    className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDevMode('select');
                      setError('');
                    }}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingDev || !newDevName.trim()}
                    onClick={handleSaveNewDeveloper}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{isSavingDev ? 'Saving Developer...' : 'Save & Select Developer'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Due Date *
              </label>
              <input
                type="datetime-local"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed task instructions..."
              className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>

      {/* Delete Developer Confirmation Modal */}
      {devToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center space-x-2 text-rose-600 mb-2">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="text-sm font-bold">Delete Developer?</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to delete developer <strong>"{devToDelete.name}"</strong> from the dropdown? Any tasks currently assigned to them will become unassigned.
            </p>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                type="button"
                disabled={isDeletingDev}
                onClick={() => setDevToDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingDev}
                onClick={handleDeleteDeveloper}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md shadow-rose-500/20"
              >
                {isDeletingDev ? 'Deleting...' : 'Delete Developer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
