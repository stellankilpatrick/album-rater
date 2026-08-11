import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";

export default function Recommendations({ user }) {
    const [grouped, setGrouped] = useState([]);

    const [sent, setSent] = useState([]);
    const [hoveredRec, setHoveredRec] = useState(null);
    const [hoveredSent, setHoveredSent] = useState(null);

    useEffect(() => {
        api.get("/community/recommendations/received").then(res => {
            console.log('recommendations received:', res.data);
            setGrouped(res.data);
        });
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
                                        {album.recommenderPfp ? (
                                            <img src={album.recommenderPfp} alt={album.recommenderUsername} style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }} />
                                        ) : (
                                            <img src="/default-avatar.png" alt="default avatar" style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover", background: '#ccd3d9' }} />
                                        )}
                                        <Link to={`/users/${album.recommenderUsername}`} style={{ fontSize: "12px" }}>{album.recommenderUsername}</Link>
                                    </div>
                                    {/* date removed per request */}
                                </div>
                            ))}
                        </div>
                    );
                })()
            }

            {sent.length > 0 && (
                <>
                    <h2>Sent by you</h2>
                    {(() => {
                        const flatSent = sent.flatMap(g => g.albums.map(a => ({ ...a, toUsername: g.username, toPfp: g.pfp })));
                        flatSent.sort((x, y) => new Date(y.createdAt || 0) - new Date(x.createdAt || 0));
                        return (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
                                {flatSent.map(album => (
                                    <div key={album.recId} style={{ textAlign: "center", position: "relative" }} onMouseEnter={() => setHoveredSent(album.recId)} onMouseLeave={() => setHoveredSent(null)}>
                                        {hoveredSent === album.recId && (
                                            <button onClick={(e) => { e.preventDefault(); if (window.confirm(`Unsend this recommendation to ${album.toUsername}?`)) unsend(album.recId, album.toUsername); }}
                                                style={{ position: "absolute", top: "6px", right: "6px", background: "rgba(0,0,0,0.6)", border: "none", color: "white", width: "28px", height: "28px", borderRadius: "6px", cursor: "pointer", zIndex: 5 }}
                                                title="Unsend recommendation"
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
                                            {album.toPfp ? (
                                                <img src={album.toPfp} alt={album.toUsername} style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }} />
                                            ) : (
                                                <img src="/default-avatar.png" alt="default avatar" style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover", background: '#ccd3d9' }} />
                                            )}
                                            <Link to={`/users/${album.toUsername}`} style={{ fontSize: "12px" }}>{album.toUsername}</Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </>
            )}
        </div>
    );
}