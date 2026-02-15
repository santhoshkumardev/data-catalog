import { useState } from "react";
import { Plus, X } from "lucide-react";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  canEdit?: boolean;
}

export default function TagEditor({ tags, onChange, canEdit = true }: Props) {
  const [input, setInput] = useState("");

  const add = () => {
    const t = input.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      onChange([...tags, t]);
    }
    setInput("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
          {t}
          {canEdit && <X size={12} className="cursor-pointer hover:text-red-600" onClick={() => onChange(tags.filter((x) => x !== t))} />}
        </span>
      ))}
      {canEdit && (
        <span className="inline-flex items-center gap-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add tag"
            className="border rounded px-1.5 py-0.5 text-xs w-20"
          />
          <button onClick={add} className="text-gray-400 hover:text-blue-600"><Plus size={14} /></button>
        </span>
      )}
    </div>
  );
}
