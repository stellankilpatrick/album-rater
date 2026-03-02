import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";

export default function ListenList({ user }) {
    const [listenList, setListenList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setEditing] = useState(false);

    useEffect(() => {
        if (!user) return;

        const fetchListenList = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/users/${user.username}/listen-list`);
                setListenList(res.data);
            } catch (err) {
                console.error("Failed to fetch listen list", err);
            } finally {
                setLoading(false);
            }
        };

        fetchListenList();
    }, [user]);

    const removeFromList = async (albumId) => {
        try {
            await api.delete(`/users/${user.username}/listen-list/${albumId}`);
            setListenList(prev => prev.filter(a => a.id !== albumId));
        } catch (err) {
            console.error("Failed to remove album from listen list", err);
        }
    };

    if (loading) return <p>Loading your listen list...</p>;

    return (
        <div>
            <h2>{user.username}'s Listen List</h2>

            <button
                onClick={() => setEditing(prev => !prev)}
                style={{
                    marginBottom: "8px",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "1px solid #333",
                    cursor: "pointer",
                    backgroundColor: "Gray",
                    color: "#fff"
                }}
            >
                {isEditing ? "Done Editing" : "Edit List"}
            </button>

            {listenList.length === 0 ? (
                <p>Your listen list is empty.</p>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: "16px"
                }}>
                    {listenList.map(album => (
                        <div key={album.id} style={{ textAlign: "center" }}>
                            <Link to={`/albums/${album.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                                <img
                                    src={album.cover_art}
                                    alt={album.title}
                                    style={{
                                        width: "100%",
                                        aspectRatio: "1 / 1",
                                        objectFit: "cover",
                                        borderRadius: "6px"
                                    }}
                                />
                                <div style={{ fontSize: "14px", fontWeight: 500 }}>
                                    <i>{album.title}</i>
                                </div>
                                <div style={{ fontSize: "13px", color: "#666" }}>
                                    {album.artist}
                                </div>
                            </Link>
                            {isEditing && (
                                <button
                                    onClick={() => removeFromList(album.id)}
                                    style={{
                                        marginTop: "4px",
                                        backgroundColor: "#e74c3c",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "4px",
                                        cursor: "pointer",
                                        padding: "2px 6px",
                                        fontSize: "0.75rem"
                                    }}
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}