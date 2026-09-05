import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/api";

export default function Home({ user }) {
  const [recent, setRecent] = useState([]);
  const [anniversary, setAnniversary] = useState([]);

  useEffect(() => {
    if (!user) return;
    // fetch recent community activity (friends) and show latest 6
    Promise.all([
      api.get("/community"),
      api.get("/community/albums")
    ]).then(([feedRes, annRes]) => {
      setRecent((feedRes.data || []).slice(0, 6));
      setAnniversary(annRes.data || []);
    }).catch(() => {});
  }, [user]);

  return (
    <div style={{ padding: "32px" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "6px" }}>Welcome back, {user ? user.username : ""}</h1>
      <p style={{ color: "#bbb", marginTop: 0 }}>Here's what's new from people you follow</p>

      {user ? (
        <>
          {recent.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", marginTop: "18px" }}>
                {recent.map(item => (
                  <Link key={`${item.username}-${item.album_id}-${item.updated_at}`} to={`/albums/${item.album_id}/users/${item.username}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ textAlign: "center" }}>
                      <img src={item.coverArt || item.album_cover || ""} alt={item.album_title} style={{ width: "96px", height: "96px", objectFit: "cover", borderRadius: "6px", display: "block", margin: "0 auto" }} />
                      <div style={{ fontSize: "13px", fontWeight: 500, marginTop: "6px" }}>
                        <i>{item.album_title}</i>
                      </div>
                      <div style={{ fontSize: "12px", color: "#888" }}>{item.username}</div>
                    </div>
                  </Link>
                ))}
            </div>
          ) : (
            <p style={{ color: "#999", marginTop: "12px" }}>No recent activity from your friends yet.</p>
          )}

          <div style={{ marginTop: "14px", textAlign: "center" }}>
            <Link to="/community"><button>See all activity</button></Link>
          </div>

          {anniversary.length > 0 && (
            <div style={{ marginTop: "28px" }}>
              <h3 style={{ marginBottom: "6px" }}>Released This Week In History</h3>
              <p style={{ color: "#bbb", marginTop: 0, marginBottom: "12px" }}>Consider re-listening!</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 120px)", gap: "28px", rowGap: "30px", justifyContent: "start", justifyItems: "start" }}>
                {anniversary.map(album => (
                  <Link key={album.id} to={`/albums/${album.id}/me`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ textAlign: "center" }}>
                      <img src={album.coverArt} alt={album.title} style={{ width: "140px", height: "140px", objectFit: "cover", borderRadius: "6px", display: "block", margin: "0 auto" }} />
                      <div style={{ fontSize: "13px", fontWeight: 500, marginTop: "6px" }}>
                        <i>{album.title}</i>
                      </div>
                      <div style={{ fontSize: "12px", color: "#666" }}>{album.artist}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <Link to="/login"><button>Login</button></Link>
          <Link to="/register"><button>Sign Up</button></Link>
        </div>
      )}
    </div>
  );
}