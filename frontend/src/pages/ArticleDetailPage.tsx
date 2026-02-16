import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookOpen, Trash2, Upload, Paperclip, Download } from "lucide-react";
import DOMPurify from "dompurify";
import { getArticle, patchArticle, deleteArticle, uploadAttachment, deleteAttachment, type ArticleDoc } from "../api/catalog";
import { trackView } from "../api/analytics";
import { useAuth } from "../auth/AuthContext";
import Breadcrumb from "../components/Breadcrumb";
import InlineEdit from "../components/InlineEdit";
import TagEditor from "../components/TagEditor";

import CommentSection from "../components/CommentSection";
import { formatFileSize } from "../utils/formatters";
import StewardSection from "../components/StewardSection";
import EndorsementBadge from "../components/EndorsementBadge";

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isSteward } = useAuth();
  const navigate = useNavigate();
  const [article, setArticle] = useState<ArticleDoc | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    getArticle(id).then(setArticle);
    trackView("article", id);
  }, [id]);

  const handleDelete = async () => {
    await deleteArticle(id!);
    navigate("/articles");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAttachment(id!, file);
    getArticle(id!).then(setArticle);
  };

  if (!article) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <Breadcrumb items={[{ label: "Articles", to: "/articles" }, { label: article.title }]} />
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen size={24} className="text-indigo-500" />
          <div className="flex-1">
            <InlineEdit value={article.title} onSave={async (v) => { const u = await patchArticle(id!, { title: v }); setArticle(u); }} placeholder="Article title..." canEdit={isSteward} />
          </div>
          <EndorsementBadge entityType="article" entityId={id!} />

          {isSteward && (
            <div className="ml-auto">
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 px-3 py-1 text-red-600 border border-red-300 text-sm rounded hover:bg-red-50">
                  <Trash2 size={14} /> Delete
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleDelete} className="px-3 py-1 bg-red-600 text-white text-sm rounded">Confirm</button>
                  <button onClick={() => setConfirmDelete(false)} className="px-3 py-1 text-sm text-gray-500">Cancel</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-1">Description</div>
          <InlineEdit value={article.description || ""} onSave={async (v) => { const u = await patchArticle(id!, { description: v }); setArticle(u); }} canEdit={isSteward} />
        </div>

        <TagEditor tags={article.tags || []} onChange={async (tags) => { const u = await patchArticle(id!, { tags }); setArticle(u); }} canEdit={isSteward} />

        <StewardSection entityType="article" entityId={id!} />

        <div className="mt-6 border-t pt-4">
          <div className="text-xs text-gray-400 mb-1">Body</div>
          <InlineEdit value={article.body || ""} onSave={async (v) => { const u = await patchArticle(id!, { body: v }); setArticle(u); }} placeholder="Add article body..." multiline canEdit={isSteward} />
        </div>

        {/* Attachments */}
        <div className="mt-6 border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Attachments ({article.attachments.length})</span>
            {isSteward && (
              <>
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  <Upload size={12} /> Upload
                </button>
                <input ref={fileRef} type="file" onChange={handleUpload} className="hidden" />
              </>
            )}
          </div>
          {article.attachments.map((att) => (
            <div key={att.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <div className="flex items-center gap-2 text-sm">
                <Paperclip size={14} className="text-gray-400" />
                {att.download_url ? (
                  <a href={att.download_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{att.filename}</a>
                ) : (
                  <span>{att.filename}</span>
                )}
                {att.file_size && <span className="text-xs text-gray-400">{formatFileSize(att.file_size)}</span>}
              </div>
              {isSteward && (
                <button
                  onClick={async () => { await deleteAttachment(id!, att.id); getArticle(id!).then(setArticle); }}
                  className="text-gray-400 hover:text-red-500"
                ><Trash2 size={12} /></button>
              )}
            </div>
          ))}
        </div>
      </div>

      <CommentSection entityType="article" entityId={id!} />
    </div>
  );
}
