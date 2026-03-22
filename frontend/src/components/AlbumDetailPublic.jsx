import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import AddSongForm from "./AddSongForm";

export default function AlbumDetailPublic({ user }) {
  const { albumId } = useParams();
  const navigate = useNavigate();

  const { username } = useParams();
  const effectiveUsername = username ?? user?.username;

  const [album, setAlbum] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editCover, setEditCover] = useState("");
  const [editReleaseDate, setEditReleaseDate] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editingSongId, setEditingSongId] = useState(null);

  const [genres, setGenres] = useState([]);
  const [allGenres, setAllGenres] = useState([]);
  const [genreInput, setGenreInput] = useState("");
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);

  const [followingReviews, setFollowingReviews] = useState([]);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchAlbum = async () => {
      try {
        const res = await api.get(`/albums/${albumId}`);
        setAlbum(res.data);
        setSongs(res.data.tracks || []);
        setGenres(res.data.genres || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlbum();
  }, [albumId]);

  useEffect(() => {
    if (album) {
      const formattedDate = album.releaseDate ? album.releaseDate.split("T")[0] : "";
      setEditReleaseDate(formattedDate);
      setEditTitle(album.title);
      setEditArtist(album.artist);
      setEditCover(prev => prev || album.coverArt || "");
    }
  }, [album]);

  useEffect(() => {
    if (!user || !albumId) return;
    api.get(`/albums/${albumId}/following-reviews`)
      .then(res => setFollowingReviews(res.data))
      .catch(err => console.error(err));
  }, [albumId, user]);

  useEffect(() => {
    if (isEditing && allGenres.length === 0) {
      api.get("/albums/genres/all").then(res => setAllGenres(res.data));
    }
  }, [isEditing]);

  const saveAlbumTitle = async () => {
    if (!editTitle.trim()) return;
    try {
      const res = await api.patch(`/albums/${albumId}/title`, { title: editTitle });
      setAlbum(res.data);
    } catch (err) { console.error(err); }
  };

  const saveAlbumArtist = async () => {
    if (!editArtist.trim()) return;
    try {
      const res = await api.patch(`/albums/${albumId}/artist`, { artist: editArtist });
      setAlbum(res.data);
    } catch (err) { console.error(err); }
  };

  const saveCover = async () => {
    const trimmedCover = editCover.trim();
    if (!trimmedCover || trimmedCover === album.coverArt) return;
    try {
      const res = await api.patch(`/albums/${albumId}/cover`, { cover: trimmedCover });
      setAlbum(res.data);
      setEditCover(res.data.coverArt || "");
    } catch (err) { console.error("Failed to update cover:", err); }
  };

  const saveSongTitle = async (song) => {
    if (!song.title.trim()) return;
    try {
      const res = await api.patch(`/songs/${song.id}/title`, { title: song.title });
      setSongs(prev => prev.map(s => s.id === song.id ? res.data : s));
      setEditingSongId(null);
    } catch (err) { console.error(err); }
  };

  const saveAlbumReleaseDate = async () => {
    if (!editReleaseDate) return;
    try {
      const res = await api.patch(`/albums/${albumId}/release-date`, { releaseDate: editReleaseDate });
      setAlbum(res.data);
    } catch (err) { console.error("Failed to update release date:", err); }
  };

  const saveTrackNum = async (song) => {
    if (!song.num || song.num < 1) return;
    try {
      await api.patch(`/songs/${song.id}/num`, { num: song.num });
    } catch (err) { console.error(err); }
  };

  const deleteSong = async (songId) => {
    if (!window.confirm("Delete this song?")) return;
    try {
      await api.delete(`/songs/${songId}`);
      setSongs(prev => prev.filter(s => s.id !== songId));
    } catch (err) { console.error(err); }
  };

  const handleRateClick = async () => {
    if (!user) { alert("Please log in to rate this album."); return; }
    try {
      const res = await api.post(`/albums/${album.id}/users/${effectiveUsername}`);
      navigate(`/albums/${res.data.id}/users/${effectiveUsername}`);
    } catch (err) {
      console.error(err);
      alert("Failed to submit rating.");
    }
  };

  const deleteAlbum = async () => {
    if (!window.confirm("Delete this album?")) return;
    try {
      await api.delete(`/albums/${albumId}`);
      navigate("/albums");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete album");
    }
  };

  if (loading) return <p>Loading album details...</p>;
  if (!album) return <p>Album not found.</p>;

  return (
    <div>
      {/* ===== Album Header ===== */}
      <div
        style={{
          position: "relative",
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
          {/* Cover */}
          <div>
            {album.coverArt && !isEditing && (
              <div
                style={{
                  position: "relative",
                  width: isMobile ? "150px" : "200px",
                  height: isMobile ? "150px" : "200px",
                  overflow: "hidden",
                  borderRadius: "12px"
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
                    height: "100%",
                    objectFit: "contain"
                  }}
                />
              </div>
            )}

            {isEditing && (
              <div style={{ marginTop: "8px" }}>
                <input
                  type="text"
                  placeholder="Cover image URL"
                  value={editCover}
                  onChange={e => setEditCover(e.target.value)}
                  onBlur={saveCover}
                  style={{ width: "200px" }}
                />
              </div>
            )}
          </div>

          {/* Right side info */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: isMobile ? "center" : "flex-start" }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? "1.75rem" : undefined, textAlign: isMobile ? "center" : undefined }}>
              {isEditing ? (
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={saveAlbumTitle}
                  onKeyDown={e => e.key === "Enter" && e.target.blur()}
                  style={{ fontStyle: "italic" }}
                />
              ) : (
                <i>{album.title}</i>
              )}
            </h1>
            <h2 style={{ margin: 0, textAlign: isMobile ? "center" : undefined }}>
              {isEditing ? (
                <input
                  value={editArtist}
                  onChange={e => setEditArtist(e.target.value)}
                  onBlur={saveAlbumArtist}
                  onKeyDown={e => e.key === "Enter" && e.target.blur()}
                />
              ) : (
                album.artistIds?.map((id, i) => (
                  <span key={id}>
                    <Link to={`/artists/${id}`} style={{ color: "white" }}>
                      {album.artist?.split(' & ')[i]}
                    </Link>
                    {i < album.artistIds.length - 1 && ", "}
                  </span>
                ))
              )}
            </h2>

            <h4 style={{ margin: 0 }}>
              Released{" "}
              {isEditing ? (
                <input
                  type="date"
                  value={editReleaseDate}
                  onChange={e => setEditReleaseDate(e.target.value)}
                  onBlur={saveAlbumReleaseDate}
                  style={{ marginLeft: "4px" }}
                />
              ) : (
                new Date(`${album.releaseDate.split("T")[0]}T12:00:00`).toLocaleDateString(
                  "en-US", { year: "numeric", month: "short", day: "numeric" }
                )
              )}
            </h4>

            {/* Genres */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", maxWidth: "400px", justifyContent: isMobile ? "center" : "flex-start" }}>
              {genres.map(g => (
                <span
                  key={g.id}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    borderRadius: "12px",
                    padding: "2px 10px",
                    fontSize: "0.8rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  {g.name}
                  {isEditing && (
                    <button
                      onClick={async () => {
                        const res = await api.delete(`/albums/${albumId}/genres/${g.id}`);
                        setGenres(res.data);
                      }}
                      style={{ background: "none", border: "none", color: "white", cursor: "pointer", padding: 0, fontSize: "0.75rem" }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}

              {isEditing && (
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Add genre..."
                    value={genreInput}
                    onChange={e => { setGenreInput(e.target.value); setShowGenreDropdown(true); }}
                    onFocus={() => setShowGenreDropdown(true)}
                    onBlur={() => setTimeout(() => setShowGenreDropdown(false), 300)}
                    onKeyDown={async e => {
                      if (e.key === "Enter" && genreInput.trim()) {
                        const matches = allGenres.filter(g =>
                          g.name.toLowerCase().includes(genreInput.toLowerCase()) &&
                          !genres.find(existing => existing.id === g.id)
                        );
                        const name = matches.length === 1 ? matches[0].name : genreInput.trim();
                        const res = await api.post(`/albums/${albumId}/genres`, { name });
                        setGenres(res.data);
                        setGenreInput("");
                        setShowGenreDropdown(false);
                      }
                    }}
                    style={{ fontSize: "0.8rem", padding: "2px 6px", borderRadius: "8px", width: "110px" }}
                  />
                  {showGenreDropdown && genreInput.trim() && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      background: "#222",
                      border: "1px solid #444",
                      borderRadius: "6px",
                      zIndex: 100,
                      maxHeight: "160px",
                      overflowY: "auto",
                      minWidth: "140px"
                    }}>
                      {allGenres
                        .filter(g =>
                          g.name.toLowerCase().includes(genreInput.toLowerCase()) &&
                          !genres.find(existing => existing.id === g.id)
                        )
                        .map(g => (
                          <div
                            key={g.id}
                            onClick={async () => {
                              const res = await api.post(`/albums/${albumId}/genres`, { name: g.name });
                              setGenres(res.data);
                              setGenreInput("");
                              setShowGenreDropdown(false);
                            }}
                            style={{ padding: "6px 10px", cursor: "pointer", fontSize: "0.85rem" }}
                          >
                            {g.name}
                          </div>
                        ))
                      }
                      {!allGenres.find(g => g.name.toLowerCase() === genreInput.toLowerCase()) && (
                        <div
                          onClick={async () => {
                            const res = await api.post(`/albums/${albumId}/genres`, { name: genreInput.trim() });
                            setGenres(res.data);
                            setGenreInput("");
                            setShowGenreDropdown(false);
                          }}
                          style={{ padding: "6px 10px", cursor: "pointer", fontSize: "0.85rem", borderTop: "1px solid #444", color: "#aaa" }}
                        >
                          Create "{genreInput}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <p style={{ margin: 0 }}>
              Average Score: {album.avgScore?.toFixed(1) || "0.0"} |{" "}
              {album.ratingCount ?? 0} rating{album.ratingCount !== 1 ? "s" : ""}
            </p>

            <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap", justifyContent: isMobile ? "center" : "flex-start" }}>
              <button
                onClick={() => { setIsEditing(e => !e); setEditingSongId(null); }}
                style={isEditing ? { backgroundColor: "green", color: "white", border: "none", borderRadius: "3px" } : {}}
              >
                {isEditing ? "Done editing" : "Edit album"}
              </button>

              {user && !isEditing && (
                <button
                  onClick={handleRateClick}
                  style={{ backgroundColor: "#1db954", color: "white", borderRadius: "5px", border: "none", fontWeight: "bold", cursor: "pointer" }}
                >
                  Rate album
                </button>
              )}
              {user && !isEditing && (
                <button onClick={() => api.post(`/users/${effectiveUsername}/listen-list/${album.id}`)}>
                  Add to Listen List
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Tracks ===== */}
      <h2>Tracklist</h2>

      <div style={{ overflowX: isMobile ? "auto" : "visible", width: isMobile ? "100%" : "auto" }}>
        <table style={{ width: isMobile ? "auto" : "100%", borderCollapse: "collapse", tableLayout: isMobile ? "auto" : "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: "30px" }}>#</th>
              <th style={{ textAlign: "left", maxWidth: isMobile ? "200px" : undefined }}>Title</th>
              <th>Rating</th>
              {isEditing && <th></th>}
            </tr>
          </thead>

          <tbody>
            {songs
              .slice()
              .sort((a, b) => a.num - b.num)
              .map(song => (
                <tr key={song.id}>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        min="1"
                        value={song.num}
                        style={{ width: "3rem" }}
                        onChange={e => setSongs(prev => prev.map(s => s.id === song.id ? { ...s, num: Number(e.target.value) } : s))}
                        onBlur={() => saveTrackNum(song)}
                      />
                    ) : song.num}
                  </td>

                  <td style={{ maxWidth: isMobile ? "300px" : undefined, whiteSpace: isMobile && !isEditing ? "nowrap" : undefined, overflow: isMobile && !isEditing ? "hidden" : undefined, textOverflow: isMobile && !isEditing ? "ellipsis" : undefined }}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={song.title}
                        autoFocus={editingSongId === song.id}
                        onChange={e => setSongs(prev => prev.map(s => s.id === song.id ? { ...s, title: e.target.value } : s))}
                        onBlur={() => saveSongTitle(song)}
                        onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingSongId(null); }}
                        onFocus={() => setEditingSongId(song.id)}
                      />
                    ) : (
                      <span>{song.title}</span>
                    )}
                  </td>

                  <td>{song.totalRatings > 0 ? `${song.notSkippedPercent}%` : "No ratings"}</td>

                  {isEditing && (
                    <td>
                      <button className="danger" onClick={() => deleteSong(song.id)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {isEditing && (
        <AddSongForm
          albumId={albumId}
          nextNum={songs.length + 1}
          onAdd={song => setSongs(prev => [...prev, song])}
        />
      )}

      {isEditing && Number(album.ratingCount) === 0 && (
        <button
          className="danger"
          onClick={deleteAlbum}
          style={{ backgroundColor: "red", color: "white", border: "none", borderRadius: "4px", padding: "4px 10px", cursor: "pointer" }}
        >
          Delete album
        </button>
      )}

      {user && followingReviews.length > 0 && (
        <>
          <h4>Reviews by others:</h4>
          <ul>
            {followingReviews.map(r => (
              <li key={r.id}>
                <Link to={`/albums/${albumId}/users/${r.username}`}>{r.username}</Link>{" "}
                — {Math.round(r.rating)} points
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}