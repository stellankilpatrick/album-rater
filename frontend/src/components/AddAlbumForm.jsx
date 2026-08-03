import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

export default function AddAlbumForm({ onAdd }) {
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [artistSuggestions, setArtistSuggestions] = useState([]);
    const [showArtistDropdown, setShowArtistDropdown] = useState(false);
    const [releaseDate, setReleaseDate] = useState("");
    const [coverArt, setCoverArt] = useState("");
    const [type, setType] = useState("");
    const [official, setOfficial] = useState(true);

    const handleSubmit = e => {
        e.preventDefault();
        if (!type) {
            alert('Please select an album type before creating.');
            return;
        }
        api.post("/albums/new", { title, artist, releaseDate, coverArt, type, official })
            .then(res => {
                const album = { ...res.data, id: res.data.id ?? res.data.albumId };
                onAdd(album);
            })
            .catch(err => console.error("Failed to add album:", err));
    };

    // prevent official from being true if type is not album or ep
    useEffect(() => {
        if (official && !["album", "ep"].includes(type)) {
            setOfficial(false);
        }
    }, [type, official]);

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
                    style={{ padding: "12px 16px", fontSize: "16px", width: "95%" }}
                    required
                />
                <div style={{ position: "relative" }}>
                    <input
                        type="text"
                        value={artist}
                        onChange={e => { setArtist(e.target.value); if (e.target.value.trim().length >= 2) { setShowArtistDropdown(true); api.get(`/search?q=${encodeURIComponent(e.target.value.trim())}`).then(res => setArtistSuggestions(res.data.artists || [])).catch(() => setArtistSuggestions([])); } else { setShowArtistDropdown(false); setArtistSuggestions([]); } }}
                        onFocus={() => { if (artist.trim().length >= 2) { setShowArtistDropdown(true); api.get(`/search?q=${encodeURIComponent(artist.trim())}`).then(res => setArtistSuggestions(res.data.artists || [])).catch(() => setArtistSuggestions([])); } }}
                        onBlur={() => setTimeout(() => setShowArtistDropdown(false), 200)}
                        placeholder="Artist (use '&' to separate multiple artists)"
                        style={{ padding: "12px 16px", fontSize: "16px", width: "95%" }}
                        required
                    />
                    {showArtistDropdown && artist.trim().length >= 2 && artistSuggestions.length > 0 && (
                        <div style={{ position: "absolute", top: "100%", left: 0, width: "100%", background: "#fff", border: "1px solid #ccc", zIndex: 1000, maxHeight: "200px", overflowY: "auto", textAlign: "left", boxSizing: "border-box", color: "#000" }}>
                            {artistSuggestions.map(a => (
                                <div key={a.id} onClick={() => { setArtist(a.name); setShowArtistDropdown(false); setArtistSuggestions([]); }} style={{ padding: "8px 10px", cursor: "pointer", textAlign: "left", color: "#000" }}>{a.name}</div>
                            ))}
                        </div>
                    )}
                </div>
                <input
                    type="text"
                    value={coverArt}
                    onChange={e => setCoverArt(e.target.value)}
                    placeholder="Cover art URL (copy image address)"
                    style={{ padding: "12px 16px", fontSize: "16px", width: "95%" }}
                />
                <input
                    type="date"
                    value={releaseDate}
                    onChange={e => setReleaseDate(e.target.value)}
                    style={{ padding: "12px 16px", fontSize: "16px", width: "95%" }}
                />
                <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    style={{ padding: "12px 16px", fontSize: "16px", width: "101%", color: type ? "#000" : "#9a9a9a" }}
                >
                    <option value="" disabled>Select album type</option>
                    <option value="album">Album</option>
                    <option value="ep">EP</option>
                    <option value="compilation">Compilation</option>
                    <option value="soundtrack">Soundtrack</option>
                    <option value="live album">Live Album</option>
                    <option value="single">Single</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", cursor: "pointer" }}>
                    <input
                        type="checkbox"
                        checked={official}
                        onChange={e => {
                            // Prevent non-album/ep from being official
                            if (e.target.checked && !["album", "ep"].includes(type)) {
                                return;
                            }
                            setOfficial(e.target.checked);
                        }}
                        disabled={!["album", "ep"].includes(type)}
                    />
                    Official release
                </label>
                <button onClick={handleSubmit} style={{ padding: "12px 16px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>
                    Add Album
                </button>
            </div>
        </form>
    );
}