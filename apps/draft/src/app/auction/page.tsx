import { Suspense } from "react";
import { getViewerContextAction } from "@/features/auction/actions/viewerContext.action";
import { MobileApp } from "@/features/auction/components/MobileApp";
import { LogoutButton } from "@/features/auth/components/LogoutButton";

export default async function MobilePage() {
  const ctx = await getViewerContextAction();

  // Don't redirect to /login on failure — the proxy would bounce an authed user
  // straight back here, causing a redirect loop. Show the reason in place.
  if (!ctx.success) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#09090b] p-6 text-center">
        <p className="text-sm text-gray-400">
          No pudimos cargar tu perfil del evento.
          <br />
          <span className="text-gray-600">({ctx.error})</span>
        </p>
        <LogoutButton />
      </main>
    );
  }

  return (
    <Suspense>
      <MobileApp {...ctx.data} />
    </Suspense>
  );
}
