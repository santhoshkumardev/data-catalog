import { useState } from "react";
import { Pencil } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

function hasContent(html: string) {
  const text = html.replace(/<[^>]*>/g, "").trim();
  return text.length > 0;
}

interface Props {
  value: string;
  onSave: (val: string) => Promise<void>;
  placeholder?: string;
  multiline?: boolean;
  canEdit?: boolean;
}

export default function InlineEdit({ value, onSave, placeholder = "Add description...", multiline, canEdit = true }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <div className="group relative cursor-pointer" onClick={() => canEdit && setEditing(true)}>
        {multiline && hasContent(value) ? (
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: value }} />
        ) : hasContent(value) ? (
          <span>{value}</span>
        ) : (
          <span className="text-gray-400 italic">{placeholder}</span>
        )}
        {canEdit && (
          <Pencil size={14} className="absolute top-0 right-0 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div>
      {multiline ? (
        <RichTextEditor content={draft} onChange={setDraft} placeholder={placeholder} />
      ) : (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm"
          autoFocus
        />
      )}
      <div className="flex gap-2 mt-2">
        <button onClick={handleSave} disabled={saving} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
          Save
        </button>
        <button onClick={() => { setDraft(value); setEditing(false); }} className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">
          Cancel
        </button>
      </div>
    </div>
  );
}
