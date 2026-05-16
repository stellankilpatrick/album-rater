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
        api.post("/albums/new", { title, artist, releaseDate, coverArt })
            .then(res => {
                const album = { ...res.data, id: res.data.id ?? res.data.albumId };
                onAdd(album);
                navigate(`/albums/${album.id}`);
            })
            .catch(err => console.error("Failed to add album:", err));
    };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{
                backgroundColor: "#111",
                borderRadius: "4px",
                padding: "24px",
                minWidth: "260px",
                maxWidth: "600px",
                display: "flex",
                flexDirection: "column",
                margin: "0 auto",
                gap: "16px"
            }}>
                <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Album title"
                    style={{ padding: "12px 16px", fontSize: "16px" }}
                />
                <input
                    type="text"
                    value={artist}
                    onChange={e => setArtist(e.target.value)}
                    placeholder="Artist (use '&' to separate multiple artists)"
                    style={{ padding: "12px 16px", fontSize: "16px" }}
                />
                <input
                    type="text"
                    value={coverArt}
                    onChange={e => setCoverArt(e.target.value)}
                    placeholder="Cover art URL (copy image address)"
                    style={{ padding: "12px 16px", fontSize: "16px" }}
                />
                <input
                    type="date"
                    value={releaseDate}
                    onChange={e => setReleaseDate(e.target.value)}
                    style={{ padding: "12px 16px", fontSize: "16px" }}
                />
                <button onClick={handleSubmit} style={{ padding: "12px 16px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>
                    Add Album
                </button>
            </div>
        </form>
    );
}