'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Plus, 
  CheckCircle2, 
  X, 
  Trash2, 
  FileSearch, 
  Settings, 
  Database, 
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  StickyNote,
  ListTodo,
  Wrench
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Stats {
  totalUsers: number;
  pendingUsers: number;
  activeUsers: number;
  suspendedUsers: number;
}

interface PendingUser {
  id: string;
  username: string;
  email?: string | null;
  createdAt: string;
}

interface RecentActivity {
  id: string;
  changeType: string;
  changedBy: { username: string };
  changedAt: string;
  customer: { clientName: string; dbxCustomerId: string } | null;
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
}

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

interface MaintenanceItem {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  completed: boolean;
  recurring?: 'weekly' | 'monthly' | null;
}

interface ApiPreference {
  id: string;
  userId: string;
  preferenceType: 'note' | 'todo' | 'maintenance';
  title: string | null;
  content: string | null;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');

  // Todo state
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');

  // Maintenance state
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);
  const [newMaintenance, setNewMaintenance] = useState({ title: '', description: '', dueDate: '', recurring: '' as 'weekly' | 'monthly' | '' });
  const [preferencesLoading, setPreferencesLoading] = useState(true);

  // Load preferences from API
  useEffect(() => {
    fetchPreferences();
  }, []);

  useEffect(() => {
    fetchStats();
    fetchRecentActivity();
  }, []);

  const fetchPreferences = async () => {
    setPreferencesLoading(true);
    try {
      // Fetch all preferences
      const response = await fetch('/api/admin/preferences');
      const data = await response.json();

      if (data.success) {
        const prefs: ApiPreference[] = data.preferences || [];
        
        // Parse notes
        const notesData = prefs
          .filter(p => p.preferenceType === 'note')
          .map(p => ({
            id: p.id,
            content: p.content || '',
            createdAt: p.createdAt,
          }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10);
        setNotes(notesData);

        // Parse todos
        const todosData = prefs
          .filter(p => p.preferenceType === 'todo')
          .map(p => ({
            id: p.id,
            text: p.content || p.title || '',
            completed: p.metadata?.completed || false,
            createdAt: p.createdAt,
          }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTodos(todosData);

        // Parse maintenance
        const maintenanceData = prefs
          .filter(p => p.preferenceType === 'maintenance')
          .map(p => ({
            id: p.id,
            title: p.title || '',
            description: p.metadata?.description || '',
            dueDate: p.metadata?.dueDate || '',
            completed: p.metadata?.completed || false,
            recurring: p.metadata?.recurring || null,
          }))
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        setMaintenanceItems(maintenanceData);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setPreferencesLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();

      if (!data.success) {
        router.push('/login');
        return;
      }

      const users = data.users || [];
      const pending = users.filter((u: any) => u.status === 'pending').slice(0, 5);
      setPendingUsers(pending);
      setStats({
        totalUsers: users.length,
        pendingUsers: users.filter((u: any) => u.status === 'pending').length,
        activeUsers: users.filter((u: any) => u.status === 'active').length,
        suspendedUsers: users.filter((u: any) => u.status === 'suspended').length,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    setActivityLoading(true);
    try {
      const response = await fetch('/api/timeline?period=day&limit=10');
      const data = await response.json();

      if (data.success) {
        setRecentActivity(data.changes || []);
      }
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  // Notes functions
  const saveNote = async () => {
    if (!newNote.trim()) return;
    try {
      const response = await fetch('/api/admin/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferenceType: 'note',
          content: newNote,
        }),
      });
      const data = await response.json();
      if (data.success) {
        const note: Note = {
          id: data.preference.id,
          content: data.preference.content || '',
          createdAt: data.preference.createdAt,
        };
        const updated = [note, ...notes].slice(0, 10);
        setNotes(updated);
        setNewNote('');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note. Please try again.');
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/preferences/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        const updated = notes.filter(n => n.id !== id);
        setNotes(updated);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note. Please try again.');
    }
  };

  // Todo functions
  const addTodo = async () => {
    if (!newTodo.trim()) return;
    try {
      const response = await fetch('/api/admin/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferenceType: 'todo',
          title: newTodo,
          content: newTodo,
          metadata: { completed: false },
        }),
      });
      const data = await response.json();
      if (data.success) {
        const todo: Todo = {
          id: data.preference.id,
          text: data.preference.content || data.preference.title || '',
          completed: false,
          createdAt: data.preference.createdAt,
        };
        const updated = [todo, ...todos];
        setTodos(updated);
        setNewTodo('');
      }
    } catch (error) {
      console.error('Error adding todo:', error);
      alert('Failed to add todo. Please try again.');
    }
  };

  const toggleTodo = async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const newCompleted = !todo.completed;
    try {
      const response = await fetch(`/api/admin/preferences/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: { completed: newCompleted },
        }),
      });
      const data = await response.json();
      if (data.success) {
        const updated = todos.map(t => t.id === id ? { ...t, completed: newCompleted } : t);
        setTodos(updated);
      }
    } catch (error) {
      console.error('Error toggling todo:', error);
      alert('Failed to update todo. Please try again.');
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/preferences/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        const updated = todos.filter(t => t.id !== id);
        setTodos(updated);
      }
    } catch (error) {
      console.error('Error deleting todo:', error);
      alert('Failed to delete todo. Please try again.');
    }
  };

  // Maintenance functions
  const addMaintenance = async () => {
    if (!newMaintenance.title.trim() || !newMaintenance.dueDate) return;
    try {
      const response = await fetch('/api/admin/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferenceType: 'maintenance',
          title: newMaintenance.title,
          content: newMaintenance.description,
          metadata: {
            description: newMaintenance.description,
            dueDate: newMaintenance.dueDate,
            completed: false,
            recurring: newMaintenance.recurring || null,
          },
        }),
      });
      const data = await response.json();
      if (data.success) {
        const item: MaintenanceItem = {
          id: data.preference.id,
          title: data.preference.title || '',
          description: data.preference.metadata?.description || '',
          dueDate: data.preference.metadata?.dueDate || '',
          completed: false,
          recurring: data.preference.metadata?.recurring || null,
        };
        const updated = [item, ...maintenanceItems];
        setMaintenanceItems(updated);
        setNewMaintenance({ title: '', description: '', dueDate: '', recurring: '' });
      }
    } catch (error) {
      console.error('Error adding maintenance:', error);
      alert('Failed to add maintenance item. Please try again.');
    }
  };

  const toggleMaintenance = async (id: string) => {
    const item = maintenanceItems.find(m => m.id === id);
    if (!item) return;
    const newCompleted = !item.completed;
    try {
      const response = await fetch(`/api/admin/preferences/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: {
            ...item,
            completed: newCompleted,
          },
        }),
      });
      const data = await response.json();
      if (data.success) {
        const updated = maintenanceItems.map(m => m.id === id ? { ...m, completed: newCompleted } : m);
        setMaintenanceItems(updated);
      }
    } catch (error) {
      console.error('Error toggling maintenance:', error);
      alert('Failed to update maintenance item. Please try again.');
    }
  };

  const deleteMaintenance = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/preferences/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        const updated = maintenanceItems.filter(m => m.id !== id);
        setMaintenanceItems(updated);
      }
    } catch (error) {
      console.error('Error deleting maintenance:', error);
      alert('Failed to delete maintenance item. Please try again.');
    }
  };

  const getUpcomingMaintenance = () => {
    const now = new Date();
    return maintenanceItems
      .filter(m => !m.completed && new Date(m.dueDate) >= now)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const upcomingMaintenance = getUpcomingMaintenance();
  const completedTodos = todos.filter(t => t.completed).length;
  const totalTodos = todos.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage users and system settings
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pendingUsers || 0}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeUsers || 0}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suspended</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.suspendedUsers || 0}</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats && stats.pendingUsers > 0 && (
                <Link href="/admin/users?status=pending">
                  <Button variant="default" className="gap-2 relative border-2 border-yellow-500 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950 dark:hover:bg-yellow-900">
                    <AlertCircle className="h-4 w-4 text-yellow-600 animate-pulse" />
                    <span className="font-semibold">Approve Users</span>
                    <Badge variant="destructive" className="ml-1">
                      {stats.pendingUsers}
                    </Badge>
                  </Button>
                </Link>
              )}
              <Link href="/admin/users">
                <Button variant="outline" className="gap-2">
                  <Users className="h-4 w-4" />
                  Manage Users
                </Button>
              </Link>
              <Link href="/admin/audit-logs?period=day">
                <Button variant="outline" className="gap-2">
                  <FileSearch className="h-4 w-4" />
                  View Today's Activity
                </Button>
              </Link>
              <Link href="/admin/data-management">
                <Button variant="outline" className="gap-2">
                  <Database className="h-4 w-4" />
                  Data Management
                </Button>
              </Link>
              <Link href="/admin/settings">
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  System Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Pending Items */}
          {stats && stats.pendingUsers > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                        Pending Approvals
                      </CardTitle>
                      <CardDescription>
                        {stats.pendingUsers} user{stats.pendingUsers !== 1 ? 's' : ''} awaiting approval
                      </CardDescription>
                    </div>
                    <Link href="/admin/users?status=pending">
                      <Button variant="ghost" size="sm">View All</Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingUsers.slice(0, 5).map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.email || 'No email'} • {formatDate(user.createdAt)}
                          </p>
                        </div>
                        <Link href={`/admin/users/${user.id}`}>
                          <Button size="sm" variant="default">Approve</Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>Last 10 system changes</CardDescription>
                  </div>
                  <Link href="/admin/audit-logs">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.changedBy.username}</p>
                          <p className="text-xs text-muted-foreground">
                            {activity.changeType.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                            {activity.customer && ` • ${activity.customer.clientName}`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDateTime(activity.changedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Admin Notes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.7 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <StickyNote className="h-5 w-5" />
                  Admin Notes
                </CardTitle>
                <CardDescription>Quick notes and reminders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="min-h-[80px]"
                    maxLength={500}
                  />
                </div>
                <Button onClick={saveNote} size="sm" disabled={!newNote.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Save Note
                </Button>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {notes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="p-3 border rounded-lg bg-muted/50">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm flex-1 whitespace-pre-wrap">{note.content}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteNote(note.id)}
                            className="h-6 w-6"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDateTime(note.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* To-Do List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.8 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListTodo className="h-5 w-5" />
                  To-Do List
                  {totalTodos > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {completedTodos}/{totalTodos}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Track your admin tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a task..."
                    value={newTodo}
                    onChange={(e) => setNewTodo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                  />
                  <Button onClick={addTodo} size="icon" disabled={!newTodo.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {todos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No tasks yet</p>
                  ) : (
                    todos.map((todo) => (
                      <div
                        key={todo.id}
                        className={`flex items-center gap-3 p-3 border rounded-lg ${
                          todo.completed ? 'bg-muted/50 opacity-60' : ''
                        }`}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleTodo(todo.id)}
                          className="h-5 w-5"
                        >
                          {todo.completed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <div className="h-4 w-4 border-2 rounded" />
                          )}
                        </Button>
                        <span
                          className={`flex-1 text-sm ${
                            todo.completed ? 'line-through text-muted-foreground' : ''
                          }`}
                        >
                          {todo.text}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTodo(todo.id)}
                          className="h-6 w-6"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Maintenance Calendar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.9 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Maintenance Schedule
                </CardTitle>
                <CardDescription>Upcoming maintenance tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Task title"
                    value={newMaintenance.title}
                    onChange={(e) => setNewMaintenance({ ...newMaintenance, title: e.target.value })}
                  />
                  <Input
                    type="date"
                    value={newMaintenance.dueDate}
                    onChange={(e) => setNewMaintenance({ ...newMaintenance, dueDate: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button onClick={addMaintenance} size="sm" disabled={!newMaintenance.title || !newMaintenance.dueDate}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {upcomingMaintenance.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No upcoming maintenance</p>
                  ) : (
                    upcomingMaintenance.map((item) => {
                      const isOverdue = new Date(item.dueDate) < new Date() && !item.completed;
                      return (
                        <div
                          key={item.id}
                          className={`p-3 border rounded-lg ${
                            isOverdue ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleMaintenance(item.id)}
                                  className="h-5 w-5"
                                >
                                  {item.completed ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <div className="h-4 w-4 border-2 rounded" />
                                  )}
                                </Button>
                                <span className={`text-sm font-medium ${item.completed ? 'line-through' : ''}`}>
                                  {item.title}
                                </span>
                                {item.recurring && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.recurring}
                                  </Badge>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs text-muted-foreground ml-7 mt-1">{item.description}</p>
                              )}
                              <p className={`text-xs ml-7 mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                Due: {formatDate(item.dueDate)}
                                {isOverdue && ' (Overdue)'}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMaintenance(item.id)}
                              className="h-6 w-6"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

