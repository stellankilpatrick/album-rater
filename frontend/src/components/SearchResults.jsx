import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import { searchSpotifyAlbums, openSpotifyAlbum } from "../api/spotify";

export default function SearchResults() {
    const [params] = useSearchParams();
    const query = params.get("q");
    const navigate = useNavigate();

    const [results, setResults] = useState({
        albums: [],
        artists: [],
        users: [],
    });
    const [spotifyResults, setSpotifyResults] = useState([]);
    const [openingSpotifyId, setOpeningSpotifyId] = useState(null);
    const [spotifyError, setSpotifyError] = useState(false);

    useEffect(() => {
        if (!query) return;

        api.get(`/search?q=${encodeURIComponent(query)}`).then((res) => {
            setResults(res.data);
        });
    }, [query]);

    useEffect(() => {
        setSpotifyResults([]);
        setSpotifyError(false);
        if (!query?.trim()) return;
        let cancelled = false;
        searchSpotifyAlbums(query.trim()).then(albums => { if (!cancelled) setSpotifyResults(albums); });
        return () => { cancelled = true; };
    }, [query]);

    const handleOpenSpotifyAlbum = async (spotifyAlbum) => {
        setOpeningSpotifyId(spotifyAlbum.spotifyId);
        setSpotifyError(false);
        try {
            navigate(`/albums/${await openSpotifyAlbum(spotifyAlbum)}`);
        } catch (err) {
            console.error("Failed to open Spotify album:", err);
            setSpotifyError(true);
            setOpeningSpotifyId(null);
        }
    };

    // Spotify albums not already listed among the site's own album results
    const siteAlbumIds = new Set(results.albums.map(a => a.id));
    const spotifyAlbums = spotifyResults.filter(a => !siteAlbumIds.has(a.existingAlbumId));

    if (!query) return <div>No search query.</div>;

    return (
        <div>
            <h2>Search results for "{query}"</h2>

            <h3>Albums</h3>
            {results.albums.length === 0 && spotifyAlbums.length === 0
                ? <div style={{ color: "#999" }}>No albums</div>
                : results.albums.map((a) => (
                    <div key={a.id}>
                        <Link to={`/albums/${a.id}`}>
                            <i>{a.title}</i> — {a.artist}
                        </Link>
                    </div>
                ))}
            {spotifyAlbums.map((a) => (
                <div key={a.spotifyId}>
                    <button
                        type="button"
                        onClick={() => handleOpenSpotifyAlbum(a)}
                        disabled={openingSpotifyId !== null}
                        style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", textDecoration: "underline", cursor: openingSpotifyId ? "wait" : "pointer", textAlign: "left" }}
                    >
                        <i>{a.title}</i> — {a.artist}
                    </button>
                    <span style={{ color: "#888", fontSize: "13px" }}>
                        {openingSpotifyId === a.spotifyId ? " · opening…" : a.releaseDate ? ` · ${a.releaseDate.slice(0, 4)}` : ""}
                    </span>
                </div>
            ))}
            {spotifyError && <div style={{ color: "#f87171", fontSize: "13px" }}>Couldn't open that album, try again.</div>}
            {spotifyAlbums.length > 0 && <div style={{ color: "#666", fontSize: "12px", marginTop: "4px" }}>Album info from Spotify</div>}

            <h3>Artists</h3>
            {results.artists.length === 0
                ? <div style={{ color: "#999" }}>No artists</div>
                : results.artists.map((a) => (
                    <div key={a.id}>
                        <Link to={`/artists/${a.id}`}>{a.name}</Link>
                    </div>
                ))}

            <h3>Users</h3>
            {results.users.length === 0
                ? <div style={{ color: "#999" }}>No users</div>
                : results.users.map((u) => (
                    <div key={u.id}>
                        <Link to={`/users/${u.username}`}>{u.username}</Link>
                    </div>
                ))}
        </div>
    );
}