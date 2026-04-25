import { useState, useEffect } from "react";
import api from "../api/api";

export default function AddSongForm({ albumId, onAdd, nextNum }) {
  const [title, setTitle] = useState("");
  const [num, setNum] = useState(nextNum);
  const [featured, setFeatured] = useState("");

  useEffect(() => {
    setNum(nextNum);
  }, [nextNum]);

  const handleSubmit = e => {
    e.preventDefault();

    api.post(`/albums/${albumId}/songs`, { title, num, albumId, featured: featured || null })
      .then(res => {
        onAdd(res.data);
        setTitle("");
      }).catch(err => console.error(err));
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="number"
        value={num}
        onChange={e => setNum(parseInt(e.target.value))}
        min="1"
        placeholder="Track number"
        required
      />
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Song title"
        required
      />
      <input
        type="text"
        value={featured}
        onChange={e => setFeatured(e.target.value)}
        placeholder="Featured artists (optional)"
      />
      <button type="submit">Add Song</button>
    </form>
  );
}