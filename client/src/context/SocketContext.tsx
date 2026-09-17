import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext.js';
import { api } from '../api/client.js';
import { ActivityLog, NotificationItem } from '../types/index.js';
import { useQueryClient } from '@tanstack/react-query';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineCount: number;
  activities: ActivityLog[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  setActivities: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  setUnreadNotificationCount: React.Dispatch<React.SetStateAction<number>>;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_WS_URL || window.location.origin;

    const s = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    // Real-time online presence
    s.on('presence:update', (data: { onlineCount: number }) => {
      setOnlineCount(data.onlineCount);
    });

    // Real-time role-filtered activity feed
    s.on('activity:new', (newActivity: ActivityLog) => {
      setActivities((prev) => {
        if (prev.some((a) => a.id === newActivity.id)) {
          return prev;
        }
        return [newActivity, ...prev.slice(0, 49)];
      });

      // Automatically invalidate related queries to trigger seamless UI updates without full refresh
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    });

    // Real-time project status and details sync
    s.on('project:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    });

    // Real-time in-app notifications
    s.on('notification:new', (newNotification: NotificationItem) => {
      // Role-based notification guards per specification:
      // 1. Admin: ONLY receives notifications about project completion status
      if (user.role === 'ADMIN' && !newNotification.title.includes('Project Completed')) {
        return;
      }
      // 2. PM: ONLY receives notifications about project status and task review/overdue status
      if (user.role === 'PM' && newNotification.title === 'New Task Assigned') {
        return;
      }
      // 3. Developer: ONLY receives notifications for assigned tasks, changes requested, or overdue
      if (user.role === 'DEVELOPER' && newNotification.title.includes('Project Completed')) {
        return;
      }

      setNotifications((prev) => [newNotification, ...prev]);
      setUnreadNotificationCount((prev) => prev + 1);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [user, token, queryClient]);

  // Load and refresh notifications from server on login / user change
  useEffect(() => {
    if (!user || !token) {
      setNotifications([]);
      setUnreadNotificationCount(0);
      return;
    }

    const loadNotifications = async () => {
      try {
        const res = await api.get('/notifications');
        if (res.data.success) {
          setNotifications(res.data.data.notifications);
          setUnreadNotificationCount(res.data.data.unreadCount);
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    };

    loadNotifications();
  }, [user?.id, token]);

  const joinProject = (projectId: string) => {
    socketRef.current?.emit('project:join', projectId);
  };

  const leaveProject = (projectId: string) => {
    socketRef.current?.emit('project:leave', projectId);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadNotificationCount(0);
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineCount,
        activities,
        notifications,
        unreadNotificationCount,
        joinProject,
        leaveProject,
        setActivities,
        setNotifications,
        setUnreadNotificationCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
