import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/api";

export default function AlbumsPublic({ user }) {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: "ratingCount", direction: "desc" });
  const [filters, setFilters] = useState({ artists: [], genres: [], minYear: "", maxYear: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [availableGenres, setAvailableGenres] = useState([]);
  const [genreSearchTerm, setGenreSearchTerm] = useState("");
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);

  const { username } = useParams();
  const effectiveUsername = username ?? user?.username;

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

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const res = await api.get("/albums");
        const normalized = res.data.map(a => ({ ...a, avgScore: a.avgScore ?? 0 }));
        setAlbums(normalized);
      } catch (err) {
        console.error("Failed to fetch albums:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlbums();
  }, []);

  useEffect(() => {
    api.get("/albums/genres/all")
      .then(res => setAvailableGenres(res.data))
      .catch(err => console.error(err));
  }, []);

  const uniqueArtists = [...new Set(albums.map(a => a.artist))].sort();

  const filteredAlbums = albums.filter(album => {
    const matchesArtist = filters.artists.length === 0 || filters.artists.includes(album.artist);
    const matchesGenre = filters.genres.length === 0 || filters.genres.some(g => album.genres?.includes(g));
    const albumYear = parseInt(album.releaseDate?.slice(0, 4) || "0");
    const minYear = filters.minYear ? parseInt(filters.minYear) : null;
    const maxYear = filters.maxYear ? parseInt(filters.maxYear) : null;
    const matchesMinYear = !minYear || albumYear >= minYear;
    const matchesMaxYear = !maxYear || albumYear <= maxYear;
    return matchesArtist && matchesGenre && matchesMinYear && matchesMaxYear;
  });

  const sortedAlbums = [...filteredAlbums].sort((a, b) => {
    const key = sortConfig.key;
    if (a[key] < b[key]) return sortConfig.direction === "asc" ? -1 : 1;
    if (a[key] > b[key]) return sortConfig.direction === "asc" ? 1 : -1;
    return b.avgScore - a.avgScore;
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

  const handleYearChange = (type, value) => {
    setFilters(prev => ({ ...prev, [type]: value }));
  };

  const toggleGenre = (genre) => {
    setFilters(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre]
    }));
  };

  const clearFilters = () => {
    setFilters({ artists: [], genres: [], minYear: "", maxYear: "" });
  };

  const filteredArtists = uniqueArtists.filter(artist =>
    artist.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedAlbums = sortedAlbums.slice(0, 100);

  if (loading) return <p>Loading albums...</p>;

  return (
    <div className="page-pad">
      <h1 style={{ textAlign: 'center' }}>All Rated Albums</h1>

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-bar-row" style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
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

          <div className="filter-year-row">
            <input className="filter-input" type="number" placeholder="Min year" value={filters.minYear} onChange={(e) => handleYearChange("minYear", e.target.value)} />
            <span>–</span>
            <input className="filter-input" type="number" placeholder="Max year" value={filters.maxYear} onChange={(e) => handleYearChange("maxYear", e.target.value)} />
          </div>

          <button className="filter-btn" onClick={clearFilters}>Clear Filters</button>
        </div>
        <p className="filter-meta" style={{ textAlign: "center" }}>Showing {Math.min(100, sortedAlbums.length)} of {albums.length} albums</p>
      </div>

      {!isMobile && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button className="ui-btn" style={{ marginBottom: "15px" }} onClick={() => setViewMode(prev => prev === "list" ? "grid" : "list")}>
            {viewMode === "list" ? "Grid View" : "List View"}
          </button>
        </div>
      )}

      {displayedAlbums.length === 0 ? (
        <p>No albums match your filters.</p>
      ) : viewMode === "list" ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Rank</th>
              <th></th>
              <th>Album</th>
              <th onClick={() => handleSort("artist")}>Artist{getSortArrow("artist")}</th>
              <th onClick={() => handleSort("releaseDate")}>Released{getSortArrow("releaseDate")}</th>
              <th onClick={() => handleSort("ratingCount")}>Reviews{getSortArrow("ratingCount")}</th>
              <th onClick={() => handleSort("avgScore")}>Avg Rating{getSortArrow("avgScore")}</th>
            </tr>
          </thead>
          <tbody>
            {displayedAlbums.map((album, i) => (
              <tr key={album.id}>
                <td>{i + 1}</td>
                <td>
                  {album.coverArt && (
                    <img src={album.coverArt} alt={album.title} style={{ width: 25, height: 25, objectFit: "cover" }} />
                  )}
                </td>
                <td><Link to={`/albums/${album.id}`}><i>{album.title}</i></Link></td>
                <td><Link to={`/artists/${album.artistId}`}>{album.artist}</Link></td>
                <td>{album.releaseDate?.slice(0, 4)}</td>
                <td>{album.ratingCount ?? 0}</td>
                <td>{(() => { const mode = localStorage.getItem('ratingMode') || 'score'; const r = album.avgScore; if (mode === 'stars') { const Star = require('./StarRating').default; const v = require('../utils/rating').score10ToStarValue(r); return v != null ? <Star value={v} size={14} /> : (r?.toFixed(1) ?? '0.0'); } return (album.avgScore?.toFixed(1) ?? '0.0'); })()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(3, minmax(0, 1fr))" : "repeat(auto-fill, minmax(140px, 1fr))",
          gap: isMobile ? "10px" : "15px"
        }}>
          {displayedAlbums.map(album => (
            <div key={album.id} style={{ cursor: "pointer", textAlign: "center" }}>
              {album.coverArt && (
                <Link to={`/albums/${album.id}`}>
                  <img
                    src={album.coverArt}
                    alt={album.title}
                    style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "6px", marginBottom: "3px" }}
                  />
                </Link>
              )}
              <div style={{ fontWeight: 500, fontSize: isMobile ? "12px" : "14px" }}>
                <i>{album.title}</i>
              </div>
              <div style={{ fontSize: isMobile ? "11px" : "12px", color: "#888", marginBottom: "-8px" }}>
                {album.artist}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}