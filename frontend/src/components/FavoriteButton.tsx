import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { getFavoriteStatus, toggleFavorite } from "../api/social";

interface Props {
  entityType: string;
  entityId: string;
}

export default function FavoriteButton({ entityType, entityId }: Props) {
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    getFavoriteStatus(entityType, entityId).then((s) => setIsFav(s.is_favorite));
  }, [entityType, entityId]);

  const toggle = async () => {
    const result = await toggleFavorite(entityType, entityId);
    setIsFav(result.is_favorite);
  };

  return (
    <button onClick={toggle} title={isFav ? "Remove from favorites" : "Add to favorites"}>
      <Heart
        size={18}
        className={isFav ? "fill-red-500 text-red-500" : "text-gray-400 hover:text-red-400"}
      />
    </button>
  );
}
