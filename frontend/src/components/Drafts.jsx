import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/api";

export default function Drafts({ user }) {
    const { username } = useParams();
    const effectiveUsername = username ?? user?.username;
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!effectiveUsername) return;
        const fetchDrafts = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/albums/drafts/users/${effectiveUsername}`);
                setDrafts(res.data);
            } catch (err) {
                console.error("Failed to fetch drafts", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDrafts();
    }, [effectiveUsername]);

    if (loading) return <p>Loading drafts...</p>;

    return (
        <div>
            <h2>{effectiveUsername}'s Drafts</h2>

            {drafts.length === 0 ? (
                <p>No drafts saved.</p>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 3fr))",
                    gap: "16px"
                }}>
                    {drafts.map(album => (
                        <div key={album.id} style={{ textAlign: "center" }}>
                            <Link to={`/albums/${album.id}/users/${effectiveUsername}`} style={{ textDecoration: "none", color: "inherit" }}>
                                <img
                                    src={album.coverArt}
                                    alt={album.title}
                                    style={{
                                        width: "100%",
                                        aspectRatio: "1 / 1",
                                        objectFit: "cover",
                                        borderRadius: "4px"
                                    }}
                                />
                                <div style={{ fontSize: "14px", fontWeight: 500 }}>
                                    <i>{album.title}</i>
                                </div>
                                <div style={{ fontSize: "13px", color: "#666", marginBottom: "-5px" }}>
                                    {album.artist}
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
