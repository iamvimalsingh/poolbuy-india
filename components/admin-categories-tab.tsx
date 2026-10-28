'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit3,
  CheckCircle2,
  AlertCircle,
  X,
  ToggleLeft,
  ToggleRight,
  Layers,
  Loader2,
} from 'lucide-react';
import { Category } from '@/types';
import { slugify } from '@/lib/format';

export function AdminCategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Edit modal state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSortOrder, setEditSortOrder] = useState<number>(1);
  const [editIsActive, setEditIsActive] = useState(true);

  // Create form state
  const [newLabel, setNewLabel] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSortOrder, setNewSortOrder] = useState<number>(1);
  const [newIsActive, setNewIsActive] = useState(true);

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCategories(data.data.sort((a: Category, b: Category) => a.sortOrder - b.sortOrder));
      } else {
        setErrorMessage(data.error?.message || 'Failed to load categories.');
      }
    } catch {
      setErrorMessage('Network error loading categories.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    void (async () => {
      if (!ignore) await loadCategories();
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const handleToggleActive = async (category: Category) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !category.isActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to update category status.');
        return;
      }
      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? { ...c, isActive: !category.isActive } : c))
      );
      setSuccessMessage(
        `Category "${category.label}" ${!category.isActive ? 'activated' : 'deactivated'} successfully.`
      );
    } catch {
      setErrorMessage('Network error updating category status.');
    }
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setEditLabel(category.label);
    setEditDescription(category.description || '');
    setEditSortOrder(category.sortOrder);
    setEditIsActive(category.isActive);
    setModalError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setModalError(null);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/admin/categories/${editingCategory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: editLabel.trim(),
          description: editDescription.trim() || undefined,
          sortOrder: editSortOrder,
          isActive: editIsActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setModalError(data.error?.message || 'Failed to save category changes.');
        return;
      }

      setCategories((prev) =>
        prev
          .map((c) => (c.id === editingCategory.id ? data.data : c))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      );
      setEditingCategory(null);
      setSuccessMessage(`Category "${editLabel}" updated successfully.`);
    } catch {
      setModalError('Network error saving category.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSaving(true);

    const generatedSlug = newSlug.trim() ? slugify(newSlug.trim()) : slugify(newLabel.trim());

    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newLabel.trim(),
          slug: generatedSlug,
          description: newDescription.trim() || undefined,
          sortOrder: newSortOrder,
          isActive: newIsActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setModalError(data.error?.message || 'Failed to create category.');
        return;
      }

      setCategories((prev) =>
        [...prev, data.data].sort((a, b) => a.sortOrder - b.sortOrder)
      );
      setIsCreateOpen(false);
      setNewLabel('');
      setNewSlug('');
      setNewDescription('');
      setNewSortOrder(categories.length + 1);
      setNewIsActive(true);
      setSuccessMessage(`Category "${data.data.label}" created successfully.`);
    } catch {
      setModalError('Network error creating category.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            Dynamic Product Categories
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {categories.filter((c) => c.isActive).length} active of {categories.length} total
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Database-driven multi-category engine. Configure active categories, descriptions, display order, and status without code changes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewSortOrder(categories.length + 1);
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Category</span>
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Categories Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Loading categories...</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500">
            No categories found in database. Add one to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-700 font-bold">
                  <th className="py-3 px-4 w-16">Order</th>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">URL Slug</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center w-28">Status</th>
                  <th className="py-3 px-4 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-gray-600">
                      #{cat.sortOrder}
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-950">
                      {cat.label}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-500">
                      <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px]">
                        {cat.slug}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 max-w-xs truncate">
                      {cat.description || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(cat)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                          cat.isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {cat.isActive ? (
                          <>
                            <ToggleRight className="w-4 h-4 text-emerald-600" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4 text-gray-400" />
                            <span>Inactive</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(cat)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-950 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                <span>Add Product Category</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Category Label <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newLabel}
                  onChange={(e) => {
                    setNewLabel(e.target.value);
                    if (!newSlug) {
                      setNewSlug(slugify(e.target.value));
                    }
                  }}
                  placeholder="e.g. Electric Two-Wheelers"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  URL Slug <span className="text-slate-400 font-normal">(Auto-generated if blank)</span>
                </label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="e.g. electric-two-wheelers"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-mono font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g. Community group buys for commuter and performance electric scooters."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Display Sort Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newSortOrder}
                    onChange={(e) => setNewSortOrder(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Active on Public Site
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewIsActive(!newIsActive)}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      newIsActive
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-slate-300 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {newIsActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
                >
                  {isSaving ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-950 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-600" />
                <span>Edit Category</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Category Label <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  URL Slug <span className="text-slate-400 font-normal">(Immutable)</span>
                </label>
                <input
                  type="text"
                  disabled
                  value={editingCategory.slug}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-mono font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Display Sort Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editSortOrder}
                    onChange={(e) => setEditSortOrder(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Active on Public Site
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditIsActive(!editIsActive)}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      editIsActive
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-slate-300 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {editIsActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
