import React from 'react';
import { useSocket } from '../context/SocketContext.js';
import { api } from '../api/client.js';
import { Check, CheckCheck, Bell, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useSocket();

  if (!isOpen) return null;

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      markNotificationAsRead(id);
    } catch (err) {
      console.error('Failed to mark notification read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      markAllNotificationsAsRead();
    } catch (err) {
      console.error('Failed to mark all notifications read', err);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2">
            <Bell className="h-4 w-4 text-sky-500" />
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
              Notifications
            </span>
            {unreadNotificationCount > 0 && (
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                {unreadNotificationCount} new
              </span>
            )}
          </div>
          {unreadNotificationCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center space-x-1 text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 transition-colors flex items-start justify-between space-x-3 ${
                  n.isRead
                    ? 'bg-transparent opacity-75'
                    : 'bg-sky-50/50 dark:bg-sky-950/20'
                } hover:bg-slate-50 dark:hover:bg-slate-800/40`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center space-x-1.5">
                    {!n.isRead && (
                      <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
                    )}
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {n.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {n.message}
                  </p>
                  <div className="flex items-center space-x-1 text-[10px] text-slate-400 dark:text-slate-500">
                    <Clock className="h-3 w-3" />
                    <span>
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {!n.isRead && (
                  <button
                    onClick={(e) => handleMarkRead(n.id, e)}
                    title="Mark as read"
                    className="p-1 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
