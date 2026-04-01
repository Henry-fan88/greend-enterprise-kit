import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, User as UserIcon } from 'lucide-react';
import { User } from '../store';

type UserRecord = Omit<User, 'department'> & {
  username: string;
  department: string;
  createdAt?: string;
};

type FormState = {
  name: string;
  username: string;
  password: string;
  role: User['role'];
  department: User['department'];
};

const ROLES: User['role'][] = ['admin', 'editor', 'viewer'];
const DEPARTMENTS: User['department'][] = ['Sustainability', 'R&D', 'Factory', 'HR'];

const emptyForm = (): FormState => ({
  name: '',
  username: '',
  password: '',
  role: 'viewer',
  department: 'Sustainability',
});

export default function UserManagement({
  currentUser,
  onClose,
}: {
  currentUser: User;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = () => {
    fetch('/api/users')
      .then(r => r.json())
      .then(setUsers)
      .catch(() => setLoadError('Failed to load users'));
  };

  useEffect(() => { loadUsers(); }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setFormError('');
    setMode('create');
  };

  const openEdit = (u: UserRecord) => {
    setEditingId(u.id);
    setForm({ name: u.name, username: u.username, password: '', role: u.role, department: u.department as User['department'] });
    setFormError('');
    setMode('edit');
  };

  const cancelForm = () => {
    setMode('list');
    setEditingId(null);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    const body: Record<string, string> = {
      name: form.name,
      username: form.username,
      role: form.role,
      department: form.department,
    };
    if (form.password) body.password = form.password;
    if (mode === 'create') body.password = form.password; // required on create

    const url = mode === 'create' ? '/api/users' : `/api/users/${editingId}`;
    const method = mode === 'create' ? 'POST' : 'PUT';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setFormError(data.error || 'Failed to save user');
      setSubmitting(false);
      return;
    }

    loadUsers();
    setMode('list');
    setEditingId(null);
    setSubmitting(false);
  };

  const handleDelete = async (u: UserRecord) => {
    if (!window.confirm(`Delete account "${u.name}" (@${u.username})? This cannot be undone.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    if (res.ok) {
      loadUsers();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete user');
    }
  };

  const roleLabel = (role: string) => {
    if (role === 'admin') return 'Admin';
    if (role === 'editor') return 'Editor';
    return 'Viewer';
  };

  const roleBadge = (role: string) => {
    if (role === 'admin') return 'bg-purple-100 text-purple-700';
    if (role === 'editor') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4">
          <h2 className="text-2xl font-bold">User Management</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-8 pb-8">
          {mode === 'list' ? (
            <>
              {loadError && (
                <p className="text-sm text-red-500 mb-4">{loadError}</p>
              )}

              <div className="flex justify-end mb-4">
                <button
                  onClick={openCreate}
                  className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add User</span>
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Username</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Department</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 uppercase">
                              {u.name.charAt(0)}
                            </div>
                            <span>{u.name}</span>
                            {u.id === currentUser.id && (
                              <span className="text-xs text-gray-400">(you)</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">@{u.username}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(u.role)}`}>
                            {roleLabel(u.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{u.department}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => openEdit(u)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(u)}
                              disabled={u.id === currentUser.id}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={u.id === currentUser.id ? 'Cannot delete own account' : 'Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {mode === 'create' ? 'Create New User' : 'Edit User'}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    placeholder="e.g. Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                    placeholder="e.g. jsmith"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {mode === 'edit' && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required={mode === 'create'}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  placeholder={mode === 'create' ? 'Set a password' : 'New password (optional)'}
                  autoComplete="new-password"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as User['role'] }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{roleLabel(r)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={form.department}
                    onChange={e => setForm(f => ({ ...f, department: e.target.value as User['department'] }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Role description */}
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <p><span className="font-semibold text-purple-700">Admin:</span> Full access — can view, add, edit, delete records and manage user accounts</p>
                <p><span className="font-semibold text-blue-700">Editor:</span> Can view, add, and edit records; cannot delete or manage users</p>
                <p><span className="font-semibold text-gray-600">Viewer:</span> Read-only access — can view and export data only</p>
              </div>

              {formError && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : mode === 'create' ? 'Create User' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
