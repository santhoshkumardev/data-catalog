import { useEffect, useRef, useState } from "react";
import { UserCheck, Plus, X, Search } from "lucide-react";
import { getStewards, assignSteward, removeSteward, getUsersForAssignment, type Steward } from "../api/governance";
import { useAuth } from "../auth/AuthContext";

interface Props {
  entityType: string;
  entityId: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export default function StewardSection({ entityType, entityId }: Props) {
  const { isEditor } = useAuth();
  const [stewards, setStewards] = useState<Steward[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = () => getStewards(entityType, entityId).then(setStewards);
  useEffect(() => { load(); }, [entityType, entityId]);

  const canManage = isEditor;

  const stewardIds = new Set(stewards.map((s) => s.user_id));
  const availableUsers = allUsers.filter((u) => !stewardIds.has(u.id));
  const filtered = searchQuery.trim()
    ? availableUsers.filter((u) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSelect = async (userId: string) => {
    await assignSteward({ user_id: userId, entity_type: entityType, entity_id: entityId });
    setSearchQuery("");
    setShowAdd(false);
    load();
  };

  const handleRemove = async (userId: string) => {
    await removeSteward(entityType, entityId, userId);
    load();
  };

  const openAdd = async () => {
    if (allUsers.length === 0) {
      const users = await getUsersForAssignment();
      setAllUsers(users);
    }
    setShowAdd(true);
    setSearchQuery("");
    setHighlightIdx(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      handleSelect(filtered[highlightIdx].id);
    } else if (e.key === "Escape") {
      setShowAdd(false);
    }
  };

  useEffect(() => {
    if (!showAdd) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAdd(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAdd]);

  useEffect(() => { setHighlightIdx(0); }, [searchQuery]);

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-2">
        <UserCheck size={14} className="text-gray-400" />
        <span className="text-xs text-gray-400 font-medium">Stewards</span>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {stewards.length === 0 && <span className="text-xs text-gray-400">No stewards assigned</span>}
        {stewards.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5 text-xs text-blue-700">
            {s.user_name}
            {canManage && (
              <button onClick={() => handleRemove(s.user_id)} className="text-blue-400 hover:text-red-500 ml-0.5">
                <X size={10} />
              </button>
            )}
          </span>
        ))}
        {canManage && !showAdd && (
          <button onClick={openAdd} className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:underline">
            <Plus size={12} /> Add steward
          </button>
        )}
        {showAdd && (
          <div className="relative" ref={dropdownRef}>
            <div className="inline-flex items-center border rounded px-2 py-0.5 bg-white focus-within:ring-2 focus-within:ring-blue-500">
              <Search size={12} className="text-gray-400 mr-1" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search users..."
                className="text-xs outline-none w-48"
              />
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 ml-1">
                <X size={12} />
              </button>
            </div>
            {searchQuery.trim() && (
              <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
                {filtered.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400">No users found</div>
                ) : (
                  filtered.map((u, i) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelect(u.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 ${i === highlightIdx ? "bg-blue-50" : ""}`}
                    >
                      <div className="font-medium text-gray-800">{u.name}</div>
                      <div className="text-gray-400">{u.email}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
