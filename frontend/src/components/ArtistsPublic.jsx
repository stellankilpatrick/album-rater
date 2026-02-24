import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api/api";

export default function ArtistsPublic({ user }) {
    const [artists, setArtists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: "ratingCount", direction: "desc" });
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState("list");

    const { username } = useParams();
    const effectiveUsername = username ?? user?.username;

    useEffect(() => {
        const fetchArtists = async () => {
            try {
                const res = await api.get("/artists"); // Backend route that returns artists with albums rated by anyone
                const normalized = res.data.map(a => ({
                    ...a,
                    avgRating: a.avgRating ?? 0,
                    albumCount: a.albumCount ?? 0,
                    ratingCount: a.ratingCount ?? 0,
                }));
                setArtists(normalized);
            } catch (err) {
                console.error("Failed to fetch artists:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchArtists();
    }, []);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc"
        }));
    };

    const sortedArtists = [...artists].sort((a, b) => {
        const key = sortConfig.key;
        if (a[key] < b[key]) return sortConfig.direction === "asc" ? -1 : 1;
        if (a[key] > b[key]) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
    });

    if (loading) return <p>Loading artists...</p>;

    return (
        <div>
            <h1>All Rated Artists</h1>

            <button
                onClick={() =>
                    setViewMode(prev => (prev === "list" ? "grid" : "list"))
                }
                style={{ marginBottom: "15px" }}
            >
                {viewMode === "list" ? "Grid View" : "List View"}
            </button>

            {viewMode === "list" ? (
                /* LIST VIEW */
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr>
                            <th onClick={() => handleSort("id")}>Rank</th>
                            <th></th>
                            <th onClick={() => handleSort("name")}>Artist</th>
                            <th onClick={() => handleSort("albumCount")}>Albums</th>
                            <th onClick={() => handleSort("ratingCount")}>Reviews</th>
                            <th onClick={() => handleSort("avgRating")}>Average Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedArtists.map((artist, i) => (
                            <tr
                                key={artist.id}
                                style={{ cursor: "pointer" }}
                                onClick={() => navigate(`/artists/${artist.id}`)}
                            >
                                <td>{i + 1}</td>
                                <td>
                                    {artist.image && (
                                        <img
                                            src={artist.image}
                                            alt={artist.name}
                                            style={{
                                                width: 25,
                                                height: 25,
                                                objectFit: "cover",
                                                borderRadius: "50%"
                                            }}
                                        />
                                    )}
                                </td>
                                <td>{artist.name}</td>
                                <td>{artist.albumCount}</td>
                                <td>{artist.ratingCount}</td>
                                <td>{artist.avgRating.toFixed(1)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                /* GRID VIEW */
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                        gap: "22px"
                    }}
                >
                    {sortedArtists.map(artist => (
                        <div
                            key={artist.id}
                            style={{ textAlign: "center", cursor: "pointer" }}
                            onClick={() => navigate(`/artists/${artist.id}`)}
                        >
                            {artist.image && (
                                <img
                                    src={artist.image}
                                    alt={artist.name}
                                    style={{
                                        width: "140px",
                                        height: "140px",
                                        objectFit: "cover",
                                        borderRadius: "50%",
                                        marginBottom: "8px"
                                    }}
                                />
                            )}
                            <div style={{ fontWeight: 500 }}>{artist.name}</div>
                            <div style={{ fontSize: "13px" }}>
                                {artist.albumCount} albums · {artist.ratingCount} reviews
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}