import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext.js';
import { api } from '../api/client.js';
import { Activity, Clock, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

  // Fetch initial 20 missed events from PostgreSQL database (Offline Catchup)
  useEffect(() => {
    let isMounted = true;

    const fetchMissedEvents = async () => {
      try {
        const res = await api.get('/activity', {
          params: { limit: maxItems },
        });

        if (isMounted && res.data.success) {
          setActivities(res.data.data.activities);
        }
      } catch (err) {
        console.error('Failed to fetch activity logs from database', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchMissedEvents();

    return () => {
      isMounted = false;
    };
  }, [maxItems, setActivities]);

  // If projectId is supplied, filter feed to this project
  const displayActivities = projectId
    ? activities.filter((a) => a.projectId === projectId)
    : activities;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live updates via WebSockets & DB catchup
            </p>
          </div>
        </div>

        <span className="inline-flex items-center space-x-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
          <Zap className="h-3 w-3" />
          <span>Real-time</span>
        </span>
      </div>

      <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[480px] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
            Loading recent activity...
          </div>
        ) : displayActivities.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
            No activity events recorded yet.
          </div>
        ) : (
          displayActivities.slice(0, maxItems).map((log) => (
            <div
              key={log.id}
              className="py-3.5 flex items-start space-x-3 text-xs animate-in fade-in duration-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition-colors"
            >
              <div className="h-2 w-2 rounded-full bg-sky-500 mt-1.5 shrink-0" />
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
