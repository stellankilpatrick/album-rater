import { useState, useEffect } from "react";
import api from "../api/api";
import { useNavigate, Navigate, useParams } from "react-router-dom";

export default function AlbumList({ user }) {
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: "score10", direction: "desc" });
    const [filters, setFilters] = useState({ artists: [], genres: [], minYear: "", maxYear: "" });
    const [searchTerm, setSearchTerm] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [availableGenres, setAvailableGenres] = useState([]);
    const [genreSearchTerm, setGenreSearchTerm] = useState("");
    const [showGenreDropdown, setShowGenreDropdown] = useState(false);

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

    useEffect(() => {
        if (!effectiveUsername) return;
        api.get(`/albums/users/${effectiveUsername}/genres`)
            .then(res => setAvailableGenres(res.data))
            .catch(err => console.error(err));
    }, [effectiveUsername]);

    const uniqueArtists = [...new Set(albums.map(a => a.artist))].sort();

    const filteredAlbums = albums.filter(album => {
        const matchesArtist = filters.artists.length === 0 || filters.artists.includes(album.artist);
        const matchesGenre = filters.genres.length === 0 || filters.genres.some(g => album.genres?.includes(g));
        const albumYear = parseInt(album.releaseDate.slice(0, 4));
        const minYear = filters.minYear ? parseInt(filters.minYear) : null;
        const maxYear = filters.maxYear ? parseInt(filters.maxYear) : null;
        const matchesMinYear = !minYear || albumYear >= minYear;
        const matchesMaxYear = !maxYear || albumYear <= maxYear;
        return matchesArtist && matchesMinYear && matchesMaxYear && matchesGenre;
    });

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
        return sortConfig.direction === "asc" ? " ↑" : " ↓";
    };

    const toggleArtist = (artist) => {
        setFilters(prev => ({
            ...prev,
            artists: prev.artists.includes(artist)
                ? prev.artists.filter(a => a !== artist)
                : [...prev.artists, artist]
        }));
    };

    const toggleGenre = (genre) => {
        setFilters(prev => ({
            ...prev,
            genres: prev.genres.includes(genre)
                ? prev.genres.filter(g => g !== genre)
                : [...prev.genres, genre]
        }));
    };

    const handleYearChange = (type, value) => {
        setFilters(prev => ({ ...prev, [type]: value }));
    };

    const clearFilters = () => {
        setFilters({ artists: [], genres: [], minYear: "", maxYear: "" });
    };

    const filteredArtists = uniqueArtists.filter(artist =>
        artist.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="page-pad">
            <h1>{effectiveUsername}'s Top Albums</h1>

            {loading ? (
                <p>Loading albums...</p>
            ) : albums.length === 0 ? (
                <p>No albums found.</p>
            ) : (
                <>
                    {/* Filters */}
                    <div className="filter-bar">
                        <div className="filter-bar-row">
                            {/* Artist dropdown */}
                            <div style={{ position: "relative" }}>
                                <button
                                    className={`filter-btn${filters.artists.length > 0 ? " active" : ""}`}
                                    onClick={() => { setShowGenreDropdown(false); setShowDropdown(v => !v); }}
                                >
                                    Artists{filters.artists.length > 0 ? ` (${filters.artists.length})` : ""}
                                </button>
                                {showDropdown && (
                                    <div className="filter-dropdown-panel">
                                        <input
                                            className="filter-dropdown-search"
                                            type="text"
                                            placeholder="Search artists..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                        {filteredArtists.map(artist => (
                                            <div key={artist} className="filter-dropdown-item">
                                                <label>
                                                    <input type="checkbox" checked={filters.artists.includes(artist)} onChange={() => toggleArtist(artist)} />
                                                    {artist}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Genre dropdown */}
                            <div style={{ position: "relative" }}>
                                <button
                                    className={`filter-btn${filters.genres.length > 0 ? " active" : ""}`}
                                    onClick={() => { setShowDropdown(false); setShowGenreDropdown(v => !v); }}
                                >
                                    Genres{filters.genres.length > 0 ? ` (${filters.genres.length})` : ""}
                                </button>
                                {showGenreDropdown && (
                                    <div className="filter-dropdown-panel">
                                        <input
                                            className="filter-dropdown-search"
                                            type="text"
                                            placeholder="Search genres..."
                                            value={genreSearchTerm}
                                            onChange={(e) => setGenreSearchTerm(e.target.value)}
                                        />
                                        {availableGenres
                                            .filter(g => g.name.toLowerCase().includes(genreSearchTerm.toLowerCase()))
                                            .map(g => (
                                                <div key={g.id} className="filter-dropdown-item">
                                                    <label>
                                                        <input type="checkbox" checked={filters.genres.includes(g.name)} onChange={() => toggleGenre(g.name)} />
                                                        {g.name}
                                                    </label>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* Year range */}
                            <div className="filter-year-row">
                                <input className="filter-input" type="number" placeholder="Min year" value={filters.minYear} onChange={(e) => handleYearChange("minYear", e.target.value)} />
                                <span>–</span>
                                <input className="filter-input" type="number" placeholder="Max year" value={filters.maxYear} onChange={(e) => handleYearChange("maxYear", e.target.value)} />
                            </div>

                            <button className="filter-btn" onClick={clearFilters}>Clear Filters</button>
                        </div>
                        <p className="filter-meta">Showing {sortedAlbums.length} of {albums.length} albums</p>
                    </div>

                    {/* Toggle button — hidden on mobile */}
                    {!isMobile && (
                        <button className="ui-btn" style={{ marginBottom: "10px" }} onClick={() => setViewMode(prev => prev === "list" ? "grid" : "list")}>
                            {viewMode === "list" ? "Grid View" : "List View"}
                        </button>
                    )}

                    {sortedAlbums.length === 0 ? (
                        <p>No albums match your filters.</p>
                    ) : viewMode === "list" ? (
                        <table style={{ width: "100%", borderCollapse: "collapse", borderSpacing: 0 }}>
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th></th>
                                    <th onClick={() => handleSort("title")}>Title{getSortArrow("title")}</th>
                                    <th onClick={() => handleSort("artist")}>Artist{getSortArrow("artist")}</th>
                                    <th onClick={() => handleSort("releaseDate")}>Released{getSortArrow("releaseDate")}</th>
                                    <th onClick={() => handleSort("score10")}>Rating{getSortArrow("score10")}</th>
                                    <th onClick={() => handleSort("rating")}>Points{getSortArrow("rating")}</th>
                                    <th>Tracks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAlbums.map((album, i) => (
                                    <tr key={album.id}>
                                        <td>{i + 1}</td>
                                        <td style={{ padding: 0 }}>
                                            {album.coverArt && (
                                                <img src={album.coverArt} alt={album.title} style={{ width: 25, height: 25, borderRadius: "3px" }} />
                                            )}
                                        </td>
                                        <td style={{ cursor: "pointer" }} onClick={() => navigate(`/albums/${album.id}/users/${effectiveUsername}`)}>
                                            <i>{album.title}</i>
                                        </td>
                                        <td style={{ cursor: "pointer" }} onClick={() => navigate(`/artists/${album.artistId}/users/${effectiveUsername}`)}>
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
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(auto-fill, minmax(180px, 1fr))",
                            gap: isMobile ? "10px" : "16px"
                        }}>
                            {sortedAlbums.map((album, i) => (
                                <div
                                    key={album.id}
                                    style={{ cursor: "pointer", textAlign: "center" }}
                                    onClick={() => navigate(`/albums/${album.id}/users/${effectiveUsername}`)}
                                >
                                    <img
                                        src={album.coverArt}
                                        alt={album.title}
                                        style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "6px" }}
                                    />
                                    <div style={{ fontSize: isMobile ? "11px" : "14px", fontWeight: 500 }}>
                                        {i+1}. <i>{album.title}</i> · {album.score10.toFixed(1)}
                                    </div>
                                    <div style={{ fontSize: isMobile ? "10px" : "13px", color: "#888" }}>
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