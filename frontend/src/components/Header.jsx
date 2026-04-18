import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import api from "../api/api";

function TopNav({ effectiveUsername, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [dropdownResults, setDropdownResults] = useState(null);
  const dropdownRef = useRef(null);
  const [communityOpen, setCommunityOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (query.trim().length < 2) { setDropdownResults(null); return; }
    const timeout = setTimeout(() => {
      api.get(`/search?q=${encodeURIComponent(query)}`).then(res => {
        setDropdownResults(res.data);
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownResults(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = () => {
    onLogout();
    navigate("/");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
    setQuery("");
    setDropdownResults(null);
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
      <div
        style={{ position: "relative" }}
        onMouseEnter={() => setCommunityOpen(true)}
        onMouseLeave={() => setCommunityOpen(false)}
      >
        <Link to="/community" style={navStyle("/community")}>Community</Link>
        {communityOpen && (
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            backgroundColor: "#111",
            border: "1px solid #333",
            borderRadius: "4px",
            fontSize: "13px",
            zIndex: 200,
            minWidth: "180px",
            padding: "4px 0",
          }}>
            <Link
              to="/community"
              style={{ display: "block", padding: "8px 12px", color: "white" }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#222"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
            >
              Feed
            </Link>
            <Link
              to="/community/recommendations"
              style={{ display: "block", padding: "8px 12px", color: "white" }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#222"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
            >
              Recommendations
            </Link>
          </div>
        )}
      </div>      <Link to={`/users/${effectiveUsername}`} style={navStyle(`/users/${effectiveUsername}`)}>Profile</Link>
    </>
  );

  const SearchBox = (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: isMobile ? "140px" : undefined }}
        />
      </form>

      {dropdownResults && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          backgroundColor: "#111",
          border: "1px solid #333",
          borderRadius: "4px",
          zIndex: 200,
          minWidth: "250px",
          maxHeight: "400px",
          overflowY: "auto",
          padding: "8px 0"
        }}>
          {["albums", "artists", "users"].map(type => (
            dropdownResults[type]?.length > 0 && (
              <div key={type}>
                <div style={{ color: "#888", fontSize: "11px", padding: "4px 12px", textTransform: "uppercase" }}>{type}</div>
                {dropdownResults[type].map(item => (
                  <Link
                    key={item.id}
                    to={type === "albums" ? `/albums/${item.id}` : type === "artists" ? `/artists/${item.id}` : `/users/${item.username}`}
                    onClick={() => { setQuery(""); setDropdownResults(null); }}
                    style={{ display: "block", padding: "6px 12px", color: "white", textDecoration: "none" }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#222"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    {type === "albums" ? <><i>{item.title}</i> — {item.artist}</> : type === "artists" ? item.name : item.username}
                  </Link>
                ))}
              </div>
            )
          ))}
          {["albums", "artists", "users"].every(t => !dropdownResults[t]?.length) && (
            <div style={{ color: "#999", padding: "8px 12px" }}>No results</div>
          )}
        </div>
      )}
    </div>
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

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
              {SearchBox}
              <button onClick={handleSignOut} style={{ color: "white", backgroundColor: "black", border: "1px solid white", cursor: "pointer" }}>
                Sign out
              </button>
            </div>
          </>
        ) : (
          <>
            {links}
            <div style={{ marginLeft: "auto" }} />
            {SearchBox}
            <button onClick={handleSignOut} style={{ color: "white", backgroundColor: "black", border: "1px solid white", cursor: "pointer" }}>
              Sign out
            </button>
          </>
        )}
      </div>

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