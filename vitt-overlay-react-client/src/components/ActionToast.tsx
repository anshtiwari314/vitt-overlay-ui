import { Copy, X } from 'lucide-react'

type ActionToastProps = {
  message: string
  error?: boolean
  onDismiss: () => void
  onCopied?: () => void
}

export default function ActionToast({ message, error, onDismiss, onCopied }: ActionToastProps) {
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message)
      onCopied?.()
    } catch {
      /* selection fallback — user can still copy manually */
    }
  }

  return (
    <div className={`action-toast ${error ? 'error' : ''}`} role="alert">
      <p className="action-toast-message">{message}</p>
      <div className="action-toast-actions">
        <button type="button" className="action-toast-btn" onClick={() => void copyMessage()} title="Copy message">
          <Copy size={14} />
        </button>
        <button type="button" className="action-toast-btn" onClick={onDismiss} title="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
