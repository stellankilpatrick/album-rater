import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/api";
import Community from "./Community";

export default function Home({ user }) {
  const [anniversary, setAnniversary] = useState([]);

  useEffect(() => {
    if (!user) return;
    api.get("/community/albums")
      .then(res => setAnniversary(res.data || []))
      .catch(err => console.error("Failed to load anniversary albums:", err));
  }, [user]);

  return (
    <div style={{ padding: "32px" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "6px" }}>Welcome back, {user ? user.username : ""}</h1>

      {user ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: "24px",
          alignItems: "start",
          marginTop: "18px"
        }}>
          <section>
            <Community user={user} homeFeed />
            <div style={{ marginTop: "14px", textAlign: "center" }}>
              <Link to="/community"><button>See all activity</button></Link>
            </div>
          </section>

          {anniversary.length > 0 && (
            <section>
              <h2 style={{ marginTop: 0, marginBottom: "6px" }}>Released This Week In History</h2>
              <p style={{ color: "#bbb", marginTop: 0, marginBottom: "12px" }}>Consider re-listening!</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 140px)", gap: "20px", rowGap: "24px", justifyContent: "start", justifyItems: "start" }}>
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
            </section>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <Link to="/login"><button>Login</button></Link>
          <Link to="/register"><button>Sign Up</button></Link>
        </div>
      )}
    </div>
  );
}