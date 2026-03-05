import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

export default function AddAlbumForm({ onAdd }) {
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [releaseDate, setReleaseDate] = useState("");
    const [coverArt, setCoverArt] = useState("");
    const navigate = useNavigate();

    const handleSubmit = e => {
        e.preventDefault();
        api.post("/albums/new", { title, artist, releaseDate })
            .then(res => {
                const album = { ...res.data, id: res.data.id ?? res.data.albumId };
                onAdd(album);
                navigate(`/albums/${album.id}`);
            })
            .catch(err => console.error("Failed to add album:", err));
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Album title"
                required
            />
            <input
                type="text"
                value={artist}
                onChange={e => setArtist(e.target.value)}
                placeholder="Artist (use ', ' for collabs e.g. Artist1, Artist2)"
                required
            />
            <input
                type="date"
                value={releaseDate || ""}
                onChange={e => setReleaseDate(e.target.value)}
            />
            <button type="submit">Add Album</button>
        </form>
    );
}