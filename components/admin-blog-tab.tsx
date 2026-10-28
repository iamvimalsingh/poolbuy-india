'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  ExternalLink,
  Archive,
  Send,
} from 'lucide-react';
import { BlogPost } from '@/types';
import { slugify } from '@/lib/format';
import { safeRenderMarkdown } from '@/lib/blog-render';

export function AdminBlogTab() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formTopic, setFormTopic] = useState('Solar Energy');
  const [formAuthor, setFormAuthor] = useState('PoolBuy Research Desk');
  const [formExcerpt, setFormExcerpt] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCoverImageUrl, setFormCoverImageUrl] = useState('');
  const [formCoverImageAlt, setFormCoverImageAlt] = useState('');
  const [formTags, setFormTags] = useState('Solar, Energy, Guide');
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>('DRAFT');

  const loadPosts = async () => {
    try {
      const res = await fetch('/api/admin/blog');
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to load blog posts.');
        return;
      }
      setPosts(data.data);
    } catch {
      setErrorMessage('Network error loading blog posts.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchPosts() {
      try {
        const res = await fetch('/api/admin/blog');
        const data = await res.json();
        if (!ignore && res.ok && data.success) {
          setPosts(data.data);
        } else if (!ignore && (!res.ok || !data.success)) {
          setErrorMessage(data.error?.message || 'Failed to load blog posts.');
        }
      } catch {
        if (!ignore) setErrorMessage('Network error loading blog posts.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    fetchPosts();
    return () => {
      ignore = true;
    };
  }, []);

  const handleOpenCreate = () => {
    setEditingPost(null);
    setFormTitle('');
    setFormSlug('');
    setFormTopic('Solar Energy');
    setFormAuthor('PoolBuy Research Desk');
    setFormExcerpt('');
    setFormContent('');
    setFormCoverImageUrl('');
    setFormCoverImageAlt('');
    setFormTags('Solar, Energy, Guide');
    setFormStatus('DRAFT');
    setModalError(null);
    setShowPreview(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (post: BlogPost) => {
    setEditingPost(post);
    setFormTitle(post.title);
    setFormSlug(post.slug);
    setFormTopic(post.topic);
    setFormAuthor(post.author);
    setFormExcerpt(post.excerpt);
    setFormContent(post.content);
    setFormCoverImageUrl(post.coverImageUrl || '');
    setFormCoverImageAlt(post.coverImageAlt || '');
    setFormTags((post.tags || []).join(', '));
    setFormStatus(post.status);
    setModalError(null);
    setShowPreview(false);
    setIsModalOpen(true);
  };

  const handleTitleChange = (val: string) => {
    setFormTitle(val);
    if (!editingPost) {
      setFormSlug(slugify(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSaving(true);

    try {
      const payload = {
        title: formTitle.trim(),
        slug: formSlug.trim() || slugify(formTitle),
        topic: formTopic.trim(),
        author: formAuthor.trim(),
        excerpt: formExcerpt.trim(),
        content: formContent.trim(),
        coverImageUrl: formCoverImageUrl.trim() || null,
        coverImageAlt: formCoverImageAlt.trim() || null,
        tags: formTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        status: formStatus,
      };

      const url = editingPost ? `/api/admin/blog/${editingPost.id}` : '/api/admin/blog';
      const method = editingPost ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setModalError(data.error?.message || 'Failed to save blog post.');
        return;
      }

      setIsModalOpen(false);
      setSuccessMessage(
        editingPost
          ? `Post "${data.data.title}" updated successfully.`
          : `New post "${data.data.title}" created successfully.`
      );
      loadPosts();
    } catch {
      setModalError('Network error while saving blog post.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublish = async (post: BlogPost) => {
    const nextStatus = post.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to update publication status.');
        return;
      }
      setSuccessMessage(
        nextStatus === 'PUBLISHED'
          ? `Article "${post.title}" is now published and live.`
          : `Article "${post.title}" has been archived.`
      );
      loadPosts();
    } catch {
      setErrorMessage('Network error updating post status.');
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    try {
      const res = await fetch(`/api/admin/blog/${postId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to delete blog post.');
        return;
      }
      setSuccessMessage('Article deleted successfully.');
      loadPosts();
    } catch {
      setErrorMessage('Network error deleting post.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-950">Blog CMS &amp; Editorial Intelligence</h2>
          <p className="text-xs text-gray-500 mt-1">
            Author and publish unbiased equipment teardowns, subsidy guides, and market analyses without redeployment.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-98 transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Write New Article</span>
        </button>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Posts Table */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-gray-400">Loading blog articles...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4">Article Title &amp; Slug</th>
                  <th className="py-3.5 px-4">Topic</th>
                  <th className="py-3.5 px-4">Author</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Published Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {posts.map((post) => {
                  const statusColors = {
                    PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
                    ARCHIVED: 'bg-slate-100 text-slate-700 border-slate-200',
                  };

                  return (
                    <tr key={post.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                        <div className="font-bold text-gray-950 text-sm line-clamp-1">{post.title}</div>
                        <div className="text-[11px] text-gray-400 font-mono truncate">/blog/{post.slug}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {post.topic}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-900">{post.author}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[post.status]}`}
                        >
                          {post.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500">
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Not published'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {post.status === 'PUBLISHED' && (
                            <a
                              href={`/blog/${post.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
                              title="View live article"
                            >
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                              <span>View</span>
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(post)}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 transition-colors"
                            title="Edit article"
                          >
                            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTogglePublish(post)}
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                              post.status === 'PUBLISHED'
                                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                            title={post.status === 'PUBLISHED' ? 'Archive article' : 'Publish article'}
                          >
                            {post.status === 'PUBLISHED' ? (
                              <>
                                <Archive className="w-3 h-3" aria-hidden="true" />
                                <span>Archive</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3 h-3" aria-hidden="true" />
                                <span>Publish</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(post.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                            title="Delete article"
                          >
                            <Trash2 className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 relative">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>

            <h3 className="text-xl font-bold text-gray-950 mb-1">
              {editingPost ? `Edit Article: ${editingPost.title}` : 'Write New Article'}
            </h3>
            <p className="text-xs text-gray-500 mb-6">
              Write informative Markdown content. Unbiased, factual consumer guides establish search authority.
            </p>

            {modalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. Complete 2026 Rooftop Solar Subsidy Guide"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">URL Slug *</label>
                  <input
                    type="text"
                    required
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="e.g. rooftop-solar-subsidy-guide-2026"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-mono font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Topic *</label>
                  <input
                    type="text"
                    required
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    placeholder="Solar Energy, Home Backup, Water Treatment"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Author Name *</label>
                  <input
                    type="text"
                    required
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="e.g. Vikram Sengupta"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED')}
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
                  >
                    <option value="DRAFT">DRAFT (Internal only)</option>
                    <option value="PUBLISHED">PUBLISHED (Live to public &amp; search engines)</option>
                    <option value="ARCHIVED">ARCHIVED (Hidden from directory)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-800 mb-1">Short Excerpt *</label>
                <textarea
                  required
                  rows={2}
                  value={formExcerpt}
                  onChange={(e) => setFormExcerpt(e.target.value)}
                  placeholder="Concise 1-2 sentence summary displayed in article cards and meta description."
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
                />
              </div>

              {/* Markdown Content with Live Preview Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-gray-800">Markdown Content *</label>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{showPreview ? 'Switch to Editor' : 'Live Preview'}</span>
                  </button>
                </div>

                {showPreview ? (
                  <div
                    className="w-full min-h-[250px] max-h-[350px] overflow-y-auto p-4 rounded-xl border border-slate-300 bg-slate-50 prose prose-slate text-xs"
                    dangerouslySetInnerHTML={{ __html: safeRenderMarkdown(formContent) }}
                  />
                ) : (
                  <textarea
                    required
                    rows={10}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="# Main Heading&#10;&#10;Write clean markdown content with ## headings, lists, tables, and bold text."
                    className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-gray-300 outline-hidden"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Cover Image URL</label>
                  <input
                    type="url"
                    value={formCoverImageUrl}
                    onChange={(e) => setFormCoverImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="Solar, Subsidy, Bhopal"
                    className="w-full text-sm px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-medium focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : editingPost ? 'Update Article' : 'Create Article'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
