import { Suspense } from "react";
import { getViewerContextAction } from "@/features/auction/actions/viewerContext.action";
import { HostApp } from "@/features/host/components/HostApp";
import { LogoutButton } from "@/features/auth/components/LogoutButton";

export default async function HostPage() {
  const ctx = await getViewerContextAction();

  if (!ctx.success) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#09090b] p-6 text-center">
        <p className="text-sm text-gray-400">
          No pudimos cargar el evento.
          <br />
          <span className="text-gray-600">({ctx.error})</span>
        </p>
        <LogoutButton />
      </main>
    );
  }

  return (
    <Suspense>
      <HostApp eventId={ctx.data.eventId} userId={ctx.data.userId} />
    </Suspense>
  );
}
