import React, { useState } from 'react';
import { api } from '../api/client.js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Client } from '../types/index.js';
import { X, FolderPlus, Plus, Trash2, AlertTriangle, Check, Users } from 'lucide-react';
import { getCleanErrorMessage } from '../utils/errors.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateProjectModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientMode, setClientMode] = useState<'existing' | 'write'>('existing');

  // Write new client form fields
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientCompany, setNewClientCompany] = useState('');
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [clientSuccessMsg, setClientSuccessMsg] = useState('');

  // Delete client confirmation state
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [showManageClients, setShowManageClients] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: clientsData } = useQuery<{ clients: Client[] }>({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await api.get('/clients');
      return res.data.data;
    },
    enabled: isOpen,
  });

  const clients = clientsData?.clients || [];
  const selectedClient = clients.find((c) => c.id === clientId);

  if (!isOpen) return null;

  const handleSaveNewClient = async () => {
    if (isSavingClient) return;
    if (!newClientName.trim()) {
      setError('Please provide a client name');
      return;
    }

    setIsSavingClient(true);
    setError('');
    setClientSuccessMsg('');

    try {
      const res = await api.post('/clients', {
        name: newClientName.trim(),
        email: newClientEmail.trim() || undefined,
        company: newClientCompany.trim() || undefined,
      });

      const createdClient = res.data?.data?.client;
      await queryClient.invalidateQueries({ queryKey: ['clients'] });

      if (createdClient?.id) {
        setClientId(createdClient.id);
      }
      setNewClientName('');
      setNewClientEmail('');
      setNewClientCompany('');
      setClientMode('existing');
      setClientSuccessMsg(`Client "${createdClient?.name || 'New Client'}" saved and selected!`);
    } catch (err: any) {
      setError(getCleanErrorMessage(err, 'Failed to save client'));
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    setIsDeletingClient(true);
    setError('');

    try {
      const deletedName = clientToDelete.name;
      await api.delete(`/clients/${clientToDelete.id}`);
      if (clientId === clientToDelete.id) {
        setClientId('');
      }
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setClientToDelete(null);
      setClientSuccessMsg(`Client "${deletedName}" was deleted successfully.`);
    } catch (err: any) {
      setError(getCleanErrorMessage(err, 'Request is not acceptable'));
    } finally {
      setIsDeletingClient(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a project title');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      let finalClientId = clientId;

      // If user chose to write a new client, create it first
      if (clientMode === 'write') {
        if (!newClientName.trim()) {
          setError('Please provide a client name');
          setIsSubmitting(false);
          return;
        }

        const clientRes = await api.post('/clients', {
          name: newClientName.trim(),
          email: newClientEmail.trim() || undefined,
          company: newClientCompany.trim() || undefined,
        });

        finalClientId = clientRes.data.data.client.id;
        queryClient.invalidateQueries({ queryKey: ['clients'] });
      } else {
        if (!finalClientId) {
          setError('Please select a client or write a new one');
          setIsSubmitting(false);
          return;
        }
      }

      // Automatically creates with status: ACTIVE (no initial status selection)
      await api.post('/projects', {
        title: title.trim(),
        description: description.trim() || undefined,
        clientId: finalClientId,
      });

      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });

      // Reset modal state
      setTitle('');
      setDescription('');
      setClientId('');
      setNewClientName('');
      setNewClientEmail('');
      setNewClientCompany('');
      setClientMode('existing');
      setShowManageClients(false);
      onClose();
    } catch (err: any) {
      setError(getCleanErrorMessage(err, 'Request is not acceptable'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
        <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <FolderPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Create New Project
                </h3>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  Initial Status: Active
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {clientSuccessMsg && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5">
              <Check className="h-4 w-4 shrink-0" />
              <span>{clientSuccessMsg}</span>
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
                Project Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Arc Reactor Telemetry UI"
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            {/* Client Section: Select Previous or Write New */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Client *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setClientMode(clientMode === 'existing' ? 'write' : 'existing');
                    setError('');
                    setClientSuccessMsg('');
                  }}
                  className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 flex items-center space-x-1 py-0.5 px-1.5 rounded-md hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
                >
                  {clientMode === 'existing' ? (
                    <>
                      <Plus className="h-3 w-3" />
                      <span>Write New Client</span>
                    </>
                  ) : (
                    <span>Select Existing Client</span>
                  )}
                </button>
              </div>

              {clientMode === 'existing' ? (
                <div className="space-y-2">
                  <div>
                    <select
                      value={clientId}
                      onChange={(e) => {
                        setClientId(e.target.value);
                        setError('');
                        setClientSuccessMsg('');
                      }}
                      className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    >
                      <option value="">
                        {clients.length === 0
                          ? 'No previous clients found'
                          : `-- Select a Client (${clients.length} available) --`}
                      </option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {clients.length > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                      <span>
                        {selectedClient
                          ? `${selectedClient.name} (${selectedClient.email})`
                          : 'Select a previous client or write a new one'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowManageClients(!showManageClients)}
                        className="hover:text-slate-600 dark:hover:text-slate-200 underline font-medium"
                      >
                        {showManageClients ? 'Hide client list' : `Manage / Delete clients (${clients.length})`}
                      </button>
                    </div>
                  )}

                  {/* Expandable Client Management List */}
                  {showManageClients && clients.length > 0 && (
                    <div className="space-y-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-1">
                        Click a client to select, or click Delete to remove:
                      </div>
                      <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900">
                        {clients.map((c) => (
                          <div
                            key={c.id}
                            className={`flex items-center justify-between p-2 text-xs transition-colors ${
                              clientId === c.id
                                ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <div
                              className="flex-1 cursor-pointer pr-2"
                              onClick={() => {
                                setClientId(c.id);
                                setError('');
                              }}
                            >
                              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                                <span>{c.name}</span>
                                {c.company && (
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    ({c.company})
                                  </span>
                                )}
                                {clientId === c.id && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {c.email} · {c._count?.projects ?? 0} project(s)
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setClientToDelete(c);
                              }}
                              className="flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                              title={`Delete client ${c.name}`}
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Write New Client Form */
                <div className="p-3.5 rounded-xl border border-sky-200/80 bg-sky-50/30 dark:border-sky-900/50 dark:bg-sky-950/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-sky-800 dark:text-sky-300">
                      Write New Client Details
                    </div>
                    <span className="text-[10px] text-slate-400">Will be saved to client list</span>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Client or Contact Name *"
                      className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      placeholder="Client Email Address (Optional)"
                      className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={newClientCompany}
                      onChange={(e) => setNewClientCompany(e.target.value)}
                      placeholder="Company / Organization Name (Optional)"
                      className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>
                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setClientMode('existing');
                        setError('');
                      }}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingClient || !newClientName.trim()}
                      onClick={handleSaveNewClient}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{isSavingClient ? 'Saving Client...' : 'Save & Select Client'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of deliverables and scope..."
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
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Client Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center space-x-2 text-rose-600 mb-2">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="text-sm font-bold">Delete Client?</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to delete client <strong>"{clientToDelete.name}"</strong>?
              {(clientToDelete._count?.projects ?? 0) > 0 && (
                <span className="block mt-1 text-rose-500 font-medium">
                  Warning: This will also delete {clientToDelete._count?.projects} associated project(s) and their tasks.
                </span>
              )}
            </p>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                type="button"
                disabled={isDeletingClient}
                onClick={() => setClientToDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingClient}
                onClick={handleDeleteClient}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md shadow-rose-500/20"
              >
                {isDeletingClient ? 'Deleting...' : 'Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
