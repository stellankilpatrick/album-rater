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

    if (!effectiveUsername) {
        return <Navigate to="/login" />;
    }

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

            // normalize release date
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

    return (
        <div>
            <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>

                    {artist.image && (
                        <img
                            src={artist.image}
                            alt={`${artist.name} cover`}
                            style={{
                                width: "150px",
                                height: "150px",
                                objectFit: "cover",
                                borderRadius: "50%"
                            }}
                        />
                    )}

                    <h1 style={{ margin: 0 }}>{effectiveUsername}'s Top Albums by {artist.name}</h1>

                </div>
            </div>

            {albums.length === 0 ? (
                <p>No albums for this artist.</p>
            ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Rank</th>
                            <th></th>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Album</th>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Released</th>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Points</th>
                            <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Rate</th>
                        </tr>
                    </thead>

                    <tbody>
                        {albums
                            .slice()
                            .sort((a, b) => b.rating - a.rating)
                            .map((album, i) => (
                                <tr
                                    key={album.id}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => navigate(`/albums/${album.id}/users/${user.username}`)}
                                >
                                    <td>{i + 1}</td>
                                    <td style={{ textAlign: "left" }}>
                                        {album.coverArt && (
                                            <img
                                                src={album.coverArt}
                                                alt={album.title}
                                                style={{ width: "22px", height: "22px", objectFit: "cover", borderRadius: "3px" }}
                                            />
                                        )}
                                    </td>
                                    <td style={{ padding: "4px 8px" }}>
                                        <i>{album.title}</i>
                                    </td>
                                    <td style={{ padding: "4px 8px" }}>
                                        {album.releaseDate ? album.releaseDate.slice(0, 4) : ""}
                                    </td>
                                    <td style={{ padding: "4px 8px" }}>
                                        {Math.round(album.rating)}
                                    </td>
                                    <td style={{ padding: "4px 8px" }}>
                                        {album.rate}
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            )}

            <Link to={`/artists/${artist.id}`} style={{}}>
                All albums by {artist.name}
            </Link>
        </div>
    );
}