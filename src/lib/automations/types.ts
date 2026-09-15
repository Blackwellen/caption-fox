export interface PersonLite {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

export interface AutomationCondition { field: string; operator: string; value: string }
export interface AutomationActionStep { action_key: string; config: Record<string, unknown> }

export interface AutomationRow {
  id: string
  workspace_id: string
  name: string
  description: string | null
  status: string
  trigger_key: string
  trigger_config: Record<string, unknown>
  conditions: AutomationCondition[]
  actions: AutomationActionStep[]
  source_template_key: string | null
  is_demo: boolean
  created_by: string | null
  run_count: number
  success_count: number
  failure_count: number
  last_run_at: string | null
  last_run_status: string | null
  created_at: string
  updated_at: string
  creator?: PersonLite | null
}

export interface AutomationRunRow {
  id: string
  workspace_id: string
  automation_id: string
  trigger_source: string
  status: string
  context: Record<string, unknown>
  error: string | null
  started_at: string
  finished_at: string | null
  automation?: Pick<AutomationRow, 'id' | 'name' | 'trigger_key'> | null
  action_logs?: AutomationActionLogRow[]
}

export interface AutomationActionLogRow {
  id: string
  workspace_id: string
  run_id: string
  action_key: string
  status: string
  message: string | null
  affected_entity_type: string | null
  affected_entity_id: string | null
  created_at: string
}

export interface AutomationTemplateRow {
  key: string
  name: string
  description: string
  category: string
  trigger_key: string
  default_trigger_config: Record<string, unknown>
  default_conditions: AutomationCondition[]
  default_actions: AutomationActionStep[]
  risk_level: string
}

export interface TriggerCatalogRow {
  key: string
  label: string
  description: string
  kind: 'event' | 'schedule'
  source_table: string | null
  config_schema: Record<string, unknown>
}

export interface ActionCatalogRow {
  key: string
  label: string
  description: string
  config_schema: Record<string, unknown>
  risk_level: string
}

export interface AutomationNotificationRow {
  id: string
  workspace_id: string
  automation_id: string | null
  run_id: string | null
  title: string
  message: string
  link: string | null
  read: boolean
  created_at: string
  automation?: Pick<AutomationRow, 'id' | 'name'> | null
}

export interface KpiValue {
  id: string
  label: string
  value: string
  hint?: string
  trend?: 'up' | 'down' | 'flat'
  icon: string
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'red' | 'slate'
  spark?: number[]
  href?: string
}

export interface StatusCount { key: string; label: string; value: number; colour: string }
export interface MetricPoint { date: string; [key: string]: string | number }
