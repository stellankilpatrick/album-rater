import { useState, useEffect } from "react";
import api from "../api/api";

export default function AddSongForm({ albumId, onAdd, nextNum }) {
  const [title, setTitle] = useState("");
  const [num, setNum] = useState(Number(nextNum) || 1);
  const [featured, setFeatured] = useState("");

  useEffect(() => {
    setNum(Number(nextNum) || 1);
  }, [nextNum]);

  const handleSubmit = e => {
    e.preventDefault();

    api.post(`/albums/${albumId}/songs`, { title, num, albumId, featured: featured || null })
      .then(res => {
        onAdd(res.data);
        setTitle("");
        setFeatured("");
      }).catch(err => console.error(err));
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 95px) minmax(220px, 1.2fr) minmax(200px, 1fr) auto", gap: "5px", marginTop: "10px", padding: 0, background: "transparent", border: "none", borderRadius: 0, alignItems: "center" }}>
      <input
        type="number"
        value={num}
        onChange={e => setNum(Number.parseInt(e.target.value, 10) || 1)}
        min="1"
        placeholder="Track number"
        required
        style={{ width: "95px", padding: "8px 10px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
      />
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Song title"
        required
        style={{ minWidth: "220px", flex: "1 1 220px", padding: "8px 8px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
      />
      <input
        type="text"
        value={featured}
        onChange={e => setFeatured(e.target.value)}
        placeholder="Featured artists (optional)"
        style={{ minWidth: "200px", flex: "1 1 200px", padding: "8px 10px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
      />
      <button type="submit" style={{ padding: "8px 12px", borderRadius: "8px", border: "none", backgroundColor: "#1db954", color: "white", cursor: "pointer", fontWeight: 600 }}>Add Song</button>
    </form>
  );
}