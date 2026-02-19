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
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        {/* LEFT: cover */}
        {album.coverArt && (
          <img
            src={album.coverArt}
            alt={`${album.title} cover`}
            style={{ maxWidth: "200px" }}
          />
        )}

        {/* RIGHT: text */}
        <div>
          <h1 style={{ marginTop: "0px" }}>
            <i>{album.title} </i>
            <Link to={`/artists/${album.artistId}/users/${effectiveUsername}`}>
              by {album.artist}
            </Link>
          </h1>

          <h4 style={{ marginTop: "4px", color: "#666" }}>
            {new Date(`${album.releaseDate.split("T")[0]}T12:00:00`).toLocaleDateString(
              "en-US",
              {
                year: "numeric",
                month: "short",
                day: "numeric"
              }
            )}
          </h4>

          {album.score10 != null && (
            <h1 style={{ marginTop: "12px" }}>
              {album.score10.toFixed(1)}
            </h1>
          )}

          <h4>
            {effectiveUsername === user?.username
              ? `Your likes: ${goodSongs} of ${ratedSongs} tracks`
              : `${effectiveUsername}'s likes: ${goodSongs} of ${ratedSongs} tracks`
            }
          </h4>
        </div>
      </div>

      <li>
        {songs.map(song => (
          <div key={song.id}>
            {song.num}. {song.title} —{" "}
            <select
              value={song.localRating ?? ""}
              disabled={!isOwner}
              onChange={
                isOwner
                  ? e => {
                    const value =
                      e.target.value === "" ? null : Number(e.target.value);
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
      </li>

      {isOwner && (
        <button
          onClick={handleDeleteAlbum}
          style={{
            marginTop: "1rem",
            backgroundColor: "red",
            color: "white",
            padding: "0.5rem 1rem",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Delete Album Rating
        </button>
      )}

      <div>
        <Link
          to={`/albums/${album.id}`}
          style={{ display: "inline-block", marginBottom: "1rem", textDecoration: "none" }}
        >
          All ratings of {album.title}
        </Link>

        <br />

        <Link
          to={`/artists/${album.artistId}/users/${effectiveUsername}`}
          style={{ display: "inline-block", marginBottom: "1rem", textDecoration: "none" }}
        >
          All albums by {album.artist}
        </Link>

      </div>

    </div>
  );
}