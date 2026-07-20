import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import api from "../api/api";
import DefaultAvatar from "./DefaultAvatar";

function TopNav({ effectiveUsername, email, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [dropdownResults, setDropdownResults] = useState(null);
  const dropdownRef = useRef(null);
  const [pfp, setPfp] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

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

  useEffect(() => {
    api.get(`/users/${effectiveUsername}/pfp`).then(res => setPfp(res.data.pfp));
  }, [effectiveUsername]);

  useEffect(() => {
    const handler = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
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

  useEffect(() => {
    api.get("/notifications").then(res => setNotifications(res.data));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = () => {
    api.patch("/notifications/read-all");
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotif = (id) => {
    api.delete(`/notifications/${id}`);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const timeAgo = (date) => {
    const timestamp = new Date(date).getTime();
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  };

  // Add album form in header
  const [addAlbumOpen, setAddAlbumOpen] = useState(false);
  const [albumTitle, setAlbumTitle] = useState("");
  const [albumArtist, setAlbumArtist] = useState("");
  const [albumReleaseDate, setAlbumReleaseDate] = useState("");

  const handleAddAlbum = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/albums/new", { title: albumTitle, artist: albumArtist, releaseDate: albumReleaseDate });
      const album = { ...res.data, id: res.data.id ?? res.data.albumId };
      setAlbumTitle(""); setAlbumArtist(""); setAlbumReleaseDate("");
      setAddAlbumOpen(false);
      navigate(`/albums/${album.id}`);
    } catch (err) {
      console.error("Failed to add album:", err);
    }
  };

  const getNotifLink = (n) => {
    if (n.type === "recommendation") return `/albums/${n.album_id}`;
    if (n.type === "recommendation_rated") return `/albums/${n.album_id}/users/${n.from_username}`;
    if (n.type === "like" && n.album_id) return `/albums/${n.album_id}/users/${n.target_username ?? effectiveUsername}`;
    if (n.type === "reply") return `/albums/${n.album_id}/users/${n.target_username}`;
    if (n.album_id) return `/albums/${n.album_id}/users/${effectiveUsername}`;
    return `/users/${n.from_username}`;
  };

  const navClass = (path) =>
    `nav-link${location.pathname === path ? " nav-link-active" : ""}`;

  const links = (
    <>
      <Link to={`/albums/users/${effectiveUsername}`} className={navClass(`/albums/users/${effectiveUsername}`)}>Album Rankings</Link>
      <Link to={`/artists/users/${effectiveUsername}`} className={navClass(`/artists/users/${effectiveUsername}`)}>Artist Rankings</Link>
      <Link to="/albums" className={navClass("/albums")}>Albums</Link>
      <Link to="/artists" className={navClass("/artists")}>Artists</Link>
      <div style={{ position: "relative" }}
        onMouseEnter={() => setAddAlbumOpen(true)}
        onMouseLeave={() => setAddAlbumOpen(false)}
      >
        {(<Link to="/albums/new" className={navClass("/albums/new")}>Add Album</Link>)}
      </div>
      <Link to="/community" className={navClass("/community")}>Community</Link>
    </>
  );

  const profileMenu = (
    <div ref={profileMenuRef} style={{ position: "relative" }}>
      <button
        className="nav-avatar-btn"
        onClick={() => setProfileMenuOpen(o => !o)}
        aria-label="Profile menu"
      >
        {pfp ? (
          <img src={pfp} alt="" className="nav-avatar-img" />
        ) : (
          <DefaultAvatar size={28} />
        )}
      </button>

      {profileMenuOpen && (
        <div className="nav-profile-dropdown">
          <div className="nav-profile-name">{effectiveUsername}</div>
          <div className="nav-profile-email">{email}</div>
          <div className="nav-dropdown-sep" />
          <Link to={`/users/${effectiveUsername}`} className="nav-dropdown-item" onClick={() => setProfileMenuOpen(false)}>My Page</Link>
          <Link to={`/users/${effectiveUsername}/listen-list`} className="nav-dropdown-item" onClick={() => setProfileMenuOpen(false)}>Listen List</Link>
          <Link to="/community/recommendations" className="nav-dropdown-item" onClick={() => setProfileMenuOpen(false)}>Recommendations</Link>
          <div className="nav-dropdown-sep" />
          <button
            className="nav-dropdown-item nav-dropdown-item-btn"
            onClick={() => { setProfileMenuOpen(false); handleSignOut(); }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
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
                    className="nav-dropdown-item"
                    style={{ padding: "6px 12px" }}
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
              <div ref={notifRef} style={{ position: "relative" }}>
                <button
                  className="nav-bell"
                  onClick={() => {
                    setNotifOpen(o => !o);
                    if (!notifOpen) markAllRead();
                  }}
                >
                  🕭
                  {unreadCount > 0 && (
                    <span style={{
                      position: "absolute", top: "-4px", right: "-4px",
                      backgroundColor: "red", borderRadius: "50%",
                      width: "16px", height: "16px", fontSize: "10px",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div style={{
                    position: "absolute", top: "100%", right: 0,
                    backgroundColor: "#111", border: "1px solid #333",
                    borderRadius: "4px", zIndex: 200, width: "300px",
                    maxHeight: "400px", overflowY: "auto"
                  }}>
                    {notifications.length === 0
                      ? <div style={{ padding: "12px", color: "#999", fontSize: "13px" }}>No notifications</div>
                      : notifications.map(n => (
                        <div
                          key={n.id}
                          className="nav-notif-item"
                          style={{ backgroundColor: n.read ? "transparent" : "rgba(255,255,255,0.05)" }}
                        >
                          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", flex: 1 }}>
                            {n.from_pfp && (
                              <img src={n.from_pfp} alt="" style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                            )}
                            <Link
                              to={getNotifLink(n)}
                              onClick={() => setNotifOpen(false)}
                              style={{ fontSize: "13px", color: "white", flex: 1 }}
                            >
                              {n.message}
                              <div style={{ fontSize: "11px", color: "#999", marginTop: "2px" }}>
                                {timeAgo(n.created_at)}
                              </div>
                            </Link>
                          </div>
                          <button className="nav-notif-delete" onClick={() => deleteNotif(n.id)}>×</button>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
              <button onClick={handleSignOut} className="nav-signout">Sign out</button>
            </div>
          </>
        ) : (
          <>
            {profileMenu}
            <div className="nav-center-group">
            {links}
            {SearchBox}
            <div ref={notifRef} style={{ position: "relative" }}>
              <button
                className="nav-bell"
                onClick={() => {
                  setNotifOpen(o => !o);
                  if (!notifOpen) markAllRead();
                }}
              >
                🕭
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: "-4px", right: "-4px",
                    backgroundColor: "red", borderRadius: "50%",
                    width: "16px", height: "16px", fontSize: "10px",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div style={{
                  position: "absolute", top: "100%", right: 0,
                  backgroundColor: "#111", border: "1px solid #333",
                  borderRadius: "4px", zIndex: 200, width: "500px",
                  maxHeight: "400px", overflowY: "auto"
                }}>
                  {notifications.length === 0
                    ? <div style={{ padding: "12px", color: "#999", fontSize: "13px" }}>No notifications</div>
                    : notifications.map(n => (
                      <div
                        key={n.id}
                        className="nav-notif-item"
                        style={{ backgroundColor: n.read ? "transparent" : "rgba(255,255,255,0.05)" }}
                      >
                        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", flex: 1 }}>
                          {n.from_pfp && (
                            <img src={n.from_pfp} alt="" style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          )}
                          <Link
                            to={getNotifLink(n)}
                            onClick={() => setNotifOpen(false)}
                            style={{ fontSize: "13px", color: "white", flex: 1 }}
                          >
                            {n.message}
                            <div style={{ fontSize: "11px", color: "#999", marginTop: "2px" }}>
                              {timeAgo(n.created_at)}
                            </div>
                          </Link>
                        </div>
                        <button className="nav-notif-delete" onClick={() => deleteNotif(n.id)}>×</button>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
            </div>
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
              className={location.pathname === to ? "nav-mobile-link nav-mobile-link-active" : "nav-mobile-link"}
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