const COLORS: Record<string, string> = {
  public: "bg-green-100 text-green-800",
  internal: "bg-blue-100 text-blue-800",
  confidential: "bg-amber-100 text-amber-800",
  restricted: "bg-red-100 text-red-800",
};

export default function ClassificationBadge({ level }: { level: string }) {
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${COLORS[level] || "bg-gray-100 text-gray-600"}`}>
      {level}
    </span>
  );
}
