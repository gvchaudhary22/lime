"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface PlanData {
  tier: string;
  framework: string;
  archetype: string;
  agents: { name: string; action: string }[];
  skills: { name: string; action: string; source?: string }[];
  summary: string;
  default_budget_usd: number;
}

interface Plan {
  id: string;
  repository_id: string;
  plan_type: string;
  status: string;
  repo_tier: string;
  repo_framework: string;
  repo_archetype: string;
  context_score: number;
  plan_data: string;
  admin_feedback: string;
  created_at: string;
}

export default function AgentPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    const res = await api.listPendingAgentPlans();
    if (res.success && res.data) {
      setPlans(res.data);
    }
    setLoading(false);
  };

  const approvePlan = async (planId: string) => {
    const res = await api.approveAgentPlan(planId);
    if (res.success) {
      // Find the plan to get repo ID for execution
      const plan = plans.find(p => p.id === planId);
      if (plan?.repository_id) {
        // Auto-trigger execution after approval
        try {
          await api.executeAgentPlan(plan.repository_id, planId);
        } catch (e) {
          console.error("Execution trigger failed:", e);
        }
      }
      loadPlans();
    }
  };

  const rejectPlan = async (planId: string) => {
    if (!feedback.trim()) return;
    const res = await api.rejectAgentPlan(planId, feedback);
    if (res.success) {
      setFeedback("");
      loadPlans();
    }
  };

  const parsePlanData = (planDataStr: string): PlanData | null => {
    try {
      return JSON.parse(planDataStr);
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold text-slate-200 mb-4">Agent Generation Plans</h1>
        <div className="text-sm text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-lg font-semibold text-slate-200 mb-4">Agent Generation Plans — Admin Approval</h1>

      {plans.length === 0 ? (
        <div className="text-sm text-slate-500 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          No plans pending approval.
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const pd = parsePlanData(plan.plan_data);
            const isExpanded = expandedPlan === plan.id;
            const createAgents = pd?.agents.filter((a) => a.action === "create") || [];
            const createSkills = pd?.skills.filter((s) => s.action === "create") || [];

            return (
              <div key={plan.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-medium text-slate-200">
                      {plan.repo_framework} / {plan.repo_archetype}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      Tier: {plan.repo_tier} | Score: {plan.context_score}
                    </span>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-yellow-900/30 text-yellow-300 rounded">
                    {plan.plan_type}
                  </span>
                </div>

                <div className="text-xs text-slate-400 mb-2">
                  {createAgents.length} agents, {createSkills.length} skills to create
                  {pd && ` | Budget: $${pd.default_budget_usd}/mo`}
                </div>

                <button
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                  className="text-xs text-blue-400 hover:text-blue-300 mb-3"
                >
                  {isExpanded ? "Hide details" : "Show details"}
                </button>

                {isExpanded && pd && (
                  <div className="mb-3 p-3 bg-slate-900/50 rounded text-xs">
                    <div className="mb-2">
                      <strong className="text-slate-300">Agents:</strong>{" "}
                      <span className="text-slate-400">{createAgents.map((a) => a.name).join(", ")}</span>
                    </div>
                    <div className="mb-2">
                      <strong className="text-slate-300">Skills (KB):</strong>{" "}
                      <span className="text-slate-400">
                        {createSkills.filter((s) => s.source === "module_kb").map((s) => s.name).join(", ") || "none"}
                      </span>
                    </div>
                    <div>
                      <strong className="text-slate-300">Skills (template):</strong>{" "}
                      <span className="text-slate-400">
                        {createSkills.filter((s) => s.source === "template").map((s) => s.name).join(", ") || "none"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approvePlan(plan.id)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors"
                  >
                    Approve
                  </button>
                  <input
                    type="text"
                    placeholder="Rejection reason..."
                    value={expandedPlan === plan.id ? feedback : ""}
                    onChange={(e) => { setExpandedPlan(plan.id); setFeedback(e.target.value); }}
                    className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 placeholder-slate-600"
                  />
                  <button
                    onClick={() => rejectPlan(plan.id)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
