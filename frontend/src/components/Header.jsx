import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

function TopNav({ effectiveUsername, onLogout }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSignOut = () => {
    onLogout();
    navigate("/"); // sends them back to AuthPage
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
    setQuery("");
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        marginBottom: "12px",
      }}
    >
      {/* left side nav */}
      <Link to={`/albums/users/${effectiveUsername}`} style={{ textDecoration: "none" }}>
        Album Rankings
      </Link>
      <Link to={`/artists/users/${effectiveUsername}`} style={{ textDecoration: "none" }}>
        Artist Rankings
      </Link>
      <Link to="/albums" style={{ textDecoration: "none" }}>Albums</Link>
      <Link to="/artists" style={{ textDecoration: "none" }}>Artists</Link>
      <Link to="/albums/new" style={{ textDecoration: "none" }}>Add Album</Link>
      <Link to="/community" style={{ textDecoration: "none" }}>Community</Link>
      <Link to={`/users/${effectiveUsername}`} style={{ textDecoration: "none" }}>
        Profile
      </Link>

      {/* spacer pushes sign out to the right */}
      <div style={{ marginLeft: "auto" }} />

      {/* search */}
      <form onSubmit={handleSearch} style={{ marginLeft: "24px" }}>
        <input
          type="text"
          placeholder="Search albums / artists"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      {/* sign out */}
      <button onClick={handleSignOut}>
        Sign out
      </button>
    </div>
  );
}

export default TopNav;