'use client';

import { useEffect, useState } from 'react';
import { Package, RefreshCw, Trash2, Pencil, X, Plus, Download, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Inventory, InventoryInsert } from '@/types/database';

// Auto-calculate status based on quantity
const calculateStatus = (quantity: number): string => {
  if (quantity === 0) return 'Out of Stock';
  if (quantity < 10) return 'Low Stock';
  return 'In Stock';
};

export default function InventoryTable() {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Inventory | null>(null);
  const [editForm, setEditForm] = useState({
    item_name: '',
    quantity: 0,
    location: '',
    price_per_unit: 0,
    max_discount: 20,
    discount_tier_1_qty: 0,
    discount_tier_1_percent: 0,
    discount_tier_2_qty: 0,
    discount_tier_2_percent: 0,
    discount_tier_3_qty: 0,
    discount_tier_3_percent: 0,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    sku: '',
    item_name: '',
    quantity: 0,
    location: '',
    price_per_unit: 0,
    max_discount: 20,
    discount_tier_1_qty: 0,
    discount_tier_1_percent: 0,
    discount_tier_2_qty: 0,
    discount_tier_2_percent: 0,
    discount_tier_3_qty: 0,
    discount_tier_3_percent: 0,
  });

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setInventory(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Filtered Inventory
  const filteredInventory = inventory.filter(item => {
    // Search by Item Name OR SKU
    const matchesSearch = 
      item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by Status (using same logic as calculateStatus)
    let matchesStatus = true;
    if (filterStatus === 'In Stock') {
      matchesStatus = item.quantity >= 10;
    } else if (filterStatus === 'Low Stock') {
      matchesStatus = item.quantity > 0 && item.quantity < 20;
    } else if (filterStatus === 'Out of Stock') {
      matchesStatus = item.quantity === 0;
    }
    // If "All", matchesStatus remains true
    
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this inventory item?')) return;

    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Refresh the list
      await fetchInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inventory item');
    }
  };

  const handleEdit = (item: Inventory) => {
    setEditingItem(item);
    setEditForm({
      item_name: item.item_name || '',
      quantity: item.quantity || 0,
      location: item.location || '',
      price_per_unit: item.price_per_unit || 0,
      max_discount: item.max_discount || 20,
      discount_tier_1_qty: item.discount_tier_1_qty || 0,
      discount_tier_1_percent: item.discount_tier_1_percent || 0,
      discount_tier_2_qty: item.discount_tier_2_qty || 0,
      discount_tier_2_percent: item.discount_tier_2_percent || 0,
      discount_tier_3_qty: item.discount_tier_3_qty || 0,
      discount_tier_3_percent: item.discount_tier_3_percent || 0,
    });
  };

  const handleUpdate = async () => {
    if (!editingItem) return;

    try {
      const calculatedStatus = calculateStatus(editForm.quantity);

      const { error } = await supabase
        .from('inventory')
        .update({
          item_name: editForm.item_name,
          quantity: editForm.quantity,
          location: editForm.location,
          price_per_unit: editForm.price_per_unit,
          max_discount: editForm.max_discount,
          discount_tier_1_qty: editForm.discount_tier_1_qty,
          discount_tier_1_percent: editForm.discount_tier_1_percent,
          discount_tier_2_qty: editForm.discount_tier_2_qty,
          discount_tier_2_percent: editForm.discount_tier_2_percent,
          discount_tier_3_qty: editForm.discount_tier_3_qty,
          discount_tier_3_percent: editForm.discount_tier_3_percent,
          status: calculatedStatus,
        })
        .eq('id', editingItem.id);

      if (error) throw error;

      setEditingItem(null);
      await fetchInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update inventory item');
    }
  };

  const handleAdd = async () => {
    try {
      const calculatedStatus = calculateStatus(addForm.quantity);

      const newItem: InventoryInsert = {
        sku: addForm.sku,
        item_name: addForm.item_name,
        quantity: addForm.quantity,
        location: addForm.location,
        price_per_unit: addForm.price_per_unit,
        max_discount: addForm.max_discount,
        discount_tier_1_qty: addForm.discount_tier_1_qty,
        discount_tier_1_percent: addForm.discount_tier_1_percent,
        discount_tier_2_qty: addForm.discount_tier_2_qty,
        discount_tier_2_percent: addForm.discount_tier_2_percent,
        discount_tier_3_qty: addForm.discount_tier_3_qty,
        discount_tier_3_percent: addForm.discount_tier_3_percent,
        status: calculatedStatus,
      };

      const { error } = await supabase
        .from('inventory')
        .insert([newItem]);

      if (error) throw error;

      setShowAddModal(false);
      setAddForm({
        sku: '',
        item_name: '',
        quantity: 0,
        location: '',
        price_per_unit: 0,
        max_discount: 20,
        discount_tier_1_qty: 0,
        discount_tier_1_percent: 0,
        discount_tier_2_qty: 0,
        discount_tier_2_percent: 0,
        discount_tier_3_qty: 0,
        discount_tier_3_percent: 0,
      });
      await fetchInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add inventory item');
    }
  };

  // CSV Export Function
  const downloadCSV = () => {
    // Use filtered inventory for export
    const dataToExport = filteredInventory;

    // Define headers
    const headers = ['SKU', 'Item Name', 'Quantity', 'Location', 'Price per Unit', 'Max Discount (%)', 'Status'];

    // Convert data to CSV format
    const csvRows = [
      headers.join(','), // header row
      ...dataToExport.map(item => {
        // Handle potential commas in data by wrapping in quotes
        return [
          `"${item.sku}"`,
          `"${item.item_name}"`,
          `"${item.quantity}"`,
          `"${item.location}"`,
          `"${item.price_per_unit}"`,
          `"${item.max_discount}"`,
          `"${item.status}"`
        ].join(',');
      })
    ];

    // Create file and trigger download
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Inventory Overview</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
          <button
            onClick={fetchInventory}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
        </div>
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
          >
            <option value="All">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      {loading && inventory.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading inventory...</span>
        </div>
      ) : filteredInventory.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {inventory.length === 0 
              ? 'No inventory items found. Add one to get started!' 
              : 'No items match your search criteria.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">SKU</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Item Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Quantity</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Location</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Price/Unit</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Max Discount</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => {
                // Calculate status dynamically based on current quantity
                const currentStatus = calculateStatus(item.quantity);
                const statusColor =
                  currentStatus === 'Out of Stock' ? 'text-red-600 bg-red-50' :
                  currentStatus === 'Low Stock' ? 'text-yellow-600 bg-yellow-50' :
                  'text-green-600 bg-green-50';

                return (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-gray-900 font-mono text-sm">{item.sku}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-600" />
                        <span className="text-gray-900 font-medium">{item.item_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-gray-900 font-semibold">{item.quantity}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{item.location}</td>
                    <td className="py-3 px-4 text-gray-900 font-medium">${(item.price_per_unit || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-gray-900">{item.max_discount || 0}%</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                        {currentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="Edit item"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Delete item"
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


      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add New Inventory Item</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Basic Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Basic Information</h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={addForm.sku}
                    onChange={(e) => setAddForm({ ...addForm, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="e.g., SKU-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                  <input
                    type="text"
                    value={addForm.item_name}
                    onChange={(e) => setAddForm({ ...addForm, item_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="e.g., Laptop"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={addForm.quantity}
                    onChange={(e) => setAddForm({ ...addForm, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="e.g., 100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={addForm.location}
                    onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="e.g., Warehouse A"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs text-blue-800">
                    <strong>Status Auto-calculated:</strong><br />
                    • Qty = 0 → Out of Stock<br />
                    • Qty &lt; 10 → Low Stock<br />
                    • Qty ≥ 10 → In Stock
                  </p>
                </div>
              </div>

              {/* Right Column - Pricing & Discounts */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Pricing & Discounts</h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price per Unit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={addForm.price_per_unit}
                    onChange={(e) => setAddForm({ ...addForm, price_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="e.g., 99.99"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Tiers (Max 20%)</label>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tier 1: Qty ≥</label>
                      <input
                        type="number"
                        min="0"
                        value={addForm.discount_tier_1_qty}
                        onChange={(e) => setAddForm({ ...addForm, discount_tier_1_qty: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder="e.g., 10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={addForm.discount_tier_1_percent}
                        onChange={(e) => setAddForm({ ...addForm, discount_tier_1_percent: Math.min(20, parseInt(e.target.value) || 0) })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder="e.g., 5"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tier 2: Qty ≥</label>
                      <input
                        type="number"
                        min="0"
                        value={addForm.discount_tier_2_qty}
                        onChange={(e) => setAddForm({ ...addForm, discount_tier_2_qty: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder="e.g., 50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={addForm.discount_tier_2_percent}
                        onChange={(e) => setAddForm({ ...addForm, discount_tier_2_percent: Math.min(20, parseInt(e.target.value) || 0) })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder="e.g., 10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tier 3: Qty ≥</label>
                      <input
                        type="number"
                        min="0"
                        value={addForm.discount_tier_3_qty}
                        onChange={(e) => setAddForm({ ...addForm, discount_tier_3_qty: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder="e.g., 100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={addForm.discount_tier_3_percent}
                        onChange={(e) => setAddForm({ ...addForm, discount_tier_3_percent: Math.min(20, parseInt(e.target.value) || 0) })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder="e.g., 15"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    Discounts apply automatically based on order quantity. Max discount capped at 20%.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
              <button
                onClick={handleAdd}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Add Item
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Edit Inventory Item</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Basic Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Basic Information</h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                  <input
                    type="text"
                    value={editForm.item_name}
                    onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs text-blue-800">
                    <strong>Status Auto-calculated:</strong><br />
                    • Qty = 0 → Out of Stock<br />
                    • Qty &lt; 10 → Low Stock<br />
                    • Qty ≥ 10 → In Stock
                  </p>
                </div>
              </div>

              {/* Right Column - Pricing & Discounts */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Pricing & Discounts</h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price per Unit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.price_per_unit}
                    onChange={(e) => setEditForm({ ...editForm, price_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Tiers (Max 20%)</label>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tier 1: Qty ≥</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.discount_tier_1_qty}
                        onChange={(e) => setEditForm({ ...editForm, discount_tier_1_qty: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder="e.g., 10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={editForm.discount_tier_1_percent}
                        onChange={(e) => setEditForm({ ...editForm, discount_tier_1_percent: Math.min(20, parseInt(e.target.value) || 0) })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder="e.g., 5"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tier 2: Qty ≥</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.discount_tier_2_qty}
                        onChange={(e) => setEditForm({ ...editForm, discount_tier_2_qty: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder="e.g., 50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={editForm.discount_tier_2_percent}
                        onChange={(e) => setEditForm({ ...editForm, discount_tier_2_percent: Math.min(20, parseInt(e.target.value) || 0) })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder="e.g., 10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tier 3: Qty ≥</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.discount_tier_3_qty}
                        onChange={(e) => setEditForm({ ...editForm, discount_tier_3_qty: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder="e.g., 100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={editForm.discount_tier_3_percent}
                        onChange={(e) => setEditForm({ ...editForm, discount_tier_3_percent: Math.min(20, parseInt(e.target.value) || 0) })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder="e.g., 15"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    Discounts apply automatically based on order quantity. Max discount capped at 20%.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
              <button
                onClick={handleUpdate}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Save
              </button>
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
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
