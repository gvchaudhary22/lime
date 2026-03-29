"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  FolderOpen,
  Search,
  Settings,
  Code2,
  Star,
  LogOut,
  ChevronUp,
  Rocket,
  Plus,
  GitBranch,
  Brain,
  Ticket,
  Map,
  BarChart3,
  ArrowUpCircle,
  Building2,
  Users,
  BookOpen,
  ClipboardCheck,
  Activity,
  PackagePlus,
  ChevronDown,
  Shield,
  Bug,
  FileText,
  Zap,
  Gauge,
  Bot,
  Clock,
} from "lucide-react";
import { api, Bookmark, Conversation } from "@/lib/api";

interface SidebarProps {
  activePage?: string;
}

interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function Sidebar({ activePage = "chats" }: SidebarProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [starred, setStarred] = useState<Bookmark[]>([]);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [adminExpanded, setAdminExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("mars_user");
    if (stored) {
      const u = JSON.parse(stored);
      setUser(u);
      fetchConversations(u.id);
    }
    fetchBookmarks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchBookmarks = async () => {
    const res = await api.getBookmarks();
    if (res.success && res.data) {
      setStarred(res.data.filter((b) => b.type === "starred"));
    }
  };

  const fetchConversations = async (userId: string) => {
    const res = await api.getConversations(userId);
    if (res.success && res.data) {
      // Show most recent first, limit to 10
      setRecentConversations(res.data.slice(0, 10));
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore errors, clear local state anyway
    }
    localStorage.removeItem("mars_token");
    localStorage.removeItem("mars_user");
    router.push("/");
  };

  const navItems = [
    { icon: Plus, label: "New chat", href: "/chat", id: "new" },
    { icon: Search, label: "Search", href: "/chat", id: "search" },
    { icon: Settings, label: "Customize", href: "/chat", id: "customize" },
  ];

  const mainNav = [
    { icon: MessageSquare, label: "Chats", href: "/chat", id: "chats" },
    {
      icon: FolderOpen,
      label: "Projects",
      href: "/chat/projects",
      id: "projects",
    },
    {
      icon: Building2,
      label: "Organizations",
      href: "/chat/organizations",
      id: "organizations",
    },
    {
      icon: PackagePlus,
      label: "Simple Onboard",
      href: "/chat/simple-onboarding",
      id: "simple-onboarding",
    },
    {
      icon: GitBranch,
      label: "Auto-Onboard",
      href: "/chat/onboard",
      id: "onboard",
    },
    { icon: Code2, label: "Code", href: "/chat", id: "code" },
    {
      icon: Brain,
      label: "Learning",
      href: "/chat/learning",
      id: "learning",
    },
    {
      icon: Ticket,
      label: "Tickets",
      href: "/chat/tickets",
      id: "tickets",
    },
    {
      icon: BarChart3,
      label: "Jira",
      href: "/chat/jira",
      id: "jira",
    },
    {
      icon: Map,
      label: "Mappings",
      href: "/chat/mappings",
      id: "mappings",
    },
    {
      icon: ArrowUpCircle,
      label: "Infra",
      href: "/chat/infra",
      id: "infra",
    },
    {
      icon: Users,
      label: "Teams",
      href: "/chat/teams",
      id: "teams",
    },
    {
      icon: BookOpen,
      label: "Knowledge",
      href: "/chat/knowledge",
      id: "knowledge",
    },
    {
      icon: ClipboardCheck,
      label: "Manager",
      href: "/chat/manager",
      id: "manager",
    },
    {
      icon: Bot,
      label: "MCP Chat",
      href: "/chat/mcp",
      id: "mcp-chat",
    },
  ];

  const adminSubItems = [
    { icon: Activity, label: "Dry Run", href: "/chat/admin/dryrun", id: "admin-dryrun" },
    { icon: Bot, label: "Agent Plans", href: "/chat/admin/agent-plans", id: "admin-agents" },
    { icon: Zap, label: "Evolution", href: "/chat/admin/evolution", id: "admin-evolution" },
    { icon: Gauge, label: "Scores", href: "/chat/admin/scores", id: "admin-scores" },
    { icon: Bug, label: "ELK Bugs", href: "/chat/admin/elk-bugs", id: "admin-elk-bugs" },
    { icon: FileText, label: "ELK Logs", href: "/chat/admin/elk-logs", id: "admin-elk-logs" },
    { icon: Shield, label: "Critical Issues", href: "/chat/admin/critical-issues", id: "admin-critical" },
    { icon: Shield, label: "Enforcement", href: "/chat/admin/enforcement", id: "admin-enforcement" },
    { icon: Clock, label: "Jobs", href: "/chat/admin/jobs", id: "admin-jobs" },
    { icon: Brain, label: "AI Training", href: "/chat/admin/ai-training", id: "admin-ai-training" },
    { icon: GitBranch, label: "KB Updates", href: "/chat/admin/kb-updates", id: "admin-kb-updates" },
  ];

  return (
    <nav className="w-64 h-screen bg-[#0c0515] border-r border-white/[0.06] flex flex-col" aria-label="Main navigation">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 via-violet-500 to-fuchsia-600 flex items-center justify-center">
          <Rocket className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-white tracking-tight">
          MARS
        </span>
      </div>

      {/* Top nav */}
      <div className="px-3 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => router.push(item.href)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}

        {/* Admin Section — expandable */}
        <button
          onClick={() => setAdminExpanded(!adminExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4" />
            Admin
          </div>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${adminExpanded ? "rotate-180" : ""}`} />
        </button>
        {adminExpanded && (
          <div className="ml-4 space-y-0.5">
            {adminSubItems.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 my-3 h-px bg-white/[0.06]" />

      {/* Main nav */}
      <div className="px-3 space-y-0.5">
        {mainNav.map((item) => (
          <button
            key={item.id}
            onClick={() => router.push(item.href)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              activePage === item.id
                ? "text-white bg-white/[0.08]"
                : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="mx-4 my-3 h-px bg-white/[0.06]" />

      {/* Starred */}
      <div className="px-4 mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Starred
        </span>
      </div>
      <div className="px-3">
        {starred.length > 0 ? (
          starred.map((b) => (
            <button
              key={b.id}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="truncate">{b.label}</span>
            </button>
          ))
        ) : (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400">
            <Star className="w-4 h-4 text-yellow-500/60" aria-hidden="true" />
            <span className="text-slate-400 italic text-xs">
              No starred chats
            </span>
          </div>
        )}
      </div>

      {/* Recents */}
      <div className="px-4 mt-4 mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Recents
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        {recentConversations.length > 0 ? (
          recentConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => router.push(`/chat/${conv.id}`)}
              className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{conv.title}</span>
            </button>
          ))
        ) : (
          <div className="flex items-center gap-3 px-3 py-2 text-xs text-slate-400 italic">
            No recent conversations
          </div>
        )}
      </div>

      {/* Bottom — User email + logout */}
      <div className="relative mt-auto" ref={menuRef}>
        {/* Popup menu */}
        {showUserMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#1a1030] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        )}

        {/* User bar */}
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center gap-3 px-4 py-4 border-t border-white/[0.06] hover:bg-white/[0.03] transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm text-white font-medium truncate">
              {user?.name || "User"}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {user?.email || ""}
            </div>
          </div>
          <ChevronUp
            className={`w-4 h-4 text-slate-500 transition-transform ${
              showUserMenu ? "" : "rotate-180"
            }`}
          />
        </button>
      </div>
    </nav>
  );
}
