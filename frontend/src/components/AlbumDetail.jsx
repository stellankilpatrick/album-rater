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

  const [isSaving, setIsSaving] = useState(false);

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
  const [showRatingHelp, setShowRatingHelp] = useState(false);

  const [liked, setLiked] = useState(null); // null = not set, true = like, false = dislike

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

  const timeAgo = (date) => {
    const timestamp = new Date(date).getTime();
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years}y ago`;
    if (months > 0) return `${months}mo ago`;
    if (weeks > 0) return `${weeks}w ago`;
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
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

  // fetch album
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

  // if user liked album
  useEffect(() => {
    if (!albumId || !effectiveUsername) return;
    api.get(`/albums/${albumId}/users/${effectiveUsername}/liked`)
      .then(res => setLiked(res.data.liked))
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

  const handleToggleLike = async (newLiked) => {
    await api.patch(`/albums/${albumId}/users/${effectiveUsername}/liked`, { liked: newLiked });
    setLiked(newLiked);
  };

  const handleLikeComment = async (commentId, likedByMe) => {
    if (likedByMe) {
      const res = await api.delete("/likes", { data: { targetType: "review_comment", targetId: commentId } });
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, like_count: res.data.count, liked_by_me: false } : c));
    } else {
      const res = await api.post("/likes", { targetType: "review_comment", targetId: commentId });
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, like_count: res.data.count, liked_by_me: true } : c));
    }
  };

  const handlePostReply = async (parentId, replyToUsername) => {
    if (!replyInput.trim()) return;
    const content = replyInput;
    const res = await api.post(`/albums/${albumId}/users/${effectiveUsername}/comments`, {
      content,
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

    setIsSaving(true);
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
      if (pendingReview !== review) {
        await api.patch(`/albums/${albumId}/review/users/${effectiveUsername}`, { review: pendingReview.trim() || null });
      }

      setSongs(pendingSongs);
      setReview(pendingReview);
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save ratings:", err);
    } finally {
      setIsSaving(false);
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

  const renderCommentContent = (content) => {
    const imageRegex = /(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg)(\?\S*)?)/i;
    const match = content.match(imageRegex);
    if (match) {
      const url = match[1];
      const text = content.replace(url, "").trim();
      return (
        <div>
          {text && <div style={{ fontSize: "13px", marginBottom: "4px" }}>{text}</div>}
          <img
            src={url}
            alt=""
            style={{ maxWidth: "150px", maxHeight: "150px", borderRadius: "4px", objectFit: "cover" }}
            onError={e => { e.target.style.display = "none"; }}
          />
        </div>
      );
    }
    return <span style={{ fontSize: "13px" }}>{content}</span>;
  };

  const [reviewLikes, setReviewLikes] = useState({ count: 0, likedByMe: false, ratingId: null });

  // after album loads
  useEffect(() => {
    if (!album?.ratingId) return;
    api.get(`/likes/status?targetType=album_review&targetId=${album.ratingId}`)
      .then(res => setReviewLikes({ ...res.data, ratingId: album.ratingId }));
  }, [album]);

  // if try to close out tab while editing
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  useEffect(() => {
    if (!hasChanges) return;

    const handleClick = (e) => {
      const link = e.target.closest('a');
      if (!link || !link.href) return;
      const url = new URL(link.href, window.location.origin);
      if (url.origin === window.location.origin && link.target !== '_blank') {
        if (!window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [hasChanges]);

  useEffect(() => {
    if (!hasChanges) return;

    const handlePopState = () => {
      if (!window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
        window.history.pushState(null, null, window.location.pathname);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, null, window.location.pathname);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasChanges]);

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
    if (!window.confirm("Delete this comment?")) return;
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

  const ratingOptionStyles = {
    "": { label: "Interlude", color: "#d3d3d3", background: "rgba(255,255,255,0.08)", mutedColor: "#b8b8b8", mutedBackground: "rgba(255,255,255,0.06)" },
    0: { label: "Skip", color: "#f5f5f5", background: "#6b4545", mutedColor: "#d0d0d0", mutedBackground: "#3d2626" },
    1: { label: "Play", color: "#f5f5f5", background: "#4a6b4a", mutedColor: "#d0d0d0", mutedBackground: "#2a3f2a" },
    2: { label: "Special", color: "#f5f5f5", background: "#22c55e", mutedColor: "#f5f5f5", mutedBackground: "#16a34a" }
  };

  const getRatingOptionStyle = (value) => ratingOptionStyles[value ?? ""] ?? ratingOptionStyles[""];

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
              height: isMobile ? "100px" : "180px",
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
            "{renderCommentContent(album.review)}"
          </p>
        )
      )}
    </div>
  );

  return (
    <div style={{ paddingBottom: "20px" }}>
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
              position: "relative", width: isMobile ? "200px" : "270px",
              height: isMobile ? "200px" : "270px", overflow: "hidden",
              borderRadius: "12px", flexShrink: 0, margin: "0px 0px 0px 0px"
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
            <h1 style={{ margin: "0 0 -4px 0", fontSize: isMobile ? "1.75rem" : undefined }}>
              <Link
                to={`/albums/${album.id}`}
                style={{ color: "white", transition: "opacity 0.15s ease" }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                <i>{album.title}</i>
              </Link>
            </h1>
            <h2 style={{ margin: 0, fontSize: isMobile ? "1.25rem" : undefined }}>
              {album.artistIds?.map((id, i) => (
                <span key={id}>
                  <Link
                    to={`/artists/${id}/users/${effectiveUsername}`}
                    style={{ color: "white", transition: "opacity 0.15s ease" }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                  >
                    {album.artist?.split(' & ')[i]}
                  </Link>
                  {i < album.artistIds.length - 1 && ", "}
                </span>
              ))}
            </h2>
            <h4 style={{ margin: 0 }}>
              Released {new Date(`${album.releaseDate.split("T")[0]}T12:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </h4>
            <h4 style={{ margin: "0 0 6px 0", display: "flex", alignItems: "center", gap: "6px" }}>
              {album.pfp && (
                <img
                  src={album.pfp}
                  alt=""
                  style={{ width: "20px", height: "20px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                />
              )}
              {effectiveUsername === user?.username
                ? `Your likes: ${goodSongs} of ${ratedSongs} tracks`
                : <Link
                  to={`/users/${effectiveUsername}`}
                  style={{ color: "white", transition: "opacity 0.15s ease" }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                  {`${effectiveUsername}'s likes: ${goodSongs} of ${ratedSongs} tracks`}
                </Link>
              }
            </h4>
            {!(liked === null && !isOwner) && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.9)" }}>
                  {isOwner ? "I" : effectiveUsername}
                  <button
                    onClick={() => {
                      if (!isOwner) return;
                      if (liked === null) handleToggleLike(true);
                      else if (liked === true) handleToggleLike(false);
                      else handleToggleLike(null);
                    }}
                    disabled={!isOwner}
                    style={{
                      border: "none",
                      background:
                        liked === true
                          ? "#1db954"
                          : liked === false
                            ? "#e74c3c"
                            : "#999",
                      color: "white",
                      cursor: isOwner ? "pointer" : "default",
                      fontSize: "13px",
                      padding: "0 4px",
                      margin: "0 4px",
                      fontWeight: liked !== null ? "bold" : "normal",
                    }}
                  >
                    {liked === true
                      ? (isOwner ? "like" : "likes")
                      : liked === false
                        ? (isOwner ? "dislike" : "dislikes")
                        : "add rating"}
                  </button>
                  this album
                </div>
                {isOwner && (
                  <>
                    <button
                      onClick={() => setShowRatingHelp(v => !v)}
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "bold",
                        background: liked === null ? "#facc15" : "#cbd5e1",
                        color: liked === null ? "#111827" : "#334155"
                      }}
                      aria-label="Show rating help"
                    >
                      ?
                    </button>
                    {showRatingHelp && (
                      <div style={{
                        padding: "6px 8px",
                        borderRadius: "6px",
                        background: "rgba(255,255,255,0.14)",
                        color: "white",
                        fontSize: "12px",
                        maxWidth: "500px",
                        lineHeight: 1.4
                      }}>
                        Feedback on this album will be used to improve your scoring algorithms, affecting that big number right below this. Feeback is optional, if you don't have a strong opinion on this album, you can leave it unrated.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {album.score10 != null && (
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                <h1 style={{ margin: "-12px 0px -10px 0px", fontSize: isMobile ? "3rem" : "4rem" }}>{album.score10.toFixed(1)}</h1>
                {ranks.overall?.rank != null && (
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px" }}>
                    <strong style={{ fontSize: isMobile ? "18px" : "25px" }}>{ordinal(ranks.overall.rank)}</strong> of {ranks.overall.total} albums
                  </span>
                )}
              </div>
            )}
            {/* Genres */}
            {genres.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", margin: "0px 0px 0px 0px" }}>
                {genres.map(g => (
                  <span
                    key={g.id}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.2)",
                      borderRadius: "12px",
                      padding: "2px 6px",
                      fontSize: "0.8rem"
                    }}
                  >
                    {g.name}
                  </span>
                ))}
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

      {isMobile && (
        <div style={{ padding: "0 16px" }}>
          {album?.ratingId && (
            <div style={{ marginBottom: "4px" }}>
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

      {/* ===== TRACKLIST + SIDEBAR ===== */}
      <div style={{
        display: "flex", flexDirection: isMobile ? "column" : "row",
        gap: "32px", alignItems: "flex-start", paddingLeft: isMobile ? "0" : "10px"
      }}>
        {/* LEFT: Tracklist + Comments */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tracklist */}
          <div style={{ overflowX: "auto", width: "100%", maxWidth: isMobile ? "calc(100vw - 32px)" : "100%" }}>
            <table style={{ borderCollapse: "collapse", width: "auto" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", paddingRight: "12px", width: "30px" }}>#</th>
                  <th style={{ textAlign: "left", paddingRight: "12px", minWidth: isMobile ? "250px" : undefined }}>Title</th>
                  <th style={{ textAlign: "left", paddingRight: "24px" }}>Rating</th>
                  <th style={{ textAlign: "left" }}>Comment</th>
                </tr>
              </thead>
              <tbody>
                {pendingSongs.map(song => {
                  const selectedStyle = getRatingOptionStyle(song.localRating);

                  return (
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
                          style={{
                            color: song.localRating == null ? "#c8c8c8" : (isOwner ? selectedStyle.color : selectedStyle.mutedColor),
                            background: song.localRating == null ? "#4b4b4b" : (isOwner ? selectedStyle.background : selectedStyle.mutedBackground),
                            border: "none",
                            borderRadius: "4px",
                            padding: "2px 6px",
                            fontWeight: 400,
                            cursor: isOwner ? "pointer" : "default",
                            fontSize: "12px",
                            opacity: isOwner ? 1 : 0.9
                          }}
                        >
                          <option value="" style={{ color: "#c8c8c8", backgroundColor: "#4b4b4b" }}>Interlude</option>
                          <option value={0} style={{ color: ratingOptionStyles[0].color, backgroundColor: ratingOptionStyles[0].background }}>- Skip</option>
                          <option value={1} style={{ color: ratingOptionStyles[1].color, backgroundColor: ratingOptionStyles[1].background }}>+ Play</option>
                          <option value={2} style={{ color: ratingOptionStyles[2].color, backgroundColor: ratingOptionStyles[2].background }}>++ Special</option>
                        </select>
                      </td>
                      <td style={{
                        whiteSpace: "nowrap",
                        minWidth: isMobile ? "250px" : "auto"
                      }}>
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
                              style={{
                                border: "none",
                                background: "transparent",
                                width: isMobile ? "400px" : "520px",
                                minWidth: isMobile ? "400px" : undefined,
                                fontSize: isMobile ? "11px" : "13px",
                                whiteSpace: "nowrap",
                                color: "#D3D3D3"
                              }}
                            />
                          </div>
                        ) : (
                          <span style={{ color: "#D3D3D3", fontSize: "13px" }}>{song.comment ?? ""}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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

          {/* COMMENTS */}
          <div style={{ marginBottom: "24px", maxWidth: isMobile ? "calc(100vw - 32px)" : "600px", marginTop: "32px", marginLeft: isMobile ? "16px" : "0", marginRight: isMobile ? "16px" : "0" }}>
            <h3 style={{ marginBottom: "8px", fontSize: isMobile ? "16px" : "18px" }}>Comments</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              {comments.filter(c => !c.parent_id).map(c => (
                <div key={c.id}>
                  {/* Top-level comment */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "6px", padding: "8px 12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        to={`/users/${c.username}`}
                        style={{ fontWeight: "bold", fontSize: isMobile ? "12px" : "13px", transition: "opacity 0.15s ease" }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                      >
                        {c.username}
                      </Link>
                      <span style={{ fontSize: isMobile ? "10px" : "11px", color: "#999", marginLeft: "8px" }}>
                        {timeAgo(c.created_at)}
                      </span>
                      <div style={{ fontSize: isMobile ? "12px" : "13px", marginTop: "2px", wordBreak: "break-word" }}>{renderCommentContent(c.content)}</div>
                      <button
                        onClick={() => {
                          setReplyingTo(replyingTo === c.id ? null : c.id);
                          setReplyInput(replyingTo === c.id ? "" : `@${c.username} `);
                        }}
                        style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: isMobile ? "10px" : "11px", padding: "4px 0 0 0" }}
                      >
                        {replyingTo === c.id ? "Cancel" : "Reply"}
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "8px", flexShrink: 0 }}>
                      {c.username !== user?.username ? (
                        <button
                          onClick={() => handleLikeComment(c.id, c.liked_by_me)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: c.liked_by_me ? "#e0245e" : "#999", fontSize: isMobile ? "12px" : "13px", padding: 0 }}
                        >
                          ❤︎ {Number(c.like_count)}
                        </button>
                      ) : (
                        Number(c.like_count) > 0 && (
                          <span style={{ color: "#999", fontSize: isMobile ? "12px" : "13px" }}>❤︎ {Number(c.like_count)}</span>
                        )
                      )}
                      {(c.username === user?.username || isOwner) && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "16px", padding: 0 }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Reply input */}
                  {replyingTo === c.id && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "6px", marginLeft: isMobile ? "12px" : "24px" }}>
                      <textarea
                        type="text"
                        value={replyInput}
                        onChange={e => setReplyInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handlePostReply(c.id, c.username)}
                        placeholder={`Reply to ${c.username}...`}
                        maxLength={200}
                        autoFocus
                        style={{ flex: 1, padding: "6px 10px", borderRadius: "4px", border: "1px solid #444", background: "transparent", color: "#D3D3D3", fontSize: isMobile ? "12px" : "13px" }}
                      />
                      <button onClick={() => handlePostReply(c.id, c.username)} style={{ padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: isMobile ? "12px" : "13px", flexShrink: 0 }}>
                        Reply
                      </button>
                    </div>
                  )}

                  {/* Replies */}
                  {comments.filter(r => r.parent_id === c.id).map(reply => (
                    <div key={reply.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "6px", padding: "8px 12px", marginTop: "4px", marginLeft: isMobile ? "12px" : "24px" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link
                            to={`/users/${reply.username}`}
                            style={{ fontWeight: "bold", fontSize: isMobile ? "12px" : "13px", transition: "opacity 0.15s ease" }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                          >
                            {reply.username}
                          </Link>
                          <span style={{ fontSize: isMobile ? "10px" : "11px", color: "#999", marginLeft: "8px" }}>
                            {timeAgo(reply.created_at)}
                          </span>
                          <div style={{ fontSize: isMobile ? "12px" : "13px", marginTop: "2px", wordBreak: "break-word" }}>{renderCommentContent(reply.content)}</div>
                          <button
                            onClick={() => {
                              setReplyingTo(replyingTo === `${c.id}-${reply.id}` ? null : `${c.id}-${reply.id}`);
                              setReplyInput(replyingTo === `${c.id}-${reply.id}` ? "" : `@${reply.username} `);
                            }}
                            style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: isMobile ? "10px" : "11px", padding: "4px 0 0 0" }}
                          >
                            {replyingTo === `${c.id}-${reply.id}` ? "Cancel" : "Reply"}
                          </button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "8px", flexShrink: 0 }}>
                          {reply.username !== user?.username ? (
                            <button
                              onClick={() => handleLikeComment(reply.id, reply.liked_by_me)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: reply.liked_by_me ? "#e0245e" : "#999", fontSize: isMobile ? "12px" : "13px", padding: 0 }}
                            >
                              ❤︎ {Number(reply.like_count)}
                            </button>
                          ) : (
                            Number(reply.like_count) > 0 && (
                              <span style={{ color: "#999", fontSize: isMobile ? "12px" : "13px" }}>❤︎ {Number(reply.like_count)}</span>
                            )
                          )}
                          {(reply.username === user?.username || isOwner) && (
                            <button
                              onClick={() => handleDeleteComment(reply.id)}
                              style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: "16px", padding: 0 }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>

                      {replyingTo === `${c.id}-${reply.id}` && (
                        <div style={{ display: "flex", gap: "8px", marginTop: "6px", marginLeft: isMobile ? "24px" : "48px" }}>
                          <textarea
                            type="text"
                            value={replyInput}
                            onChange={e => setReplyInput(e.target.value)}
                            placeholder={`Reply to ${reply.username}...`}
                            maxLength={200}
                            autoFocus
                            style={{ flex: 1, padding: "6px 10px", borderRadius: "4px", border: "1px solid #444", background: "transparent", color: "#D3D3D3", fontSize: isMobile ? "12px" : "13px" }}
                          />
                          <button onClick={() => handlePostReply(c.id, reply.username)} style={{ padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: isMobile ? "12px" : "13px", flexShrink: 0 }}>
                            Reply
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <textarea
                type="text"
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                placeholder="Add a comment..."
                maxLength={200}
                style={{ flex: 1, padding: "4px 10px 0px 4px", borderRadius: "4px", border: "1px solid #444", background: "transparent", color: "#D3D3D3", fontSize: isMobile ? "12spx" : "13px" }}
              />
              <button onClick={handlePostComment} style={{ padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: isMobile ? "12px" : "13px", flexShrink: 0 }}>
                Post
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Ranks */}
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
          {/* Ranks */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "160px" }}>
            <h3 style={{ margin: 0 }}>Ranks</h3>
            {ranks.year?.rank != null && (
              <Link
                to={`/albums/users/${effectiveUsername}?minYear=${album.releaseDate?.slice(0, 4)}&maxYear=${album.releaseDate?.slice(0, 4)}`}
                style={{ textDecoration: "none", color: "inherit", cursor: "pointer", transition: "opacity 0.15s ease" }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                <div style={{ fontSize: "16px" }}>
                  <strong style={{ fontSize: "28px" }}>{ordinal(ranks.year.rank)} </strong>
                  <span style={{ color: "#999" }}>of {ranks.year.total} <strong style={{ fontSize: "15px" }}>{album.releaseDate?.slice(0, 4)}</strong> albums</span>
                </div>
              </Link>
            )}
            {ranks.decade?.rank != null && (
              <Link
                to={`/albums/users/${effectiveUsername}?minYear=${Math.floor(album.releaseDate?.slice(0, 4) / 10) * 10}&maxYear=${Math.floor(album.releaseDate?.slice(0, 4) / 10) * 10 + 9}`}
                style={{ textDecoration: "none", color: "inherit", cursor: "pointer", transition: "opacity 0.15s ease" }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                <div style={{ fontSize: "16px" }}>
                  <strong style={{ fontSize: "28px" }}>{ordinal(ranks.decade.rank)} </strong>
                  <span style={{ color: "#999" }}>of {ranks.decade.total} <strong style={{ fontSize: "15px" }}>{Math.floor(album.releaseDate?.slice(0, 4) / 10) * 10}s</strong> albums</span>
                </div>
              </Link>
            )}
            {Array.isArray(ranks.artist) && ranks.artist.map(a => a.rank != null && (
              <Link
                key={a.name}
                to={`/albums/users/${effectiveUsername}?artist=${encodeURIComponent(a.name)}`}
                style={{ textDecoration: "none", color: "inherit", cursor: "pointer", transition: "opacity 0.15s ease" }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                <div style={{ fontSize: "16px" }}>
                  <strong style={{ fontSize: "28px" }}>{ordinal(a.rank)} </strong>
                  <span style={{ color: "#999" }}>of {a.total} <strong style={{ fontSize: "15px" }}>{a.name}</strong> albums</span>
                </div>
              </Link>
            ))}
            {genres.map(g => ranks[`genre_${g.name}`]?.rank != null && (
              <Link
                key={g.name}
                to={`/albums/users/${effectiveUsername}?genre=${encodeURIComponent(g.name)}`}
                style={{ textDecoration: "none", color: "inherit", cursor: "pointer", transition: "opacity 0.15s ease" }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                <div style={{ fontSize: "16px" }}>
                  <strong style={{ fontSize: "28px" }}>{ordinal(ranks[`genre_${g.name}`].rank)} </strong>
                  <span style={{ color: "#999" }}>of {ranks[`genre_${g.name}`].total} <strong style={{ fontSize: "15px" }}>{g.name}</strong> albums</span>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "160px" }}>
            <button style={{ minWidth: "30px", borderRadius: "4px" }}>
              <Link
                to={`/albums/${album.id}`}
                style={{ textDecoration: "none", fontSize: "14px", transition: "opacity 0.15s ease" }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                All ratings of <i>{album.title}</i>
              </Link>
            </button>
            {album.artistIds?.map((id, i) => (
              <button key={id} style={{ minWidth: "30px", borderRadius: "4px" }}>
                <Link
                  to={`/artists/${id}/users/${effectiveUsername}`}
                  style={{ textDecoration: "none", fontSize: "14px", transition: "opacity 0.15s ease" }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
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
      {isSaving && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999
        }}>
          <div style={{
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            padding: "32px",
            textAlign: "center",
            color: "white"
          }}>
            <div style={{ marginBottom: "16px", fontSize: "18px" }}>Saving your rating...</div>
            <div style={{
              width: "40px",
              height: "40px",
              border: "3px solid rgba(255,255,255,0.2)",
              borderTop: "3px solid white",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto"
            }} />
            <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
          </div>
        </div>
      )}
    </div>
  );
}