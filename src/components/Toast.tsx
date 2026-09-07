import { useToast } from "../hooks/useToast";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, X } from "lucide-react";

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: RefreshCw
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();
  return (
    <div className="toast-container">
      {toasts.map(t => {
        const Icon = icons[t.type];
        return (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Icon size={16} />
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => removeToast(t.id)}><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}
