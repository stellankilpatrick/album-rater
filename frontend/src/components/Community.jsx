import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";

export default function Community() {
    const [feed, setFeed] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [showMyActivity, setShowMyActivity] = useState(false);

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const endpoint = showMyActivity ? "/community/my-activity" : "/community";
                const feedRes = await api.get(endpoint);
                setFeed(feedRes.data);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [showMyActivity]);

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
            <div className="community page-pad">
                <h1 style={{ textAlign: "center" }}>Activity</h1>
            <div style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: "32px",
                alignItems: "flex-start"
            }}>
                {/* Left: activity feed */}
                <div style={{ flex: isMobile ? undefined : "1 1 0", minWidth: 0 }}>
                    <div style={{ marginBottom: "8px", textAlign: "center" }}>
                        <h2 style={{ marginTop: 0, marginBottom: 0 }}>{showMyActivity ? "Your" : "Friend"} Recent Activity</h2>
                    </div>
                    <div style={{ textAlign: "center", marginBottom: "12px" }}>
                        <button
                            onClick={() => setShowMyActivity(!showMyActivity)}
                            style={{ padding: "6px 12px", cursor: "pointer" }}
                        >
                            {showMyActivity ? "Show Friends" : "Show My Activity"}
                        </button>
                    </div>
                    {feed.length === 0 ? (
                        <p>No activity yet. Follow more people.</p>
                    ) : (
                        <div style={{ minHeight: isMobile ? "60vh" : "75vh", overflowY: "visible", paddingRight: "8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ width: isMobile ? "100%" : "720px" }}>
                            {feed.map(item => (
                                <div key={`${item.username}-${item.album_id}-${item.updated_at}`} className="community-item" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                                    {item.pfp && (
                                        <Link to={`/users/${item.username}`}>
                                            <img src={item.pfp} alt="" style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                                        </Link>
                                    )}
                                    <div>
                                        <Link to={`/users/${item.username}`}>
                                            <strong style={{ fontWeight: 600 }}>{item.username}</strong>
                                        </Link>
                                        {" "}
                                        {Math.abs(new Date(item.updated_at) - new Date(item.created_at)) < 60000 ? "rated" : "updated"}
                                        {" "}
                                        <Link to={`/albums/${item.album_id}/users/${item.username}`}>
                                            <strong style={{ fontWeight: 600 }}>{item.album_title}</strong>
                                        </Link>
                                        {" by "}
                                        {item.artist_name}
                                        {" "}
                                        <span className="time" style={{ fontSize: "12px", color: "#999" }}>{timeAgo(item.updated_at)}</span>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* no right column (anniversary removed) */}
            </div>
            
        </div>
    );
}