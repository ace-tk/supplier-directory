import { PageHeader } from "@/components/layout/page-header";
import { BusinessStructureTabs } from "@/components/business-structure/BusinessStructureTabs";
import { getBusinessSetupAction, getAssignedBusinessAction } from "@/services/business-structure";
import { EMPTY_SETUP } from "@/lib/business-structure";

export default async function BusinessStructurePage() {
  const [setup, assignedBusiness] = await Promise.all([
    getBusinessSetupAction(),
    getAssignedBusinessAction(),
  ]);

  return (
    <div>
      <PageHeader title="Business Structure" description="Set up the legal entity, its businesses, locations, members and access. Then manage deals." />
      <BusinessStructureTabs
        initialSetup={setup.success ? setup.data : EMPTY_SETUP}
        assignedBusiness={assignedBusiness}
      />
    </div>
  );
}

