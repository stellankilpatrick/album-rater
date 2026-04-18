import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";

export default function Recommendations({ user }) {
  const [grouped, setGrouped] = useState([]);

  useEffect(() => {
    api.get("/community/recommendations/received").then(res => setGrouped(res.data));
  }, []);

  const dismiss = async (recId, fromUsername) => {
    await api.delete(`/community/recommendations/${recId}`);
    setGrouped(prev => prev.map(g => g.username === fromUsername
      ? { ...g, albums: g.albums.filter(a => a.recId !== recId) }
      : g
    ).filter(g => g.albums.length > 0));
  };

  if (!grouped.length) return <div>No recommendations yet.</div>;

  return (
    <div>
      <h2>Recommended for you</h2>
      {grouped.map(group => (
        <div key={group.username} style={{ marginBottom: "24px" }}>
          <h3>From <Link to={`/users/${group.username}`}>{group.username}</Link></h3>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {group.albums.map(album => (
              <div key={album.recId} style={{ textAlign: "center" }}>
                <Link to={`/albums/${album.albumId}`}>
                  {album.coverArt && (
                    <img src={album.coverArt} alt={album.title}
                      style={{ width: "120px", height: "120px", objectFit: "cover", borderRadius: "4px", display: "block" }} />
                  )}
                  <div style={{ fontSize: "12px", marginTop: "4px", maxWidth: "120px" }}>{album.title}</div>
                </Link>
                <button onClick={() => dismiss(album.recId, group.username)}
                  style={{ fontSize: "11px", marginTop: "4px", cursor: "pointer" }}>
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}