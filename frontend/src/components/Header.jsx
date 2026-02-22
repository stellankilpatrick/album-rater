import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

function TopNav({ effectiveUsername, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
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

  const navStyle = (path) => ({
    textDecoration: location.pathname === path ? "underline" : "none",
    color: "white",
    fontWeight: location.pathname === path ? "bold" : "normal"
  });

  return (
    <div className="top-nav"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        backgroundColor: "black",
        padding: "10px 16px",
        minHeight: "40px"
      }}
    >
      <Link to={`/albums/users/${effectiveUsername}`} style={navStyle(`/albums/users/${effectiveUsername}`)}>
        Album Rankings
      </Link>
      <Link to={`/artists/users/${effectiveUsername}`} style={navStyle(`/artists/users/${effectiveUsername}`)}>
        Artist Rankings
      </Link>
      <Link to="/albums" style={navStyle("/albums")}>Albums</Link>
      <Link to="/artists" style={navStyle("/artists")}>Artists</Link>
      <Link to="/albums/new" style={navStyle("/albums/new")}>Add Album</Link>
      <Link to="/community" style={navStyle("/community")}>Community</Link>
      <Link to={`/users/${effectiveUsername}`} style={navStyle(`/users/${effectiveUsername}`)}>
        Profile
      </Link>

      <div style={{ marginLeft: "auto" }} />

      <form onSubmit={handleSearch} style={{ marginLeft: "24px" }}>
        <input
          type="text"
          placeholder="Search albums / artists"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <button onClick={handleSignOut} style={{ color: "white", backgroundColor: "black", border: "1px solid white", cursor: "pointer" }}>
        Sign out
      </button>
    </div>
  );
}

export default TopNav;