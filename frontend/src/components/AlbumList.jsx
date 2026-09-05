import { useState, useEffect } from "react";
import api from "../api/api";
import { getRatingMode, score10ToStarValue, renderScore } from "../utils/rating";
import StarRating from "./StarRating";
import { useNavigate, Navigate, useParams, useSearchParams } from "react-router-dom";

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
    const [searchParams, setSearchParams] = useSearchParams();

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [viewMode, setViewMode] = useState(window.innerWidth <= 768 ? "grid" : "grid");

    // Read filters directly from URL
    const sortKey = searchParams.get("sort") ?? "score10";
    const sortDir = searchParams.get("dir") ?? "desc";
    const selectedArtists = searchParams.getAll("artist");
    const selectedGenres = searchParams.getAll("genre");
    const minYear = searchParams.get("minYear") ?? "";
    const maxYear = searchParams.get("maxYear") ?? "";


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
    const isOwner = user?.username === effectiveUsername;

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

    const uniqueArtists = [...new Set(
        albums
            .flatMap(a => a.artist ? a.artist.split(' & ').map(artist => artist.trim()) : [])
    )]
        .sort();

    const filteredAlbums = albums.filter(album => {
        // Split artists and check if any selected artist is in this album
        const albumArtists = album.artist ? album.artist.split(' & ').map(a => a.trim()) : [];
        const matchesArtist = selectedArtists.length === 0 ||
            selectedArtists.some(selected => albumArtists.includes(selected));

        const matchesGenre = selectedGenres.length === 0 || selectedGenres.some(g => album.genres?.includes(g));
        const albumYear = parseInt(album.releaseDate?.slice(0, 4));
        const min = minYear ? parseInt(minYear) : null;
        const max = maxYear ? parseInt(maxYear) : null;
        return matchesArtist && matchesGenre
            && (!min || albumYear >= min)
            && (!max || albumYear <= max);
    });

    const sortedAlbums = [...filteredAlbums].sort((a, b) => {
        if (a[sortKey] < b[sortKey]) return sortDir === "asc" ? -1 : 1;
        if (a[sortKey] > b[sortKey]) return sortDir === "asc" ? 1 : -1;
        return 0;
    });

    // Helper to update one or more params without wiping others
    const updateParams = (updates) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            Object.entries(updates).forEach(([key, value]) => {
                if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
                    next.delete(key);
                } else if (Array.isArray(value)) {
                    next.delete(key);
                    value.forEach(v => next.append(key, v));
                } else {
                    next.set(key, value);
                }
            });
            return next;
        });
    };

    const handleSort = (key) => {
        const newDir = sortKey === key && sortDir === "desc" ? "asc" : "desc";
        updateParams({ sort: key, dir: newDir });
    };

    const getSortArrow = (key) => {
        if (sortKey !== key) return "";
        return sortDir === "asc" ? " ↑" : " ↓";
    };

    const toggleArtist = (artist) => {
        const next = selectedArtists.includes(artist)
            ? selectedArtists.filter(a => a !== artist)
            : [...selectedArtists, artist];
        updateParams({ artist: next });
    };

    const toggleGenre = (genre) => {
        const next = selectedGenres.includes(genre)
            ? selectedGenres.filter(g => g !== genre)
            : [...selectedGenres, genre];
        updateParams({ genre: next });
    };

    const handleYearChange = (type, value) => {
        updateParams({ [type]: value });
    };

    const clearFilters = () => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            ["artist", "genre", "minYear", "maxYear"].forEach(k => next.delete(k));
            return next;
        });
    };

    const filteredArtists = uniqueArtists.filter(artist =>
        artist.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="page-pad">
            <h1 style={{ marginBottom: "-6px", textAlign: "center" }}>
                {isOwner ? "My Top Albums" : `${effectiveUsername}'s Top Albums`}
            </h1>

            {loading ? (
                <p>Loading albums...</p>
            ) : albums.length === 0 ? (
                <p>No albums found.</p>
            ) : (
                <>
                    {/* Filters */}
                    <div className="filter-bar">
                        <div className="filter-bar-row" style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                            {/* Artist dropdown */}
                            <div style={{ position: "relative" }}>
                                <button
                                    className={`filter-btn${selectedArtists.length > 0 ? " active" : ""}`}
                                    onClick={() => { setShowGenreDropdown(false); setShowDropdown(v => !v); }}
                                >
                                    Artists{selectedArtists.length > 0 ? ` (${selectedArtists.length})` : ""}
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
                                                    <input type="checkbox" checked={selectedArtists.includes(artist)} onChange={() => toggleArtist(artist)} />
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
                                    className={`filter-btn${selectedGenres.length > 0 ? " active" : ""}`}
                                    onClick={() => { setShowDropdown(false); setShowGenreDropdown(v => !v); }}
                                >
                                    Genres{selectedGenres.length > 0 ? ` (${selectedGenres.length})` : ""}
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
                                                        <input type="checkbox" checked={selectedGenres.includes(g.name)} onChange={() => toggleGenre(g.name)} />
                                                        {g.name}
                                                    </label>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* Year range */}
                            <div className="filter-year-row">
                                <input className="filter-input" type="number" placeholder="Min year" value={minYear} onChange={(e) => handleYearChange("minYear", e.target.value)} />
                                <span>–</span>
                                <input className="filter-input" type="number" placeholder="Max year" value={maxYear} onChange={(e) => handleYearChange("maxYear", e.target.value)} />
                            </div>

                            <button className="filter-btn" onClick={clearFilters}>Clear Filters</button>
                        </div>
                        <p className="filter-meta" style={{ textAlign: "center" }}>Showing {sortedAlbums.length} of {albums.length} albums</p>
                    </div>

                    {/* View mode fixed to grid — list view button removed */}

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
                                        <td>{getRatingMode() === 'stars' ? <StarRating value={score10ToStarValue(album.score10)} size={14}/> : renderScore(album.score10)}</td>
                                        <td>{album.rate}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(auto-fill, minmax(160px, 1fr))",
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
                                    <div style={{ fontSize: isMobile ? "11px" : "13.5px", fontWeight: 500 }}>
                                        {i + 1}. <i>{album.title}</i> · {getRatingMode() === 'stars' ? <StarRating value={score10ToStarValue(album.score10)} size={14}/> : renderScore(album.score10)}
                                    </div>
                                    <div style={{ fontSize: isMobile ? "10px" : "12.5px", color: "#888", marginBottom: "-8px" }}>
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