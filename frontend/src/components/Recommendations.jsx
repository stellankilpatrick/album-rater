import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";

export default function Recommendations({ user }) {
    const [grouped, setGrouped] = useState([]);

    const [sent, setSent] = useState([]);
    const [hoveredRec, setHoveredRec] = useState(null);

    useEffect(() => {
        api.get("/community/recommendations/received").then(res => setGrouped(res.data));
        api.get("/community/recommendations/sent").then(res => setSent(res.data));
    }, []);

    const unsend = async (recId, toUsername) => {
        if (!window.confirm(`Unsend this recommendation to ${toUsername}?`)) return;
        await api.delete(`/community/recommendations/${recId}`);
        setSent(prev => prev.map(g => g.username === toUsername
            ? { ...g, albums: g.albums.filter(a => a.recId !== recId) }
            : g
        ).filter(g => g.albums.length > 0));
    };

    const dismiss = async (recId, fromUsername) => {
        if (!window.confirm(`Dismiss this recommendation from ${fromUsername}?`)) return;
        await api.delete(`/community/recommendations/${recId}`);
        setGrouped(prev => prev.map(g => g.username === fromUsername
            ? { ...g, albums: g.albums.filter(a => a.recId !== recId) }
            : g
        ).filter(g => g.albums.length > 0));
    };

    return (
        <div>
            <h2>Recommended for you</h2>
            {grouped.length === 0
                ? <div style={{ color: "#999" }}>No recommendations yet.</div>
                : (() => {
                    // flatten grouped into single album list with recommender info
                    const flat = grouped.flatMap(g => g.albums.map(a => ({ ...a, recommenderUsername: g.username })));
                    // sort by createdAt desc if present
                    flat.sort((x,y) => new Date(y.createdAt || 0) - new Date(x.createdAt || 0));
                    return (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
                            {flat.map(album => (
                                <div key={album.recId} style={{ textAlign: "center", position: "relative" }} onMouseEnter={() => setHoveredRec(album.recId)} onMouseLeave={() => setHoveredRec(null)}>
                                    {hoveredRec === album.recId && (
                                        <button onClick={(e) => {
                                            e.preventDefault();
                                            const ok = window.confirm('Are you sure you want to dismiss this recommendation?');
                                            if (ok) dismiss(album.recId, album.recommenderUsername);
                                        }}
                                            style={{ position: "absolute", top: "6px", right: "6px", background: "rgba(0,0,0,0.6)", border: "none", color: "white", width: "28px", height: "28px", borderRadius: "6px", cursor: "pointer", zIndex: 5 }}
                                            title="Dismiss recommendation"
                                        >
                                            ✕
                                        </button>
                                    )}
                                    <Link to={`/albums/${album.albumId}`}>
                                        {album.coverArt && (
                                            <img src={album.coverArt} alt={album.title}
                                                style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "4px", display: "block" }} />
                                        )}
                                    </Link>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "8px" }}>
                                        {album.recommenderPfp && (
                                            <img src={album.recommenderPfp} alt={album.recommenderUsername} style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }} />
                                        )}
                                        <Link to={`/users/${album.recommenderUsername}`} style={{ fontSize: "12px" }}>{album.recommenderUsername}</Link>
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#888", marginTop: "6px" }}>{album.createdAt ? new Date(album.createdAt).toLocaleString() : null}</div>
                                </div>
                            ))}
                        </div>
                    );
                })()
            }

            {sent.length > 0 && (
                <>
                    <h2>Sent by you</h2>
                    <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
                        {sent.map(group => (
                            <div key={group.username} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <h3 style={{ margin: 0 }}>To <Link to={`/users/${group.username}`}>{group.username}</Link></h3>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 120px)", gap: "8px" }}>
                                    {group.albums.slice(0, 8).map(album => (
                                        <div key={album.recId} style={{ textAlign: "center" }}>
                                            <Link to={`/albums/${album.albumId}`}>
                                                {album.coverArt && (
                                                    <img src={album.coverArt} alt={album.title}
                                                        style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "4px", display: "block" }} />
                                                )}
                                                <div style={{ fontSize: "12px", marginTop: "6px", maxWidth: "120px", marginLeft: "auto", marginRight: "auto" }}>{album.title}</div>
                                            </Link>
                                            <button onClick={() => unsend(album.recId, group.username)}
                                                style={{ fontSize: "11px", marginTop: "6px", cursor: "pointer" }}>
                                                Unsend
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}