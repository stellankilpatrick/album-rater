import { useEffect, useState } from "react";
import api from "../api/api";
import { useParams, useNavigate, Link } from "react-router-dom";

export default function AlbumDetail({ user }) {
  const { albumId } = useParams();
  const navigate = useNavigate();

  const { username } = useParams();
  const effectiveUsername = username ?? user?.username;
  const isOwner = user?.username === effectiveUsername;

  const [album, setAlbum] = useState(null);
  const [songs, setSongs] = useState([]);

  const [ranks, setRanks] = useState({});
  const [genres, setGenres] = useState([]);

  const [focusedSongId, setFocusedSongId] = useState(null);

  const [review, setReview] = useState("");
  const [reviewFocused, setReviewFocused] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState("");
  const [recSent, setRecSent] = useState(false);

  useEffect(() => {
    if (user) api.get(`albums/${albumId}/users/${effectiveUsername}/mutuals`).then(res => setFriends(res.data));
  }, [user]);

  const sendRec = async () => {
    if (!selectedFriend) return;
    await api.post("/community/recommendations", { toUsername: selectedFriend, albumId });
    setRecSent(true);
  };

  const ordinal = n => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ---------------- fetch album ------------ */
  useEffect(() => {
    if (!effectiveUsername) return;

    api.get(`/albums/${albumId}/users/${effectiveUsername}`)
      .then(res => {
        setAlbum(res.data);
        setSongs(res.data.songs);
      })
      .catch(err => console.error(err));
  }, [albumId, effectiveUsername]);

  useEffect(() => {
    setAlbum(null);
    setSongs([]);
  }, [albumId]);

  useEffect(() => {
    if (album?.review) setReview(album.review);
  }, [album]);

  const handleRatingChange = (songId, newRating) => {
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, localRating: newRating } : s));
    api.patch(`/songs/${songId}/rating`, { rating: newRating })
      .then(res => {
        setSongs(prev => prev.map(s =>
          s.id === songId ? { ...s, localRating: newRating } : s
        ));
      })
      .catch(err => console.error("Failed to update rating:", err));
  };

  const handleDeleteAlbum = async () => {
    if (!window.confirm("Delete this album?")) return;
    try {
      await api.delete(`/albums/${album.id}/users/${effectiveUsername}`);
      navigate(`/albums/users/${effectiveUsername}`);
    } catch (err) {
      console.error("Failed to delete album:", err);
    }
  }

  const handleCommentChange = (songId, comment) => {
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, comment } : s));
  };

  const handleCommentBlur = (songId, comment) => {
    api.patch(`/songs/${songId}/comment`, { comment })
      .catch(err => console.error("Failed to update comment:", err));
  };

  const handleReviewBlur = () => {
    setReviewFocused(false);
    if (!review.trim()) return;
    api.patch(`/albums/${albumId}/review/users/${effectiveUsername}`, { review })
      .catch(err => console.error("Failed to update review:", err));
  };

  useEffect(() => {
    if (!albumId) return;
    api.get(`/albums/${albumId}/genres`)
      .then(res => setGenres(res.data))
      .catch(err => console.error(err));
  }, [albumId]);

  useEffect(() => {
    if (!album) return;
    api.get(`/albums/${albumId}/rank/overall/users/${effectiveUsername}`).then(r => setRanks(p => ({ ...p, overall: r.data })));
    api.get(`/albums/${albumId}/rank/year/users/${effectiveUsername}`).then(r => setRanks(p => ({ ...p, year: r.data })));
    api.get(`/albums/${albumId}/rank/decade/users/${effectiveUsername}`).then(r => setRanks(p => ({ ...p, decade: r.data })));
    api.get(`/albums/${albumId}/rank/artist/users/${effectiveUsername}`).then(r => setRanks(p => ({ ...p, artist: r.data })));
    genres.forEach(g => {
      api.get(`/albums/${albumId}/rank/genre/${encodeURIComponent(g.name)}/users/${effectiveUsername}`)
        .then(r => setRanks(p => ({ ...p, [`genre_${g.name}`]: r.data })));
    });
  }, [album, genres]);

  if (!album) return <div>Loading...</div>

  const goodSongs = songs.filter(s => s.localRating > 0).length;
  const ratedSongs = songs.filter(s => s.localRating !== null && s.localRating !== undefined).length;

  const reviewPanel = (
    <div style={{
      flexShrink: 0,
      width: isMobile ? "100%" : "575px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      zIndex: 3,
      ...(isMobile ? { padding: "0 16px 16px 0px" } : { marginLeft: "auto", marginTop: "16px" })
    }}>
      {isOwner ? (
        <>
          <textarea
            value={review}
            onChange={e => setReview(e.target.value)}
            onFocus={() => setReviewFocused(true)}
            onBlur={handleReviewBlur}
            placeholder="Write a review..."
            maxLength={500}
            style={{
              background: isMobile ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "8px",
              color: isMobile ? "#D3D3D3" : "white",
              padding: "8px",
              resize: "none",
              width: isMobile ? "100%" : "500px",
              height: isMobile ? "100px" : "150px",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
          {reviewFocused && (
            <span style={{ fontSize: "11px", color: review.length >= 500 ? "red" : "rgba(255,255,255,0.6)" }}>
              {review.length}/500
            </span>
          )}
        </>
      ) : (
        album?.review && (
          <p style={{ margin: isMobile ? 0 : "0 30px 0 0", fontSize: "13px", color: "white", fontStyle: "italic" }}>
            "{album.review}"
          </p>
        )
      )}
    </div>
  );

  return (
    <div>
      {/* ===== HEADER WITH BLUR ===== */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          overflow: "hidden",
          marginBottom: "20px",
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          marginTop: "-10px",
          color: "white"
        }}
      >
        {album.coverArt && (
          <img
            src={album.coverArt}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(40px)",
              transform: "scale(1.2)",
              opacity: 0.95
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.4))"
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: "20px",
            alignItems: isMobile ? "center" : "flex-start",
            padding: "24px"
          }}
        >
          {album.coverArt && (
            <div
              style={{
                position: "relative",
                width: isMobile ? "200px" : "220px",
                height: isMobile ? "200px" : "220px",
                overflow: "hidden",
                borderRadius: "12px",
                flexShrink: 0
              }}
            >
              <img
                src={album.coverArt}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "blur(24px)",
                  transform: "scale(1.15)",
                  opacity: 0.7
                }}
              />
              <img
                src={album.coverArt}
                alt={`${album.title} cover`}
                style={{
                  position: "relative",
                  width: "100%",
                  height: "auto",
                  objectFit: "contain"
                }}
              />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? "1.75rem" : undefined }}>
              <Link to={`/albums/${album.id}`} style={{ color: "white" }}>
                <i>{album.title}</i>
              </Link>
            </h1>
            <h2 style={{ margin: 0, fontSize: isMobile ? "1.25rem" : undefined }}>
              {album.artistIds?.map((id, i) => (
                <span key={id}>
                  <Link to={`/artists/${id}/users/${effectiveUsername}`} style={{ color: "white" }}>
                    {album.artist?.split(' & ')[i]}
                  </Link>
                  {i < album.artistIds.length - 1 && ", "}
                </span>
              ))}
            </h2>

            <h4 style={{ margin: 0 }}>
              Released {new Date(`${album.releaseDate.split("T")[0]}T12:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </h4>

            <h4 style={{ margin: 0 }}>
              {effectiveUsername === user?.username
                ? `Your likes: ${goodSongs} of ${ratedSongs} tracks`
                : `${effectiveUsername}'s likes: ${goodSongs} of ${ratedSongs} tracks`}
            </h4>

            {album.score10 != null && (
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                <h1 style={{ margin: 0, fontSize: isMobile ? "3rem" : "3.5rem" }}>{album.score10.toFixed(1)}</h1>
                {ranks.overall?.rank != null && (
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px" }}>
                    <strong style={{ fontSize: isMobile ? "18px" : "25px" }}>{ordinal(ranks.overall.rank)}</strong> of {ranks.overall.total} albums
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Review panel — inline on desktop, stacked on mobile */}
        {!isMobile && reviewPanel}
      </div>

      {/* Review panel stacked below header on mobile */}
      {isMobile && reviewPanel}

      {/* ===== TRACKLIST + SIDEBAR ===== */}
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: "32px",
        alignItems: "flex-start",
        paddingLeft: isMobile ? "0" : "10px"
      }}>

        {/* Tracklist — scrollable on mobile */}
        <div style={{ overflowX: isMobile ? "auto" : "visible", width: isMobile ? "100%" : "auto" }}>
          <table style={{ borderCollapse: "collapse", flex: "0 0 auto", tableLayout: "auto", width: isMobile ? "100%" : "auto" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", paddingRight: "12px", width: "30px" }}>#</th>
                <th style={{ textAlign: "left", paddingRight: "12px", minWidth: isMobile ? "250px" : undefined }}>Title</th>
                <th style={{ textAlign: "left" }}>Rating</th>
                <th style={{ textAlign: "left" }}>Comment</th>
              </tr>
            </thead>
            <tbody>
              {songs.map(song => (
                <tr key={song.id}>
                  <td style={{ paddingRight: "12px", width: "30px" }}>{song.num}</td>
                  <td style={{ paddingRight: "12px", maxWidth: isMobile ? "250px" : undefined, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {song.title}
                  </td>
                  <td style={{ paddingRight: "24px" }}>
                    <select
                      value={song.localRating ?? ""}
                      disabled={!isOwner}
                      onChange={
                        isOwner ? e => {
                          const value = e.target.value === "" ? null : Number(e.target.value);
                          handleRatingChange(song.id, value);
                        }
                          : undefined
                      }
                      style={{ color: isOwner ? "inherit" : "#333", background: isOwner ? "inherit" : "#f0f0f0" }}
                    >
                      <option value="">Interlude</option>
                      <option value={0}>- Skip</option>
                      <option value={1}>+ Play</option>
                      <option value={2}>++ Special</option>
                    </select>
                  </td>
                  <td style={{ wordBreak: "break-word" }}>
                    {isOwner ? (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <input
                          type="text"
                          value={song.comment ?? ""}
                          onChange={e => handleCommentChange(song.id, e.target.value)}
                          onBlur={e => { handleCommentBlur(song.id, e.target.value); setFocusedSongId(null); }}
                          onFocus={() => setFocusedSongId(song.id)}
                          placeholder="Add a note..."
                          maxLength={75}
                          style={{ border: "none", background: "transparent", width: isMobile ? "520px" : "520px", color: "#D3D3D3" }}
                        />
                        {focusedSongId === song.id && song.comment?.length > 0 && (
                          <span style={{ fontSize: "11px", color: song.comment?.length >= 75 ? "red" : "#999" }}>
                            {song.comment?.length}/75
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "#D3D3D3", fontSize: "13px" }}>{song.comment ?? ""}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px", flexShrink: 0, paddingLeft: isMobile ? "10px" : "0" }}>
          {/*Recommend album to friends */}
          {friends.length > 0 && user.username === effectiveUsername && (
            <div style={{ marginBottom: "-10px" }}>
              <select value={selectedFriend} onChange={e => { setSelectedFriend(e.target.value); setRecSent(false); }}>
                <option value="">Recommend to...</option>
                {friends.map(f => <option key={f.id} value={f.username}>{f.username}</option>)}
              </select>
              <button onClick={sendRec} disabled={!selectedFriend}>{recSent ? "Sent!" : "Send"}</button>
            </div>
          )}
          {/* RANKS */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "160px" }}>
            <h3 style={{ margin: 0 }}>Ranks</h3>
            {ranks.year?.rank != null && (
              <div style={{ fontSize: "16px" }}>
                <strong style={{ fontSize: "28px" }}>{ordinal(ranks.year.rank)} </strong>
                <span style={{ color: "#999" }}>of {ranks.year.total} <strong style={{ fontSize: "15px" }}>{album.releaseDate?.slice(0, 4)}</strong> albums</span>
              </div>
            )}
            {ranks.decade?.rank != null && (
              <div style={{ fontSize: "16px" }}>
                <strong style={{ fontSize: "28px" }}>{ordinal(ranks.decade.rank)} </strong>
                <span style={{ color: "#999" }}>of {ranks.decade.total} <strong style={{ fontSize: "15px" }}>{Math.floor(album.releaseDate?.slice(0, 4) / 10) * 10}s</strong> albums</span>
              </div>
            )}
            {Array.isArray(ranks.artist) && ranks.artist.map(a => a.rank != null && (
              <div key={a.name} style={{ fontSize: "16px" }}>
                <strong style={{ fontSize: "28px" }}>{ordinal(a.rank)} </strong>
                <span style={{ color: "#999" }}>of {a.total} <strong style={{ fontSize: "15px" }}>{a.name}</strong> albums</span>
              </div>
            ))}
            {genres.map(g => ranks[`genre_${g.name}`]?.rank != null && (
              <div key={g.name} style={{ fontSize: "16px" }}>
                <strong style={{ fontSize: "28px" }}>{ordinal(ranks[`genre_${g.name}`].rank)} </strong>
                <span style={{ color: "#999" }}>of {ranks[`genre_${g.name}`].total} <strong style={{ fontSize: "15px" }}>{g.name}</strong> albums</span>
              </div>
            ))}
          </div>

          {/* Sidebar: links + delete */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "160px" }}>
            <button style={{ minWidth: "30px", borderRadius: "4px" }}>
              <Link to={`/albums/${album.id}`} style={{ textDecoration: "none", fontSize: "14px" }}>
                All ratings of {album.title}
              </Link>
            </button>
            {album.artistIds?.map((id, i) => (
              <button style={{ minWidth: "30px", borderRadius: "4px" }}>
                <Link key={id} to={`/artists/${id}/users/${effectiveUsername}`} style={{ textDecoration: "none", fontSize: "14px" }}>
                  All albums by {album.artist?.split(' & ')[i]}
                </Link>
              </button>
            ))}
            {isOwner && (
              <button
                onClick={handleDeleteAlbum}
                style={{
                  backgroundColor: "red",
                  color: "white",
                  padding: "0.3rem 0.5rem",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  width: "fit-content"
                }}
              >
                Delete Album Rating
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}