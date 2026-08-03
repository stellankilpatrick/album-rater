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
  const [editSnapshot, setEditSnapshot] = useState(null);

  const [genres, setGenres] = useState([]);
  const [allGenres, setAllGenres] = useState([]);
  const [genreInput, setGenreInput] = useState("");
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);

  const [followingReviews, setFollowingReviews] = useState([]);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const [myReview, setMyReview] = useState(null);

  const [songSort, setSongSort] = useState("num");
  const [draftTrackNums, setDraftTrackNums] = useState({});

  useEffect(() => {
    if (!user || !albumId) return;
    api.get(`/albums/${albumId}/users/${user.username}`)
      .then(res => setMyReview(res.data))
      .catch(() => setMyReview(null));
  }, [albumId, user]);

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
      setEditCover(album.coverArt || "");
      setEditType(album.type || "album");
      setEditOfficial(Boolean(album.official));
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

  const saveSongFeatured = async (song) => {
    try {
      await api.patch(`/songs/${song.id}/featured`, { featured: song.featured ?? null });
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
    const draftValue = draftTrackNums[song.id];
    const nextNum = Number(draftValue);

    if (!Number.isInteger(nextNum) || nextNum < 1) {
      setDraftTrackNums(prev => {
        const updated = { ...prev };
        delete updated[song.id];
        return updated;
      });
      return;
    }

    try {
      const res = await api.patch(`/songs/${song.id}/num`, { num: nextNum });
      const updatedSongs = Array.isArray(res.data?.songs) ? res.data.songs : null;
      if (updatedSongs) {
        setSongs(updatedSongs.map(s => ({ ...s, num: s.num ?? s.track_number ?? 1 })));
      } else {
        setSongs(prev => prev.map(s => s.id === song.id ? { ...s, num: res.data?.song?.num ?? nextNum } : s));
      }
      setDraftTrackNums(prev => {
        const updated = { ...prev };
        delete updated[song.id];
        return updated;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSong = async (songId) => {
    if (!window.confirm("Delete this song?")) return;
    try {
      await api.delete(`/songs/${songId}`);
      setSongs(prev => prev.filter(s => s.id !== songId));
    } catch (err) { console.error(err); }
  };

  const [editType, setEditType] = useState("album");
  const [editOfficial, setEditOfficial] = useState(false);

  const saveAlbumType = async (typeToSave) => {
    try {
      const typeValue = typeToSave ?? editType;
      await api.patch(`/albums/${album.id}/type`, { type: typeValue });
      setAlbum(prev => ({ ...prev, type: typeValue }));
    } catch (err) {
      console.error("Failed to save album type:", err);
    }
  };

  const saveAlbumOfficial = async () => {
    try {
      await api.patch(`/albums/${album.id}/official`, { official: editOfficial });
      setAlbum(prev => ({ ...prev, official: editOfficial }));
    } catch (err) {
      console.error("Failed to save album official status:", err);
    }
  };

  const handleStartEditing = () => {
    setIsEditing(true);
    setEditingSongId(null);

    setEditType(album.type || "album");
    setEditOfficial(Boolean(album.official));

    setEditSnapshot({
      album: {
        ...album,
        title: editTitle,
        artist: editArtist,
        coverArt: editCover,
        releaseDate: editReleaseDate
      },
      songs: songs.map(song => ({ ...song })),
      genres: [...genres]
    });
  };

  const handleSaveChanges = async () => {
    try {
      if (editTitle.trim() && editTitle !== album?.title) {
        await saveAlbumTitle();
      }

      if (editArtist.trim() && editArtist !== album?.artist) {
        await saveAlbumArtist();
      }

      if (editReleaseDate && editReleaseDate !== (album?.releaseDate || "").split("T")[0]) {
        await saveAlbumReleaseDate();
      }

      const trimmedCover = editCover.trim();
      if (trimmedCover && trimmedCover !== album?.coverArt) {
        await saveCover();
      }

      if (editType !== album?.type) {
        await saveAlbumType(editType);
      }

      if (editOfficial !== Boolean(album?.official)) {
        await saveAlbumOfficial();
      }

      for (const song of songs) {
        const originalSong = editSnapshot?.songs?.find(s => s.id === song.id);
        if (!originalSong) continue;

        if (song.title?.trim() && song.title !== originalSong.title) {
          await api.patch(`/songs/${song.id}/title`, { title: song.title });
        }

        if ((song.featured ?? "") !== (originalSong.featured ?? "")) {
          await api.patch(`/songs/${song.id}/featured`, { featured: song.featured ?? null });
        }

        const draftValue = draftTrackNums[song.id];
        if (draftValue !== undefined) {
          const nextNum = Number(draftValue);
          if (Number.isInteger(nextNum) && nextNum >= 1) {
            await api.patch(`/songs/${song.id}/num`, { num: nextNum });
          }
        }
      }

      const refreshedRes = await api.get(`/albums/${albumId}`);
      setAlbum(refreshedRes.data);
      setSongs(refreshedRes.data.tracks || []);
      setGenres(refreshedRes.data.genres || []);
      setDraftTrackNums({});
      setEditingSongId(null);
      setIsEditing(false);
      setEditSnapshot(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelChanges = () => {
    if (editSnapshot) {
      setAlbum(editSnapshot.album);
      setSongs(editSnapshot.songs);
      setGenres(editSnapshot.genres);
      setEditTitle(editSnapshot.album?.title || "");
      setEditArtist(editSnapshot.album?.artist || "");
      setEditCover(editSnapshot.album?.coverArt || "");
      setEditReleaseDate(editSnapshot.album?.releaseDate ? editSnapshot.album.releaseDate.split("T")[0] : "");
    }

    setDraftTrackNums({});
    setEditingSongId(null);
    setIsEditing(false);
    setEditSnapshot(null);
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

  const displayedSongs = songs.slice().sort((a, b) => {
    if (songSort === "rating") {
      return (b.notSkippedPercent ?? 0) - (a.notSkippedPercent ?? 0);
    }
    return a.num - b.num;
  });

  const nextTrackNum = songs.reduce((max, song) => Math.max(max, Number(song.num) || 0), 0) + 1;

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
            padding: isEditing ? "24px 28px" : "24px"
          }}
        >
          {/* Cover */}
          <div>
            {album.coverArt && !isEditing && (
              <div
                style={{
                  position: "relative",
                  width: isMobile ? "150px" : "210px",
                  height: isMobile ? "150px" : "210px",
                  overflow: "hidden",
                  borderRadius: "8px"
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
              <div style={{ marginTop: "10px", padding: "10px 6px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px", width: "min(320px, 100%)" }}>
                <input
                  type="text"
                  placeholder="Cover image URL"
                  value={editCover}
                  onChange={e => setEditCover(e.target.value)}
                  onBlur={saveCover}
                  style={{ width: "100%", padding: "4px 8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.9)", color: "#222", boxSizing: "border-box" }}
                />
              </div>
            )}
          </div>

          {/* Right side info */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: isEditing ? "12px" : "10px",
              alignItems: isMobile ? "center" : "flex-start",
              width: isEditing ? "100%" : undefined,
              padding: isEditing ? "6px 0" : undefined
            }}
          >
            {isEditing ? (
              <select
                value={editType}
                onChange={e => setEditType(e.target.value)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: "rgba(255,255,255,0.12)",
                  color: "white",
                  fontSize: "1rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em"
                }}
              >
                <option value="album" style={{ color: "black" }}>Album</option>
                <option value="ep" style={{ color: "black" }}>EP</option>
                <option value="compilation" style={{ color: "black" }}>Compilation</option>
                <option value="soundtrack" style={{ color: "black" }}>Soundtrack</option>
                <option value="live album" style={{ color: "black" }}>Live Album</option>
              </select>
              ) : (
                !isMobile ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.9 }}>
                  <span style={{ color: "inherit" }}>{album.type ? (album.type.toUpperCase() === "EP" ? "EP" : album.type.charAt(0).toUpperCase() + album.type.slice(1)) : "Album"}</span>
                  <span style={{ color: "inherit", margin: "0 6px" }}>•</span>
                  <span style={{ color: "inherit", fontSize: "14px" }}>{new Date(`${album.releaseDate.split("T")[0]}T12:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
              ) : null
            )}

            <h1
              style={{
                margin: isEditing ? 0 : "0 0 -8px 0",
                fontSize: isMobile ? "2.2rem" : "3.2rem",
                textAlign: isMobile ? "center" : undefined,
                lineHeight: 1.1
              }}
            >
              {isEditing ? (
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={saveAlbumTitle}
                  onKeyDown={e => e.key === "Enter" && e.target.blur()}
                  style={{ fontStyle: "italic", padding: "4px 8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.12)", color: "white", width: "min(320px, 100%)", boxSizing: "border-box" }}
                />
              ) : (
                <span style={{ fontStyle: "normal" }}>{album.title}</span>
              )}
            </h1>
            <h2 style={{ margin: isEditing ? 0 : "0 0 -4px 0", textAlign: isMobile ? "center" : undefined, lineHeight: 1.2, fontWeight: "normal", fontSize: isMobile ? "14px" : "17px" }}>
              {isEditing ? (
                <input
                  value={editArtist}
                  onChange={e => setEditArtist(e.target.value)}
                  onBlur={saveAlbumArtist}
                  onKeyDown={e => e.key === "Enter" && e.target.blur()}
                  style={{ padding: "4px 8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.12)", color: "white", width: "min(300px, 100%)", boxSizing: "border-box" }}
                />
              ) : (
                  album.artistIds?.map((id, i) => (
                  <span key={id} style={{ fontWeight: "normal" }}>
                    <Link to={`/artists/${id}`} style={{ color: "white", fontWeight: "normal" }}>
                      {album.artist?.split(' & ')[i]}
                    </Link>
                    {i < album.artistIds.length - 1 && ", "}
                  </span>
                ))
              )}
            </h2>
            {isMobile && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", opacity: 0.85, marginTop: "2px", justifyContent: "center" }}>
                <div style={{ fontSize: "0.90rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "inherit" }}>
                  {album.type ? (album.type.toUpperCase() === "EP" ? "EP" : album.type.charAt(0).toUpperCase() + album.type.slice(1)) : "Album"}
                </div>
                <span style={{ color: "inherit", fontSize: "0.95rem" }}>•</span>
                <div style={{ fontSize: "0.90rem", color: "inherit" }}>
                  {new Date(`${album.releaseDate.split("T")[0]}T12:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </div>
              </div>
            )}

            {isEditing && (
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", cursor: "pointer", marginTop: "12px" }}>
                <input
                  type="checkbox"
                  checked={editOfficial}
                  onChange={e => {
                    // Prevent non-album/ep from being official
                    if (e.target.checked && !["album", "ep"].includes(editType)) {
                      return;
                    }
                    setEditOfficial(e.target.checked);
                  }}
                  onBlur={saveAlbumOfficial}
                />
                Official release
              </label>
            )}

            {/* Genres */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", maxWidth: "700px", justifyContent: isMobile ? "center" : "flex-start" }}>
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
                    style={{ fontSize: "0.8rem", padding: "2px 6px", borderRadius: "8px", width: "110px", border: "none" }}
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

            <p style={{ margin: isEditing ? 0 : "0 0 -4px 0", lineHeight: 1.4 }}>
              Average Score: {album.avgScore?.toFixed(1) || "0.0"} |{" "}
              {album.ratingCount ?? 0} rating{album.ratingCount !== 1 ? "s" : ""}
            </p>

            <div style={{ display: "flex", gap: "10px", marginTop: isEditing ? "10px" : "8px", flexWrap: "wrap", justifyContent: isMobile ? "center" : "flex-start" }}>
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveChanges}
                    style={{ backgroundColor: "green", color: "white", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: 600 }}
                  >
                    Save changes
                  </button>
                  <button
                    onClick={handleCancelChanges}
                    style={{ backgroundColor: "#666", color: "white", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: 600 }}
                  >
                    Cancel changes
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStartEditing}
                  style={{ borderRadius: "12px", border: "None", cursor: "pointer" }}
                >
                  Edit album
                </button>
              )}

              {user && !isEditing && (
                <button
                  onClick={handleRateClick}
                  style={{ backgroundColor: "#1db954", color: "white", borderRadius: "12px", border: "none", fontWeight: "bold", cursor: "pointer" }}
                >
                  Rate album
                </button>
              )}
              {user && !isEditing && (
                <button
                  onClick={(e) => {
                    api.post(`/users/${effectiveUsername}/listen-list/${album.id}`);
                    e.target.textContent = "Added to Listen List!";
                  }}
                  style={{ background: "#fbf0c5", borderRadius: "12px", border: "none" }}
                >
                  Add to Listen List
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
        {/* ===== Tracks ===== */}
        <div style={{ flex: 7 }}>
          <div style={{ overflowX: isMobile ? "auto" : "visible", width: isMobile ? "100%" : "auto" }}>
            <table style={{ width: isMobile ? "auto" : "100%", borderCollapse: "collapse", tableLayout: isMobile ? "auto" : "fixed", marginTop: isEditing ? "4px" : undefined }}>
              <thead>
                <tr>
                  <th style={{ width: isEditing ? "40px" : "30px", padding: isEditing ? "10px 8px" : undefined, textAlign: "left" }}>#</th>
                  <th style={{ textAlign: "left", maxWidth: isMobile ? "200px" : undefined, padding: isEditing ? "10px 8px" : undefined }}>Title</th>
                  {!isEditing && (
                    <th
                      onClick={() =>
                        setSongSort(prev => prev === "rating" ? "num" : "rating")
                      }
                      style={{ cursor: "pointer", userSelect: "none", padding: isEditing ? "10px 8px" : undefined }}
                    >
                      Rating {songSort === "rating" ? "↓" : ""}
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {displayedSongs.map(song => (
                  <tr key={song.id} style={{ lineHeight: isEditing ? 1 : 1.4 }}>
                    <td style={{ padding: isEditing ? "2px 8px" : undefined, verticalAlign: isEditing ? "top" : undefined }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          value={draftTrackNums[song.id] ?? song.num}
                          style={{ width: "3.2rem", padding: "3px 6px", borderRadius: "6px", border: "1px solid #555", textAlign: "center", boxSizing: "border-box" }}
                          onChange={e => setDraftTrackNums(prev => ({ ...prev, [song.id]: e.target.value }))}
                          onBlur={() => saveTrackNum(song)}
                          onKeyDown={e => {
                            if (e.key === "Enter") e.target.blur();
                            if (e.key === "Escape") {
                              setDraftTrackNums(prev => {
                                const updated = { ...prev };
                                delete updated[song.id];
                                return updated;
                              });
                            }
                          }}
                        />
                      ) : song.num}
                    </td>

                    <td style={{
                      padding: isEditing ? "2px 8px" : undefined,
                      verticalAlign: isEditing ? "top" : undefined,
                      minWidth: isMobile ? "270px" : undefined,
                      whiteSpace: isMobile && !isEditing ? "normal" : "normal",
                      overflow: isMobile && !isEditing ? "hidden" : undefined,
                      textOverflow: isMobile && !isEditing ? "ellipsis" : undefined,
                      wordBreak: "break-word"
                    }}>
                      {isEditing ? (
                        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "8px", width: "100%", alignItems: isMobile ? "stretch" : "center" }}>
                          <input
                            type="text"
                            value={song.title}
                            autoFocus={editingSongId === song.id}
                            onChange={e => setSongs(prev => prev.map(s => s.id === song.id ? { ...s, title: e.target.value } : s))}
                            onBlur={() => saveSongTitle(song)}
                            onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingSongId(null); }}
                            onFocus={() => setEditingSongId(song.id)}
                            style={{ flex: 1, padding: "3px 8px", borderRadius: "6px", border: "1px solid #ccc" }}
                          />
                          <input
                            type="text"
                            value={song.featured ?? ""}
                            placeholder="Featured artists"
                            onChange={e => setSongs(prev => prev.map(s => s.id === song.id ? { ...s, featured: e.target.value } : s))}
                            onBlur={() => saveSongFeatured(song)}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                e.target.blur();
                                // move focus to the next song's title input (if any)
                                const row = e.target.closest('tr');
                                if (row && row.nextElementSibling) {
                                  const nextTitle = row.nextElementSibling.querySelector('input[type="text"]');
                                  if (nextTitle) nextTitle.focus();
                                }
                              }
                            }}
                            style={{ flex: isMobile ? 1 : "0 1 220px", padding: "3px 8px", borderRadius: "6px", border: "1px solid #ccc" }}
                          />
                        </div>
                      ) : (
                        <span>{song.title}{song.featured ? <span style={{ fontSize: "0.8em", color: "#aaa" }}> (ft. {song.featured})</span> : ""}</span>
                      )}
                    </td>

                    {!isEditing && <td>{song.totalRatings > 0 ? `${song.notSkippedPercent}%` : "—"}</td>}

                    {isEditing && (
                      <td style={{ padding: isEditing ? "3px 8px" : undefined, verticalAlign: isEditing ? "top" : undefined }}>
                        <button className="danger" onClick={() => deleteSong(song.id)} style={{ marginLeft: "8px", padding: "6px 10px", borderRadius: "6px" }}>Delete</button>
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
              nextNum={nextTrackNum}
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
        </div>

        {!isMobile && (
          <div style={{ flex: 2 }}>
            {myReview?.score10 != null && myReview?.userRating != null && (
              <h3>
                <Link to={`/albums/${albumId}/users/${effectiveUsername}`}>
                  Your rating: {myReview.score10.toFixed(1)}
                </Link>
              </h3>
            )}

            {user && followingReviews.length > 0 && (
              <>
                <h3>Reviews by others:</h3>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {followingReviews.sort((a, b) => (b.score10 ?? -1) - (a.score10 ?? -1)).map(r => (
                    <li key={r.id}>
                      <Link to={`/albums/${albumId}/users/${r.username}`} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {r.pfp
                          ? <img src={r.pfp} alt={r.username} style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }} />
                          : <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#444" }} />
                        }
                        {r.username} <b>{r.score10 != null ? r.score10.toFixed(1) : "N/A"}</b>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {isMobile && (
        <div style={{ marginTop: "1.5rem" }}>
          {myReview?.score10 != null && myReview?.userRating != null && (
            <h3>
              <Link to={`/albums/${albumId}/users/${effectiveUsername}`}>
                Your rating: {myReview.score10.toFixed(1)}
              </Link>
            </h3>
          )}

          {user && followingReviews.length > 0 && (
            <>
              <h3>Reviews by others:</h3>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {followingReviews.sort((a, b) => (b.score10 ?? -1) - (a.score10 ?? -1)).map(r => (
                  <li key={r.id}>
                    <Link to={`/albums/${albumId}/users/${r.username}`} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {r.pfp
                        ? <img src={r.pfp} alt={r.username} style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }} />
                        : <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#444" }} />
                      }
                      {r.username} <b>{r.score10 != null ? r.score10.toFixed(1) : "N/A"}</b>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}