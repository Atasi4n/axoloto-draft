'use client'

type Props = {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Sí',
  cancelLabel = 'No',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0d0d12] p-6"
      >
        <h2 className="text-lg font-medium text-white">{title}</h2>
        {message && <p className="mt-2 text-sm text-gray-400">{message}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 bg-[#15151c] px-5 py-2 text-sm text-gray-200 transition-colors hover:bg-[#1c1c24]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border border-red-900/60 bg-red-950/40 px-5 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-950/60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
