import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { BookText, Trash2, Link2, Unlink } from "lucide-react";
import { getGlossaryTerm, patchGlossaryTerm, deleteGlossaryTerm, getTermLinks, unlinkTerm, type GlossaryTerm, type TermLink } from "../api/glossary";
import { trackView } from "../api/analytics";
import { useAuth } from "../auth/AuthContext";
import Breadcrumb from "../components/Breadcrumb";
import InlineEdit from "../components/InlineEdit";
import TagEditor from "../components/TagEditor";

import CommentSection from "../components/CommentSection";

const ENTITY_LINKS: Record<string, (id: string) => string> = {
  database: (id) => `/databases/${id}`,
  schema: (id) => `/schemas/${id}`,
  table: (id) => `/tables/${id}`,
  query: (id) => `/queries/${id}`,
  article: (id) => `/articles/${id}`,
};

export default function GlossaryTermPage() {
  const { id } = useParams<{ id: string }>();
  const { isSteward } = useAuth();
  const navigate = useNavigate();
  const [term, setTerm] = useState<GlossaryTerm | null>(null);
  const [links, setLinks] = useState<TermLink[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    getGlossaryTerm(id).then(setTerm);
    getTermLinks(id).then(setLinks);
    trackView("glossary", id);
  }, [id]);

  const handleDelete = async () => {
    await deleteGlossaryTerm(id!);
    navigate("/glossary");
  };

  const handleUnlink = async (linkId: string) => {
    await unlinkTerm(id!, linkId);
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
  };

  const handleStatusToggle = async () => {
    if (!term) return;
    const newStatus = term.status === "approved" ? "draft" : "approved";
    const u = await patchGlossaryTerm(id!, { status: newStatus });
    setTerm(u);
  };

  if (!term) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <Breadcrumb items={[{ label: "Glossary", to: "/glossary" }, { label: term.name }]} />
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <BookText size={24} className="text-teal-500" />
          <h1 className="text-xl font-bold">{term.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${term.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
            {term.status}
          </span>

          <div className="ml-auto flex gap-2">
            {isSteward && (
              <button onClick={handleStatusToggle} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">
                Mark as {term.status === "approved" ? "draft" : "approved"}
              </button>
            )}
            {isSteward && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 px-3 py-1 text-red-600 border border-red-300 text-sm rounded hover:bg-red-50">
                <Trash2 size={14} /> Delete
              </button>
            )}
            {confirmDelete && (
              <div className="flex gap-2">
                <button onClick={handleDelete} className="px-3 py-1 bg-red-600 text-white text-sm rounded">Confirm</button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1 text-sm text-gray-500">Cancel</button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-1">Definition</div>
          <InlineEdit value={term.definition} onSave={async (v) => { const u = await patchGlossaryTerm(id!, { definition: v }); setTerm(u); }} multiline canEdit={isSteward} />
        </div>

        <TagEditor tags={term.tags || []} onChange={async (tags) => { const u = await patchGlossaryTerm(id!, { tags }); setTerm(u); }} canEdit={isSteward} />

        {term.owner_name && (
          <div className="mt-4 text-sm text-gray-500">Owner: <span className="font-medium text-gray-700">{term.owner_name}</span></div>
        )}

        {/* Linked Entities */}
        <div className="mt-6 border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={16} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Linked Entities ({links.length})</span>
          </div>
          {links.length === 0 ? (
            <div className="text-sm text-gray-400">No linked entities yet.</div>
          ) : (
            <div className="space-y-1">
              {links.map((link) => (
                <div key={link.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{link.entity_type}</span>
                    {ENTITY_LINKS[link.entity_type] ? (
                      <Link to={ENTITY_LINKS[link.entity_type](link.entity_id)} className="text-blue-600 hover:underline">
                        {link.entity_id}
                      </Link>
                    ) : (
                      <span>{link.entity_id}</span>
                    )}
                  </div>
                  {isSteward && (
                    <button onClick={() => handleUnlink(link.id)} className="text-gray-400 hover:text-red-500">
                      <Unlink size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CommentSection entityType="glossary" entityId={id!} />
    </div>
  );
}
