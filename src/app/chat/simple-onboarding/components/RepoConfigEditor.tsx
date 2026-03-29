"use client";

import { useEffect, useState } from "react";
import { GitBranch } from "lucide-react";
import { api, Repository } from "@/lib/api";

interface RepoConfig {
  default_branch: string;
  backend_base_url: string;
  elk_qa_urls: string;
}

export default function RepoConfigEditor({ repo, onSave }: { repo: Repository; onSave: (updated: Repository) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<RepoConfig>({
    default_branch: repo.default_branch || "main",
    backend_base_url: repo.backend_base_url || "",
    elk_qa_urls: repo.elk_qa_urls || "[]",
  });

  useEffect(() => {
    setConfig({
      default_branch: repo.default_branch || "main",
      backend_base_url: repo.backend_base_url || "",
      elk_qa_urls: repo.elk_qa_urls || "[]",
    });
  }, [repo.id, repo.default_branch, repo.backend_base_url, repo.elk_qa_urls]);

  const handleSave = async () => {
    setSaving(true);
    const res = await api.updateRepoConfig(repo.id, {
      default_branch: config.default_branch,
      backend_base_url: config.backend_base_url,
      elk_qa_urls: config.elk_qa_urls,
    });
    if (res.success && res.data) {
      onSave(res.data);
      setEditing(false);
    }
    setSaving(false);
  };

  let elkUrls: string[] = [];
  try {
    const parsed = JSON.parse(config.elk_qa_urls || "[]");
    if (Array.isArray(parsed)) elkUrls = parsed;
  } catch { elkUrls = []; }

  if (!editing) {
    return (
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5" />Repository Config
          </h3>
          <button onClick={() => setEditing(true)} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">Edit</button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Master Branch</span>
            <span className="text-xs text-white font-medium">{config.default_branch}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">QA / Backend URL</span>
            <span className="text-xs text-white font-medium truncate max-w-[200px]">{config.backend_base_url || "Not set"}</span>
          </div>
          <div className="flex items-start justify-between">
            <span className="text-xs text-slate-400">ELK QA URLs</span>
            <div className="text-right">
              {elkUrls.length > 0 ? elkUrls.map((u, i) => (
                <span key={i} className="block text-xs text-white font-medium truncate max-w-[200px]">{u}</span>
              )) : <span className="text-xs text-slate-500">Not configured</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 border-b border-white/[0.06]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5" />Repository Config
        </h3>
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Master Branch</label>
          <input type="text" value={config.default_branch} onChange={(e) => setConfig({ ...config, default_branch: e.target.value })}
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500/30" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">QA / Backend URL</label>
          <input type="text" value={config.backend_base_url} onChange={(e) => setConfig({ ...config, backend_base_url: e.target.value })}
            placeholder="https://qa.example.com"
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">ELK QA URLs (comma-separated)</label>
          <input type="text" value={elkUrls.join(", ")}
            onChange={(e) => { const urls = e.target.value.split(",").map(u => u.trim()).filter(Boolean); setConfig({ ...config, elk_qa_urls: JSON.stringify(urls) }); }}
            placeholder="https://elk-qa.example.com"
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30" />
        </div>
      </div>
    </div>
  );
}
