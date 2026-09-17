/** Result shape every Strategy server action returns. Never throws to the client. */
export interface ActionResult {
  ok: boolean
  error?: string
  /** Field-level validation errors keyed by input name. */
  fieldErrors?: Record<string, string>
  id?: string
  message?: string
}
