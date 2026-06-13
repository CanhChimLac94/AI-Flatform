"use client";

import { AppShell } from "@/components/layout/AppShell";
import { FlowEditor } from "@/components/flow-designer/FlowEditor";

export default function AgentFlowPage() {
  return (
    <AppShell>
      <FlowEditor />
    </AppShell>
  );
}
