import { useEffect, useState } from "react";
import api from "../api/api";
import AddSongForm from "./AddSongForm";
import { useParams, useNavigate, Link } from "react-router-dom";

export default function AlbumDetail({ user }) {
  const { albumId } = useParams();
  const navigate = useNavigate();

  const { username } = useParams();
  const effectiveUsername = username ?? user?.username;
  const isOwner = user?.username === effectiveUsername;

  const [album, setAlbum] = useState(null);
  const [songs, setSongs] = useState([]);

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

  // update song rating
  const handleRatingChange = (songId, newRating) => {
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, localRating: newRating } : s));

    // update backend
    api.patch(`/songs/${songId}/rating`, { rating: newRating })
      .then(res => {
        // update album rating in parent
        setSongs(prev => prev.map(s =>
          s.id === songId ? { ...s, localRating: newRating } : s
        ));
      })
      .catch(err => console.error("Failed to update rating:", err));
  };

  // delete album
  const handleDeleteAlbum = async () => {
    if (!window.confirm("Delete this album?")) return;

    try {
      await api.delete(`/albums/${album.id}/users/${effectiveUsername}`);
      navigate(`/albums/users/${effectiveUsername}`);
    } catch (err) {
      console.error("Failed to delete album:", err);
    }
  }

  if (!album) return <div>Loading...</div>

  const goodSongs = songs.filter(s => s.localRating > 0).length;
  const ratedSongs = songs.filter(s => s.localRating !== null && s.localRating !== undefined).length;

  return (
    <div>
      {/* ===== HEADER WITH BLUR ===== */}
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
            gap: "20px",
            alignItems: "flex-start",
            padding: "24px"
          }}
        >
          {album.coverArt && (
            <div
              style={{
                position: "relative",
                width: "200px",
                height: "200px",
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
                  height: "100%",
                  objectFit: "contain"
                }}
              />
            </div>
          )}

          {/* RIGHT: text — tighter spacing */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h1 style={{ margin: 0 }}>
              <i>{album.title} </i>
              <Link to={`/artists/${album.artistId}/users/${effectiveUsername}`} style={{ color: "white" }}>
                by {album.artist}
              </Link>
            </h1>

            <h4 style={{ margin: 0 }}>
              Released {new Date(`${album.releaseDate.split("T")[0]}T12:00:00`).toLocaleDateString(
                "en-US",
                { year: "numeric", month: "short", day: "numeric" }
              )}
            </h4>

            {album.score10 != null && (
              <h1 style={{ margin: 0, fontSize: "4rem" }}>
                {album.score10.toFixed(1)}
              </h1>
            )}

            <h4 style={{ margin: 0 }}>
              {effectiveUsername === user?.username
                ? `Your likes: ${goodSongs} of ${ratedSongs} tracks`
                : `${effectiveUsername}'s likes: ${goodSongs} of ${ratedSongs} tracks`
              }
            </h4>
          </div>
        </div>
      </div>

      {/* ===== TRACKLIST + SIDEBAR ===== */}
      <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>

        {/* Tracklist */}
        <ul style={{ flex: 1, margin: 0, padding: "0 0 0 10px", listStyle: "none" }}>
          {songs.map(song => (
            <div key={song.id}>
              {song.num}. {song.title} —{" "}
              <select
                value={song.localRating ?? ""}
                disabled={!isOwner}
                onChange={
                  isOwner
                    ? e => {
                        const value = e.target.value === "" ? null : Number(e.target.value);
                        handleRatingChange(song.id, value);
                      }
                    : undefined
                }
              >
                <option value="">Interlude</option>
                <option value={0}>Skip</option>
                <option value={1}>Good</option>
                <option value={2}>Great</option>
              </select>
            </div>
          ))}
        </ul>

        {/* Sidebar: links + delete */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "160px", marginTop: "4px" }}>
          <Link to={`/albums/${album.id}`} style={{ textDecoration: "none" }}>
            All ratings of {album.title}
          </Link>
          <Link to={`/artists/${album.artistId}/users/${effectiveUsername}`} style={{ textDecoration: "none" }}>
            All albums by {album.artist}
          </Link>
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
  );
}