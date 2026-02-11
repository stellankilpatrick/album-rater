import { useEffect, useState } from "react";
import api from "../api/api";
import { useNavigate, Link, useParams, Navigate } from "react-router-dom";

export default function ArtistList({ user }) {
    const [artists, setArtists] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: "totalScore", direction: "desc" });
    const navigate = useNavigate();
    const { username } = useParams();
    const effectiveUsername = username ?? user?.username;
    const [viewMode, setViewMode] = useState("list");

    if (!effectiveUsername) return <Navigate to="/login" />;

    useEffect(() => {
        api.get(`/artists/users/${effectiveUsername}`)
            .then(res => setArtists(res.data))
            .catch(err => console.error(err));
    }, [effectiveUsername]);

    // Sort handler
    const sortedArtists = [...artists].sort((a, b) => {
        const key = sortConfig.key;
        if (a[key] < b[key]) return sortConfig.direction === "asc" ? -1 : 1;
        if (a[key] > b[key]) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
    });

    const handleSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
        }));
    };

    return (
        <div>
            <h1>{effectiveUsername}'s Top Artists</h1>

            <button
                onClick={() =>
                    setViewMode(prev => (prev === "list" ? "grid" : "list"))
                }
                style={{ marginBottom: "15px" }}
            >
                {viewMode === "list" ? "Grid View" : "List View"}
            </button>


            {viewMode === "list" ? (
                /* LIST VIEW (existing table) */
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th></th>
                            <th onClick={() => handleSort("name")}>Artist</th>
                            <th onClick={() => handleSort("albumCount")}>Albums</th>
                            <th onClick={() => handleSort("totalScore")}>Total Score</th>
                        </tr>
                    </thead>

                    <tbody>
                        {sortedArtists.map((a, i) => (
                            <tr key={a.id}>
                                <td>{i + 1}</td>
                                <td>
                                    {a.image && (
                                        <img
                                            src={a.image}
                                            alt={a.name}
                                            style={{
                                                width: 22,
                                                height: 22,
                                                objectFit: "cover",
                                                borderRadius: "50%"
                                            }}
                                        />
                                    )}
                                </td>
                                <td>
                                    <Link
                                        to={`/artists/${a.id}/users/${effectiveUsername}`}
                                        style={{ textDecoration: "none", color: "inherit" }}
                                    >
                                        {a.name}
                                    </Link>
                                </td>
                                <td>{a.albumCount ?? 0}</td>
                                <td>{Math.round(a.totalScore ?? 0)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                /* GRID VIEW */
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                        gap: "20px"
                    }}
                >
                    {sortedArtists.map(a => (
                        <div
                            key={a.id}
                            style={{ textAlign: "center", cursor: "pointer" }}
                            onClick={() =>
                                navigate(`/artists/${a.id}/users/${effectiveUsername}`)
                            }
                        >
                            {a.image && (
                                <img
                                    src={a.image}
                                    alt={a.name}
                                    style={{
                                        width: "140px",
                                        height: "140px",
                                        objectFit: "cover",
                                        borderRadius: "50%",
                                        marginBottom: "8px"
                                    }}
                                />
                            )}
                            <div style={{ fontWeight: 500 }}>{a.name}</div>
                            <div style={{ fontSize: "13px" }}>
                                {a.albumCount} albums · {a.totalScore} points
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}