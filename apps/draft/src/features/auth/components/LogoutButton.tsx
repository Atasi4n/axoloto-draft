"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/features/auth/actions/auth.actions";
import { ConfirmModal } from "@/features/host/components/ConfirmModal";

export function LogoutButton({ withLabel = false }: { withLabel?: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleLogout() {
    await logoutAction();
    window.location.assign("/login");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        aria-label="Cerrar sesión"
        className={
          withLabel
            ? "flex items-center gap-2 rounded-lg border border-red-900 bg-[#171717] px-4 py-2 text-sm text-red-300 transition-colors hover:bg-[#1f1416]"
            : "rounded-lg border border-red-900 bg-[#171717] p-2.5 text-red-300 transition-colors hover:bg-[#1f1416]"
        }
      >
        <LogOut className="h-4 w-4" />
        {withLabel && "Cerrar sesión"}
      </button>

      <ConfirmModal
        open={confirmOpen}
        title="¿Seguro de que quieres cerrar sesión?"
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
        onConfirm={() => {
          setConfirmOpen(false);
          handleLogout();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
