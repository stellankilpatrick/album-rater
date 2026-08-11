import { useEffect, useState } from "react";
import api from "../api/api"; // your axios/fetch wrapper
import { Link, useParams } from "react-router-dom";

export default function ProfilePage({ user }) {
    if (!user) return null;
    const [topArtists, setTopArtists] = useState([]);
    const [topAlbums, setTopAlbums] = useState([]);
    const [loading, setLoading] = useState(false);
    const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
    const [ratingCounts, setRatingCounts] = useState({ albums: 0, artists: 0 });
    const [userStats, setUserStats] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    const [pfp, setPfp] = useState(null);
    const [editingPfp, setEditingPfp] = useState(false);
    const [pfpInput, setPfpInput] = useState("");

    const [banner, setBanner] = useState(null);
    const [editingBanner, setEditingBanner] = useState(false);
    const [bannerInput, setBannerInput] = useState("");

    const { username } = useParams();
    const effectiveUsername = username ?? user?.username;
    const isMe = user.username === effectiveUsername;
    const [isFollowing, setIsFollowing] = useState(false);

    const [bio, setBio] = useState(null);
    const [bioInput, setBioInput] = useState("");

    const toggleFollow = async () => {
        if (isFollowing) {
            await api.delete(`/users/${effectiveUsername}/follow`);
            setFollowCounts(c => ({ ...c, followers: c.followers - 1 }));
        } else {
            await api.post(`/users/${effectiveUsername}/follow`);
            setFollowCounts(c => ({ ...c, followers: c.followers + 1 }));
        }
        setIsFollowing(!isFollowing);
    };

    useEffect(() => {
        async function fetchTop() {
            setLoading(true);
            try {
                const [albumsRes, artistsRes] = await Promise.all([
                    api.get(`/users/${effectiveUsername}/top-albums`),
                    api.get(`/users/${effectiveUsername}/top-artists`)
                ]);

                setTopAlbums(albumsRes.data);
                setTopArtists(artistsRes.data);
            } catch (err) {
                console.error("Error fetching top albums/artists:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchTop();
    }, [user.id]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // fetch pfp
    useEffect(() => {
        api.get(`/users/${effectiveUsername}/pfp`).then(res => {
            setPfp(res.data.pfp);
            setPfpInput(res.data.pfp);
        });
    }, [effectiveUsername]);

    // fetch banner
    useEffect(() => {
        api.get(`/users/${effectiveUsername}/banner`).then(res => {
            setBanner(res.data.banner);
            setBannerInput(res.data.banner ?? "");
        });
    }, [effectiveUsername]);

    // fetch bio
    useEffect(() => {
        api.get(`/users/${effectiveUsername}/bio`).then(res => {
            setBio(res.data.bio);
            setBioInput(res.data.bio ?? "");
        });
    }, [effectiveUsername]);

    const savePfp = async () => {
        try {
            const res = await api.put(`/users/${effectiveUsername}/pfp`, {
                pfp: pfpInput
            });

            setPfp(res.data.pfp);
            setEditingPfp(false);
        } catch (err) {
            console.error("Error updating pfp", err);
        }
    };

    const saveBanner = async () => {
        try {
            const res = await api.put(`/users/${effectiveUsername}/banner`, { banner: bannerInput || null });
            setBanner(res.data.banner);
            setEditingBanner(false);
        } catch (err) {
            console.error("Error updating banner", err);
        }
    };

    useEffect(() => {
        api.get(`/users/${effectiveUsername}/follow-counts`)
            .then(res => setFollowCounts({
                followers: Number(res.data.followers),
                following: Number(res.data.following)
            }));
    }, [user.id]);

    useEffect(() => {
        api.get(`/users/${effectiveUsername}/rating-counts`)
            .then(res => setRatingCounts(res.data));
    }, [user.id]);

    useEffect(() => {
        api.get(`/users/${effectiveUsername}/stats`).then(res => setUserStats(res.data)).catch(() => setUserStats(null));
    }, [user.id]);

    useEffect(() => {
        if (isMe) return;

        api.get(`/users/${effectiveUsername}/is-following`)
            .then(res => setIsFollowing(res.data.isFollowing));
    }, [effectiveUsername, isMe]);


    if (loading) return <div>Loading...</div>;

    return (
        <div
            className="page-pad"
            style={{
                textAlign: isMobile ? "center" : "left"
            }}
        >
            {/* Banner */}
            <div
                style={{
                    height: "180px",
                    backgroundColor: "#222",
                    backgroundImage: banner ? `url(${banner})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    marginLeft: "calc(-1 * (100vw - 100%) / 2)",
                    marginRight: "calc(-1 * (100vw - 100%) / 2)",
                    marginTop: "-16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: isMobile ? "center" : "flex-start",
                }}
            >
                {isMe && !banner && <span style={{ color: "#666" }}>Click to add banner</span>}
            </div>

            <div
                style={{
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    alignItems: isMobile ? "center" : "flex-end",
                    justifyContent: "flex-start",
                    gap: "24px",
                    marginBottom: "16px"
                }}
            >
                {/* Profile Picture */}
                <img
                    src={pfp}
                    alt="profile"
                    style={{
                        width: isMobile ? "150px" : "220px",
                        height: isMobile ? "150px" : "220px",
                        objectFit: "cover",
                        borderRadius: "50%",
                        marginTop: "-75px",
                        flexShrink: 0,
                    }}
                />

                {/* User Info */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px", paddingBottom: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: isMobile ? "center" : "flex-start", gap: "12px" }}>
                        <h1 style={{ margin: 0 }}>{effectiveUsername}</h1>
                        {!isMe && (
                            <button className="ui-btn" onClick={toggleFollow}>
                                {isFollowing ? "Following" : "Follow"}
                            </button>
                        )}
                        {isMe && (
                            <>
                                <button className="ui-btn" onClick={() => {
                                    if (editingPfp || editingBanner) {
                                        savePfp();
                                        saveBanner();
                                        api.put(`/users/${effectiveUsername}/bio`, { bio: bioInput }).then(() => setBio(bioInput));
                                        setEditingPfp(false);
                                        setEditingBanner(false);
                                    } else {
                                        setEditingPfp(true);
                                        setEditingBanner(true);
                                    }
                                }}>
                                    {editingPfp || editingBanner ? "Save Changes" : "Edit Profile"}
                                </button>
                                {(editingPfp || editingBanner) && (
                                    <button className="ui-btn" onClick={() => {
                                        setEditingPfp(false);
                                        setEditingBanner(false);
                                        setBioInput(bio ?? "");
                                    }}>
                                        Cancel
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    <div style={{ display: "flex", justifyContent: isMobile ? "center" : "flex-start", gap: "16px" }}>
                        <Link
                            to={`/users/${effectiveUsername}/connections#followers`}
                            style={{ textDecoration: "none", color: "inherit", transition: "opacity 0.15s ease" }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                        >
                            <strong>{followCounts.followers}</strong> Followers
                        </Link>
                        <Link
                            to={`/users/${effectiveUsername}/connections#following`}
                            style={{ textDecoration: "none", color: "inherit", transition: "opacity 0.15s ease" }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                        >
                            <strong>{followCounts.following}</strong> Following
                        </Link>
                    </div>

                    <div style={{ display: "flex", justifyContent: isMobile ? "center" : "flex-start", gap: "16px" }}>
                        <div><strong>{ratingCounts.albums}</strong> {ratingCounts.albums === 1 ? "Album" : "Albums"}</div>
                        <div><strong>{ratingCounts.artists}</strong> {ratingCounts.artists === 1 ? "Artist" : "Artists"}</div>
                    </div>

                    

                    {!editingPfp && (
                        <p style={{ color: "#ccc", margin: 0 }}>
                            {bio || (isMe ? "No bio yet." : "")}
                        </p>
                    )}
                </div>
            </div>

            {/* Edit Profile Panel */}
            {(editingPfp || editingBanner) && (
                <div className="edit-profile-panel" style={{ textAlign: "left", maxWidth: "400px", margin: "0 auto" }}>
                    <div>
                        <label>Profile Picture URL</label>
                        <input
                            className="edit-profile-input"
                            type="text"
                            value={pfpInput}
                            onChange={e => setPfpInput(e.target.value)}
                            placeholder="Paste image URL"
                        />
                    </div>
                    <div>
                        <label>Banner URL</label>
                        <input
                            className="edit-profile-input"
                            type="text"
                            value={bannerInput}
                            onChange={e => setBannerInput(e.target.value)}
                            placeholder="Paste image URL"
                        />
                    </div>
                    <div>
                        <label>Bio</label>
                        <textarea
                            className="edit-profile-input"
                            value={bioInput}
                            onChange={e => setBioInput(e.target.value)}
                            maxLength={300}
                            rows={3}
                            placeholder="Write a bio..."
                            style={{ resize: "vertical" }}
                        />
                        <div style={{ fontSize: "12px", color: "#888", textAlign: "right", marginTop: "2px" }}>{bioInput.length}/300</div>
                    </div>
                </div>
            )}


            <div style={{ display: isMobile ? "block" : "flex", gap: "24px", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                    <h3>
                        <Link
                            to={`/users/${effectiveUsername}/listen-list`}
                            style={{ color: "inherit", transition: "opacity 0.15s ease" }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                        >
                            Listen List
                        </Link>
                    </h3>

                    {/* Top 5 Albums */}
                    <Link
                        to={`/albums/users/${effectiveUsername}`}
                        style={{ color: "inherit", transition: "opacity 0.15s ease" }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                    >
                        <h2>Top Albums</h2>
                    </Link>
                    {topAlbums.length > 0 && (
                        <div style={{ display: "flex", justifyContent: isMobile ? "center" : "flex-start", gap: "8px", flexWrap: "wrap" }}>
                            {topAlbums.map(album => (
                                album.coverArt && (
                                    <Link
                                        key={album.id}
                                        to={`/albums/${album.id}/users/${effectiveUsername}`}
                                    >
                                        <img
                                            src={album.coverArt}
                                            alt={album.title}
                                            style={{
                                                width: isMobile ? "40vw" : "140px",
                                                height: isMobile ? "90px" : "140px",
                                                objectFit: "cover",
                                                borderRadius: "4px"
                                            }}
                                        />
                                    </Link>
                                )
                            ))}
                        </div>
                    )}

                    {/* Top 5 Artists */}
                    <Link
                        to={`/artists/users/${effectiveUsername}`}
                        style={{ color: "inherit", transition: "opacity 0.15s ease" }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = "0.65"}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                    >
                        <h2>Top Artists</h2>
                    </Link>
                    {topArtists.length > 0 && (
                        <div style={{ display: "flex", justifyContent: isMobile ? "center" : "flex-start", gap: "8px", flexWrap: "wrap" }}>
                            {topArtists.map(artist => (
                                artist.image && (
                                    <Link
                                        key={artist.id}
                                        to={`/artists/${artist.id}/users/${effectiveUsername}`}
                                    >
                                        <img
                                            src={artist.image}
                                            alt=""
                                            style={{
                                                width: isMobile ? "40vw" : "140px",
                                                height: isMobile ? "40vw" : "140px",
                                                objectFit: "cover",
                                                borderRadius: "50%"
                                            }}
                                        />
                                    </Link>
                                )
                            ))}
                        </div>
                    )}
                </div>

                <aside style={{ width: isMobile ? "100%" : "320px", background: "rgba(255,255,255,0.02)", padding: "14px", borderRadius: "10px", color: "#ddd" }}>
                    <h3 style={{ marginTop: 0 }}>Stats</h3>
                    {userStats ? (
                        <div>
                            {/* Big stat grid */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "12px" }}>
                                <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                                    <div style={{ fontSize: "34px", fontWeight: 600, color: "#fff" }}>{userStats.totalRatedSongs}</div>
                                    <div style={{ fontSize: "12px", color: "#bbb" }}>Songs rated</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                                    <div style={{ fontSize: "34px", fontWeight: 600, color: "#fff" }}>{userStats.albumOpinionPct != null ? `${Math.round(userStats.albumOpinionPct * 100)}%` : "—"}</div>
                                    <div style={{ fontSize: "12px", color: "#bbb" }}>Albums liked</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                                    <div style={{ fontSize: "34px", fontWeight: 600, color: "#fff" }}>{userStats.totalRatedSongs > 0 ? `${Math.round((userStats.goodPlayCount / userStats.totalRatedSongs) * 100)}%` : "—"}</div>
                                    <div style={{ fontSize: "12px", color: "#bbb" }}>Songs liked</div>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                                    <div style={{ fontSize: "34px", fontWeight: 600, color: "#fff" }}>{userStats.totalRatedSongs > 0 ? `${Math.round((userStats.specialCount / userStats.totalRatedSongs) * 100)}%` : "—"}</div>
                                    <div style={{ fontSize: "12px", color: "#bbb" }}>Special</div>
                                </div>
                            </div>

                            {/* Top genres */}
                            {userStats.topGenres && userStats.topGenres.length > 0 && (
                                <div style={{ marginBottom: "10px" }}>
                                    <div style={{ fontWeight: "bold", marginBottom: "6px" }}>Top genres</div>
                                    <ol style={{ margin: 0, paddingLeft: "18px" }}>
                                        {userStats.topGenres.map((g, i) => (
                                            <li key={g.name} style={{ fontSize: i === 0 ? "16px" : "14px", marginBottom: "4px" }}>
                                                <span style={{ fontWeight: i === 0 ? 700 : 600 }}>{g.name}</span>
                                                <span style={{ color: "#999", marginLeft: "6px" }}>({g.count})</span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                            {/* Top decades (converted from topYears) */}
                            {userStats.topYears && userStats.topYears.length > 0 && (() => {
                                // convert years -> decades
                                const decadeMap = new Map();
                                userStats.topYears.forEach(y => {
                                    const year = Number(y.year);
                                    if (!year) return;
                                    const decade = Math.floor(year / 10) * 10;
                                    decadeMap.set(decade, (decadeMap.get(decade) || 0) + Number(y.count));
                                });
                                let decades = Array.from(decadeMap.entries()).map(([decade, count]) => ({ decade, count }))
                                    .sort((a,b) => b.count - a.count);
                                // ensure we always show 3 decades: if aggregation collapsed to fewer, pad with nearby decades
                                if (decades.length < 3) {
                                    const existing = new Set(decades.map(d => d.decade));
                                    // find candidate decades from the raw years list
                                    const yearsList = userStats.topYears.map(y => Number(y.year)).filter(Boolean).sort((a,b)=>b-a);
                                    let seed = yearsList[0] ? Math.floor(yearsList[0]/10)*10 : (decades[0]?.decade || new Date().getFullYear() - (new Date().getFullYear()%10));
                                    let offset = 0;
                                    while (decades.length < 3 && offset < 10) {
                                        const cand = seed - (offset+1)*10;
                                        if (!existing.has(cand)) {
                                            decades.push({ decade: cand, count: 0 });
                                            existing.add(cand);
                                        }
                                        offset++;
                                    }
                                }
                                decades = decades.slice(0,3);

                                return (
                                    <div>
                                        <div style={{ fontWeight: "bold", marginBottom: "6px" }}>Top decades</div>
                                        <ol style={{ margin: 0, paddingLeft: "18px" }}>
                                            {decades.map((d, i) => (
                                                <li key={d.decade} style={{ marginBottom: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                                                        <div style={{ fontSize: i === 0 ? "18px" : "14px", fontWeight: 800 }}>{i+1}.</div>
                                                        <div style={{ fontSize: i === 0 ? "16px" : "14px", fontWeight: i === 0 ? 700 : 600 }}>{d.decade}s</div>
                                                    </div>
                                                    <div style={{ color: "#999" }}>({d.count})</div>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div style={{ color: "#888" }}>No stats available</div>
                    )}
                </aside>
            </div>
        </div>
    );
}