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
  const [pendingSongs, setPendingSongs] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  const [ranks, setRanks] = useState({});
  const [genres, setGenres] = useState([]);

  const [focusedSongId, setFocusedSongId] = useState(null);

  const [review, setReview] = useState("");
  const [pendingReview, setPendingReview] = useState("");
  const [reviewFocused, setReviewFocused] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState("");
  const [recSent, setRecSent] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [replyingTo, setReplyingTo] = useState(null); // comment id
  const [replyInput, setReplyInput] = useState("");

  const [untracked, setUntracked] = useState(false);

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

  useEffect(() => {
    if (album?.untracked != null) setUntracked(album.untracked);
  }, [album]);

  const toggleUntracked = async () => {
    const newVal = !untracked;
    await api.patch(`/albums/${albumId}/users/${effectiveUsername}/untracked`, { untracked: newVal });
    setUntracked(newVal);
  };

  useEffect(() => {
    if (!effectiveUsername) return;
    api.get(`/albums/${albumId}/users/${effectiveUsername}`)
      .then(res => {
        setAlbum(res.data);
        setSongs(res.data.songs);
        setPendingSongs(res.data.songs);
      })
      .catch(err => console.error(err));
  }, [albumId, effectiveUsername]);

  useEffect(() => {
    setAlbum(null);
    setSongs([]);
    setPendingSongs([]);
    setHasChanges(false);
  }, [albumId]);

  useEffect(() => {
    if (album?.review) {
      setReview(album.review);
      setPendingReview(album.review);
    }
  }, [album]);

  const handleLikeComment = async (commentId, likedByMe) => {
    if (likedByMe) {
      const res = await api.delete("/likes", { data: { targetType: "review_comment", targetId: commentId } });
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, like_count: res.data.count, liked_by_me: false } : c));
    } else {
      const res = await api.post("/likes", { targetType: "review_comment", targetId: commentId });
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, like_count: res.data.count, liked_by_me: true } : c));
    }
  };

  const handlePostReply = async (parentId) => {
    if (!replyInput.trim()) return;
    const res = await api.post(`/albums/${albumId}/users/${effectiveUsername}/comments`, {
      content: replyInput,
      parentId
    });
    setComments(prev => [...prev, res.data]);
    setReplyInput("");
    setReplyingTo(null);
  };

  // split into top-level and replies
  const topLevel = comments.filter(c => !c.parent_id);
  const replies = comments.filter(c => c.parent_id);

  const handleRatingChange = (songId, newRating) => {
    setPendingSongs(prev => prev.map(s => s.id === songId ? { ...s, localRating: newRating } : s));
    setHasChanges(true);
  };

  const handleCommentChange = (songId, comment) => {
    setPendingSongs(prev => prev.map(s => s.id === songId ? { ...s, comment } : s));
    setHasChanges(true);
  };

  const handleReviewChange = (val) => {
    setPendingReview(val);
    setHasChanges(true);
  };

  const handleSaveRating = async () => {
    if (!window.confirm("Are you sure you want to save your changes?")) return;

    try {
      // Save all song ratings
      for (const song of pendingSongs) {
        const original = songs.find(s => s.id === song.id);
        if (original?.localRating !== song.localRating) {
          await api.patch(`/songs/${song.id}/rating`, { rating: song.localRating ?? null });
        }
        if (original?.comment !== song.comment) {
          await api.patch(`/songs/${song.id}/comment`, { comment: song.comment });
        }
      }

      // Save review
      if (pendingReview !== review && pendingReview.trim()) {
        await api.patch(`/albums/${albumId}/review/users/${effectiveUsername}`, { review: pendingReview });
      }

      setSongs(pendingSongs);
      setReview(pendingReview);
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save ratings:", err);
    }
  };

  const handleDeleteAlbum = async () => {
    if (!window.confirm("Delete this album?")) return;
    try {
      await api.delete(`/albums/${album.id}/users/${effectiveUsername}`);
      navigate(`/albums/users/${effectiveUsername}`);
    } catch (err) {
      console.error("Failed to delete album:", err);
    }
  };

  const [reviewLikes, setReviewLikes] = useState({ count: 0, likedByMe: false, ratingId: null });

  // after album loads
  useEffect(() => {
    if (!album?.ratingId) return;
    api.get(`/likes/status?targetType=album_review&targetId=${album.ratingId}`)
      .then(res => setReviewLikes({ ...res.data, ratingId: album.ratingId }));
  }, [album]);

  useEffect(() => {
    if (!albumId || !effectiveUsername) return;
    api.get(`/albums/${albumId}/users/${effectiveUsername}/comments`)
      .then(res => setComments(res.data))
      .catch(err => console.error(err));
  }, [albumId, effectiveUsername]);

  const handlePostComment = async () => {
    if (!commentInput.trim()) return;
    const res = await api.post(`/albums/${albumId}/users/${effectiveUsername}/comments`, { content: commentInput });
    setComments(prev => [...prev, res.data]);
    setCommentInput("");
  };

  const handleDeleteComment = async (commentId) => {
    await api.delete(`/albums/${albumId}/users/${effectiveUsername}/comments/${commentId}`);
    setComments(prev => prev.filter(c => c.id !== commentId));
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

  if (!album) return <div>Loading...</div>;

  const goodSongs = pendingSongs.filter(s => s.localRating > 0).length;
  const ratedSongs = pendingSongs.filter(s => s.localRating !== null && s.localRating !== undefined).length;

  const reviewPanel = (
    <div style={{
      flexShrink: 0,
      width: isMobile ? "100%" : "650px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      zIndex: 3,
      padding: isMobile ? "0 16px 16px 0px" : "8px 32px 8px 8px",
      marginLeft: isMobile ? undefined : "auto",
      marginTop: isMobile ? undefined : "16px"
    }}>
      {isOwner ? (
        <>
          <textarea
            value={pendingReview}
            onChange={e => handleReviewChange(e.target.value)}
            onFocus={() => setReviewFocused(true)}
            onBlur={() => setReviewFocused(false)}
            placeholder="Write a review..."
            maxLength={500}
            style={{
              background: isMobile ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "8px",
              color: isMobile ? "#D3D3D3" : "white",
              padding: "8px",
              resize: "none",
              width: isMobile ? "100%" : "625px",
              height: isMobile ? "100px" : "150px",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
          {reviewFocused && (
            <span style={{ fontSize: "11px", color: pendingReview.length >= 500 ? "red" : "rgba(255,255,255,0.6)" }}>
              {pendingReview.length}/500
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
      <div style={{
        position: "relative",
        zIndex: 2,
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        overflow: "hidden",
        marginBottom: "20px",
        width: "100wv",
        marginLeft: "calc(-1 * (100vw - 100%) / 2)",
        marginRight: "calc(-1 * (100vw - 100%) / 2)",
        marginTop: "-10px",
        color: "white"
      }}>
        {album.coverArt && (
          <img src={album.coverArt} alt="" style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", filter: "blur(40px)", transform: "scale(1.2)", opacity: 0.95
          }} />
        )}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.4))"
        }} />
        <div style={{
          position: "relative", zIndex: 2, display: "flex",
          flexDirection: isMobile ? "column" : "row", gap: "20px",
          alignItems: isMobile ? "center" : "flex-start", padding: "24px"
        }}>
          {album.coverArt && (
            <div style={{
              position: "relative", width: isMobile ? "200px" : "220px",
              height: isMobile ? "200px" : "220px", overflow: "hidden",
              borderRadius: "12px", flexShrink: 0
            }}>
              <img src={album.coverArt} alt="" style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover", filter: "blur(24px)", transform: "scale(1.15)", opacity: 0.7
              }} />
              <img src={album.coverArt} alt={`${album.title} cover`} style={{
                position: "relative", width: "100%", height: "auto", objectFit: "contain"
              }} />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? "1.75rem" : undefined }}>
              <Link to={`/albums/${album.id}`} style={{ color: "white" }}><i>{album.title}</i></Link>
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
                : <Link to={`/users/${effectiveUsername}`} style={{ color: "white" }}>
                  {`${effectiveUsername}'s likes: ${goodSongs} of ${ratedSongs} tracks`}
                </Link>
              }
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
        <div style={{ position: "relative", zIndex: 3, color: "white", flexShrink: 0, marginLeft: "auto" }}>
          {!isMobile && (
            <div style={{ position: "relative" }}>
              {album?.ratingId && (
                <div style={{ position: "absolute", top: "8px", right: "8px", zIndex: 4 }}>
                  {!isOwner ? (
                    <button
                      onClick={async () => {
                        if (reviewLikes.likedByMe) {
                          const res = await api.delete("/likes", { data: { targetType: "album_review", targetId: reviewLikes.ratingId } });
                          setReviewLikes(prev => ({ ...prev, count: res.data.count, likedByMe: false }));
                        } else {
                          const res = await api.post("/likes", { targetType: "album_review", targetId: reviewLikes.ratingId });
                          setReviewLikes(prev => ({ ...prev, count: res.data.count, likedByMe: true }));
                        }
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: reviewLikes.likedByMe ? "#e0245e" : "white", fontSize: "24px" }}
                    >
                      ❤︎ {reviewLikes.count}
                    </button>
                  ) : (
                    <span style={{ color: "white", fontSize: "22px" }}>❤︎ {reviewLikes.count}</span>
                  )}
                </div>
              )}
              {reviewPanel}
            </div>
          )}
        </div>
      </div>

      {isMobile && reviewPanel}

      {/* ===== TRACKLIST + SIDEBAR ===== */}
      <div style={{
        display: "flex", flexDirection: isMobile ? "column" : "row",
        gap: "32px", alignItems: "flex-start", paddingLeft: isMobile ? "0" : "10px"
      }}>
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
              {pendingSongs.map(song => (
                <tr key={song.id}>
                  <td style={{ paddingRight: "12px", width: "30px" }}>{song.num}</td>
                  <td style={{ paddingRight: "12px", maxWidth: isMobile ? "250px" : undefined, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {song.title}{song.featured ? <span style={{ fontSize: "0.8em", color: "#aaa" }}> (ft. {song.featured})</span> : ""}
                  </td>
                  <td style={{ paddingRight: "24px" }}>
                    <select
                      value={song.localRating ?? ""}
                      disabled={!isOwner}
                      onChange={isOwner ? e => {
                        const value = e.target.value === "" ? null : Number(e.target.value);
                        handleRatingChange(song.id, value);
                      } : undefined}
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
                          onFocus={() => setFocusedSongId(song.id)}
                          onBlur={() => setFocusedSongId(null)}
                          placeholder="Add a note..."
                          maxLength={75}
                          style={{ border: "none", background: "transparent", width: "520px", color: "#D3D3D3" }}
                        />
                      </div>
                    ) : (
                      <span style={{ color: "#D3D3D3", fontSize: "13px" }}>{song.comment ?? ""}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {isOwner && hasChanges && (
            <button
              onClick={handleSaveRating}
              style={{
                marginTop: "16px",
                backgroundColor: "#1db954",
                color: "white",
                border: "none",
                borderRadius: "3px",
                padding: "8px 8px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Save Rating
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px", flexShrink: 0, paddingLeft: isMobile ? "10px" : "0" }}>
          {friends.length > 0 && user.username === effectiveUsername && (
            <div style={{ marginBottom: "-10px" }}>
              <select value={selectedFriend} onChange={e => { setSelectedFriend(e.target.value); setRecSent(false); }}>
                <option value="">Recommend to...</option>
                {friends.map(f => <option key={f.id} value={f.username}>{f.username}</option>)}
              </select>
              <button onClick={sendRec} disabled={!selectedFriend}>{recSent ? "Sent!" : "Send"}</button>
            </div>
          )}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "160px" }}>
            <button style={{ minWidth: "30px", borderRadius: "4px" }}>
              <Link to={`/albums/${album.id}`} style={{ textDecoration: "none", fontSize: "14px" }}>
                All ratings of <i>{album.title}</i>
              </Link>
            </button>
            {album.artistIds?.map((id, i) => (
              <button key={id} style={{ minWidth: "30px", borderRadius: "4px" }}>
                <Link to={`/artists/${id}/users/${effectiveUsername}`} style={{ textDecoration: "none", fontSize: "14px" }}>
                  All albums by {album.artist?.split(' & ')[i]}
                </Link>
              </button>
            ))}
            {isOwner && (
              <button onClick={handleDeleteAlbum} style={{
                backgroundColor: "red", color: "white", padding: "0.3rem 0.5rem",
                border: "none", borderRadius: "4px", cursor: "pointer", width: "fit-content"
              }}>
                Delete Album Rating
              </button>
            )}
            {isOwner && (
              <button
                onClick={toggleUntracked}
                title={untracked ? "Click to track this album" : "Click to hide from activity feed"}
                style={{ borderRadius: "4px", cursor: "pointer", width: "fit-content", background: untracked ? "grey" : "white" }}
              >
                {untracked ? "Untracked" : "Tracked"}
              </button>
            )}
          </div>
        </div>
      </div>
      {/* ===== COMMENTS ===== */}
      <div style={{ marginBottom: "24px", maxWidth: "600px" }}>
        <h3 style={{ marginBottom: "8px" }}>Comments</h3>
        {comments.length === 0 && <div style={{ color: "#999", fontSize: "13px" }}>No comments yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
          {topLevel.map(c => (
            <div key={c.id}>
              {/* existing comment JSX, just add a Reply button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "6px", padding: "8px 12px" }}>
                <div style={{ flex: 1 }}>
                  <Link to={`/users/${c.username}`} style={{ fontWeight: "bold", fontSize: "13px" }}>{c.username}</Link>
                  <span style={{ fontSize: "11px", color: "#999", marginLeft: "8px" }}>
                    {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <div style={{ fontSize: "13px", marginTop: "2px" }}>{c.content}</div>
                  {user && (
                    <button
                      onClick={() => { setReplyingTo(replyingTo === c.id ? null : c.id); setReplyInput(""); }}
                      style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "12px", padding: "4px 0 0 0" }}
                    >
                      {replyingTo === c.id ? "Cancel" : "Reply"}
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "8px", flexShrink: 0 }}>
                  {c.username !== user?.username ? (
                    <button
                      onClick={() => handleLikeComment(c.id, c.liked_by_me)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: c.liked_by_me ? "#e0245e" : "#999", fontSize: "13px", padding: 0 }}
                    >
                      ❤︎ {Number(c.like_count)}
                    </button>
                  ) : (
                    Number(c.like_count) > 0 && <span style={{ color: "#999", fontSize: "13px" }}>❤︎ {Number(c.like_count)}</span>
                  )}
                  {(c.username === user?.username || isOwner) && (
                    <button
                      onClick={() => handleDeleteComment(c.id)}
                      style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "16px", padding: 0 }}
                    >×</button>
                  )}
                </div>
              </div>

              {/* Reply input */}
              {replyingTo === c.id && (
                <div style={{ display: "flex", gap: "8px", marginTop: "6px", marginLeft: "24px" }}>
                  <input
                    type="text"
                    value={replyInput}
                    onChange={e => setReplyInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handlePostReply(c.id)}
                    placeholder={`Reply to ${c.username}...`}
                    maxLength={200}
                    autoFocus
                    style={{ flex: 1, padding: "6px 10px", borderRadius: "4px", border: "1px solid #444", background: "transparent", color: "#D3D3D3" }}
                  />
                  <button onClick={() => handlePostReply(c.id)} style={{ padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>
                    Post
                  </button>
                </div>
              )}

              {/* Replies */}
              {replies.filter(r => r.parent_id === c.id).map(r => (
                <div key={r.id} style={{ marginLeft: "24px", marginTop: "6px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "6px", padding: "8px 12px" }}>
                  <div style={{ flex: 1 }}>
                    <Link to={`/users/${r.username}`} style={{ fontWeight: "bold", fontSize: "13px" }}>{r.username}</Link>
                    <span style={{ fontSize: "11px", color: "#999", marginLeft: "8px" }}>
                      {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <div style={{ fontSize: "13px", marginTop: "2px" }}>{r.content}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "8px", flexShrink: 0 }}>
                    {r.username !== user?.username ? (
                      <button
                        onClick={() => handleLikeComment(r.id, r.liked_by_me)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: r.liked_by_me ? "#e0245e" : "#999", fontSize: "13px", padding: 0 }}
                      >
                        ❤︎ {Number(r.like_count)}
                      </button>
                    ) : (
                      Number(r.like_count) > 0 && <span style={{ color: "#999", fontSize: "13px" }}>❤︎ {Number(r.like_count)}</span>
                    )}
                    {(r.username === user?.username || isOwner) && (
                      <button
                        onClick={() => handleDeleteComment(r.id)}
                        style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "16px", padding: 0 }}
                      >×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={commentInput}
            onChange={e => setCommentInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handlePostComment()}
            placeholder="Add a comment..."
            maxLength={200}
            style={{ flex: 1, padding: "6px 10px", borderRadius: "4px", border: "1px solid #444", background: "transparent", color: "#D3D3D3" }}
          />
          <button onClick={handlePostComment} style={{ padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>
            Post
          </button>
        </div>
      </div>
    </div>
  );
}