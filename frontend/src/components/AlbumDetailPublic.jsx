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

  const [followingReviews, setFollowingReviews] = useState([]);

  useEffect(() => {
    const fetchAlbum = async () => {
      try {
        const res = await api.get(`/albums/${albumId}`);
        setAlbum(res.data);
        setSongs(res.data.tracks || []);
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
      // Convert ISO timestamp to "YYYY-MM-DD" for the date input
      const formattedDate = album.releaseDate
        ? album.releaseDate.split("T")[0]  // <- this removes the time part
        : "";
      setEditReleaseDate(formattedDate);

      setEditTitle(album.title);
      setEditArtist(album.artist);
      setEditCover(prev => prev || album.coverArt || "");
    }
  }, [album]);

  // fetches album reviews from following
  useEffect(() => {
    if (!user || !albumId) return;

    api.get(`/albums/${albumId}/following-reviews`)
      .then(res => setFollowingReviews(res.data))
      .catch(err => console.error(err));
  }, [albumId, user]);

  const saveAlbumTitle = async () => {
    if (!editTitle.trim()) return;

    try {
      const res = await api.patch(`/albums/${albumId}/title`, {
        title: editTitle
      });
      setAlbum(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const saveAlbumArtist = async () => {
    if (!editArtist.trim()) return;

    try {
      const res = await api.patch(`/albums/${albumId}/artist`, {
        artist: editArtist
      });
      setAlbum(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const saveCover = async () => {
    const trimmedCover = editCover.trim();
    if (!trimmedCover) return;
    if (trimmedCover === album.coverArt) return; // don't re-save same value

    try {
      const res = await api.patch(`/albums/${albumId}/cover`, {
        cover: trimmedCover
      });
      setAlbum(res.data);
      setEditCover(res.data.coverArt || "");
    } catch (err) {
      console.error("Failed to update cover:", err);
    }
  };

  const saveSongTitle = async (song) => {
    if (!song.title.trim()) return;

    try {
      const res = await api.patch(`/songs/${song.id}/title`, {
        title: song.title
      });

      setSongs(prev =>
        prev.map(s => (s.id === song.id ? res.data : s))
      );
      setEditingSongId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const saveAlbumReleaseDate = async () => {
    if (!editReleaseDate) return;

    try {
      const res = await api.patch(`/albums/${albumId}/release-date`, {
        releaseDate: editReleaseDate
      });
      setAlbum(res.data);
    } catch (err) {
      console.error("Failed to update release date:", err);
    }
  };

  const saveTrackNum = async (song) => {
    if (!song.num || song.num < 1) return;

    try {
      await api.patch(`/songs/${song.id}/num`, { num: song.num });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSong = async (songId) => {
    if (!window.confirm("Delete this song?")) return;

    try {
      await api.delete(`/songs/${songId}`);
      setSongs(prev => prev.filter(s => s.id !== songId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRateClick = async () => {
    if (!user) {
      alert("Please log in to rate this album.");
      return;
    }

    try {
      const res = await api.post(
        `/albums/${album.id}/users/${effectiveUsername}`
      );

      // ALWAYS trust the backend id
      const ratedAlbumId = res.data.id;

      navigate(`/albums/${ratedAlbumId}/users/${effectiveUsername}`);
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
          width: "calc(100% + 32px)",
          marginLeft: "-16px",
          marginRight: "-16px",
          marginTop: "-10px",
          color: "white"
        }}
      >
        {/* blurred background */}
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

        {/* dark overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.4))"
          }}
        />

        {/* content */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            gap: "20px",
            alignItems: "flex-start",
            padding: "24px"
          }}
        >
          {/* Cover */}
          <div>
            {album.coverArt && !isEditing && (
              <div
                style={{
                  position: "relative",
                  width: "200px",
                  height: "200px",
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
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <h1 style={{ margin: 0 }}>
              {isEditing ? (
                <>
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onBlur={saveAlbumTitle}
                    onKeyDown={e => e.key === "Enter" && e.target.blur()}
                    style={{ fontStyle: "italic", marginRight: "6px" }}
                  />
                  {" "}by{" "}
                  <input
                    value={editArtist}
                    onChange={e => setEditArtist(e.target.value)}
                    onBlur={saveAlbumArtist}
                    onKeyDown={e => e.key === "Enter" && e.target.blur()}
                    style={{ marginLeft: "6px" }}
                  />
                </>
              ) : (
                <>
                  <i>{album.title}</i> by{" "}
                  <Link to={`/artists/${album.artistId}`}>
                    {album.artist}
                  </Link>
                </>
              )}
            </h1>

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
                  "en-US",
                  { year: "numeric", month: "short", day: "numeric" }
                )
              )}
            </h4>

            <p style={{ margin: 0 }}>
              Average Score: {album.avgScore?.toFixed(1) || "0.0"} |{" "}
              {album.ratingCount ?? 0} rating
              {album.ratingCount !== 1 ? "s" : ""}
            </p>

            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <button
                onClick={() => {
                  setIsEditing(e => !e);
                  setEditingSongId(null);
                }}
              >
                {isEditing ? "Done editing" : "Edit album"}
              </button>

              {user && !isEditing && (
                <button onClick={handleRateClick}>Rate album</button>
              )}

              {user && !isEditing && (
                <button
                  onClick={() =>
                    api.post(`/users/${effectiveUsername}/listen-list/${album.id}`)
                  }
                >
                  Add to Listen List
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Tracks ===== */}
      <h2>Tracklist</h2>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Rating</th>
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
                      onChange={e =>
                        setSongs(prev =>
                          prev.map(s =>
                            s.id === song.id
                              ? { ...s, num: Number(e.target.value) }
                              : s
                          )
                        )
                      }
                      onBlur={() => saveTrackNum(song)}
                    />
                  ) : (
                    song.num
                  )}
                </td>

                <td>
                  {isEditing ? (
                    <input
                      type="text"
                      value={song.title}
                      autoFocus={editingSongId === song.id}
                      onChange={e =>
                        setSongs(prev =>
                          prev.map(s =>
                            s.id === song.id
                              ? { ...s, title: e.target.value }
                              : s
                          )
                        )
                      }
                      onBlur={() => saveSongTitle(song)}
                      onKeyDown={e => {
                        if (e.key === "Enter") e.target.blur();
                        if (e.key === "Escape") setEditingSongId(null);
                      }}
                      onFocus={() => setEditingSongId(song.id)}
                    />
                  ) : (
                    <span>{song.title}</span>
                  )}
                </td>

                <td>
                  {song.totalRatings > 0
                    ? `${song.notSkippedPercent}%`
                    : "No ratings"}
                </td>

                <td>
                  {isEditing && (
                    <button className="danger" onClick={() => deleteSong(song.id)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {isEditing && (
        <AddSongForm
          albumId={albumId}
          nextNum={songs.length + 1}
          onAdd={song => setSongs(prev => [...prev, song])}
        />
      )}

      {isEditing && Number(album.ratingCount) === 0 && (
        <button className="danger" onClick={deleteAlbum}>
          Delete album
        </button>
      )}

      {user && followingReviews.length > 0 && (
        <>
          <h4>Reviewed by people you follow</h4>
          <ul>
            {followingReviews.map(r => (
              <li key={r.id}>
                <Link to={`/albums/${albumId}/users/${r.username}`}>
                  {r.username}
                </Link>{" "}
                — {Math.round(r.rating)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}