import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

function TopNav({ effectiveUsername, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close menu on navigation
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleSignOut = () => {
    onLogout();
    navigate("/");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
    setQuery("");
    setMenuOpen(false);
  };

  const navStyle = (path) => ({
    textDecoration: location.pathname === path ? "underline" : "none",
    color: "white",
    fontWeight: location.pathname === path ? "bold" : "normal"
  });

  const links = (
    <>
      <Link to={`/albums/users/${effectiveUsername}`} style={navStyle(`/albums/users/${effectiveUsername}`)}>Album Rankings</Link>
      <Link to={`/artists/users/${effectiveUsername}`} style={navStyle(`/artists/users/${effectiveUsername}`)}>Artist Rankings</Link>
      <Link to="/albums" style={navStyle("/albums")}>Albums</Link>
      <Link to="/artists" style={navStyle("/artists")}>Artists</Link>
      <Link to="/albums/new" style={navStyle("/albums/new")}>Add Album</Link>
      <Link to="/community" style={navStyle("/community")}>Community</Link>
      <Link to={`/users/${effectiveUsername}`} style={navStyle(`/users/${effectiveUsername}`)}>Profile</Link>
    </>
  );

  return (
    <div style={{ backgroundColor: "black", position: "relative", zIndex: 100 }}>
      <div
        className="top-nav"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "10px 16px",
          minHeight: "40px"
        }}
      >
        {isMobile ? (
          <>
            {/* Hamburger button */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                padding: "4px"
              }}
            >
              <span style={{ display: "block", width: "22px", height: "2px", backgroundColor: "white" }} />
              <span style={{ display: "block", width: "22px", height: "2px", backgroundColor: "white" }} />
              <span style={{ display: "block", width: "22px", height: "2px", backgroundColor: "white" }} />
            </button>

            {/* Search + sign out always visible */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
              <form onSubmit={handleSearch}>
                <input
                  type="text"
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ width: "140px" }}
                />
              </form>
              <button onClick={handleSignOut} style={{ color: "white", backgroundColor: "black", border: "1px solid white", cursor: "pointer" }}>
                Sign out
              </button>
            </div>
          </>
        ) : (
          <>
            {links}
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
          </>
        )}
      </div>

      {/* Dropdown menu */}
      {isMobile && menuOpen && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          backgroundColor: "black",
          display: "flex",
          flexDirection: "column",
          gap: "0",
          borderTop: "1px solid #333",
          zIndex: 99
        }}>
          {[
            { to: `/albums/users/${effectiveUsername}`, label: "Album Rankings" },
            { to: `/artists/users/${effectiveUsername}`, label: "Artist Rankings" },
            { to: "/albums", label: "Albums" },
            { to: "/artists", label: "Artists" },
            { to: "/albums/new", label: "Add Album" },
            { to: "/community", label: "Community" },
            { to: `/users/${effectiveUsername}`, label: "Profile" },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              style={{
                ...navStyle(to),
                padding: "14px 16px",
                borderBottom: "1px solid #222",
                fontSize: "16px"
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default TopNav;