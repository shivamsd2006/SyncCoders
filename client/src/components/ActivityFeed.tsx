import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext.js';
import { api } from '../api/client.js';
import { Activity, Clock, Search, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { UserAvatar } from './UserAvatar.js';

interface Props {
  projectId?: string; // Optional filter if viewing inside a specific project
  title?: string;
  maxItems?: number;
}

export const ActivityFeed: React.FC<Props> = ({
  projectId,
  title = 'Live Activity Feed',
  maxItems = 20,
}) => {
  const { activities, setActivities } = useSocket();
  const [isLoading, setIsLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');

  // Fetch initial missed events from PostgreSQL database (Offline Catchup)
  useEffect(() => {
    let isMounted = true;

    const fetchMissedEvents = async () => {
      try {
        const res = await api.get('/activity', {
          params: { limit: maxItems, ...(projectId ? { projectId } : {}) },
        });

        if (isMounted && res.data.success) {
          const fetchedActivities = res.data.data.activities || [];
          setActivities((prev) => {
            const combined = [...fetchedActivities, ...prev];
            const seen = new Set<string>();
            return combined.filter((item) => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            });
          });
        }
      } catch (err) {
        console.error('Failed to load missed activity logs:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchMissedEvents();

    return () => {
      isMounted = false;
    };
  }, [maxItems, projectId, setActivities]);

  // If projectId is supplied, filter feed to this project
  const displayActivities = projectId
    ? activities.filter((a) => a.projectId === projectId)
    : activities;

  // Decision 11-B: Quick filtering by project or team member name
  const filteredActivities = displayActivities.filter((a) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      a.formattedMessage?.toLowerCase().includes(q) ||
      a.userName?.toLowerCase().includes(q) ||
      a.userUsername?.toLowerCase().includes(q) ||
      a.userHeadline?.toLowerCase().includes(q) ||
      a.taskTitle?.toLowerCase().includes(q) ||
      a.projectName?.toLowerCase().includes(q)
    );
  });

  // Guarantee key uniqueness to prevent duplicate React child keys
  const uniqueFilteredActivities = React.useMemo(() => {
    const seen = new Set<string>();
    return filteredActivities.filter((a) => {
      if (!a.id || seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [filteredActivities]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
          </div>
        </div>

        {/* Filter Input for Decision 11-B */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter member / project..."
            className="w-full sm:w-44 text-xs pl-8 pr-7 py-1 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[480px] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
            Loading recent activity...
          </div>
        ) : uniqueFilteredActivities.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
            {filterQuery ? 'No activities match the filter.' : 'No activity events recorded yet.'}
          </div>
        ) : (
          uniqueFilteredActivities.slice(0, maxItems).map((log) => (
            <div
              key={log.id}
              className="py-3 flex items-start space-x-3 text-xs animate-in fade-in duration-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors"
            >
              <UserAvatar
                name={log.userName || 'User'}
                avatarUrl={log.userAvatar}
                size="xs"
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {log.formattedMessage}
                </p>
                <div className="flex items-center space-x-3 text-[11px] text-slate-400 dark:text-slate-500">
                  <span className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {formatDistanceToNow(new Date(log.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </span>
                  {log.userHeadline && (
                    <span className="hidden sm:inline-block text-[10px] text-slate-400 dark:text-slate-500">
                      • {log.userHeadline}
                    </span>
                  )}
                  {log.projectName && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                      {log.projectName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
