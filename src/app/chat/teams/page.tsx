"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  Plus,
  Loader2,
  Shield,
  Code2,
  Eye,
  ChevronRight,
  Trash2,
  UserPlus,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { api, Team, TeamDetail, TeamMember, TeamModule, Organization } from "@/lib/api";

type View = "list" | "detail" | "create";

export default function TeamsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-screen bg-[#0c0515] items-center justify-center text-white">Loading...</div>}>
      <TeamsPage />
    </Suspense>
  );
}

function TeamsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgIdFromUrl = searchParams.get("org_id");
  const [view, setView] = useState<View>("list");
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newOrgId, setNewOrgId] = useState("");
  const [creating, setCreating] = useState(false);

  // Add member form
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("developer");

  useEffect(() => {
    const token = localStorage.getItem("mars_token");
    if (!token) {
      router.push("/");
      return;
    }
    fetchData();
  }, [router]);

  const fetchData = async () => {
    setLoading(true);
    const [teamsRes, orgsRes] = await Promise.all([
      api.listTeams(orgIdFromUrl || undefined),
      api.listOrganizations(),
    ]);
    if (teamsRes.success && teamsRes.data) setTeams(teamsRes.data);
    if (orgsRes.success && orgsRes.data) {
      setOrgs(orgsRes.data);
      // Pre-select org from URL param, or default to first
      if (orgIdFromUrl) {
        setNewOrgId(orgIdFromUrl);
      } else if (orgsRes.data.length > 0 && !newOrgId) {
        setNewOrgId(orgsRes.data[0].id);
      }
    }
    setLoading(false);
  };

  const openTeam = async (id: string) => {
    setLoading(true);
    const res = await api.getTeam(id);
    if (res.success && res.data) {
      // Backend returns { team, members, modules } — map to flat TeamDetail
      const raw = res.data as unknown as { team?: TeamDetail; members?: TeamMember[]; modules?: TeamModule[] };
      if (raw.team) {
        // Nested response format
        setSelectedTeam({ ...raw.team, members: raw.members || [], modules: raw.modules || [] });
      } else {
        // Already flat format
        setSelectedTeam(res.data);
      }
      setView("detail");
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newName || !newSlug || !newOrgId) return;
    setCreating(true);
    const res = await api.createTeam({
      organization_id: newOrgId,
      name: newName,
      slug: newSlug,
      description: newDesc,
    });
    setCreating(false);
    if (res.success) {
      setNewName("");
      setNewSlug("");
      setNewDesc("");
      setView("list");
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    await api.deleteTeam(id);
    setView("list");
    fetchData();
  };

  const handleAddMember = async () => {
    if (!selectedTeam || !memberEmail.trim()) return;
    try {
      await api.addTeamMember(selectedTeam.id, { email: memberEmail.trim(), role: memberRole });
      setMemberEmail("");
      setShowAddMember(false);
      openTeam(selectedTeam.id);
    } catch {
      alert("Failed to add member. Make sure the email is registered in MARS.");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam) return;
    await api.removeTeamMember(selectedTeam.id, userId);
    openTeam(selectedTeam.id);
  };

  const roleColor = (role: string) => {
    const colors: Record<string, string> = {
      manager: "text-purple-400 bg-purple-500/10",
      developer: "text-blue-400 bg-blue-500/10",
      tester: "text-green-400 bg-green-500/10",
      tech_support: "text-yellow-400 bg-yellow-500/10",
      fresher: "text-orange-400 bg-orange-500/10",
    };
    return colors[role] || "text-slate-400 bg-white/[0.05]";
  };

  const ownershipIcon = (type: string) => {
    switch (type) {
      case "primary": return <Shield className="w-3.5 h-3.5 text-purple-400" />;
      case "secondary": return <Code2 className="w-3.5 h-3.5 text-blue-400" />;
      case "reviewer": return <Eye className="w-3.5 h-3.5 text-green-400" />;
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#0c0515]">
      <Sidebar activePage="teams" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {view !== "list" && (
                <button
                  onClick={() => { setView("list"); setSelectedTeam(null); }}
                  className="text-slate-400 hover:text-white transition-colors text-sm"
                >
                  Teams
                </button>
              )}
              {view !== "list" && <ChevronRight className="w-4 h-4 text-slate-600" />}
              <Users className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">
                {view === "create" ? "Create Team" : view === "detail" && selectedTeam ? selectedTeam.name : "Teams"}
              </h1>
            </div>
            {view === "list" && (
              <button
                onClick={() => setView("create")}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Team
              </button>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {view === "list" && "Manage teams, members, and module ownership"}
            {view === "create" && "Create a new team for your organization"}
            {view === "detail" && selectedTeam && `${selectedTeam.members?.length || 0} members, ${selectedTeam.modules?.length || 0} modules`}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : view === "create" ? (
            /* Create Form */
            <div className="max-w-lg space-y-4 pt-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Organization</label>
                <select
                  value={newOrgId}
                  onChange={(e) => setNewOrgId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white focus:outline-none focus:border-purple-500/30"
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Team Name</label>
                <input
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")); }}
                  placeholder="e.g. Platform Team"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/30"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Slug</label>
                <input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="platform-team"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/30"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  placeholder="What does this team do?"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/30 resize-none"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={creating || !newName || !newSlug}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Team
              </button>
            </div>
          ) : view === "detail" && selectedTeam ? (
            /* Team Detail */
            <div className="space-y-6 pt-2">
              {/* Description */}
              {selectedTeam.description && (
                <p className="text-sm text-slate-400">{selectedTeam.description}</p>
              )}

              {/* Members */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-white">Members</h2>
                  <button
                    onClick={() => setShowAddMember(!showAddMember)}
                    className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add Member
                  </button>
                </div>

                {showAddMember && (
                  <div className="flex items-center gap-2 mb-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                    <input
                      type="email"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      placeholder="Email (required)"
                      className="flex-1 px-2.5 py-1.5 rounded-lg text-xs bg-white/[0.03] text-white border border-white/[0.06] placeholder-slate-600 focus:outline-none"
                    />
                    <select
                      value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg text-xs bg-white/[0.03] text-white border border-white/[0.06]"
                    >
                      <option value="developer">Developer</option>
                      <option value="manager">Manager</option>
                      <option value="tester">Tester</option>
                      <option value="tech_support">Tech Support</option>
                      <option value="fresher">Fresher</option>
                    </select>
                    <button onClick={handleAddMember} className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg">Add</button>
                  </div>
                )}

                <div className="space-y-2">
                  {(selectedTeam.members || []).map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                          {(m.email || m.user_id || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm text-white">{m.email || m.user_id}</span>
                          {m.manager_id && (
                            <span className="text-[10px] text-slate-500 ml-2">reports to: {
                              (selectedTeam.members || []).find(mgr => mgr.user_id === m.manager_id)?.email || m.manager_id
                            }</span>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${roleColor(m.role)}`}>{m.role}</span>
                      </div>
                      <button onClick={() => handleRemoveMember(m.user_id)} className="text-slate-500 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(!selectedTeam.members || selectedTeam.members.length === 0) && (
                    <div className="text-center py-6 text-slate-500 text-xs">No members yet</div>
                  )}
                </div>
              </div>

              {/* Modules */}
              <div>
                <h2 className="text-sm font-medium text-white mb-3">Assigned Modules</h2>
                <div className="space-y-2">
                  {(selectedTeam.modules || []).map((mod) => (
                    <div key={mod.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        {ownershipIcon(mod.ownership_type)}
                        <div>
                          <span className="text-sm text-white">{mod.module_name}</span>
                          <span className="text-xs text-slate-500 ml-2">{mod.module_path}</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">{mod.ownership_type}</span>
                    </div>
                  ))}
                  {(!selectedTeam.modules || selectedTeam.modules.length === 0) && (
                    <div className="text-center py-6 text-slate-500 text-xs">No modules assigned</div>
                  )}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="pt-4 border-t border-white/[0.06]">
                <button
                  onClick={() => handleDelete(selectedTeam.id)}
                  className="px-4 py-2 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  Delete Team
                </button>
              </div>
            </div>
          ) : (
            /* Team List */
            <div className="space-y-3 pt-2">
              {teams.length > 0 ? (
                teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => openTeam(team.id)}
                    className="w-full text-left px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Users className="w-4.5 h-4.5 text-purple-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{team.name}</div>
                          <div className="text-xs text-slate-500">{team.slug}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${team.status === "active" ? "text-green-400 bg-green-500/10" : "text-slate-400 bg-white/[0.05]"}`}>
                          {team.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                      </div>
                    </div>
                    {team.description && (
                      <p className="text-xs text-slate-400 mt-2 line-clamp-1">{team.description}</p>
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-16 text-slate-500 text-sm">
                  No teams yet. Create one to get started.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
