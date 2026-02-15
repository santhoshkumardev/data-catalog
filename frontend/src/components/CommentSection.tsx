import { useEffect, useState } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { getComments, addComment, deleteComment, type Comment } from "../api/social";
import { useAuth } from "../auth/AuthContext";
import { timeAgo } from "../utils/formatters";

interface Props {
  entityType: string;
  entityId: string;
}

export default function CommentSection({ entityType, entityId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const load = () => getComments(entityType, entityId).then(setComments);
  useEffect(() => { load(); }, [entityType, entityId]);

  const submit = async () => {
    if (!body.trim()) return;
    setLoading(true);
    await addComment(entityType, entityId, body.trim());
    setBody("");
    await load();
    setLoading(false);
  };

  const remove = async (id: string) => {
    await deleteComment(id);
    await load();
  };

  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
        <MessageSquare size={16} /> Comments ({comments.length})
      </h3>
      <div className="space-y-3 mb-4">
        {comments.map((c) => (
          <div key={c.id} className="bg-gray-50 rounded p-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="font-medium text-gray-700">{c.user_name}</span>
              <div className="flex items-center gap-2">
                <span>{timeAgo(c.created_at)}</span>
                {user?.id === c.user_id && (
                  <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-800">{c.body}</p>
          </div>
        ))}
        {comments.length === 0 && <p className="text-sm text-gray-400 italic">No comments yet.</p>}
      </div>
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add a comment..."
          className="flex-1 border rounded px-3 py-1.5 text-sm"
        />
        <button onClick={submit} disabled={loading || !body.trim()} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
          Post
        </button>
      </div>
    </div>
  );
}
