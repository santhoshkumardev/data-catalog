import { AlertTriangle } from "lucide-react";

interface Props {
  status: "pending" | "approved" | "rejected";
  requesterName?: string;
}

export default function ApprovalBanner({ status, requesterName }: Props) {
  if (status !== "pending") return null;

  return (
    <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 mb-4">
      <AlertTriangle size={16} className="text-yellow-600" />
      <span className="text-sm text-yellow-800">
        Pending approval{requesterName ? ` — requested by ${requesterName}` : ""}. Changes are awaiting steward review.
      </span>
    </div>
  );
}
