"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export default function EvolutionPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ event_type: "new_agents", description: "", mars_version: "25.0" });
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    setLoading(true);
    const res = await api.listEvolutionEvents();
    if (res.success && res.data) setEvents(res.data);
    setLoading(false);
  };

  const createEvent = async () => {
    if (!form.description.trim()) return;
    const res = await api.createEvolutionEvent(form);
    if (res.success) {
      setShowCreate(false);
      setForm({ event_type: "new_agents", description: "", mars_version: "25.0" });
      loadEvents();
    }
  };

  const planPropagation = async (eventId: string) => {
    setSelectedEvent(eventId);
    const res = await api.planPropagation(eventId);
    if (res.success && res.data) setPlans(res.data);
  };

  const viewStatus = async (eventId: string) => {
    setSelectedEvent(eventId);
    const res = await api.getEvolutionStatus(eventId);
    if (res.success && res.data) setPlans(res.data.plans || []);
  };

  const eventTypes = ["new_goal", "new_agents", "new_skills", "new_rules", "template_update", "framework_support"];

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-slate-200">MARS Evolution & Propagation</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
        >
          {showCreate ? "Cancel" : "New Evolution Event"}
        </button>
      </div>

      {showCreate && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Event Type</label>
              <select
                value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300"
              >
                {eventTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What changed in MARS..."
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 placeholder-slate-600"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">MARS Version</label>
              <input
                value={form.mars_version}
                onChange={(e) => setForm({ ...form, mars_version: e.target.value })}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300"
              />
            </div>
            <button onClick={createEvent} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs rounded">
              Create Event
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="text-sm text-slate-500 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
          No evolution events yet.
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event: any) => (
            <div key={event.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200">{event.description}</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-900/30 text-blue-300 rounded">{event.event_type}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  event.status === "completed" ? "bg-green-900/30 text-green-300"
                  : event.status === "pending" ? "bg-yellow-900/30 text-yellow-300"
                  : "bg-slate-700 text-slate-400"
                }`}>
                  {event.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 mb-2">
                v{event.mars_version} | {event.propagated_count}/{event.total_repos} repos | {new Date(event.created_at).toLocaleDateString()}
              </div>
              <div className="flex gap-2">
                {event.status === "pending" && (
                  <button
                    onClick={() => planPropagation(event.id)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
                  >
                    Plan Propagation
                  </button>
                )}
                <button
                  onClick={() => viewStatus(event.id)}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded"
                >
                  View Status
                </button>
              </div>

              {selectedEvent === event.id && plans.length > 0 && (
                <div className="mt-3 space-y-2">
                  {plans.map((plan: any) => (
                    <div key={plan.id} className="bg-slate-900/50 p-2 rounded text-xs flex items-center justify-between">
                      <span className="text-slate-300">{plan.repo_framework}/{plan.repo_archetype} — {plan.repo_tier}</span>
                      <span className={`px-2 py-0.5 rounded ${
                        plan.status === "approved" ? "bg-green-900/30 text-green-300"
                        : plan.status === "pending_approval" ? "bg-yellow-900/30 text-yellow-300"
                        : plan.status === "completed" ? "bg-green-900/30 text-green-300"
                        : "bg-slate-700 text-slate-400"
                      }`}>
                        {plan.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
