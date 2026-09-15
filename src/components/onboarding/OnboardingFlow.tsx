'use client'

import type { FlowProps } from './useOnboardingFlow'
import CreatorFlow from './CreatorFlow'
import BusinessFlow from './BusinessFlow'
import BrandFlow from './BrandFlow'
import AgencyFlow from './AgencyFlow'
import SupplierFlow from './SupplierFlow'

// Five purpose-built flows sharing one persistence model (useOnboardingFlow)
// and one set of primitives — deliberately not a generic form renderer.
export function OnboardingFlow(props: FlowProps) {
  switch (props.type) {
    case 'creator': return <CreatorFlow {...props} />
    case 'business': return <BusinessFlow {...props} />
    case 'brand': return <BrandFlow {...props} />
    case 'agency': return <AgencyFlow {...props} />
    case 'supplier': return <SupplierFlow {...props} />
  }
}
