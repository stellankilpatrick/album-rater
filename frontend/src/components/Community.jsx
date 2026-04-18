import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";

export default function Community() {
    const [feed, setFeed] = useState([]);
    const [anniversaryAlbums, setAnniversaryAlbums] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [feedRes, anniversaryRes] = await Promise.all([
                    api.get("/community"),
                    api.get("/community/albums")
                ]);
                setFeed(feedRes.data);
                setAnniversaryAlbums(anniversaryRes.data);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    function timeAgo(date) {
        const timestamp = new Date(date).getTime();
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return "just now";
    }

    if (loading) return <p>Loading…</p>;

    return (
        <div className="community">
            <h1>Community</h1>
            <div style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: "32px",
                alignItems: "flex-start"
            }}>
                {/* Left: activity feed */}
                <div style={{ flex: isMobile ? undefined : "1 1 0", minWidth: 0 }}>
                    <h3 style={{ marginTop: 0 }}>Recent Friend Activity</h3>
                    {feed.length === 0 ? (
                        <p>No activity yet. Follow more people.</p>
                    ) : (
                        feed.map(item => (
                            <div key={`${item.username}-${item.album_id}-${item.updated_at}`} className="community-item">
                                <Link to={`/users/${item.username}`}>
                                    <strong>{item.username}</strong>
                                </Link>
                                {" updated "}
                                <Link to={`/albums/${item.album_id}/users/${item.username}`}>
                                    <strong>{item.album_title}</strong>
                                </Link>
                                {" by "}
                                {item.artist_name}
                                {" "}
                                <span className="time">{timeAgo(item.updated_at)}</span>
                            </div>
                        ))
                    )}
                </div>

                {/* Right: anniversary albums */}
                {anniversaryAlbums.length > 0 && (
                    <div style={{ flex: isMobile ? undefined : "0 0 640px", width: isMobile ? "100%" : undefined, paddingRight: isMobile ? "0px" : "50px" }}>
                        <h3 style={{ marginTop: 0 }}>Released This Week In History</h3>
                        <p style={{ marginTop: "-5px" }}>Consider re-listening!</p>
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(4, 1fr)",
                            gap: "12px"
                        }}>
                            {anniversaryAlbums.map(album => (
                                <div key={album.id} style={{ textAlign: "center" }}>
                                    <Link to={`/albums/${album.id}/me`}>
                                        <img
                                            src={album.coverArt}
                                            alt={album.title}
                                            style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "6px" }}
                                        />
                                    </Link>
                                    <div style={{ fontSize: "13px", fontWeight: 500 }}>
                                        <i>{album.title}</i> ({album.releaseDate.slice(0, 4)})
                                    </div>
                                    <div style={{ fontSize: "12px", color: "#666" }}>
                                        {album.artist}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <Link to="/community/recommendations">Recommended Albums</Link>        </div>
    );
}