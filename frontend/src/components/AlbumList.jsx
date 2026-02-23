import { useState, useEffect } from "react";
import api from "../api/api";
import { useNavigate, Navigate, useParams } from "react-router-dom";

export default function AlbumList({ user }) {
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: "score10", direction: "desc" });
    const [filters, setFilters] = useState({
        artists: [],
        minYear: "",
        maxYear: ""
    });
    const [searchTerm, setSearchTerm] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);

    const [viewMode, setViewMode] = useState("list");

    const navigate = useNavigate();

    const token = localStorage.getItem("token");

    const { username } = useParams();
    const effectiveUsername = username ?? user?.username;

    if (!effectiveUsername) return <Navigate to="/login" />;

    useEffect(() => {
        if (!token || !effectiveUsername) return;

        const fetchAlbums = async () => {
            try {
                const res = await api.get(`/albums/users/${effectiveUsername}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const normalized = res.data.map(a => ({
                    ...a,
                    releaseDate: a.releaseDate ?? a.release_date ?? "",
                    score10: a.score10 ?? 0
                }));

                setAlbums(normalized);
            } catch (err) {
                console.error("Failed to fetch albums:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAlbums();
    }, [token, effectiveUsername]);

    // Get unique artists from albums
    const uniqueArtists = [...new Set(albums.map(a => a.artist))].sort();

    // Filter albums
    const filteredAlbums = albums.filter(album => {
        const matchesArtist = filters.artists.length === 0 || filters.artists.includes(album.artist);

        const albumYear = parseInt(album.releaseDate.slice(0, 4));
        const minYear = filters.minYear ? parseInt(filters.minYear) : null;
        const maxYear = filters.maxYear ? parseInt(filters.maxYear) : null;

        const matchesMinYear = !minYear || albumYear >= minYear;
        const matchesMaxYear = !maxYear || albumYear <= maxYear;

        return matchesArtist && matchesMinYear && matchesMaxYear;
    });

    // Sort handler
    const sortedAlbums = [...filteredAlbums].sort((a, b) => {
        const key = sortConfig.key;
        if (a[key] < b[key]) return sortConfig.direction === "asc" ? -1 : 1;
        if (a[key] > b[key]) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
    });

    const handleSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
        }));
    };

    const getSortArrow = (key) => {
        if (sortConfig.key !== key) return "";
        return sortConfig.direction === "asc" ? " ▲" : " ▼";
    };

    const toggleArtist = (artist) => {
        setFilters(prev => {
            const currentArtists = prev.artists;
            if (currentArtists.includes(artist)) {
                return {
                    ...prev,
                    artists: currentArtists.filter(a => a !== artist)
                };
            } else {
                return {
                    ...prev,
                    artists: [...currentArtists, artist]
                };
            }
        });
    };

    const handleYearChange = (type, value) => {
        setFilters(prev => ({ ...prev, [type]: value }));
    };

    const clearFilters = () => {
        setFilters({
            artists: [],
            minYear: "",
            maxYear: ""
        });
    };

    // Filter artists based on search
    const filteredArtists = uniqueArtists.filter(artist =>
        artist.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <h1>{effectiveUsername}'s Top Albums</h1>

            {loading ? (
                <p>Loading albums...</p>
            ) : albums.length === 0 ? (
                <p>No albums found.</p>
            ) : (
                <>
                    {/* Filters */}
                    <div style={{ marginBottom: "15px", padding: "10px", border: "1px solid #ccc", borderRadius: "4px" }}>
                        <h3 style={{ margin: "2px 0 8px 0" }}>Filters</h3>
                        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "flex-start" }}>
                            {/* Artist Multi-Select Dropdown */}
                            <div style={{ position: "relative" }}>
                                <button
                                    onClick={() => setShowDropdown(!showDropdown)}
                                    style={{ padding: "3px 5px", cursor: "pointer" }}
                                >
                                    Artists ({filters.artists.length})
                                </button>
                                {showDropdown && (
                                    <div style={{
                                        position: "absolute",
                                        top: "100%",
                                        left: 0,
                                        background: "white",
                                        border: "1px solid #ccc",
                                        borderRadius: "4px",
                                        padding: "10px",
                                        zIndex: 1000,
                                        minWidth: "200px",
                                        maxHeight: "300px",
                                        overflowY: "auto",
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                                    }}>
                                        <input
                                            type="text"
                                            placeholder="Search artists..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ width: "100%", padding: "5px", marginBottom: "10px", boxSizing: "border-box" }}
                                        />
                                        {filteredArtists.map(artist => (
                                            <div key={artist} style={{ padding: "3px 0" }}>
                                                <label style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={filters.artists.includes(artist)}
                                                        onChange={() => toggleArtist(artist)}
                                                        style={{ marginRight: "8px" }}
                                                    />
                                                    {artist}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Year Range */}
                            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                <input
                                    type="number"
                                    placeholder="Min year"
                                    value={filters.minYear}
                                    onChange={(e) => handleYearChange("minYear", e.target.value)}
                                    style={{ padding: "3px", width: "70px" }}
                                />
                                <span>to</span>
                                <input
                                    type="number"
                                    placeholder="Max year"
                                    value={filters.maxYear}
                                    onChange={(e) => handleYearChange("maxYear", e.target.value)}
                                    style={{ padding: "3px", width: "70px" }}
                                />
                            </div>

                            <button onClick={clearFilters} style={{ padding: "3px 5px" }}>
                                Clear Filters
                            </button>
                        </div>
                        <p style={{ marginTop: "4px", fontSize: "14px", color: "#666" }}>
                            Showing {sortedAlbums.length} of {albums.length} albums
                        </p>
                    </div>

                    <button
                        onClick={() =>
                            setViewMode(prev => (prev === "list" ? "grid" : "list"))
                        }
                        style={{ marginBottom: "10px" }}
                    >
                        {viewMode === "list" ? "Grid View" : "List View"}
                    </button>

                    {sortedAlbums.length === 0 ? (
                        <p>No albums match your filters.</p>
                    ) : viewMode === "list" ? (
                        /* LIST VIEW (your existing table, unchanged) */
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th></th>
                                    <th onClick={() => handleSort("title")}>Title{getSortArrow("title")}</th>
                                    <th onClick={() => handleSort("artist")}>Artist{getSortArrow("artist")}</th>
                                    <th onClick={() => handleSort("releaseDate")}>Released{getSortArrow("releaseDate")}</th>
                                    <th onClick={() => handleSort("score10")}>Rating{getSortArrow("score10")}</th>
                                    <th onClick={() => handleSort("rating")}>Points{getSortArrow("rating")}</th>
                                    <th>Songs</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAlbums.map((album, i) => (
                                    <tr key={album.id}>
                                        <td>{i + 1}</td>
                                        <td>
                                            {album.coverArt && (
                                                <img
                                                    src={album.coverArt}
                                                    alt={album.title}
                                                    style={{ width: 22, height: 22 }}
                                                />
                                            )}
                                        </td>
                                        <td
                                            style={{ cursor: "pointer" }}
                                            onClick={() =>
                                                navigate(`/albums/${album.id}/users/${effectiveUsername}`)
                                            }
                                        >
                                            <i>{album.title}</i>
                                        </td>
                                        <td
                                            style={{ cursor: "pointer" }}
                                            onClick={() =>
                                                navigate(`/artists/${album.artistId}/users/${effectiveUsername}`)
                                            }
                                        >
                                            {album.artist}
                                        </td>
                                        <td>{album.releaseDate?.slice(0, 4)}</td>
                                        <td>{album.score10.toFixed(1)}</td>
                                        <td>{Math.round(album.rating)}</td>
                                        <td>{album.rate}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        /* GRID VIEW */
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                                gap: "16px"
                            }}
                        >
                            {sortedAlbums.map(album => (
                                <div
                                    key={album.id}
                                    style={{ cursor: "pointer", textAlign: "center" }}
                                    onClick={() =>
                                        navigate(`/albums/${album.id}/users/${effectiveUsername}`)
                                    }
                                >
                                    <img
                                        src={album.coverArt}
                                        alt={album.title}
                                        style={{
                                            width: "100%",
                                            aspectRatio: "1 / 1",
                                            objectFit: "cover",
                                            borderRadius: "6px"
                                        }}
                                    />

                                    <div style={{ fontWeight: 500 }}>
                                        <i>{album.title}</i>
                                    </div>
                                    <div style={{ fontSize: "13px", color: "#666" }}>
                                        {album.artist}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}