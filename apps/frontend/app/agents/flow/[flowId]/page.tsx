"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useI18n } from "@/contexts/I18nContext";

function FlowEditorLoading() {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 items-center justify-center bg-chat-bg text-sm text-muted">
      {t("flows.designerLoading")}
    </div>
  );
}

const FlowEditor = dynamic(
  () => import("@/components/flow-designer/FlowEditor").then((m) => m.FlowEditor),
  {
    ssr: false,
    loading: () => <FlowEditorLoading />,
  },
);

function FlowEditorPageContent({ flowId }: { flowId: string | null }) {
  const searchParams = useSearchParams();
  const editMeta = searchParams.get("edit") === "info";

  return <FlowEditor flowId={flowId} editMeta={editMeta} />;
}

export default function FlowEditorPage({ params }: { params: { flowId: string } }) {
  const flowId = params.flowId === "new" ? null : params.flowId;

  return (
    <AppShell>
      <Suspense fallback={<FlowEditorLoading />}>
        <FlowEditorPageContent flowId={flowId} />
      </Suspense>
    </AppShell>
  );
}
