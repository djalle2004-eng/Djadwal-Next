'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Shield,
  Download,
  Users,
  Database,
  Plus,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  HardDrive,
  Key,
  UserCheck,
  UserX,
  Edit2,
  Trash2,
  X,
  FileJson
} from 'lucide-react';

import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Dialog,
  DialogTitle,
  DialogDescription,
  Skeleton,
  EmptyState
} from '@djadwal/ui';

import { api } from '@/lib/api';

interface UserItem {
  id: number;
  username: string;
  full_name?: string | null;
  email?: string | null;
  role: 'admin' | 'department_head' | 'staff' | 'professor' | string;
  is_active: number;
  last_login?: string | null;
  created_at?: string | null;
}

export default function BackupsAndUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Backup Download State
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [downloadingSql, setDownloadingSql] = useState(false);

  // Add / Edit User Modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [isActive, setIsActive] = useState(true);
  const [submittingUser, setSubmittingUser] = useState(false);

  // Permissions Modal
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [selectedUserForPerms, setSelectedUserForPerms] = useState<UserItem | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Load Users
  const loadUsers = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await api.listUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 2. Download JSON Full Snapshot
  const handleDownloadJsonBackup = async () => {
    try {
      setDownloadingJson(true);
      const snapshot = await api.getBackupSnapshot();
      const jsonStr = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `djadwal_snapshot_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('success', 'تم تنزيل النسخة الاحتياطية الشاملة (JSON Snapshot) بنجاح');
    } catch (err: any) {
      showToast('error', 'فشل تنزيل النسخة الاحتياطية');
    } finally {
      setDownloadingJson(false);
    }
  };

  // 3. Download SQL Backup Snapshot
  const handleDownloadSqlBackup = async () => {
    try {
      setDownloadingSql(true);
      const snapshot = await api.getBackupSnapshot();
      const dateStr = new Date().toISOString().split('T')[0];
      let sqlContent = `-- =========================================================\n`;
      sqlContent += `-- DJADWAL SYSTEM DATABASE SNAPSHOT\n`;
      sqlContent += `-- Exported At: ${new Date().toISOString()}\n`;
      sqlContent += `-- Total Assignments: ${snapshot.counts?.assignments_total ?? 0}\n`;
      sqlContent += `-- 2026-2027 Assignments: ${snapshot.counts?.assignments_2026_2027 ?? 0}\n`;
      sqlContent += `-- =========================================================\n\n`;

      // Helper to generate SQL INSERTs
      const dumpTable = (tableName: string, rows: any[]) => {
        if (!rows || rows.length === 0) return '';
        let out = `-- Table: ${tableName} (${rows.length} rows)\n`;
        const keys = Object.keys(rows[0]);
        for (const row of rows) {
          const values = keys.map(k => {
            const v = row[k];
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          });
          out += `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        return out + '\n';
      };

      if (snapshot.data) {
        sqlContent += dumpTable('academic_years', snapshot.data.academic_years);
        sqlContent += dumpTable('departments', snapshot.data.departments);
        sqlContent += dumpTable('rooms', snapshot.data.rooms);
        sqlContent += dumpTable('professors', snapshot.data.professors);
        sqlContent += dumpTable('courses', snapshot.data.courses);
        sqlContent += dumpTable('groups', snapshot.data.groups);
        sqlContent += dumpTable('assignments', snapshot.data.assignments);
        sqlContent += dumpTable('extra_sessions', snapshot.data.extra_sessions);
      }

      const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `djadwal_snapshot_${dateStr}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('success', 'تم توليد وتنزيل ملف SQL للاسترجاع الفوري بنجاح');
    } catch (err: any) {
      showToast('error', 'فشل توليد ملف SQL');
    } finally {
      setDownloadingSql(false);
    }
  };

  // 4. Open User Modal
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setFullName('');
    setEmail('');
    setRole('staff');
    setIsActive(true);
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (user: UserItem) => {
    setEditingUser(user);
    setUsername(user.username);
    setPassword('');
    setFullName(user.full_name || '');
    setEmail(user.email || '');
    setRole(user.role);
    setIsActive(user.is_active === 1);
    setUserModalOpen(true);
  };

  // 5. Save User
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    try {
      setSubmittingUser(true);
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          username: username.trim(),
          full_name: fullName.trim() || undefined,
          email: email.trim() || undefined,
          role,
          is_active: isActive ? 1 : 0,
          password: password.trim() ? password.trim() : undefined
        });
        showToast('success', 'تم تحديث بيانات المستخدم بنجاح');
      } else {
        if (!password.trim()) {
          showToast('error', 'كلمة المرور مطلوبة للمستخدم الجديد');
          setSubmittingUser(false);
          return;
        }
        await api.createUser({
          username: username.trim(),
          password: password.trim(),
          full_name: fullName.trim() || undefined,
          email: email.trim() || undefined,
          role
        });
        showToast('success', 'تم إنشاء حساب المستخدم بنجاح');
      }
      setUserModalOpen(false);
      await loadUsers();
    } catch (err: any) {
      showToast('error', err?.messageAr || err?.message || 'فشلت العملية');
    } finally {
      setSubmittingUser(false);
    }
  };

  // 6. Permissions Dialog
  const handleOpenPermissions = async (user: UserItem) => {
    setSelectedUserForPerms(user);
    setPermModalOpen(true);
    try {
      const res = await api.getUserPermissions(user.id);
      setUserPermissions(Array.isArray(res?.permissions) ? res.permissions : []);
    } catch (err) {
      setUserPermissions([]);
    }
  };

  const togglePermission = (perm: string) => {
    setUserPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedUserForPerms) return;
    try {
      setSavingPerms(true);
      await api.updateUserPermissions(selectedUserForPerms.id, userPermissions);
      showToast('success', 'تم تحديث صلاحيات المستخدم بنجاح');
      setPermModalOpen(false);
    } catch (err: any) {
      showToast('error', 'فشل حفظ الصلاحيات');
    } finally {
      setSavingPerms(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-16 font-sans" dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
                : 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors ms-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  النسخ الاحتياطي وإدارة المستخدمين والصلاحيات
                </h1>
                <Badge variant="success">Production Immunity & RBAC</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تنزيل لقطة احتياطية فورية على جهازك، إدارة المستخدمين، وتأمين الصلاحيات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadUsers}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* SECTION 1: INSTANT LOCAL BACKUP SNAPSHOT */}
        <Card className="border-emerald-200 dark:border-emerald-800/80 shadow-sm bg-gradient-to-br from-emerald-50/30 to-white dark:from-emerald-950/20 dark:to-slate-900">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2 text-emerald-900 dark:text-emerald-300">
                  <HardDrive className="h-5 w-5 text-emerald-600" />
                  <span>النسخ الاحتياطي الفوري والشامل (Instant Safety Snapshot)</span>
                </CardTitle>
                <CardDescription>
                  تحميل لقطة كاملة لقاعدة البيانات (كافة القاعات، الأساتذة، المقاييس، الأفواج، والتكليفات الـ 1,034 المعتمدة) بضغطة واحدة على جهازك الشخصي
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                {/* JSON Snapshot Button */}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDownloadJsonBackup}
                  disabled={downloadingJson}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
                >
                  <FileJson className="h-4 w-4" />
                  <span>{downloadingJson ? 'جاري تجهيز JSON...' : 'تنزيل لقطة JSON كاملة'}</span>
                </Button>

                {/* SQL Backup Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSqlBackup}
                  disabled={downloadingSql}
                  className="gap-2 text-xs text-emerald-800 border-emerald-300 hover:bg-emerald-50 font-semibold"
                >
                  <FileCode className="h-4 w-4" />
                  <span>{downloadingSql ? 'جاري تجهيز SQL...' : 'تنزيل ملف SQL'}</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-slate-500 block">إجمالي التكليفات بالقاعدة</span>
                <strong className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5 block">
                  4,987 تكليف
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-slate-500 block">تكليفات 2026-2027 الحالية</span>
                <strong className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  1,034 تكليف
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-slate-500 block">محرك التخزين الأساسي</span>
                <strong className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  Neon PostgreSQL
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-slate-500 block">نسخة الأمان الاحتياطية</span>
                <strong className="text-base font-bold text-teal-600 dark:text-teal-400 mt-0.5 block">
                  Turso Dual-Write
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: USERS & RBAC MANAGEMENT */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <span>إدارة حسابات المستخدمين وصلاحيات الوصول ({users.length})</span>
                </CardTitle>
                <CardDescription>
                  تعيين الأدوار والصلاحيات (مدير، رئيس قسم، موظف برمجة، أستاذ) وتفعيل الحسابات
                </CardDescription>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenAddUser}
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة مستخدم جديد</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <EmptyState
                title="لا يوجد مستخدمون مسجلون"
                description="ابدأ بإضافة أول حساب مستخدم للنظام"
              />
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3.5 px-4 text-start font-bold">اسم المستخدم</th>
                      <th className="py-3.5 px-4 text-start font-bold">الاسم الكامل</th>
                      <th className="py-3.5 px-4 text-start font-bold">البريد الإلكتروني</th>
                      <th className="py-3.5 px-4 text-start font-bold">الدور الوظيفي</th>
                      <th className="py-3.5 px-4 text-center font-bold">الحالة</th>
                      <th className="py-3.5 px-4 text-center font-bold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4 font-bold font-mono text-slate-900 dark:text-slate-100">
                          {u.username}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                          {u.full_name || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {u.email || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              u.role === 'admin'
                                ? 'primary'
                                : u.role === 'department_head'
                                ? 'info'
                                : 'neutral'
                            }
                          >
                            {u.role === 'admin'
                              ? 'مدير النظام (Admin)'
                              : u.role === 'department_head'
                              ? 'رئيس قسم'
                              : u.role === 'professor'
                              ? 'أستاذ'
                              : 'موظف برمجة'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {u.is_active === 1 ? (
                            <Badge variant="success">نشط</Badge>
                          ) : (
                            <Badge variant="danger">معطل</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* Edit User */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEditUser(u)}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-indigo-600"
                              title="تعديل الحساب"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>

                            {/* Permissions */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenPermissions(u)}
                              className="h-8 w-8 p-0 text-slate-600 hover:text-amber-600"
                              title="إدارة الصلاحيات المخصصة"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit User Modal */}
      <Dialog open={userModalOpen} onClose={() => setUserModalOpen(false)}>
        <div className="p-6 text-start max-w-md" dir="rtl">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <span>{editingUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}</span>
          </DialogTitle>

          <form onSubmit={handleSaveUser} className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                اسم المستخدم (Username) *
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {editingUser ? 'كلمة المرور الجديدة (اتركه فارغاً للإبقاء عليها)' : 'كلمة المرور *'}
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!editingUser}
                className="w-full text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                الاسم الكامل
              </label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: د. لخضر حمادي"
                className="w-full text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                البريد الإلكتروني
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  الدور الوظيفي *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="admin">مدير النظام (Admin)</option>
                  <option value="department_head">رئيس قسم</option>
                  <option value="staff">موظف برمجة</option>
                  <option value="professor">أستاذ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  حالة الحساب
                </label>
                <select
                  value={isActive ? '1' : '0'}
                  onChange={(e) => setIsActive(e.target.value === '1')}
                  className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="1">حساب مفعّل</option>
                  <option value="0">حساب معطّل</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t">
              <Button type="button" variant="outline" onClick={() => setUserModalOpen(false)}>
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submittingUser}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                {submittingUser ? 'جاري الحفظ...' : editingUser ? 'تحديث البيانات' : 'إنشاء المستخدم'}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* Permissions Modal */}
      <Dialog open={permModalOpen} onClose={() => setPermModalOpen(false)}>
        <div className="p-6 text-start max-w-md" dir="rtl">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-600" />
            <span>صلاحيات المستخدم ({selectedUserForPerms?.username})</span>
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-slate-500">
            تخصيص الوصول المباشر للوحدات والشاشات الحساسة
          </DialogDescription>

          <div className="space-y-2 mt-4 text-xs">
            {[
              { id: 'schedules_manage', label: 'إدارة وتعديل الجداول الزمنية الأسبوعية' },
              { id: 'assignments_manage', label: 'إسناد الحصص والتكليفات والاستيراد الذري' },
              { id: 'rooms_manage', label: 'إدارة القاعات وحجز الحصص التعويضية' },
              { id: 'professors_manage', label: 'إدارة الأساتذة والنصاب السنوي' },
              { id: 'print_settings_manage', label: 'تعديل إعدادات الطباعة الرسمية' },
              { id: 'backup_export', label: 'تنزيل النسخ الاحتياطية للنظام' },
              { id: 'audit_undo', label: 'التراجع الذري عن التعديلات (Undo)' },
            ].map(p => (
              <label
                key={p.id}
                className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={userPermissions.includes(p.id)}
                  onChange={() => togglePermission(p.id)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-800 dark:text-slate-200">{p.label}</span>
              </label>
            ))}
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => setPermModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={savingPerms}
              onClick={handleSavePermissions}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              {savingPerms ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
