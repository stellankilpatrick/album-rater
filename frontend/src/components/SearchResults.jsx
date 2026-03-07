import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../api/api";

export default function SearchResults() {
    const [params] = useSearchParams();
    const query = params.get("q");

    const [results, setResults] = useState({
        albums: [],
        artists: [],
        users: [],
    });

    useEffect(() => {
        if (!query) return;

        api.get(`/search?q=${query}`).then((res) => {
            setResults(res.data);
        });
    }, [query]);

    if (!query) return <div>No search query.</div>;

    return (
        <div>
            <h2>Search results for "{query}"</h2>

            <h3>Albums</h3>
            {results.albums.length === 0
                ? <div style={{ color: "#999" }}>No albums</div>
                : results.albums.map((a) => (
                    <div key={a.id}>
                        <Link to={`/albums/${a.id}`}>
                            <i>{a.title}</i> — {a.artist}
                        </Link>
                    </div>
                ))}

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