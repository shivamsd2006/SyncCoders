export type Role = 'ADMIN' | 'PM' | 'DEVELOPER';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
  _count?: {
    projects: number;
  };
}

export interface Project {
  id: string;
  title: string;
  description?: string | null;
  clientId: string;
  client?: Client;
  createdBy: string;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
  tasks?: Task[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  project?: {
    id: string;
    title: string;
    createdBy?: string;
  };
  assignedTo?: string | null;
  assignee?: {
    id: string;
    name: string;
    email: string;
  } | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName?: string;
  userId: string;
  userName: string;
  oldStatus: string;
  newStatus: string;
  formattedMessage: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  taskId?: string | null;
  task?: {
    id: string;
    title: string;
    projectId: string;
  } | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminStats {
  role: 'ADMIN';
  totalProjects: number;
  totalClients: number;
  totalUsers: number;
  tasksByStatus: Record<TaskStatus, number>;
  overdueTasksCount: number;
  onlineUsersCount: number;
}

export interface PMStats {
  role: 'PM';
  projectsCount: number;
  projectsSummary: Project[];
  tasksByPriority: Record<TaskPriority, number>;
  upcomingDueThisWeek: Task[];
  overdueTasksCount: number;
  onlineUsersCount: number;
}

export interface DevStats {
  role: 'DEVELOPER';
  assignedTasksCount: number;
  pendingTasksCount: number;
  overdueTasksCount: number;
  onlineUsersCount: number;
}
