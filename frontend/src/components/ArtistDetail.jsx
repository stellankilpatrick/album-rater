import { useEffect, useState } from "react";
import { useParams, useNavigate, Link, Navigate } from "react-router-dom";
import api from "../api/api";

export default function ArtistDetail({ user }) {
    const { artistId, username } = useParams();
    const navigate = useNavigate();
    const effectiveUsername = username ?? user?.username;

    const [artist, setArtist] = useState(null);
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem("token");

    const [sortMode, setSortMode] = useState("rating");

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [viewMode, setViewMode] = useState(window.innerWidth <= 768 ? "grid" : "grid");

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            if (mobile) setViewMode("grid");
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    if (!effectiveUsername) return <Navigate to="/login" />;

    useEffect(() => {
        if (!token) return;
        fetchArtist();
    }, [artistId, effectiveUsername, token]);

    const fetchArtist = async () => {
        try {
            const res = await api.get(`/artists/${artistId}/users/${effectiveUsername}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setArtist(res.data.artist);
            const normalized = res.data.albums.map(a => ({
                ...a,
                releaseDate: a.releaseDate ?? a.release_date ?? ""
            }));
            setAlbums(normalized);
        } catch (err) {
            console.error("Failed to fetch artist", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <p>Loading artist...</p>;
    if (!artist) return <p>Artist not found.</p>;

    const sortedAlbums = albums.slice().sort((a, b) =>
        sortMode === "rating"
            ? b.rating - a.rating
            : new Date(a.releaseDate) - new Date(b.releaseDate)
    );

    return (
        <div>
            <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                    {artist.image && (
                        <img
                            src={artist.image}
                            alt={`${artist.name} cover`}
                            style={{ width: isMobile ? "80px" : "200px", height: isMobile ? "80px" : "200px", objectFit: "cover", borderRadius: "50%" }}
                        />
                    )}
                    <h1 style={{ margin: 0, fontSize: isMobile ? "1.3rem" : undefined }}>
                        <Link to={`/users/${effectiveUsername}`}>
                            {effectiveUsername}
                        </Link>'s Top Albums by {artist.name}
                    </h1>
                </div>
            </div>

            <button onClick={() => setSortMode(prev => prev === "rating" ? "chronological" : "rating")} style={{ marginBottom: "10px" }}>
                {sortMode === "rating" ? "Sort: Rating" : "Sort: Chronological"}
            </button>

            {!isMobile && (
                <button onClick={() => setViewMode(prev => prev === "list" ? "grid" : "list")} style={{ marginBottom: "10px", marginLeft: "8px" }}>
                    {viewMode === "list" ? "Grid View" : "List View"}
                </button>
            )}

            <button style={{ marginLeft: "8px" }}>
                <Link to={`/artists/${artist.id}`} style={{ marginBottom: "10px" }}>
                    All albums by {artist.name}
                </Link>
            </button>

            {albums.length === 0 ? (
                <p>No albums for this artist.</p>
            ) : viewMode === "list" ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Rank</th>
                            <th></th>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Album</th>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Released</th>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Rating</th>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Points</th>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAlbums.map((album, i) => (
                            <tr key={album.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/albums/${album.id}/users/${effectiveUsername}`)}>
                                <td>{i + 1}</td>
                                <td>
                                    {album.coverArt && (
                                        <img src={album.coverArt} alt={album.title} style={{ width: "22px", height: "22px", objectFit: "cover", borderRadius: "3px" }} />
                                    )}
                                </td>
                                <td style={{ padding: "4px 8px" }}><i>{album.title}</i></td>
                                <td style={{ padding: "4px 8px" }}>{album.releaseDate ? album.releaseDate.slice(0, 4) : ""}</td>
                                <td style={{ padding: "4px 8px" }}>{album.score10?.toFixed(1)}</td>
                                <td style={{ padding: "4px 8px" }}>{Math.round(album.rating)}</td>
                                <td style={{ padding: "4px 8px" }}>{album.rate}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: isMobile ? "10px" : "16px"
                }}>
                    {sortedAlbums.map((album, i) => (
                        <div
                            key={album.id}
                            style={{ cursor: "pointer", textAlign: "center" }}
                            onClick={() => navigate(`/albums/${album.id}/users/${effectiveUsername}`)}
                        >
                            {album.coverArt && (
                                <img
                                    src={album.coverArt}
                                    alt={album.title}
                                    style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "6px", marginBottom: "4px" }}
                                />
                            )}
                            <div style={{ fontSize: isMobile ? "11px" : "15px", fontWeight: 500 }}>
                                {sortMode === "rating" && `${i + 1}. `}<i>{album.title}</i> · {album.score10?.toFixed(1)}
                            </div>
                            <div style={{ fontSize: isMobile ? "10px" : "14px", color: "#888" }}>
                                {album.releaseDate?.slice(0, 4)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}