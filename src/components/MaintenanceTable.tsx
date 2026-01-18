'use client';

import { useEffect, useState } from 'react';
import { Wrench, RefreshCw, Plus, CheckCircle, Clock, DollarSign, Truck, Plane } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MaintenanceLog, MaintenanceLogInsert, Vehicle } from '@/types/database';

export default function MaintenanceTable() {
  const [maintenanceLogs, setMaintenanceLogs] = useState<(MaintenanceLog & { vehicle?: Vehicle })[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<MaintenanceLogInsert>({
    vehicle_id: '',
    description: '',
    cost: 0,
    status: 'In Progress',
  });

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch maintenance logs with vehicle info
      const { data: logs, error: logsError } = await supabase
        .from('maintenance_logs')
        .select(`
          *,
          vehicles (*)
        `)
        .order('created_at', { ascending: false });

      if (logsError) throw logsError;

      // Fetch all vehicles
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .order('name');

      if (vehiclesError) throw vehiclesError;

      setMaintenanceLogs((logs || []).map(log => ({
        ...log,
        vehicle: (log as any).vehicles
      })));
      setVehicles(vehiclesData || []);
    } catch (err) {
      console.error('Error fetching maintenance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Insert maintenance log
      const { error: logError } = await supabase
        .from('maintenance_logs')
        .insert([addForm]);

      if (logError) throw logError;

      // Update vehicle status to Maintenance
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({ status: 'Maintenance' })
        .eq('id', addForm.vehicle_id);

      if (vehicleError) throw vehicleError;

      // Reset form and close modal
      setAddForm({
        vehicle_id: '',
        description: '',
        cost: 0,
        status: 'In Progress',
      });
      setShowAddModal(false);

      // Refresh data
      await fetchData();
    } catch (err) {
      console.error('Error adding maintenance:', err);
    }
  };

  const handleCompleteMaintenance = async (logId: string, vehicleId: string) => {
    try {
      // Update maintenance log status
      const { error: logError } = await supabase
        .from('maintenance_logs')
        .update({
          status: 'Completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', logId);

      if (logError) throw logError;

      // Update vehicle status to Idle
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({ status: 'Idle' })
        .eq('id', vehicleId);

      if (vehicleError) throw vehicleError;

      // Refresh data
      await fetchData();
    } catch (err) {
      console.error('Error completing maintenance:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading maintenance logs...</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Maintenance History</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
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
            Add Maintenance
          </button>
        </div>
      </div>

      {/* Maintenance Logs Table */}
      {maintenanceLogs.length === 0 ? (
        <div className="text-center py-12">
          <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No maintenance logs found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Vehicle</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Description</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Cost</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {maintenanceLogs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {log.vehicle?.type === 'Airplane' ? (
                        <Plane className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Truck className="w-4 h-4 text-green-600 dark:text-green-400" />
                      )}
                      <span className="text-gray-900 dark:text-gray-100 font-medium">{log.vehicle?.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{log.description}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-gray-900 dark:text-gray-100 font-medium">
                      <DollarSign className="w-4 h-4" />
                      {log.cost.toFixed(2)}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {log.status === 'Completed' ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" />
                        Completed
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400 flex items-center gap-1 w-fit">
                        <Clock className="w-3 h-3" />
                        In Progress
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-900 dark:text-gray-100 text-sm">
                    {new Date(log.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    {log.status === 'In Progress' && (
                      <button
                        onClick={() => handleCompleteMaintenance(log.id, log.vehicle_id)}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                      >
                        Mark Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Maintenance Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Add Maintenance Log</h3>
            <form onSubmit={handleAddMaintenance}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Vehicle
                  </label>
                  <select
                    value={addForm.vehicle_id}
                    onChange={(e) => setAddForm({ ...addForm, vehicle_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select vehicle...</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} ({vehicle.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={addForm.description}
                    onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                    required
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Describe the maintenance work..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cost ($)
                  </label>
                  <input
                    type="number"
                    value={addForm.cost}
                    onChange={(e) => setAddForm({ ...addForm, cost: parseFloat(e.target.value) || 0 })}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Maintenance
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
