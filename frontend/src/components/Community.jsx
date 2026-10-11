import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import StarRating from "./StarRating";
import { getRatingMode, score10ToStarValue, renderScore } from "../utils/rating";

// Same rule as before: an entry whose first and last song ratings are within a
// minute of each other is a new rating; anything later is an update
const isNewRating = (item) => Math.abs(new Date(item.updated_at) - new Date(item.created_at)) < 60000;

function daysAgo(date) {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
    if (days <= 0) return "Today";
    return days === 1 ? "1 day ago" : `${days} days ago`;
}

// Review text without image links (the album page shows those as images)
const reviewText = (review) =>
    review?.replace(/https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg)(\?\S*)?/gi, "").trim();

function Avatar({ pfp, size }) {
    return pfp
        ? <img src={pfp} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        : <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: "#2b2b2b", flexShrink: 0 }} />;
}

// Each artist links to their page; falls back to the joined name string
function ArtistLinks({ item }) {
    if (!item.artists?.length) return item.artist_name;
    return item.artists.map((a, i) => (
        <span key={a.id}>
            {i > 0 && " & "}
            <Link to={`/artists/${a.id}`} className="timeline-artist">{a.name}</Link>
        </span>
    ));
}

// Left edge and width of the nav bar's centered items (Album Rankings through the
// notification bell), relative to `container`; null when there's no such group (mobile).
// `rendered` re-measures once the container exists (the feed renders after loading).
function useNavCenterSpan(containerRef, rendered) {
    const [span, setSpan] = useState(null);

    useLayoutEffect(() => {
        const group = document.querySelector(".nav-center-group");
        const measure = () => {
            const container = containerRef.current;
            if (!group?.firstElementChild || !container) return setSpan(null);
            const left = group.firstElementChild.getBoundingClientRect().left;
            const right = group.lastElementChild.getBoundingClientRect().right;
            setSpan({ marginLeft: left - container.getBoundingClientRect().left, width: right - left });
        };
        measure();
        const observer = new ResizeObserver(measure);
        if (group) observer.observe(group);
        if (containerRef.current) observer.observe(containerRef.current);
        window.addEventListener("resize", measure);
        return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
    }, [containerRef, rendered]);

    return span;
}

export default function Community({ user }) {
    const [feed, setFeed] = useState([]);
    const timelineContainerRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const navSpan = useNavCenterSpan(timelineContainerRef, !loading && feed.length > 0);
    const [likePending, setLikePending] = useState(null);

    const [showMyActivity, setShowMyActivity] = useState(false);

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const endpoint = showMyActivity ? "/community/my-activity" : "/community";
                const feedRes = await api.get(endpoint);
                setFeed(feedRes.data);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [showMyActivity]);

    // Like or unlike someone's review (reviews are album_ratings rows); you can't like your own
    const toggleReviewLike = async (item) => {
        if (item.user_id === user?.id || likePending) return;
        setLikePending(item.rating_id);
        try {
            const like = { targetType: "album_review", targetId: item.rating_id };
            const res = item.liked_by_me
                ? await api.delete("/likes", { data: like })
                : await api.post("/likes", like);
            setFeed(prev => prev.map(f => f.rating_id === item.rating_id
                ? { ...f, like_count: res.data.count, liked_by_me: !item.liked_by_me }
                : f));
        } catch (err) {
            console.error("Failed to update like:", err);
        } finally {
            setLikePending(null);
        }
    };

    if (loading) return <p>Loading…</p>;

    return (
            <div className="community activity-page">
                <h1 style={{ textAlign: "center" }}>Activity</h1>
            <div style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: "32px",
                alignItems: "flex-start"
            }}>
                {/* Left: activity feed */}
                <div style={{ flex: isMobile ? undefined : "1 1 0", minWidth: 0 }}>
                    <div style={{ marginBottom: "8px", textAlign: "center" }}>
                        <h2 style={{ marginTop: 0, marginBottom: 0 }}>{showMyActivity ? "Your" : "Friend"} Recent Activity</h2>
                    </div>
                    <div style={{ textAlign: "center", marginBottom: "12px" }}>
                        <button
                            onClick={() => setShowMyActivity(!showMyActivity)}
                            style={{ padding: "6px 12px", cursor: "pointer" }}
                        >
                            {showMyActivity ? "Show Friends" : "Show My Activity"}
                        </button>
                    </div>
                    {feed.length === 0 ? (
                        <p>No activity yet. Follow more people.</p>
                    ) : (
                        <div className="activity-timeline" ref={timelineContainerRef}>
                            <div style={navSpan ?? undefined}>
                            {feed.map((item, i) => isNewRating(item) ? (
                                <div key={`${item.username}-${item.album_id}-${item.updated_at}`} className={`timeline-card${feed[i + 1]?.user_id === item.user_id ? " joined" : ""}`}>
                                    <Link to={`/albums/${item.album_id}`} className="timeline-cover">
                                        {item.coverArt
                                            ? <img src={item.coverArt} alt={item.album_title} />
                                            : <div className="timeline-cover-placeholder" />}
                                    </Link>
                                    <div className="timeline-body">
                                        <div className="timeline-header">
                                            <div className="timeline-title">
                                                <Link to={`/users/${item.username}`} className="timeline-user">
                                                    <Avatar pfp={item.pfp} size={22} />
                                                    {item.username}
                                                </Link>
                                                {" rated "}
                                                <Link to={`/albums/${item.album_id}/users/${item.username}`} className="timeline-album">
                                                    {item.album_title}
                                                </Link>
                                                {" by "}
                                                <ArtistLinks item={item} />
                                            </div>
                                            <div className="timeline-meta">
                                                <span className="timeline-date">{daysAgo(item.created_at)}</span>
                                                {item.rating_id && (() => {
                                                    const isOwn = item.user_id === user?.id;
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleReviewLike(item)}
                                                            className={`timeline-like${item.liked_by_me ? " liked" : ""}${isOwn ? " own" : ""}`}
                                                            aria-disabled={isOwn}
                                                            aria-pressed={item.liked_by_me}
                                                            title={isOwn ? "You can't like your own review" : item.liked_by_me ? "Unlike" : "Like"}
                                                        >
                                                            ❤︎ {item.like_count ?? 0}
                                                        </button>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        <Link to={`/albums/${item.album_id}/users/${item.username}`} className="timeline-review-link">
                                            {item.score != null && (
                                                <div className="timeline-score">
                                                    {getRatingMode() === "stars"
                                                        ? <StarRating value={score10ToStarValue(item.score)} size={16} />
                                                        : renderScore(item.score)}
                                                </div>
                                            )}
                                            {reviewText(item.review) && (
                                                <p className="timeline-review">{reviewText(item.review)}</p>
                                            )}
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div key={`${item.username}-${item.album_id}-${item.updated_at}`} className={`timeline-update${feed[i + 1]?.user_id === item.user_id ? " joined" : ""}`}>
                                    <Link to={`/albums/${item.album_id}`} className="timeline-update-cover">
                                        {item.coverArt
                                            ? <img src={item.coverArt} alt={item.album_title} />
                                            : <div className="timeline-cover-placeholder" />}
                                    </Link>
                                    <div className="timeline-update-text">
                                        <Link to={`/users/${item.username}`} className="timeline-user">
                                            <Avatar pfp={item.pfp} size={18} />
                                            {item.username}
                                        </Link>
                                        {" updated "}
                                        <Link to={`/albums/${item.album_id}/users/${item.username}`}>
                                            <strong style={{ fontWeight: 600 }}>{item.album_title}</strong>
                                        </Link>
                                        {" by "}
                                        <ArtistLinks item={item} />
                                        <span className="timeline-date"> · {daysAgo(item.updated_at)}</span>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* no right column (anniversary removed) */}
            </div>
            
        </div>
    );
}