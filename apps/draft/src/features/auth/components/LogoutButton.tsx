"use client";

import { logoutAction } from "@/features/auth/actions/auth.actions";

export function LogoutButton({ className }: { className?: string }) {
  async function handleLogout() {
    await logoutAction();
    window.location.assign("/login");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={
        className ??
        "rounded-lg border border-[#374151] px-4 py-2 text-sm text-white transition-colors hover:bg-[#171717]"
      }
    >
      Cerrar sesión
    </button>
  );
}
