const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  confirm_password: string;
}

interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  expires_at: string;
}

interface CheckEmailResponse {
  status: "invite_pending" | "registered" | "not_found";
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const token =
    typeof window !== "undefined" ? localStorage.getItem("mars_token") : null;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const json = await res.json();

  if (!res.ok) {
    // Token expired or invalid — clear auth and redirect to login
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("mars_token");
      localStorage.removeItem("mars_user");
      localStorage.removeItem("mars_active_project");
      window.location.href = "/";
    }
    return { success: false, error: json.error || "Something went wrong" };
  }

  return { success: true, data: json.data ?? json };
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  github_username: string;
  has_token: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  link: string;
  organization_id: string;
  repository_id: string;
  onboarding_pipeline_id: string;
  main_branch: string;
  qa_branch: string;
  qa_env_url: string;
  qa_env_verified: boolean;
  api_key_id: string | null;
  onboarding_step: string;
  status: string;
  is_starred: boolean;
  conversation_count: number;
  ai_budget_usd: number;
  ai_spent_usd: number;
  budget_alert_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface Repository {
  id: string;
  name: string;
  git_url: string;
  default_branch: string;
  description: string;
  domain: string;
  tech_stack: string;
  onboarding_status: string;
  onboarding_method: string;
  clone_path: string;
  ai_gateway_status: string;
  backend_base_url: string;
  backend_health_status: string;
  context_readiness: string;
  context_score: number;
  elk_qa_urls?: string;
  elk_prod_urls?: string;
  created_at: string;
  updated_at: string;
  // KB sync state
  kb_status?: string;
  kb_pending_files?: number;
  last_kb_sync_at?: string | null;
  last_kb_sync_sha?: string;
  kb_last_trained_at?: string | null;
}

export interface RepoFile {
  path: string;
  relative_path: string;
  size: number;
  is_dir: boolean;
}

export interface InterviewModuleScore {
  module_path: string;
  module_name: string;
  score: number;
  gaps: string[];
  ai_score?: number;
  validated_score?: number | null;
  needs_review?: boolean;
}

export interface InterviewStatus {
  completed_rounds: number[];
  total_rounds: number;
  context_score: number;
  module_scores: InterviewModuleScore[];
  gap_summary: string[];
  round_priority_order: number[];
  artifacts_collected: { type: string; url: string; name: string }[];
  size_tier?: string;
  detected_framework?: string;
  file_count?: number;
  repo_profile: {
    language: string;
    framework: string;
    project_type: string;
    size_tier?: string;
    detected_framework?: string;
    file_count?: number;
    modules: { path: string; name: string; language: string }[];
    api_route_count: number;
    has_migrations: boolean;
    has_tests: boolean;
    has_ci: boolean;
    has_docker: boolean;
  } | null;
  modules_enriched: number;
  modules_total: number;
  onboarding_phase: string;
}

export interface ChatRound {
  round: number;
  title: string;
  focus: string;
  kb_section: string;
}

export interface ChatRoundResponse {
  round: number;
  session_id: string;
  questions: string;
  repo_profile?: InterviewStatus["repo_profile"];
}

export interface ChatAnswersResponse {
  round: number;
  status: string; // "enriched" | "follow_up" | "complete" | "module_selection_pending" | "ask_next" | "module_onboarding" | "module_complete" | "all_modules_complete"
  context_score: number;
  next_round?: number;
  round_priority_order?: number[];
  follow_up_questions?: string;
  session_id?: string;
  module_scores?: InterviewModuleScore[];
  gap_summary?: string[];
  artifacts_collected?: { type: string; url: string; name: string }[];
  repo_profile?: InterviewStatus["repo_profile"];
  // Module onboarding fields
  current_module?: string;
  current_submodule?: string;
  onboarding_phase?: string;
  modules_enriched?: number;
  modules_total?: number;
  suggested_module?: { path: string; name: string };
}

export interface Bookmark {
  id: string;
  label: string;
  type: string;
  target_type: string;
  target_id: string | null;
  link: string | null;
  position: number;
}

export interface ProjectFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  description: string;
  is_editable: boolean;
  created_at: string;
}

export interface FileContent {
  id: string;
  file_name: string;
  content: string;
  file_type: string;
}

export interface APIKeyItem {
  id: string;
  name: string;
  provider: string;
  status: string;
  masked_key: string;
  created_at: string;
}

export interface ServiceConfig {
  service_type: string;
  is_enabled: boolean;
  config?: Record<string, string>;
}

export interface ProjectDetail extends Project {
  api_key?: APIKeyItem;
  files: ProjectFile[];
  services: ServiceConfig[];
}

export interface Conversation {
  id: string;
  user_id: string;
  project_id: string;
  channel: string;
  title: string;
  status: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  content_type: string;
  stage?: string;
  created_at: string;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
}

// v1.1 Types

export interface Capability {
  id: string;
  capability: string;
  enabled: boolean;
  restricted_paths: string;
  created_at: string;
}

export interface EngineeringDecision {
  id: string;
  repository_id: string;
  conversation_id: string;
  decision_type: string;
  summary: string;
  context_snapshot: string;
  approved_by: string;
  approved_at: string | null;
  created_at: string;
}

export interface ReadinessResult {
  repository_id: string;
  context_readiness: string;
  context_score: number;
  backend_health_status: string;
  details: string;
}

export interface HealthValidationResult {
  repository_id: string;
  status: string;
  latency_ms: number;
  checked_url: string;
}

export interface LearningRecord {
  id: string;
  repository_id: string;
  incident_type: string;
  root_cause: string;
  resolution: string;
  tags: string;
  severity: string;
  resolved_at: string | null;
  created_at: string;
}

export interface LearningProposal {
  id: string;
  repository_id: string;
  pattern_hash: string;
  title: string;
  description: string;
  evidence: string;
  proposed_action: string;
  status: string;
  votes_up: number;
  votes_down: number;
  created_at: string;
  updated_at: string;
}

export interface IncidentPattern {
  id: string;
  repository_id: string;
  pattern_type: string;
  description: string;
  occurrence_count: number;
  first_seen: string | null;
  last_seen: string | null;
  related_learning_ids: string;
  created_at: string;
}

export interface DetectPatternsResult {
  patterns_found: number;
  proposals_created: number;
}

// v3.0 Types

export interface Ticket {
  id: string;
  webhook_event_id: string;
  jira_key: string;
  jira_project: string;
  summary: string;
  description: string;
  issue_type: string;
  priority: string;
  status: string;
  phase: string;
  reporter: string;
  assignee: string;
  labels: string;
  components: string;
  created_at: string;
  updated_at: string;
}

export interface TicketQuestion {
  id: string;
  ticket_id: string;
  question: string;
  answer: string;
  status: string; // pending, answered, skipped
  source: string; // ai, manual
  jira_comment_id: string;
  answered_by: string;
  created_at: string;
  updated_at: string;
}

export interface AnalysisResult {
  id: string;
  ticket_id: string;
  requirement_summary: string;
  affected_services: string;
  scope_assessment: string;
  risk_level: string;
  missing_info: string;
  confidence: string | number;
  dependencies: string;
}

export interface TicketMetrics {
  completion_percentage: number;
  fulfillment_level: "HIGH" | "MEDIUM" | "LOW" | string;
  confidence_bucket: "HIGH" | "MEDIUM" | "LOW" | string;
  ai_help_score: number;
  ai_help_level: "HIGH" | "MEDIUM" | "LOW" | string;
  total_questions: number;
  pending_questions: number;
  total_approvals: number;
  total_notifications: number;
  total_executions: number;
  total_errors: number;
  error_bifurcation: Record<string, number>;
  last_activity_at?: string;
}

export interface JiraDashboardResponse {
  stats: {
    total_tickets: number;
    phase_distribution: Record<string, number>;
    status_distribution: Record<string, number>;
    average_completion: number;
    high_confidence_tickets: number;
    tickets_with_errors: number;
    high_priority_tickets: number;
    completed_tickets: number;
    active_clarification: number;
    active_coding: number;
    active_planning: number;
    active_requirements: number;
    tickets_needing_rephase: number;
    tickets_with_ai_progress: number;
  };
  tickets: Array<{
    ticket: Ticket;
    metrics: TicketMetrics;
  }>;
}

export interface TicketTimelineEvent {
  timestamp: string;
  type: string;
  phase?: string;
  title: string;
  detail: string;
  status?: string;
  source?: string;
}

export interface TicketJourneyResponse {
  ticket: Ticket;
  analysis: AnalysisResult | null;
  questions: TicketQuestion[];
  notifications: Notification[];
  approvals: Array<{
    id: string;
    ticket_id: string;
    jira_key?: string;
    phase: string;
    action: string;
    source: string;
    author: string;
    comment: string;
    created_at: string;
  }>;
  webhooks: Array<{
    id: string;
    source: string;
    event_type: string;
    issue_key: string;
    summary: string;
    status: string;
    created_at: string;
  }>;
  executions: Execution[];
  metrics: TicketMetrics;
  timeline: TicketTimelineEvent[];
  recommended_action: string;
  rephase_suggestions: string[];
}

export interface ProjectMapping {
  id: string;
  jira_project_key: string;
  jira_component: string;
  mars_project_id: string;
  repository_id: string;
  service_name: string;
  is_active: boolean;
}

export interface ServiceDependency {
  id: string;
  source_repo_id: string;
  target_repo_id: string;
  dependency_type: string;
  contract_name: string;
}

export interface TechnicalPlan {
  id: string;
  ticket_id: string;
  approach: string;
  alternatives: string;
  blast_radius: string;
  risk_mitigations: string;
  status: string;
  approved_by: string;
  created_at: string;
  updated_at: string;
}

export interface Execution {
  id: string;
  ticket_id: string;
  code_plan_id: string;
  branch_name: string;
  repo_path: string;
  status: string;
  error_message: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  ticket_id: string;
  target_type: string;
  target_id: string;
  notification_type: string;
  content: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

// v6.0 Types

// --- Infra Propagation types ---

export interface InfraVersionResponse {
  version: number;
  description: string;
  created_at: string;
}

export interface RepoPropagationState {
  repo_id: string;
  repo_name: string;
  infra_version: number;
  latest_version: number;
  needs_update: boolean;
  last_synced?: string;
  last_update_status?: string;
}

export interface PropagationStatusResponse {
  latest_version: number;
  repos: RepoPropagationState[];
}

export interface InfraUpdateResponse {
  id: string;
  repository_id: string;
  from_version: number;
  to_version: number;
  status: string;
  files_updated: number;
  cost_usd: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

export interface RoleRecommendation {
  role_name: string;
  display_name: string;
  status: string; // "required" | "recommended" | "optional" | "blocked"
  reason: string;
  locked?: boolean;
}

export interface ManualOnboardingResponse {
  id: string;
  phase: string;
  status: string;
  current_step?: string;
  detected_language?: string;
  detected_framework?: string;
  detected_architecture?: string;
  migration_status?: string;
  enabled_roles?: string[];
  domain_roles?: string[];
  repository_id?: string;
  files_generated?: number;
  cost_usd?: number;
  error_message?: string;
  // v17.0 additions
  analysis_confidence?: number;
  analysis_warnings?: string[];
  role_recommendations?: RoleRecommendation[];
  onboarding_pr_url?: string;
}

// v12.0 Types (Multi-Platform Plan Review)

export interface PlatformReview {
  id: string;
  plan_id: string;
  ticket_id: string;
  platform_key: string;
  model: string;
  status: string; // pending, running, completed, failed, timeout
  latency_ms: number;
  raw_output: string;
  parsed_output: string;
  error: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformOutput {
  verdict: string;
  recommendations: PlanRecommendation[];
  risks: PlanRisk[];
  open_questions: string[];
  confidence: string;
  blast_radius: string;
}

export interface PlanRecommendation {
  area: string;
  action: string;
  priority: string;
  reason: string;
}

export interface PlanRisk {
  description: string;
  severity: string;
  mitigation: string;
}

export interface ConsensusResult {
  id: string;
  plan_id: string;
  platforms_queried: number;
  platforms_responded: number;
  consensus_score: number;
  decision: string; // pending, consensus, partial, conflict, override
  common_items: string; // JSON string
  conflicts: string; // JSON string
  risk_union: string; // JSON string
  merged_summary: string;
  override_by: string;
  override_reason: string;
  created_at: string;
  updated_at: string;
}

export interface CrossReviewResult {
  reviews: PlatformReview[];
  consensus: ConsensusResult;
}

export interface ConflictItem {
  area: string;
  positions: Record<string, string>;
}


// v18.1 Types — Onboarding Pipeline Status Bar

export interface OnboardingStatusResponse {
  pipeline_id: string;
  phase: string;
  status: string;
  current_step: string;
  error_message?: string;
  progress_percent: number;
  files_generated: number;
  started_at?: string;
  completed_at?: string;
  checkpoints: CheckpointInfo[];
}

export interface CheckpointInfo {
  name: string;
  status: string;
  started_at?: string;
  completed_at?: string;
}

// Onboarding Artifacts Types

export interface OnboardingArtifact {
  path: string;
  relative_path: string;
  size: number;
  is_dir: boolean;
  modified_at: string;
}

export interface ArtifactContent {
  content: string;
}

// v16.0 Types — Multi-Platform Execution + Agent Sync + Improvements

export interface RepositoryAgent {
  id: string;
  repository_id: string;
  platform: string;
  name: string;
  description: string;
  file_path: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface InfraImprovement {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RepoImprovementStatus {
  id: string;
  repository_id: string;
  improvement_id: string;
  status: string;
  applied_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ImprovementDashboard {
  improvements: InfraImprovement[];
  repositories: { id: string; name: string; slug: string }[];
  statuses: Record<string, Record<string, RepoImprovementStatus>>;
}

// v21.0 Types — Teams, Knowledge, Manager Review

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  email?: string;
  role: string;
  manager_id?: string;
  status: string;
  joined_at: string;
  updated_at: string;
}

export interface TeamModule {
  id: string;
  team_id: string;
  repository_id: string;
  module_path: string;
  module_name: string;
  description: string;
  ownership_type: string;
  created_at: string;
  updated_at: string;
}

export interface TeamDetail extends Team {
  members?: TeamMember[];
  modules?: TeamModule[];
}

export interface RepositoryKnowledge {
  id: string;
  repository_id: string;
  canonical_version: number;
  canonical_content: string;
  canonical_updated_by: string | null;
  canonical_updated_at: string | null;
  materialized_summary: string;
  materialized_hash: string;
  materialized_updated_at: string | null;
  module_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RepoKnowledgeSnapshot {
  id: string;
  repository_id: string;
  version: number;
  canonical_content: string;
  updated_by: string | null;
  created_at: string;
}

export interface ModuleKnowledge {
  id: string;
  repository_id: string;
  module_path: string;
  module_name: string;
  version: number;
  purpose: string;
  entrypoints: string;
  apis_events: string;
  db_touchpoints: string;
  failure_patterns: string;
  learnings: string;
  routing_summary: string;
  confidence: string;
  content_hash: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeContribution {
  id: string;
  repository_id: string;
  module_path: string;
  contributor_id: string;
  source_type: string;
  source_id: string;
  target_section: string;
  title: string;
  content: string;
  status: string;
  reviewed_by: string | null;
  reviewer_feedback: string;
  reviewed_at: string | null;
  pr_id: string | null;
  bundle_status: string;
  created_at: string;
  updated_at: string;
}

export interface PRLearningReview {
  id: string;
  pr_id: string;
  repository_id: string;
  module_path: string;
  reviewer_id: string;
  status: string;
  overall_feedback: string;
  contribution_count: number;
  approved_count: number;
  rejected_count: number;
  created_at: string;
  updated_at: string;
}

export interface PRLearningBundle {
  pr_id: string;
  reviews: PRLearningReview[];
  contributions: KnowledgeContribution[];
  by_module: Record<string, KnowledgeContribution[]>;
}

// Helper for submitting chat answers with file attachments via multipart/form-data
async function submitWithAttachments(
  endpoint: string,
  data: {
    repository_id: string;
    round: number;
    answers: string;
    session_id?: string;
    attachments?: File[];
  }
): Promise<ApiResponse<ChatAnswersResponse>> {
  const formData = new FormData();
  formData.append("repository_id", data.repository_id);
  formData.append("round", String(data.round));
  formData.append("answers", data.answers);
  if (data.session_id) formData.append("session_id", data.session_id);
  if (data.attachments) {
    for (const file of data.attachments) {
      formData.append("attachments", file);
    }
  }

  const token =
    typeof window !== "undefined" ? localStorage.getItem("mars_token") : null;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error || "Request failed" };
    return { success: true, data: json.data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export const api = {
  checkEmail: (email: string) =>
    request<CheckEmailResponse>("/auth/check-email", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  login: (data: LoginRequest) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  register: (data: RegisterRequest) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<void>("/auth/logout", {
      method: "POST",
    }),

  getProjects: () => request<Project[]>("/api/v1/projects"),

  getProject: (id: string) => request<Project>(`/api/v1/projects/${id}`),

  createProject: (data: {
    name: string;
    description?: string;
    link?: string;
    organization_id?: string;
    main_branch?: string;
    qa_branch?: string;
    qa_env_url?: string;
  }) =>
    request<Project>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getChatReadyProjects: () =>
    request<Project[]>("/api/v1/projects/chat-ready"),

  updateQaEnvUrl: (projectId: string, qaEnvUrl: string) =>
    request<{ qa_env_url: string; qa_env_verified: boolean }>(
      `/api/v1/projects/${projectId}/qa-env`,
      {
        method: "PUT",
        body: JSON.stringify({ qa_env_url: qaEnvUrl }),
      }
    ),

  getBookmarks: (type?: string) =>
    request<Bookmark[]>(`/api/v1/bookmarks${type ? `?type=${type}` : ""}`),

  // Project detail
  getProjectDetail: (id: string) =>
    request<ProjectDetail>(`/api/v1/projects/${id}/detail`),

  // Project files
  uploadProjectFile: async (
    projectId: string,
    file: File
  ): Promise<ApiResponse<ProjectFile>> => {
    const formData = new FormData();
    formData.append("file", file);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("mars_token")
        : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(
      `${API_BASE_URL}/api/v1/projects/${projectId}/files`,
      { method: "POST", headers, body: formData }
    );
    const json = await res.json();
    if (!res.ok)
      return { success: false, error: json.error || "Upload failed" };
    return { success: true, data: json.data };
  },

  getProjectFiles: (projectId: string) =>
    request<ProjectFile[]>(`/api/v1/projects/${projectId}/files`),

  getFileContent: (projectId: string, fileId: string) =>
    request<FileContent>(
      `/api/v1/projects/${projectId}/files/${fileId}/content`
    ),

  updateFileContent: (projectId: string, fileId: string, content: string) =>
    request<void>(
      `/api/v1/projects/${projectId}/files/${fileId}/content`,
      { method: "PUT", body: JSON.stringify({ content }) }
    ),

  deleteFile: (projectId: string, fileId: string) =>
    request<void>(`/api/v1/projects/${projectId}/files/${fileId}`, {
      method: "DELETE",
    }),

  // API Keys
  getAPIKeys: () => request<APIKeyItem[]>("/api/v1/api-keys"),

  createAPIKey: (data: { name: string; api_key: string; provider?: string }) =>
    request<APIKeyItem>("/api/v1/api-keys", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteAPIKey: (id: string) =>
    request<void>(`/api/v1/api-keys/${id}`, { method: "DELETE" }),

  setProjectAPIKey: (projectId: string, apiKeyId: string) =>
    request<void>(`/api/v1/projects/${projectId}/api-key`, {
      method: "PUT",
      body: JSON.stringify({ api_key_id: apiKeyId }),
    }),

  // Service config
  getServiceConfig: (projectId: string) =>
    request<ServiceConfig[]>(`/api/v1/projects/${projectId}/services`),

  saveServiceConfig: (projectId: string, services: ServiceConfig[]) =>
    request<void>(`/api/v1/projects/${projectId}/services`, {
      method: "PUT",
      body: JSON.stringify({ services }),
    }),

  // Conversations
  createConversation: (data: {
    channel: string;
    user_id: string;
    project_id: string;
    title?: string;
  }) =>
    request<Conversation>("/api/v1/chat/conversations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getConversations: (userId: string) =>
    request<Conversation[]>(
      `/api/v1/chat/conversations?user_id=${userId}`
    ),

  getConversation: (id: string) =>
    request<ConversationDetail>(`/api/v1/chat/conversations/${id}`),

  approveAction: (conversationId: string) =>
    request<void>(`/api/v1/chat/conversations/${conversationId}/approve`, {
      method: "POST",
    }),

  rejectAction: (conversationId: string) =>
    request<void>(`/api/v1/chat/conversations/${conversationId}/reject`, {
      method: "POST",
    }),

  // GitHub OAuth
  getGitHubAuthURL: () =>
    request<{ auth_url: string }>("/auth/github"),

  getGitHubConnection: () =>
    request<{
      id: string;
      github_username: string;
      github_email: string;
      github_avatar_url: string;
      status: string;
    } | null>("/api/v1/github/connection"),

  connectGitHub: (code: string) =>
    request<{
      id: string;
      github_username: string;
      github_email: string;
      github_avatar_url: string;
      status: string;
    }>("/api/v1/github/connect", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  getGitHubRepos: (page?: number) =>
    request<Array<{
      id: number;
      full_name: string;
      name: string;
      owner: string;
      description: string;
      default_branch: string;
      language: string;
      html_url: string;
      private: boolean;
      star_count: number;
      updated_at: string;
    }>>(`/api/v1/github/repos?page=${page || 1}`),

  disconnectGitHub: () =>
    request<void>("/api/v1/github/disconnect", { method: "DELETE" }),

  // Onboarding
  startOnboarding: (data: { github_repo_full_name: string; github_repo_id: number; branch?: string }) =>
    request<{ id: string; repository_id: string; status: string; total_steps: number }>(
      "/api/v1/onboarding/start",
      { method: "POST", body: JSON.stringify(data) }
    ),

  getPipelineStatus: (pipelineId: string) =>
    request<{
      id: string;
      repository_id: string;
      status: string;
      current_step: string;
      total_steps: number;
      completed_steps: number;
      context_score: number;
      cost_usd: number;
      error_message?: string;
      passes?: Array<{
        pass_type: string;
        pass_order: number;
        status: string;
        generated_file?: string;
        cost_usd: number;
        duration_seconds: number;
      }>;
      started_at?: string;
      completed_at?: string;
    }>(`/api/v1/onboarding/${pipelineId}`),

  getContextScore: (repoId: string) =>
    request<{
      overall_score: number;
      architecture_score: number;
      patterns_score: number;
      testing_score: number;
      security_score: number;
      domain_score: number;
      api_score: number;
      documentation_score: number;
      file_count: number;
      total_lines: number;
      interpretation: string;
    }>(`/api/v1/repositories/${repoId}/context-score`),

  reAnalyze: (repoId: string) =>
    request<{ id: string; status: string }>(
      `/api/v1/repositories/${repoId}/re-analyze`,
      { method: "POST" }
    ),

  // Health & Readiness
  validateHealth: (repoId: string) =>
    request<HealthValidationResult>(
      `/api/v1/repositories/${repoId}/validate-health`,
      { method: "POST" }
    ),

  getReadiness: (repoId: string) =>
    request<ReadinessResult>(`/api/v1/repositories/${repoId}/readiness`),

  setBackendURL: (repoId: string, url: string) =>
    request<void>(`/api/v1/repositories/${repoId}/backend-url`, {
      method: "PUT",
      body: JSON.stringify({ url }),
    }),

  // Capabilities
  getCapabilities: (repoId: string) =>
    request<Capability[]>(`/api/v1/repositories/${repoId}/capabilities`),

  setCapabilities: (repoId: string, capabilities: Array<{ capability: string; enabled: boolean; restricted_paths?: string }>) =>
    request<Capability[]>(`/api/v1/repositories/${repoId}/capabilities`, {
      method: "PUT",
      body: JSON.stringify({ capabilities }),
    }),

  // Decisions
  getDecisions: (repoId: string, limit?: number) =>
    request<EngineeringDecision[]>(
      `/api/v1/repositories/${repoId}/decisions${limit ? `?limit=${limit}` : ""}`
    ),

  // Learning
  getLearningRecords: (repoId: string) =>
    request<LearningRecord[]>(`/api/v1/learning/records?repo_id=${repoId}`),

  createLearningRecord: (data: {
    repository_id: string;
    incident_type: string;
    root_cause?: string;
    resolution?: string;
    tags?: string;
    severity?: string;
  }) =>
    request<LearningRecord>("/api/v1/learning/records", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPatterns: (repoId: string) =>
    request<IncidentPattern[]>(`/api/v1/learning/patterns?repo_id=${repoId}`),

  detectPatterns: (repoId: string) =>
    request<DetectPatternsResult>(
      `/api/v1/learning/detect-patterns?repo_id=${repoId}`,
      { method: "POST" }
    ),

  getProposals: (repoId: string, status?: string) =>
    request<LearningProposal[]>(
      `/api/v1/learning/proposals?repo_id=${repoId}${status ? `&status=${status}` : ""}`
    ),

  voteProposal: (proposalId: string, direction: "up" | "down") =>
    request<void>(`/api/v1/learning/proposals/${proposalId}/vote`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    }),

  updateProposalStatus: (proposalId: string, status: string) =>
    request<void>(`/api/v1/learning/proposals/${proposalId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  // Tickets (v3.0)
  getJiraDashboard: (limit?: number) =>
    request<JiraDashboardResponse>(`/api/v1/tickets/dashboard${limit ? `?limit=${limit}` : ""}`),

  getTickets: (limit?: number) =>
    request<Ticket[]>(`/api/v1/tickets${limit ? `?limit=${limit}` : ""}`),

  getTicket: (id: string) =>
    request<Ticket>(`/api/v1/tickets/${id}`),

  analyzeTicket: (id: string) =>
    request<AnalysisResult>(`/api/v1/tickets/${id}/analyze`, {
      method: "POST",
    }),

  getTicketStatus: (id: string) =>
    request<{ ticket_id: string; jira_key: string; status: string; phase: string }>(
      `/api/v1/tickets/${id}/status`
    ),

  approveTicketPhase: (id: string, phase: string, action: string, feedback?: string) =>
    request<{ ticket_id: string; phase: string; action: string; next_phase: string; status: string }>(
      `/api/v1/tickets/${id}/approve`,
      {
        method: "POST",
        body: JSON.stringify({ phase, action, feedback }),
      }
    ),

  getTicketAnalysis: (id: string) =>
    request<AnalysisResult>(`/api/v1/tickets/${id}/analysis`),

  getTicketQuestions: (id: string) =>
    request<TicketQuestion[]>(`/api/v1/tickets/${id}/questions`),

  getTicketJourney: (id: string) =>
    request<TicketJourneyResponse>(`/api/v1/tickets/${id}/journey`),

  rephaseTicket: (id: string, phase: string, reason?: string) =>
    request<{ ticket_id: string; phase: string; reason: string; status: string }>(
      `/api/v1/tickets/${id}/rephase`,
      {
        method: "POST",
        body: JSON.stringify({ phase, reason }),
      }
    ),

  // Project Mappings (v3.0)
  getMappings: (limit?: number) =>
    request<ProjectMapping[]>(`/api/v1/mappings${limit ? `?limit=${limit}` : ""}`),

  createMapping: (data: {
    jira_project_key: string;
    mars_project_id: string;
    jira_component?: string;
    repository_id?: string;
    service_name?: string;
  }) =>
    request<ProjectMapping>("/api/v1/mappings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteMapping: (id: string) =>
    request<{ deleted: boolean }>(`/api/v1/mappings/${id}`, {
      method: "DELETE",
    }),

  getDependencies: (limit?: number) =>
    request<ServiceDependency[]>(`/api/v1/dependencies${limit ? `?limit=${limit}` : ""}`),

  // Plans (v3.0)
  getPlan: (id: string) =>
    request<TechnicalPlan>(`/api/v1/plans/${id}`),

  listPlans: (limit?: number) =>
    request<TechnicalPlan[]>(`/api/v1/plans${limit ? `?limit=${limit}` : ""}`),

  approvePlan: (id: string, approverId: string) =>
    request<{ plan_id: string; status: string }>(`/api/v1/plans/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ approver_id: approverId }),
    }),

  rejectPlan: (id: string, reason: string) =>
    request<{ plan_id: string; status: string }>(`/api/v1/plans/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // Executions (v3.0)
  getExecution: (id: string) =>
    request<Execution>(`/api/v1/executions/${id}`),

  listExecutions: (limit?: number) =>
    request<Execution[]>(`/api/v1/executions${limit ? `?limit=${limit}` : ""}`),

  // Notifications (v3.0)
  getNotifications: (ticketId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (ticketId) params.set("ticket_id", ticketId);
    if (limit) params.set("limit", String(limit));
    const qs = params.toString();
    return request<Notification[]>(`/api/v1/notifications${qs ? `?${qs}` : ""}`);
  },

  // Prompt Refinement (v3.0)
  refinePrompt: (conversationId: string, content: string, mode?: string, repoId?: string) =>
    request<{
      id: string;
      original_prompt: string;
      refined_prompt: string;
      context_used: string;
      status: string;
    }>(`/api/v1/chat/conversations/${conversationId}/refine`, {
      method: "POST",
      body: JSON.stringify({ content, mode, repo_id: repoId }),
    }),

  approveRefinement: (conversationId: string, refinementId: string, action: "approve" | "modify", modifiedPrompt?: string) =>
    request<{
      id: string;
      refined_prompt: string;
      status: string;
    }>(`/api/v1/chat/conversations/${conversationId}/approve-refinement`, {
      method: "POST",
      body: JSON.stringify({ refinement_id: refinementId, action, modified_prompt: modifiedPrompt }),
    }),

  // Dispatch Groups (v3.0)
  getDispatchGroups: (ticketId: string) =>
    request<{
      id: string;
      ticket_id: string;
      group_order: number;
      status: string;
      members: {
        id: string;
        repository_id: string;
        execution_id: string;
        status: string;
      }[];
    }[]>(`/api/v1/executions/dispatch-groups?ticket_id=${ticketId}`),

  // Manual URL Onboarding (v6.0)
  startManualOnboarding: (data: {
    repo_url: string;
    github_token: string;
    bearer_token?: string;
    qa_host_url?: string;
  }) =>
    request<ManualOnboardingResponse>("/api/v1/onboarding/manual/start", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  configureBranches: (id: string, data: {
    main_branch: string;
    qa_branch: string;
    create_qa_branch: boolean;
  }) =>
    request<ManualOnboardingResponse>(`/api/v1/onboarding/manual/${id}/branches`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  runManualAnalysis: (id: string) =>
    request<ManualOnboardingResponse>(`/api/v1/onboarding/manual/${id}/analyze`, {
      method: "POST",
    }),

  getManualAnalysisResult: (id: string) =>
    request<ManualOnboardingResponse>(`/api/v1/onboarding/manual/${id}/analysis`),

  selectRoles: (id: string, roles: string[]) =>
    request<ManualOnboardingResponse>(`/api/v1/onboarding/manual/${id}/roles`, {
      method: "PUT",
      body: JSON.stringify({ enabled_roles: roles }),
    }),

  generateAndPush: (id: string) =>
    request<ManualOnboardingResponse>(`/api/v1/onboarding/manual/${id}/generate`, {
      method: "POST",
    }),

  getManualOnboardingStatus: (id: string) =>
    request<ManualOnboardingResponse>(`/api/v1/onboarding/manual/${id}`),

  finalizeManualOnboarding: (id: string) =>
    request<ManualOnboardingResponse>(`/api/v1/onboarding/manual/${id}/finalize`, {
      method: "POST",
    }),

  // Onboarding Artifacts
  listOnboardingArtifacts: (projectId: string) =>
    request<OnboardingArtifact[]>(`/api/v1/projects/${projectId}/onboarding-artifacts`),

  getArtifactContent: (projectId: string, path: string) =>
    request<ArtifactContent>(`/api/v1/projects/${projectId}/onboarding-artifacts/content?path=${encodeURIComponent(path)}`),

  // v18.1 — Onboarding Pipeline Status
  getOnboardingStatus: (projectId: string) =>
    request<OnboardingStatusResponse>(`/api/v1/projects/${projectId}/onboarding-status`),

  retryOnboarding: (pipelineId: string) =>
    request<void>(`/api/v1/admin/onboarding/${pipelineId}/force-unlock`, { method: "POST" }),

  resumeOnboarding: (projectId: string) =>
    request<{ message: string; pipeline_id: string }>(`/api/v1/projects/${projectId}/resume-onboarding`, { method: "POST" }),

  // v17.0 — Hardened Onboarding
  approveAnalysis: (id: string) =>
    request<ManualOnboardingResponse>(`/api/v1/onboarding/manual/${id}/approve-analysis`, {
      method: "POST",
    }),

  cancelPipeline: (id: string) =>
    request<ManualOnboardingResponse>(`/api/v1/onboarding/manual/${id}/cancel`, {
      method: "POST",
    }),

  // --- Infra Propagation (v7.0) ---

  bumpInfraVersion: (data: { description: string; changes_summary?: string }) =>
    request<InfraVersionResponse>("/api/v1/infra/version", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getInfraStatus: () =>
    request<PropagationStatusResponse>("/api/v1/infra/status"),

  propagateToRepo: (repoId: string) =>
    request<InfraUpdateResponse>(`/api/v1/infra/propagate/${repoId}`, {
      method: "POST",
    }),

  propagateToAll: () =>
    request<InfraUpdateResponse[]>("/api/v1/infra/propagate-all", {
      method: "POST",
    }),

  getInfraHistory: (repoId: string) =>
    request<InfraUpdateResponse[]>(`/api/v1/infra/history/${repoId}`),

  getInfraVersions: () =>
    request<InfraVersionResponse[]>("/api/v1/infra/versions"),

  // --- Cross-Platform Plan Review (v12.0) ---

  triggerCrossReview: (planId: string) =>
    request<CrossReviewResult>(`/api/v1/plans/${planId}/cross-review/run`, {
      method: "POST",
    }),

  getCrossReview: (planId: string) =>
    request<PlatformReview[]>(`/api/v1/plans/${planId}/cross-review`),

  getConsensus: (planId: string) =>
    request<ConsensusResult>(`/api/v1/plans/${planId}/consensus`),

  overrideConsensus: (planId: string, reason: string) =>
    request<ConsensusResult>(`/api/v1/plans/${planId}/consensus/override`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // --- Organizations ---

  listOrganizations: () =>
    request<Organization[]>("/api/v1/organizations"),

  getOrganization: (id: string) =>
    request<Organization>(`/api/v1/organizations/${id}`),

  createOrganization: (data: {
    name: string;
    slug: string;
    github_username?: string;
    github_token?: string;
  }) =>
    request<Organization>("/api/v1/organizations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOrganization: (id: string, data: {
    name?: string;
    github_username?: string;
    github_token?: string;
  }) =>
    request<Organization>(`/api/v1/organizations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteOrganization: (id: string) =>
    request<void>(`/api/v1/organizations/${id}`, { method: "DELETE" }),

  // --- Repository Agents (v16.0) ---

  listRepoAgents: (repoId: string) =>
    request<RepositoryAgent[]>(`/api/v1/repositories/${repoId}/agents`),

  toggleRepoAgent: (repoId: string, agentId: string) =>
    request<RepositoryAgent>(`/api/v1/repositories/${repoId}/agents/${agentId}/toggle`, {
      method: "PUT",
    }),

  syncRepoAgents: (repoId: string) =>
    request<{ synced: number }>(`/api/v1/repositories/${repoId}/agents/sync`, {
      method: "POST",
    }),

  // --- Improvements (v16.0) ---

  listImprovements: () =>
    request<InfraImprovement[]>("/api/v1/improvements"),

  getImprovement: (id: string) =>
    request<InfraImprovement>(`/api/v1/improvements/${id}`),

  createImprovement: (data: { title: string; description: string; category: string; priority: string }) =>
    request<InfraImprovement>("/api/v1/improvements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteImprovement: (id: string) =>
    request<void>(`/api/v1/improvements/${id}`, { method: "DELETE" }),

  getImprovementDashboard: () =>
    request<ImprovementDashboard>("/api/v1/improvements/dashboard"),

  listRepoImprovementStatuses: (repoId: string) =>
    request<RepoImprovementStatus[]>(`/api/v1/improvements/repo/${repoId}`),

  updateRepoImprovementStatus: (repoId: string, improvementId: string, data: { status: string; notes?: string }) =>
    request<RepoImprovementStatus>(`/api/v1/improvements/repo/${repoId}/${improvementId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // --- Simple Onboarding ---

  startSimpleOnboarding: (data: {
    repo_url: string;
    organization_id?: string;
    github_token?: string;
    main_branch: string;
    qa_branch: string;
    qa_env_url?: string;
    team_id?: string;
  }) =>
    request<{
      id: string;
      phase: string;
      status: string;
      repo_owner: string;
      repo_name: string;
      elk_configured: boolean;
      token_required?: boolean;
      team_id?: string;
      discovered_modules?: { path: string; name: string; language: string }[];
    }>("/api/v1/onboarding/simple/start", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getSimpleOnboardingStatus: (pipelineId: string) =>
    request<{
      id: string;
      phase: string;
      status: string;
      repo_owner: string;
      repo_name: string;
      detected_language?: string;
      detected_framework?: string;
      clone_path?: string;
      repository_id?: string;
      context_score: number;
      elk_configured: boolean;
      token_required?: boolean;
      error_message?: string;
      team_id?: string;
      discovered_modules?: { path: string; name: string; language: string }[];
    }>(`/api/v1/onboarding/simple/${pipelineId}/status`),

  saveSimpleOnboardingELKConfig: (pipelineId: string, data: {
    elk_qa_urls: string[];
    elk_prod_urls: string[];
  }) =>
    request<{
      pipeline_id: string;
      elk_qa_urls: string[];
      elk_prod_urls: string[];
      saved: boolean;
      clone_status: string;
    }>(`/api/v1/onboarding/simple/${pipelineId}/elk-config`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  verifySimpleOnboardingDeploy: (pipelineId: string, data: {
    qa_env_url: string;
  }) =>
    request<{
      pipeline_id: string;
      qa_env_url: string;
      health_endpoint: string;
      status: string;
      marsbuilder_url?: string;
      instructions?: string;
    }>(`/api/v1/onboarding/simple/${pipelineId}/verify-deploy`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // --- Teams (v21.0) ---

  listTeams: (orgId?: string) =>
    request<Team[]>(`/api/v1/teams${orgId ? `?org_id=${orgId}` : ""}`),

  getTeam: (id: string) =>
    request<TeamDetail>(`/api/v1/teams/${id}`),

  createTeam: (data: { organization_id: string; name: string; slug: string; description?: string }) =>
    request<Team>("/api/v1/teams", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTeam: (id: string, data: { name?: string; description?: string; status?: string }) =>
    request<Team>(`/api/v1/teams/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteTeam: (id: string) =>
    request<void>(`/api/v1/teams/${id}`, { method: "DELETE" }),

  addTeamMember: (teamId: string, data: { user_id?: string; email?: string; role: string }) =>
    request<TeamMember>(`/api/v1/teams/${teamId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeTeamMember: (teamId: string, userId: string) =>
    request<void>(`/api/v1/teams/${teamId}/members/${userId}`, { method: "DELETE" }),

  updateTeamMemberRole: (teamId: string, userId: string, role: string) =>
    request<TeamMember>(`/api/v1/teams/${teamId}/members/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),

  assignTeamModule: (teamId: string, data: { repository_id: string; module_path: string; module_name: string; ownership_type?: string }) =>
    request<TeamModule>(`/api/v1/teams/${teamId}/modules`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  unassignTeamModule: (teamId: string, moduleId: string) =>
    request<void>(`/api/v1/teams/${teamId}/modules/${moduleId}`, { method: "DELETE" }),

  listTeamModules: (teamId: string) =>
    request<TeamModule[]>(`/api/v1/teams/${teamId}/modules`),

  getMyTeams: () =>
    request<TeamMember[]>("/api/v1/users/me/teams"),

  listTeamsByRepo: (repoId: string) =>
    request<TeamModule[]>(`/api/v1/repositories/${repoId}/teams`),

  // --- Repository Knowledge (v21.0) ---

  getRepoKnowledge: (repoId: string) =>
    request<RepositoryKnowledge>(`/api/v1/knowledge/repo/${repoId}`),

  updateCanonical: (repoId: string, content: string) =>
    request<RepositoryKnowledge>(`/api/v1/knowledge/repo/${repoId}/canonical`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  getCanonicalHistory: (repoId: string) =>
    request<RepoKnowledgeSnapshot[]>(`/api/v1/knowledge/repo/${repoId}/history`),

  regenerateMaterialized: (repoId: string) =>
    request<RepositoryKnowledge>(`/api/v1/knowledge/repo/${repoId}/regenerate`, {
      method: "POST",
    }),

  getAllRepoSummaries: () =>
    request<Record<string, string>>("/api/v1/knowledge/repos/summaries"),

  // --- Module Knowledge (v21.0) ---

  listModuleKnowledge: (repoId: string) =>
    request<ModuleKnowledge[]>(`/api/v1/knowledge/modules?repo_id=${repoId}`),

  getModuleKnowledge: (repoId: string, modulePath: string) =>
    request<ModuleKnowledge>(`/api/v1/knowledge/modules/${repoId}/${encodeURIComponent(modulePath)}`),

  getModuleKnowledgeHistory: (repoId: string, modulePath: string) =>
    request<unknown[]>(`/api/v1/knowledge/modules/${repoId}/${encodeURIComponent(modulePath)}/history`),

  createContribution: (data: {
    repository_id: string;
    module_path: string;
    source_type: string;
    target_section: string;
    title: string;
    content: string;
  }) =>
    request<KnowledgeContribution>("/api/v1/knowledge/contributions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listContributions: (params: { repo_id?: string; module_path?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params.repo_id) qs.set("repo_id", params.repo_id);
    if (params.module_path) qs.set("module_path", params.module_path);
    if (params.status) qs.set("status", params.status);
    return request<KnowledgeContribution[]>(`/api/v1/knowledge/contributions?${qs.toString()}`);
  },

  getMyContributions: () =>
    request<KnowledgeContribution[]>("/api/v1/knowledge/contributions/mine"),

  listContributionsByPR: (prId: string) =>
    request<KnowledgeContribution[]>(`/api/v1/knowledge/contributions/pr/${prId}`),

  reviewContribution: (id: string, data: { action: string; feedback?: string; content?: string }) =>
    request<KnowledgeContribution>(`/api/v1/knowledge/contributions/${id}/review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // --- Manager PR Review (v21.0) ---

  getPendingReviews: (repoId: string) =>
    request<PRLearningReview[]>(`/api/v1/manager/pending-reviews?repo_id=${repoId}`),

  getPRLearningBundle: (prId: string) =>
    request<PRLearningBundle>(`/api/v1/manager/pr/${prId}/learning`),

  submitPRReview: (prId: string, data: {
    overall_feedback: string;
    decisions: Array<{ contribution_id: string; action: string; feedback?: string; content?: string }>;
  }) =>
    request<{ reviewed: boolean }>(`/api/v1/manager/pr/${prId}/review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMyReviews: () =>
    request<PRLearningReview[]>("/api/v1/manager/my-reviews"),

  // --- Simple Onboarding Dashboard ---

  listRepositories: () =>
    request<Repository[]>("/api/v1/repositories"),

  getRepository: (id: string) =>
    request<Repository>(`/api/v1/repositories/${id}`),

  listRepoFiles: (repoId: string) =>
    request<RepoFile[]>(`/api/v1/repositories/${repoId}/files`),

  readRepoFile: (repoId: string, path: string) =>
    request<{ path: string; content: string }>(`/api/v1/repositories/${repoId}/files/content?path=${encodeURIComponent(path)}`),

  updateRepoConfig: (repoId: string, data: { default_branch?: string; backend_base_url?: string; elk_qa_urls?: string; elk_prod_urls?: string; team_id?: string }) =>
    request<Repository>(`/api/v1/repositories/${repoId}/config`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getInterviewStatus: (repoId: string) =>
    request<InterviewStatus>(`/api/v1/onboarding/simple/chat/status/${repoId}`),

  // Auto-scan
  autoScanRepo: (data: { repository_id: string }) =>
    request<{
      status: string;
      modules_scanned: number;
      total_dimensions: number;
      ai_score: number;
      needs_review: string[];
      generated_files: string[];
      module_results: { module_path: string; module_name: string; current_dimension: string; dimension_index: number; total_dimensions: number; status: string; ai_score: number; needs_review: string[] }[];
      file_count: number;
    }>("/api/v1/onboarding/simple/auto-scan", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Non-streaming version (kept for backward compat)
  autoScanModule: (data: { repository_id: string; module_path: string }) =>
    request<{
      status: string;
      modules_scanned: number;
      ai_score: number;
      needs_review: string[];
      generated_files: string[];
      module_results: { module_path: string; module_name: string; status: string; ai_score: number; needs_review: string[] }[];
    }>("/api/v1/onboarding/simple/auto-scan/module", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getAutoScanStatus: (repoId: string) =>
    request<InterviewStatus & { onboarding_mode: string; needs_review: string[]; file_count: number }>(
      `/api/v1/onboarding/simple/auto-scan/status/${repoId}`
    ),

  getChatRounds: () =>
    request<ChatRound[]>("/api/v1/onboarding/simple/chat/rounds"),

  // Module CRUD
  addOnboardingModule: (data: { repository_id: string; name: string; description?: string; parent_path?: string }) =>
    request<{ path: string; name: string; score: number; enriched: boolean }>("/api/v1/onboarding/simple/modules", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeOnboardingModule: (data: { repository_id: string; module_path: string }) =>
    request<void>("/api/v1/onboarding/simple/modules", {
      method: "DELETE",
      body: JSON.stringify(data),
    }),

  listOnboardingModules: (repoId: string) =>
    request<{ path: string; name: string; score: number; enriched: boolean; submodules?: { path: string; name: string; score: number; enriched: boolean }[] }[]>(
      `/api/v1/onboarding/simple/modules/${repoId}`
    ),

  confirmOnboardingModules: (data: { repository_id: string }) =>
    request<ChatAnswersResponse>("/api/v1/onboarding/simple/modules/confirm", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Repo-level context
  getRepoContext: (repoId: string) =>
    request<{ status: string; context_score: number; sections: Record<string, string>; repo_context_done: boolean; qa_history: { question: string; answer: string }[]; follow_up?: string }>(
      `/api/v1/onboarding/simple/repo-context/${repoId}`
    ),

  submitRepoContext: (data: { repository_id: string; answers: string; section?: string }) =>
    request<{ status: string; context_score: number; sections: Record<string, string>; repo_context_done: boolean; follow_up?: string }>(
      "/api/v1/onboarding/simple/repo-context",
      { method: "POST", body: JSON.stringify(data) }
    ),

  saveRepoContext: (data: { repository_id: string }) =>
    request<{ status: string; context_score: number; sections: Record<string, string>; repo_context_done: boolean }>(
      "/api/v1/onboarding/simple/repo-context/save",
      { method: "POST", body: JSON.stringify(data) }
    ),

  startChatRound: (data: { repository_id: string; round: number; module_path?: string }) =>
    request<ChatRoundResponse>("/api/v1/onboarding/simple/chat/start", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  submitChatAnswers: async (data: {
    repository_id: string;
    round: number;
    answers: string;
    session_id?: string;
    selected_modules?: string[];
    module_path?: string;
    attachments?: File[];
  }): Promise<ApiResponse<ChatAnswersResponse>> => {
    if (data.attachments && data.attachments.length > 0) {
      return submitWithAttachments("/api/v1/onboarding/simple/chat/answers", data);
    }
    const body: Record<string, unknown> = {
      repository_id: data.repository_id,
      round: data.round,
      answers: data.answers,
      session_id: data.session_id,
    };
    if (data.selected_modules && data.selected_modules.length > 0) {
      body.selected_modules = data.selected_modules;
    }
    if (data.module_path) {
      body.module_path = data.module_path;
    }
    return request<ChatAnswersResponse>("/api/v1/onboarding/simple/chat/answers", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  submitChatFollowUp: async (data: {
    repository_id: string;
    round: number;
    answers: string;
    session_id: string;
    attachments?: File[];
  }): Promise<ApiResponse<ChatAnswersResponse>> => {
    if (data.attachments && data.attachments.length > 0) {
      return submitWithAttachments("/api/v1/onboarding/simple/chat/followup", data);
    }
    return request<ChatAnswersResponse>("/api/v1/onboarding/simple/chat/followup", {
      method: "POST",
      body: JSON.stringify({ repository_id: data.repository_id, round: data.round, answers: data.answers, session_id: data.session_id }),
    });
  },

  // Generate workflow docs based on tier + framework
  generateWorkflowDocs: (data: { repository_id: string; reference_repo?: string }) =>
    request<{ generated_files: string[]; count: number }>("/api/v1/onboarding/simple/generate-docs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Free-form chat (sync) — replaces interview rounds 2-5
  freeFormChat: (data: { repository_id: string; message: string; session_id?: string }) =>
    request<{ response: string; session_id: string; context_score: number }>("/api/v1/onboarding/simple/chat/free", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // --- Agent Generation (v25.0) ---

  checkAgentReadiness: (repoId: string) =>
    request<{ ready: boolean; context_score: number; module_count: number; gaps: string[] }>(
      `/api/v1/repositories/${repoId}/agents/readiness`
    ),

  generateAgentPlan: (repoId: string, planType?: string) =>
    request<AgentGenerationPlan>(`/api/v1/repositories/${repoId}/agents/plan`, {
      method: "POST",
      body: JSON.stringify({ plan_type: planType || "full" }),
    }),

  getAgentPlan: (repoId: string, planId: string) =>
    request<AgentGenerationPlan>(`/api/v1/repositories/${repoId}/agents/plan/${planId}`),

  getAgentHistory: (repoId: string) =>
    request<AgentGenerationHistory[]>(`/api/v1/repositories/${repoId}/agents/history`),

  // Admin: Agent plan approval
  listPendingAgentPlans: () =>
    request<AgentGenerationPlan[]>("/api/v1/admin/agents/plans"),

  approveAgentPlan: (planId: string) =>
    request<null>(`/api/v1/admin/agents/plans/${planId}/approve`, { method: "POST" }),

  rejectAgentPlan: (planId: string, feedback: string) =>
    request<null>(`/api/v1/admin/agents/plans/${planId}/reject`, {
      method: "POST",
      body: JSON.stringify({ feedback }),
    }),

  executeAgentPlan: (repoId: string, planId: string) =>
    request<null>(`/api/v1/repositories/${repoId}/agents/generate`, {
      method: "POST",
      body: JSON.stringify({ plan_id: planId }),
    }),

  getRepoScores: (repoId: string) =>
    request<{
      repo_id: string;
      repo_name: string;
      claude_score: number;
      claude_max: number;
      mars_score: number;
      mars_max: number;
      claude_breakdown: { criteria: string; score: number; max: number; notes: string; status: string }[];
      mars_breakdown: { criteria: string; score: number; max: number; notes: string; status: string }[];
      suggestions: string[];
    }>(`/api/v1/repositories/${repoId}/scores`),

  // MCP Chat Sessions
  createMCPSession: (title?: string) =>
    request<{ id: string; user_id: string; title: string; status: string }>("/api/v1/mcp/sessions", {
      method: "POST",
      body: JSON.stringify({ title: title || "MCP Chat" }),
    }),

  listMCPSessions: () =>
    request<{ id: string; title: string; status: string; routed_repo_id: string; routed_repo_path: string; routed_confidence: number; created_at: string }[]>("/api/v1/mcp/sessions"),

  getMCPSession: (id: string) =>
    request<{ id: string; title: string; status: string; routed_repo_id: string; routed_repo_path: string; routed_confidence: number; model: string; total_cost_usd: number }>(`/api/v1/mcp/sessions/${id}`),

  getMCPMessages: (sessionId: string) =>
    request<{ id: string; role: string; content: string; message_type: string; tool_name: string; tool_input: string; tool_output: string; approval_status: string; created_at: string }[]>(`/api/v1/mcp/sessions/${sessionId}/messages`),

  approveMCPAction: (sessionId: string, messageId: string) =>
    request<null>(`/api/v1/mcp/sessions/${sessionId}/approve`, {
      method: "POST",
      body: JSON.stringify({ message_id: messageId }),
    }),

  rejectMCPAction: (sessionId: string, messageId: string) =>
    request<null>(`/api/v1/mcp/sessions/${sessionId}/reject`, {
      method: "POST",
      body: JSON.stringify({ message_id: messageId }),
    }),

  // MCP Protocol (JSON-RPC)
  mcpJsonRPC: (method: string, params?: unknown) =>
    request<unknown>("/api/v1/mcp/jsonrpc", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id: Date.now() }),
    }),

  // Manager: PR learning actions
  mergePRLearning: (prId: string) =>
    request<null>(`/api/v1/manager/pr/${prId}/merge-learning`, { method: "POST" }),

  providePRFeedback: (prId: string, feedback: string) =>
    request<null>(`/api/v1/manager/pr/${prId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ feedback }),
    }),

  // Admin: MARS evolution
  createEvolutionEvent: (data: { event_type: string; description: string; mars_version: string; changes_data?: string }) =>
    request<MarsEvolutionEvent>("/api/v1/admin/evolution", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listEvolutionEvents: () =>
    request<MarsEvolutionEvent[]>("/api/v1/admin/evolution"),

  planPropagation: (eventId: string) =>
    request<AgentGenerationPlan[]>(`/api/v1/admin/evolution/${eventId}/plan`, { method: "POST" }),

  getEvolutionStatus: (eventId: string) =>
    request<{ event: MarsEvolutionEvent; plans: AgentGenerationPlan[] }>(
      `/api/v1/admin/evolution/${eventId}/status`
    ),

  // --- Critical Issues / Vulnerability Scanner ---
  triggerVulnerabilityScan: () =>
    request<{ message: string; status: string }>("/api/v1/admin/scan/vulnerabilities", {
      method: "POST",
    }),

  listCriticalIssues: (params?: { repo_id?: string; severity?: string; status?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.repo_id) query.set("repo_id", params.repo_id);
    if (params?.severity) query.set("severity", params.severity);
    if (params?.status) query.set("status", params.status);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return request<CriticalIssue[]>(`/api/v1/admin/critical-issues${qs ? `?${qs}` : ""}`);
  },

  getCriticalIssue: (id: string) =>
    request<CriticalIssue>(`/api/v1/admin/critical-issues/${id}`),

  assignCriticalIssue: (id: string, assignedTo: string) =>
    request<{ assigned: boolean }>(`/api/v1/admin/critical-issues/${id}/assign`, {
      method: "PUT",
      body: JSON.stringify({ assigned_to: assignedTo }),
    }),

  resolveCriticalIssue: (id: string, resolution?: string) =>
    request<{ resolved: boolean }>(`/api/v1/admin/critical-issues/${id}/resolve`, {
      method: "PUT",
      body: JSON.stringify({ resolution: resolution || "resolved" }),
    }),

  getCriticalIssueStats: () =>
    request<CriticalIssueStats>("/api/v1/admin/critical-issues/stats"),

  // --- Score Dashboard ---
  getScoreDashboard: () =>
    request<ScoreDashboardResponse>("/api/v1/admin/scores/dashboard"),

  // --- ELK Integration ---
  listELKIndexes: (repoId: string) =>
    request<ELKIndex[]>(`/api/v1/repositories/${repoId}/elk-indexes`),

  addELKIndex: (repoId: string, data: { index_pattern: string; label: string; category: string; description?: string }) =>
    request<ELKIndex>(`/api/v1/repositories/${repoId}/elk-indexes`, {
      method: "POST", body: JSON.stringify(data),
    }),

  updateELKIndex: (repoId: string, indexId: string, data: { label?: string; category?: string; is_active?: boolean }) =>
    request<ELKIndex>(`/api/v1/repositories/${repoId}/elk-indexes/${indexId}`, {
      method: "PUT", body: JSON.stringify(data),
    }),

  deleteELKIndex: (repoId: string, indexId: string) =>
    request<null>(`/api/v1/repositories/${repoId}/elk-indexes/${indexId}`, { method: "DELETE" }),

  searchELK: (data: { repository_id: string; query: string; time_range?: string; category?: string; channel_id?: string; order_id?: string }) =>
    request<ELKSearchResponse>("/api/v1/admin/elk/search", {
      method: "POST", body: JSON.stringify(data),
    }),

  diagnoseELK: (data: { repository_id: string; query: string; channel_id?: string; order_id?: string }) =>
    request<ELKDiagnoseResponse>("/api/v1/admin/elk/diagnose", {
      method: "POST", body: JSON.stringify(data),
    }),

  getELKStatus: () => request<ELKStatusResponse>("/api/v1/admin/elk/status"),

  // --- ELK Bug Scanner ---

  triggerELKBugScan: (params?: { index_id?: string; repo_id?: string; search_query?: string }) =>
    request<{ message: string }>("/api/v1/admin/elk-bugs/scan", {
      method: "POST",
      body: params ? JSON.stringify(params) : undefined,
    }),

  listELKIndexes: (repoId?: string) => {
    const qs = repoId ? `?repo_id=${repoId}` : "";
    return request<{ id: string; index_pattern: string; data_view_id: string; elk_base_url: string; label: string; category: string; description: string }[]>(`/api/v1/admin/elk/indexes${qs}`);
  },

  listELKBugs: (repoId?: string) => {
    const qs = repoId ? `?repo_id=${repoId}` : "";
    return request<ELKBug[]>(`/api/v1/admin/elk-bugs${qs}`);
  },

  updateELKBug: (id: string, data: { status?: string; pr_url?: string; assigned_to?: string }) =>
    request<null>(`/api/v1/admin/elk-bugs/${id}`, {
      method: "PUT", body: JSON.stringify(data),
    }),

  getELKBug: (id: string) =>
    request<ELKBug>(`/api/v1/admin/elk-bugs/${id}`),

  analyzeELKBug: (id: string) =>
    request<{ analysis: string }>(`/api/v1/admin/elk-bugs/${id}/analyze`, { method: "POST" }),

  generateELKBugFix: (id: string) =>
    request<{ pr_url: string; branch: string }>(`/api/v1/admin/elk-bugs/${id}/generate-fix`, { method: "POST" }),

  analyzeAllELKBugs: () =>
    request<{ message: string }>("/api/v1/admin/elk-bugs/analyze-all", { method: "POST" }),

  generateAllELKBugFixes: () =>
    request<{ message: string }>("/api/v1/admin/elk-bugs/generate-all-fixes", { method: "POST" }),

  stopELKBugScan: () =>
    request<{ message: string }>("/api/v1/admin/elk-bugs/scan/stop", { method: "POST" }),

  getELKBugScanStatus: () =>
    request<{ running: boolean; total_bugs: number; open: number; assigned: number; with_pr: number; resolved: number; ai_analyzed: number; pending_review: number; code_bugs: number; workflow_issues: number; last_scan_at: string | null }>("/api/v1/admin/elk-bugs/scan/status"),

  runELKBugPipeline: (indexId?: string, repoId?: string) =>
    request<{ message: string }>("/api/v1/admin/elk-bugs/pipeline", {
      method: "POST",
      body: JSON.stringify({ index_id: indexId || "", repo_id: repoId || "" }),
    }),

  listELKBugPendingReviews: () =>
    request<ELKBug[]>("/api/v1/admin/elk-bugs/reviews/pending"),

  submitELKBugReview: (id: string, action: "approve" | "reject", comment?: string) =>
    request<null>(`/api/v1/admin/elk-bugs/${id}/review`, {
      method: "POST", body: JSON.stringify({ action, comment: comment || "" }),
    }),

  // --- CubeAPM Integration ---
  listCubeAPMServices: (repoId: string) =>
    request<CubeAPMService[]>(`/api/v1/repositories/${repoId}/cubeapm-services`),

  addCubeAPMService: (repoId: string, data: { service_name: string; label: string; environment?: string; description?: string }) =>
    request<CubeAPMService>(`/api/v1/repositories/${repoId}/cubeapm-services`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCubeAPMService: (repoId: string, svcId: string, data: { label?: string; description?: string; is_active?: boolean }) =>
    request<CubeAPMService>(`/api/v1/repositories/${repoId}/cubeapm-services/${svcId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteCubeAPMService: (repoId: string, svcId: string) =>
    request<{ deleted: boolean }>(`/api/v1/repositories/${repoId}/cubeapm-services/${svcId}`, {
      method: "DELETE",
    }),

  getCubeAPMStatus: () =>
    request<CubeAPMStatusResponse>("/api/v1/admin/cubeapm/status"),

  queryCubeAPMMetrics: (data: { query: string; duration?: string }) =>
    request<CubeAPMServiceMetrics[]>("/api/v1/admin/cubeapm/query", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getCubeAPMDeepLink: (service: string) =>
    request<{ deep_link: string }>(`/api/v1/admin/cubeapm/deep-link?service=${encodeURIComponent(service)}`),

  listCubeAPMAllServices: () =>
    request<CubeAPMService[]>("/api/v1/admin/cubeapm/services"),

  triggerCubeAPMScan: (params?: { repo_id?: string }) =>
    request<{ alerts_found: number }>("/api/v1/admin/cubeapm-alerts/scan", {
      method: "POST",
      body: JSON.stringify(params || {}),
    }),

  getCubeAPMScanStatus: () =>
    request<{ running: boolean }>("/api/v1/admin/cubeapm-alerts/scan/status"),

  listCubeAPMAlerts: (repoId?: string) =>
    request<CubeAPMAlert[]>(`/api/v1/admin/cubeapm-alerts${repoId ? `?repo_id=${repoId}` : ""}`),

  getCubeAPMAlert: (id: string) =>
    request<CubeAPMAlert>(`/api/v1/admin/cubeapm-alerts/${id}`),

  updateCubeAPMAlert: (id: string, data: { status?: string; assigned_to?: string }) =>
    request<CubeAPMAlert>(`/api/v1/admin/cubeapm-alerts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // --- Structure Viewer ---

  getAgentStructure: (repoId: string) =>
    request<{ repo_name: string; tree: Array<{ name: string; path: string; type: string; children?: unknown[] }> }>(`/api/v1/repositories/${repoId}/agent-structure`),

  getAgentFile: (repoId: string, filePath: string) =>
    request<{ content: string }>(`/api/v1/repositories/${repoId}/agent-file?path=${encodeURIComponent(filePath)}`),

  // --- Agent Builder (Custom Artifacts + Deployments) ---

  createCustomArtifact: (data: { name: string; artifact_type: string; description?: string; content: string; target_path?: string; model_hint?: string; tags?: string; guardrails?: string }) =>
    request<unknown>("/api/v1/admin/artifacts", { method: "POST", body: JSON.stringify(data) }),

  listCustomArtifacts: (typeFilter?: string) => {
    const qs = typeFilter ? `?type=${typeFilter}` : "";
    return request<unknown[]>(`/api/v1/admin/artifacts${qs}`);
  },

  getCustomArtifact: (id: string) =>
    request<unknown>(`/api/v1/admin/artifacts/${id}`),

  updateCustomArtifact: (id: string, data: { name?: string; description?: string; content?: string; target_path?: string; model_hint?: string; tags?: string; guardrails?: string }) =>
    request<unknown>(`/api/v1/admin/artifacts/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteCustomArtifact: (id: string) =>
    request<null>(`/api/v1/admin/artifacts/${id}`, { method: "DELETE" }),

  forkFromTemplate: (data: { template_name: string; artifact_type: string }) =>
    request<unknown>("/api/v1/admin/artifacts/fork", { method: "POST", body: JSON.stringify(data) }),

  listEligibleRepos: () =>
    request<unknown[]>("/api/v1/admin/artifacts/repos"),

  listECCTemplates: () =>
    request<Array<{ name: string; artifact_type: string; min_tier: string }>>("/api/v1/admin/artifacts/templates"),

  createDeployment: (data: { name: string; description?: string; artifact_ids: string[]; target_repo_ids: string[]; target_platforms: string[] }) =>
    request<unknown>("/api/v1/admin/deployments", { method: "POST", body: JSON.stringify(data) }),

  listDeployments: () =>
    request<unknown[]>("/api/v1/admin/deployments"),

  getDeployment: (id: string) =>
    request<unknown>(`/api/v1/admin/deployments/${id}`),

  planDeployment: (id: string) =>
    request<unknown>(`/api/v1/admin/deployments/${id}/plan`, { method: "POST" }),

  approveDeployment: (id: string) =>
    request<unknown>(`/api/v1/admin/deployments/${id}/approve`, { method: "POST" }),

  rejectDeployment: (id: string, feedback: string) =>
    request<unknown>(`/api/v1/admin/deployments/${id}/reject`, { method: "POST", body: JSON.stringify({ feedback }) }),

  // --- Background Jobs ---

  listJobs: () =>
    request<Array<{ id: string; name: string; description: string; enabled: boolean; enabled_by: string; schedule: string; can_run: boolean }>>("/api/v1/admin/jobs"),

  runJob: (id: string) =>
    request<unknown>(`/api/v1/admin/jobs/${id}/run`, { method: "POST" }),

  // --- KB Sync (Production Deploy → KB Auto-Update) ---

  getKBSyncStatus: (repoId: string) =>
    request<KBSyncStatus>(`/api/v1/repositories/${repoId}/kb-sync/status`),

  previewKBSync: (repoId: string, githubToken: string) =>
    request<KBSyncPreview>(`/api/v1/repositories/${repoId}/kb-sync/preview`, {
      method: "POST",
      body: JSON.stringify({ github_token: githubToken }),
    }),

  applyKBSync: (repoId: string, githubToken: string) =>
    request<KBSyncResult>(`/api/v1/repositories/${repoId}/kb-sync/apply`, {
      method: "POST",
      body: JSON.stringify({ github_token: githubToken }),
    }),

  // --- Cosmos AI Workflow Settings ---

  getCosmosSettings: (orgId?: string) => {
    const qs = orgId ? `?org_id=${encodeURIComponent(orgId)}` : "";
    return request<CosmosWorkflowSettings>(`/api/v1/settings/cosmos${qs}`);
  },

  updateCosmosSettings: (settings: CosmosWorkflowSettings) =>
    request<CosmosWorkflowSettings>("/api/v1/settings/cosmos", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),

  applyCosmosPreset: (preset: "max_quality" | "balanced" | "cost_optimized", orgId?: string) =>
    request<CosmosWorkflowSettings>("/api/v1/settings/cosmos/preset", {
      method: "POST",
      body: JSON.stringify({ preset, org_id: orgId }),
    }),

};

// --- Agent Generation Types (v25.0) ---

interface AgentGenerationPlan {
  id: string;
  repository_id: string;
  plan_type: string;
  trigger_source: string;
  status: string;
  repo_tier: string;
  repo_framework: string;
  repo_archetype: string;
  context_score: number;
  plan_data: string;
  admin_id: string;
  admin_feedback: string;
  requested_by: string;
  approved_at: string | null;
  rejected_at: string | null;
  executed_at: string | null;
  created_at: string;
}

interface AgentGenerationHistory {
  id: string;
  plan_id: string;
  repository_id: string;
  status: string;
  files_created: number;
  files_updated: number;
  files_skipped: number;
  commit_sha: string;
  branch_name: string;
  started_at: string;
  completed_at: string | null;
}

interface MarsEvolutionEvent {
  id: string;
  event_type: string;
  description: string;
  mars_version: string;
  changes_data: string;
  affects_repos: string;
  propagated_count: number;
  total_repos: number;
  status: string;
  created_by: string;
  created_at: string;
}

// --- Critical Issue Types ---

export interface CriticalIssue {
  id: string;
  repository_id: string;
  module_path: string;
  issue_type: string;
  severity: string;
  title: string;
  description: string;
  file_path: string;
  line_number: number;
  evidence: string;
  status: string;
  assigned_to: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScoreDashboardResponse {
  repos: { id: string; name: string; slug: string; context_score: number; clone_path: string }[];
  orchestrator_score: number;
  suggestions: { dimension: string; current: number; target: number; action: string; impact: string; effort: string }[];
  total_doc_files: number;
}

export interface CriticalIssueStats {
  total: number;
  by_severity: Record<string, number>;
  by_repo: Array<{
    repository_id: string;
    severity: string;
    count: number;
  }>;
}

// --- ELK Types ---

export interface ELKIndex {
  id: string;
  repository_id: string;
  index_pattern: string;
  label: string;
  category: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface ELKSearchResponse {
  method: string;
  logs: { timestamp: string; message: string; level: string; index: string }[];
  total_hits: number;
  deep_link: string;
  search_tips?: string[];
}

export interface ELKDiagnoseResponse {
  method: string;
  logs: { timestamp: string; message: string; level: string; index: string }[];
  total_hits: number;
  deep_links: string[];
  indexes_searched: number;
  search_tips: string[];
}

export interface ELKStatusResponse {
  enabled: boolean;
  auth_configured: boolean;
  base_url: string;
  has_session: boolean;
}

// --- ELK Bug Types ---

export interface ELKBug {
  id: string;
  repository_id: string;
  error_message: string;
  error_type: string;
  search_query: string;
  index_pattern: string;
  occurrence_count: number;
  affected_companies: string;
  sample_log_id: string;
  sample_log: string;
  source_file: string;
  source_line: number;
  ai_analysis: string;
  ai_fix_detail: string;
  ai_rca: string;
  specific_error: string;
  analysis_status: string;
  status: string;
  severity: string;
  bug_category: string;
  sub_error: string;
  pr_url: string;
  pr_branch: string;
  assigned_to: string;
  review_status: string;
  reviewed_by: string;
  review_comment: string;
  discovery_method: string;
  reviewed_at: string | null;
  last_seen_at: string;
  resolved_at: string | null;
  created_at: string;
}

// --- CubeAPM Types ---
export interface CubeAPMService {
  id: string;
  repository_id: string;
  service_name: string;
  environment: string;
  label: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CubeAPMAlert {
  id: string;
  repository_id: string;
  service_name: string;
  alert_type: string;
  endpoint: string;
  metric_value: number;
  threshold: number;
  severity: string;
  status: string;
  ai_analysis: string;
  ai_rca: string;
  sample_trace_id: string;
  occurrence_count: number;
  last_seen_at: string;
  resolved_at: string;
  assigned_to: string;
  created_at: string;
  updated_at: string;
}

export interface CubeAPMServiceMetrics {
  service_name: string;
  throughput: number;
  error_rate: number;
  p50_latency: number;
  p95_latency: number;
  p99_latency: number;
}

export interface CubeAPMStatusResponse {
  enabled: boolean;
  connected: boolean;
  error: string;
}

// --- KB Sync Types ---

export interface KBChangeItem {
  change_type: "api_new" | "api_modified" | "schema_ddl" | "model_const";
  source_file: string;
  kb_file_path: string;
  kb_pillar: string;
  entity_id: string;
  description: string;
  patch: string;
}

export interface KBSyncPreview {
  repo_id: string;
  pr_numbers: number[];
  latest_pr_sha: string;
  merged_at: string;
  total_prs: number;
  changes: KBChangeItem[];
  api_changes: number;
  schema_changes: number;
  model_changes: number;
  affected_kb_files: string[];
  generated_at: string;
}

export interface KBSyncResult {
  repo_id: string;
  files_marked: number;
  cosmos_triggered: boolean;
  synced_at: string;
  latest_pr_sha: string;
}

export interface KBSyncStatus {
  kb_status: string;
  kb_pending_files: number;
  last_kb_sync_at: string | null;
  last_kb_sync_sha: string;
  kb_last_trained_at: string | null;
}

// --- Cosmos AI Workflow Settings ---

export interface CosmosWorkflowSettings {
  id?: string;
  org_id?: string | null;
  quality_mode: "max_quality" | "balanced" | "cost_optimized";
  force_complex: boolean;
  model_preference: "auto" | "opus" | "sonnet" | "haiku";
  ignore_cost_budget: boolean;
  wave1_confidence_threshold: number;
  tier1_respond_threshold: number;
  probe_timeout_sec: number;
  deep_timeout_sec: number;
  pipeline1_enabled: boolean;
  pipeline2_enabled: boolean;
  pipeline3_enabled: boolean;
  pipeline4_enabled: boolean;
  pipeline5_enabled: boolean;
  enable_ralph: boolean;
  enable_riper: boolean;
  enable_hyde: boolean;
  max_context_tokens: number;
  // Wave 3: LangGraph stateful reasoning
  wave3_langgraph_enabled?: boolean;
  wave3_max_iterations?: number;
  wave3_timeout_sec?: number;
  // Wave 4: Neo4j targeted graph traversal
  wave4_neo4j_enabled?: boolean;
  wave4_max_depth?: number;
  wave4_timeout_sec?: number;
}
