// Domain types for the shared Brand & Assets module.
// Mirrors supabase/migrations/20260829000000_brand_assets.sql and
// 20260829000100_brand_rights_products.sql — keep the unions in step with the
// database CHECK constraints, they are the same contract expressed twice.

export type BrandStatus = 'draft' | 'active' | 'review' | 'archived'
export type KitStatus = 'draft' | 'review' | 'active' | 'archived'
export type ApprovalState = 'none' | 'pending' | 'changes_requested' | 'approved' | 'rejected'

export type AssetKind =
  | 'image' | 'video' | 'audio' | 'pdf' | 'presentation' | 'document'
  | 'design' | 'social' | 'packaging' | 'template' | 'archive' | 'other'

export type AssetApprovalStatus =
  | 'draft' | 'pending' | 'changes_requested' | 'approved' | 'rejected' | 'archived'

export type RightsState =
  | 'unspecified' | 'licensed' | 'all_media' | 'internal_use'
  | 'public_use' | 'restricted' | 'expiring_soon' | 'expired'

export type ProcessingState = 'uploading' | 'processing' | 'scanning' | 'ready' | 'failed'
export type ScanState = 'pending' | 'clean' | 'flagged' | 'failed'

export type LicenseType =
  | 'exclusive' | 'standard' | 'non_exclusive' | 'campaign' | 'royalty_free'
  | 'design' | 'trademark' | 'video' | 'image' | 'music' | 'other'

export type LicenseStatus =
  | 'draft' | 'pending' | 'active' | 'expiring_soon' | 'expired'
  | 'restricted' | 'suspended' | 'renewal_pending' | 'cancelled'

export type ProductStatus =
  | 'draft' | 'review' | 'active' | 'inactive' | 'archived' | 'discontinued'

export type ReadinessState = 'ready' | 'review' | 'not_ready'

export type ReadinessCheckKey =
  | 'primary_image' | 'lifestyle_image' | 'packshot' | 'product_video' | 'description'
  | 'localisation' | 'brand_compliance' | 'rights_coverage' | 'required_metadata'
  | 'approved_assets' | 'market_data'

export type ProductAssetLinkType =
  | 'primary_image' | 'packshot' | 'lifestyle' | 'video' | 'three_sixty'
  | 'packaging' | 'spec_sheet' | 'social' | 'presentation' | 'localised' | 'other'

export type ConflictType =
  | 'outside_territory' | 'unauthorised_channel' | 'expired_licence' | 'no_licence'
  | 'incompatible_product' | 'campaign_outside_period' | 'modification_prohibited'
  | 'exclusivity_clash' | 'missing_agreement' | 'expired_agreement' | 'scope_exceeded'

export type Severity = 'low' | 'medium' | 'high'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export type AlertType =
  | 'rights_expiring' | 'pending_approvals' | 'guideline_update' | 'compliance_change'
  | 'missing_product_assets' | 'storage_quota' | 'licence_expired' | 'agreement_missing'

export type ActivityEntity =
  | 'brand' | 'brand_kit' | 'asset' | 'folder' | 'collection'
  | 'license' | 'agreement' | 'product' | 'usage_request' | 'approval'

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface PersonLite {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface BrandFamily {
  id: string
  workspace_id: string
  name: string
  slug: string
  description: string | null
}

export interface BrandLite {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string | null
  status: BrandStatus
  family_id: string | null
}

export interface BrandKitColour {
  id: string
  name: string
  hex: string
  role: string | null
  usage_notes: string | null
  sort_order: number
}

export interface BrandKitTypographyStyle {
  id: string
  style_name: string
  font_family: string
  font_weight: string | null
  font_size_px: number | null
  line_height_px: number | null
  letter_spacing: string | null
  sort_order: number
}

export interface BrandKitLogo {
  id: string
  label: string
  lockup_type: string
  asset_id: string | null
  background: string | null
  sort_order: number
}

export interface BrandKitTemplate {
  id: string
  name: string
  template_type: string
  dimensions: string | null
  asset_id: string | null
  sort_order: number
}

export interface BrandKitDocument {
  id: string
  title: string
  doc_type: string
  asset_id: string | null
  version_label: string | null
}

export interface BrandKitTone {
  statement: string | null
  traits: string[]
  do_use: string[]
  dont_use: string[]
  example_copy: string | null
}

export interface BrandKit {
  id: string
  workspace_id: string
  brand_id: string
  name: string
  description: string | null
  status: KitStatus
  approval_status: ApprovalState
  logo_asset_id: string | null
  team_name: string | null
  consistency_score: number | null
  current_version: number
  published_version: number | null
  owner_id: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

/** A kit joined with the pieces the Brand Kits card needs in one round trip. */
export interface BrandKitCard extends BrandKit {
  brand: BrandLite | null
  owner: PersonLite | null
  colours: BrandKitColour[]
  typography: BrandKitTypographyStyle[]
  asset_count: number
  template_count: number
}

export interface AssetFolder {
  id: string
  workspace_id: string
  parent_id: string | null
  name: string
  path: string
  asset_count?: number
}

export interface AssetCollection {
  id: string
  workspace_id: string
  name: string
  description: string | null
  is_shared: boolean
  item_count?: number
}

export interface BrandAsset {
  id: string
  workspace_id: string
  brand_id: string | null
  brand_kit_id: string | null
  folder_id: string | null
  owner_id: string | null
  file_name: string
  file_path: string
  file_url: string
  file_type: string
  file_size: number | null
  mime_type: string | null
  width: number | null
  height: number | null
  duration_seconds: number | null
  tags: string[]
  alt_text: string | null
  asset_kind: AssetKind
  approval_status: AssetApprovalStatus
  rights_state: RightsState
  usage_scope: string | null
  storage_bucket: string | null
  thumbnail_path: string | null
  preview_path: string | null
  checksum: string | null
  version_no: number
  is_favourite: boolean
  processing_state: ProcessingState
  scan_state: ScanState
  expires_at: string | null
  download_count: number
  is_demo: boolean
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface BrandAssetCard extends BrandAsset {
  brand: BrandLite | null
  owner: PersonLite | null
}

export interface RightsTerritory {
  id: string
  code: string
  name: string
  region: string | null
  iso_codes: string[]
}

export interface RightsChannel {
  id: string
  code: string
  name: string
}

export interface RightsLicense {
  id: string
  workspace_id: string
  brand_id: string | null
  asset_id: string | null
  product_id: string | null
  name: string
  reference: string | null
  license_type: LicenseType
  licensor: string | null
  licensee: string | null
  status: LicenseStatus
  starts_on: string | null
  expires_on: string | null
  renewal_due_on: string | null
  usage_scope: string | null
  exclusivity: boolean
  modification_allowed: boolean
  distribution_limit: string | null
  risk_level: Severity | null
  owner_id: string | null
  notes: string | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface RightsLicenseRow extends RightsLicense {
  asset: Pick<BrandAsset, 'id' | 'file_name' | 'thumbnail_path' | 'asset_kind'> | null
  product: { id: string; name: string; sku: string } | null
  owner: PersonLite | null
  territories: RightsTerritory[]
  channels: RightsChannel[]
  /** Derived, never stored: days between today and expires_on. */
  days_remaining: number | null
}

export interface RightsConflict {
  id: string
  workspace_id: string
  asset_id: string | null
  license_id: string | null
  product_id: string | null
  conflict_type: ConflictType
  severity: Severity
  detail: string | null
  resolved_at: string | null
  detected_at: string
}

export interface Product {
  id: string
  workspace_id: string
  brand_id: string | null
  category_id: string | null
  collection_id: string | null
  name: string
  sku: string
  description: string | null
  product_line: string | null
  status: ProductStatus
  primary_asset_id: string | null
  readiness_score: number
  readiness_state: ReadinessState
  owner_id: string | null
  is_favourite: boolean
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface ProductCard extends Product {
  brand: BrandLite | null
  owner: PersonLite | null
  category_name: string | null
  primary_asset: Pick<BrandAsset, 'id' | 'file_name' | 'thumbnail_path' | 'file_url'> | null
  linked_asset_count: number
  markets: string[]
}

export interface ProductReadinessCheck {
  check_key: ReadinessCheckKey
  passed: boolean
  detail: string | null
  weight: number
}

export interface BrandActivityItem {
  id: string
  workspace_id: string
  actor: PersonLite | null
  entity_type: ActivityEntity
  entity_id: string | null
  action: string
  summary: string
  href: string | null
  created_at: string
}

export interface BrandAlert {
  id: string
  workspace_id: string
  alert_type: AlertType
  severity: AlertSeverity
  title: string
  body: string | null
  href: string | null
  resolved_at: string | null
  created_at: string
}

export interface WorkspaceStorage {
  workspace_id: string
  bytes_used: number
  bytes_quota: number
  asset_count: number
  recalculated_at: string
}

// ---------------------------------------------------------------------------
// View + query state
// ---------------------------------------------------------------------------

export type KitView = 'cards' | 'table'
export type AssetView = 'grid' | 'list' | 'table'
export type RightsView = 'table' | 'calendar' | 'cards'
export type ProductView = 'cards' | 'list' | 'table'

/** A KPI as rendered by the shared strip: value plus its comparison delta. */
export interface Kpi {
  key: string
  label: string
  value: string
  /** Signed change over the comparison period; null when there is no baseline. */
  delta: number | null
  deltaLabel: string | null
  /** true when a rise is good (assets added), false when a rise is bad (missing assets). */
  riseIsGood: boolean
  tone: 'blue' | 'green' | 'amber' | 'purple' | 'indigo' | 'emerald' | 'red'
  href: string | null
  tooltip: string
}
