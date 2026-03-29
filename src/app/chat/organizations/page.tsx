"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Building2,
  Github,
  Loader2,
  Trash2,
  Edit2,
  X,
  Check,
  Users,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api, Organization } from "@/lib/api";

export default function OrganizationsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", slug: "", github_username: "", github_token: "" });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", github_username: "", github_token: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchOrganizations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const res = await api.listOrganizations();
      if (res.success && res.data) {
        setOrganizations(res.data);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!createForm.name || !createForm.slug) {
      setError("Name and slug are required");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await api.createOrganization(createForm);
      if (res.success) {
        setShowCreate(false);
        setCreateForm({ name: "", slug: "", github_username: "", github_token: "" });
        fetchOrganizations();
      } else {
        setError(res.error || "Failed to create organization");
      }
    } catch {
      setError("Failed to create organization");
    }
    setCreating(false);
  };

  const handleUpdate = async (id: string) => {
    try {
      const res = await api.updateOrganization(id, editForm);
      if (res.success) {
        setEditingId(null);
        fetchOrganizations();
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this organization?")) return;
    try {
      await api.deleteOrganization(id);
      fetchOrganizations();
    } catch {
      // ignore
    }
  };

  const startEdit = (org: Organization) => {
    setEditingId(org.id);
    setEditForm({ name: org.name, github_username: org.github_username, github_token: "" });
  };

  const filtered = organizations.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#060b18]">
      <Sidebar activePage="organizations" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Organizations</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Manage organizations and their GitHub connections
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white text-sm rounded-lg hover:bg-sky-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Organization
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-white/10">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-white text-lg mb-1">No organizations yet</h3>
              <p className="text-gray-400 text-sm">
                Create an organization to group your repositories and manage GitHub connections.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl">
              {filtered.map((org) => (
                <div
                  key={org.id}
                  className="rounded-xl bg-white/[0.03] border border-white/10 p-4 hover:border-white/20 transition-colors"
                >
                  {editingId === org.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500/50"
                        placeholder="Organization name"
                      />
                      <input
                        type="text"
                        value={editForm.github_username}
                        onChange={(e) => setEditForm({ ...editForm, github_username: e.target.value })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500/50"
                        placeholder="GitHub username/org"
                      />
                      <input
                        type="password"
                        value={editForm.github_token}
                        onChange={(e) => setEditForm({ ...editForm, github_token: e.target.value })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500/50"
                        placeholder="GitHub token (leave empty to keep current)"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(org.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 text-sm rounded-lg hover:bg-green-500/30"
                        >
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 px-3 py-1.5 text-gray-400 text-sm hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-sky-400" />
                          <h3 className="text-white font-medium">{org.name}</h3>
                          <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{org.slug}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                          {org.github_username && (
                            <span className="flex items-center gap-1">
                              <Github className="w-3 h-3" /> {org.github_username}
                            </span>
                          )}
                          <span>
                            {org.has_token ? "Token configured" : "No token"}
                          </span>
                          <span>
                            Created {new Date(org.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => router.push(`/chat/teams?org_id=${org.id}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors"
                          title="Manage teams for this organization"
                        >
                          <Users className="w-3.5 h-3.5" />
                          Teams
                        </button>
                        <button
                          onClick={() => startEdit(org)}
                          className="p-2 text-gray-400 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(org.id)}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0c1221] border border-white/10 rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-white mb-4">New Organization</h2>

            {error && (
              <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                  placeholder="My Organization"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Slug</label>
                <input
                  type="text"
                  value={createForm.slug}
                  onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                  placeholder="my-org"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">GitHub Username / Org</label>
                <input
                  type="text"
                  value={createForm.github_username}
                  onChange={(e) => setCreateForm({ ...createForm, github_username: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                  placeholder="my-github-org"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">GitHub Token (optional)</label>
                <input
                  type="password"
                  value={createForm.github_token}
                  onChange={(e) => setCreateForm({ ...createForm, github_token: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sky-500/50"
                  placeholder="ghp_..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowCreate(false); setError(""); }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white text-sm rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
