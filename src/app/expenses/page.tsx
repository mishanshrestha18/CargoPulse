'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Expense, ExpenseStatus } from '@/types/database';
import {
  DollarSign,
  Upload,
  Check,
  X,
  Clock,
  FileText,
  Loader2,
  AlertCircle,
  Receipt
} from 'lucide-react';

export default function ExpensesPage() {
  const { user, userRole } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for drivers
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Admin filter
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('pending');

  const isAdmin = userRole === 'admin';
  const isDriver = userRole === 'driver';

  useEffect(() => {
    fetchExpenses();
  }, [user, statusFilter]);

  const fetchExpenses = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('expenses')
        .select('*')
        .order('created_at', { ascending: false });

      // Drivers only see their own expenses
      if (isDriver) {
        query = query.eq('user_id', user.id);
      } else if (statusFilter !== 'all') {
        // Admins can filter by status
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setExpenses(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !description) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      let receipt_url: string | undefined;

      // Upload receipt if provided
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, receiptFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);

        receipt_url = publicUrl;
      }

      // Get driver name from profile or user metadata
      const driverName = user.user_metadata?.full_name || user.email || 'Unknown Driver';

      const { error: insertError } = await supabase
        .from('expenses')
        .insert({
          user_id: user.id,
          driver_name: driverName,
          amount: parseFloat(amount),
          description,
          receipt_url,
          status: 'pending'
        });

      if (insertError) throw insertError;

      setSuccess('Expense submitted successfully!');
      setAmount('');
      setDescription('');
      setReceiptFile(null);
      fetchExpenses();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (expenseId: string, newStatus: ExpenseStatus, reason?: string) => {
    if (!user) return;

    try {
      const updateData: Partial<Expense> = {
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      };

      if (reason) {
        updateData.rejection_reason = reason;
      }

      const { error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', expenseId);

      if (error) throw error;

      setSuccess(`Expense ${newStatus} successfully!`);
      fetchExpenses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReject = (expenseId: string) => {
    const reason = prompt('Enter rejection reason (optional):');
    handleUpdateStatus(expenseId, 'rejected', reason || undefined);
  };

  const getStatusBadge = (status: ExpenseStatus) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };

    const icons = {
      pending: <Clock className="w-3 h-3" />,
      approved: <Check className="w-3 h-3" />,
      rejected: <X className="w-3 h-3" />,
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Receipt className="w-7 h-7" />
          Expense Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {isDriver ? 'Submit and track your expenses' : 'Review and manage expense submissions'}
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-400">
          <Check className="w-5 h-5 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Driver View: Submit Expense Form */}
      {isDriver && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Submit New Expense
          </h2>

          <form onSubmit={handleSubmitExpense} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Receipt (optional)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-400 file:font-medium file:cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Describe the expense (e.g., Fuel for delivery route #123)"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !amount || !description}
              className="w-full md:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Submit Expense
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Admin View: Filter */}
      {isAdmin && (
        <div className="mb-6 flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {isDriver ? 'Your Expenses' : 'All Expenses'}
          </h2>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No expenses found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Driver
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Receipt
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {new Date(expense.created_at).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {expense.driver_name}
                      </td>
                    )}
                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                      {expense.description}
                      {expense.rejection_reason && (
                        <p className="text-xs text-red-500 mt-1">
                          Reason: {expense.rejection_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      ${expense.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {expense.receipt_url ? (
                        <a
                          href={expense.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                        >
                          <FileText className="w-4 h-4" />
                          View
                        </a>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getStatusBadge(expense.status)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        {expense.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateStatus(expense.id, 'approved')}
                              className="p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(expense.id)}
                              className="p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                              title="Reject"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
