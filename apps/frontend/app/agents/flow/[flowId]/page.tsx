"use client";

import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";

const FlowEditor = dynamic(
  () => import("@/components/flow-designer/FlowEditor").then((m) => m.FlowEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center bg-[#0e0e0e] text-sm text-white/50">
        Đang tải Flow Designer...
      </div>
    ),
  },
);

export default function FlowEditorPage({ params }: { params: { flowId: string } }) {
  const flowId = params.flowId === "new" ? null : params.flowId;

  return (
    <AppShell>
      <FlowEditor flowId={flowId} />
    </AppShell>
  );
}
