import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext.js';
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
      setActivities((prev) => [newActivity, ...prev.slice(0, 49)]);

      // Automatically invalidate related queries to trigger seamless UI updates without full refresh
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    });

    // Real-time in-app notifications
    s.on('notification:new', (newNotification: NotificationItem) => {
      setNotifications((prev) => [newNotification, ...prev]);
      setUnreadNotificationCount((prev) => prev + 1);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [user, token, queryClient]);

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
