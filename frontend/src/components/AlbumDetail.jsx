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

  const [ranks, setRanks] = useState({});
  const [genres, setGenres] = useState([]);

  const [focusedSongId, setFocusedSongId] = useState(null);

  const ordinal = n => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

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

  const handleCommentChange = (songId, comment) => {
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, comment } : s));
  };

  const handleCommentBlur = (songId, comment) => {
    api.patch(`/songs/${songId}/comment`, { comment })
      .catch(err => console.error("Failed to update comment:", err));
  };

  // get genres
  useEffect(() => {
    if (!albumId) return;
    api.get(`/albums/${albumId}/genres`)
      .then(res => setGenres(res.data))
      .catch(err => console.error(err));
  }, [albumId]);

  // fetch ranks
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
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <h1 style={{ margin: 0 }}><i>{album.title}</i></h1>

            <h2 style={{ margin: 0 }}>
              <Link to={`/artists/${album.artistId}/users/${effectiveUsername}`} style={{ color: "white" }}>
                {album.artist}
              </Link>
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
                <h1 style={{ margin: 0, fontSize: "3.5rem" }}>{album.score10.toFixed(1)}</h1>
                {ranks.overall?.rank != null && (
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px" }}>
                    <strong style={{ fontSize: "25px" }}>{ordinal(ranks.overall.rank)}</strong> of {ranks.overall.total} albums
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== TRACKLIST + SIDEBAR ===== */}
      <div style={{ display: "flex", gap: "32px", alignItems: "flex-start", paddingLeft: "10px" }}>

        {/* Tracklist */}
        <table style={{ borderCollapse: "collapse", flex: "0 0 auto" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", paddingRight: "12px", width: "30px" }}>#</th>
              <th style={{ textAlign: "left", paddingRight: "12px" }}>Title</th>
              <th style={{ textAlign: "left" }}>Rating</th>
              <th style={{ textAlign: "left" }}>Comment</th>
            </tr>
          </thead>
          <tbody>
            {songs.map(song => (
              <tr key={song.id}>
                <td style={{ paddingRight: "12px", width: "30px" }}>{song.num}</td>
                <td style={{ paddingRight: "12px" }}>{song.title}</td>
                <td style={{ paddingRight: "24px" }}>
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
                        style={{ border: "none", background: "transparent", width: "520px" }}
                      />
                      {focusedSongId === song.id && song.comment?.length > 0 && (
                        <span style={{ fontSize: "11px", color: song.comment?.length >= 75 ? "red" : "#999" }}>
                          {song.comment?.length}/75
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: "#666", fontSize: "13px" }}>{song.comment ?? ""}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* RANKS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "160px", marginTop: "4px", flexShrink: 0 }}>
          <h3 style={{ margin: 0 }}>Ranks</h3>
          {ranks.year?.rank != null && (
            <div style={{ fontSize: "13px" }}>
              <strong style={{ fontSize: "18px" }}>{ordinal(ranks.year.rank)} </strong>
              <span style={{ color: "#666" }}>of {ranks.year.total} <strong style={{ fontSize: "15px" }}>{album.releaseDate?.slice(0, 4)}</strong> albums</span>
            </div>
          )}
          {ranks.decade?.rank != null && (
            <div style={{ fontSize: "13px" }}>
              <strong style={{ fontSize: "18px" }}>{ordinal(ranks.decade.rank)} </strong>
              <span style={{ color: "#666" }}>of {ranks.decade.total} <strong style={{ fontSize: "15px" }}>{Math.floor(album.releaseDate?.slice(0, 4) / 10) * 10}s</strong> albums</span>
            </div>
          )}
          {ranks.artist?.rank != null && (
            <div style={{ fontSize: "13px" }}>
              <strong style={{ fontSize: "18px" }}>{ordinal(ranks.artist.rank)} </strong>
              <span style={{ color: "#666" }}>of {ranks.artist.total} <strong style={{ fontSize: "15px" }}>{album.artist}</strong> albums</span>
            </div>
          )}
          {genres.map(g => ranks[`genre_${g.name}`]?.rank != null && (
            <div key={g.name} style={{ fontSize: "13px" }}>
              <strong style={{ fontSize: "18px" }}>{ordinal(ranks[`genre_${g.name}`].rank)} </strong>
              <span style={{ color: "#666" }}>of {ranks[`genre_${g.name}`].total} <strong style={{ fontSize: "15px" }}>{g.name}</strong> albums</span>
            </div>
          ))}
        </div>

        {/* Sidebar: links + delete */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "160px", marginTop: "4px", flexShrink: 0 }}>
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
    </div >
  );
}