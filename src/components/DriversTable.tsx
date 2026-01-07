'use client';

import { useEffect, useState } from 'react';
import { Users, RefreshCw, Trash2, Pencil, X, Plus, Phone, CreditCard, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Driver, DriverInsert } from '@/types/database';

export default function DriversTable() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    status: 'Idle' as 'Idle' | 'Busy',
    phone: '',
    license_number: '',
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    status: 'Idle' as 'Idle' | 'Busy',
    phone: '',
    license_number: '',
  });

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch drivers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  // Filtered Drivers
  const filteredDrivers = drivers.filter(driver => {
    // Search by Name, Phone, or License Number
    const matchesSearch =
      driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (driver.phone && driver.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (driver.license_number && driver.license_number.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filter by Status
    const matchesStatus = filterStatus === 'All' || driver.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string, status: Driver['status']) => {
    // Prevent deletion of drivers that are Busy
    if (status === 'Busy') {
      setError('Cannot delete driver while Busy. Cancel the active shipment first.');
      return;
    }

    if (!confirm('Are you sure you want to delete this driver?')) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete driver');
    }
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setEditForm({
      name: driver.name || '',
      status: driver.status || 'Idle',
      phone: driver.phone || '',
      license_number: driver.license_number || '',
    });
  };

  const handleUpdate = async () => {
    if (!editingDriver) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          name: editForm.name,
          status: editForm.status,
          phone: editForm.phone || null,
          license_number: editForm.license_number || null,
        })
        .eq('id', editingDriver.id);

      if (error) throw error;

      setEditingDriver(null);
      await fetchDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update driver');
    }
  };

  const handleAdd = async () => {
    try {
      const newDriver: DriverInsert = {
        name: addForm.name,
        status: addForm.status,
        phone: addForm.phone || undefined,
        license_number: addForm.license_number || undefined,
      };

      const { error } = await supabase
        .from('drivers')
        .insert([newDriver]);

      if (error) throw error;

      setShowAddModal(false);
      setAddForm({
        name: '',
        status: 'Idle',
        phone: '',
        license_number: '',
      });
      await fetchDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add driver');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Drivers Management</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchDrivers}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Driver
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, phone, or license..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="All">All Status</option>
            <option value="Idle">Idle</option>
            <option value="Busy">Busy</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading drivers...</span>
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm || filterStatus !== 'All' ? 'No drivers found matching your filters' : 'No drivers found. Add your first driver to get started.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Phone</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">License Number</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Added</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.map((driver) => {
                const statusColor =
                  driver.status === 'Idle'
                    ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
                    : 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20';

                return (
                  <tr key={driver.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-gray-900 dark:text-gray-100 font-medium">{driver.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                        {driver.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {driver.phone ? (
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <span className="font-mono text-sm">{driver.phone}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600 text-sm">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {driver.license_number ? (
                        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <CreditCard className="w-4 h-4 text-gray-500" />
                          <span className="font-mono text-sm">{driver.license_number}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600 text-sm">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                        <Clock className="w-4 h-4" />
                        {new Date(driver.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(driver)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Edit driver"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(driver.id, driver.status)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                          title={driver.status === 'Busy' ? 'Cannot delete driver while Busy' : 'Delete driver'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Driver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Add New Driver</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Driver Name *
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="e.g., John Smith"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status *
                </label>
                <select
                  value={addForm.status}
                  onChange={(e) => setAddForm({ ...addForm, status: e.target.value as 'Idle' | 'Busy' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="Idle">Idle</option>
                  <option value="Busy">Busy</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="e.g., +1-555-0101"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  License Number
                </label>
                <input
                  type="text"
                  value={addForm.license_number}
                  onChange={(e) => setAddForm({ ...addForm, license_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="e.g., DL12345"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button
                onClick={handleAdd}
                disabled={!addForm.name}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Driver
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Driver Modal */}
      {editingDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Driver</h3>
              <button
                onClick={() => setEditingDriver(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Driver Name *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status *
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'Idle' | 'Busy' })}
                  disabled={editingDriver?.status === 'Busy'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  <option value="Idle">Idle</option>
                  <option value="Busy">Busy</option>
                </select>
                {editingDriver?.status === 'Busy' && (
                  <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                    Currently on active shipment. Cancel shipment to reset.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  License Number
                </label>
                <input
                  type="text"
                  value={editForm.license_number}
                  onChange={(e) => setEditForm({ ...editForm, license_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <button
                onClick={handleUpdate}
                disabled={!editForm.name}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingDriver(null)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
