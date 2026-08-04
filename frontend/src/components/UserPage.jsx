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

                    {userStats && (
                        <div style={{ marginTop: "8px", color: "#ccc", fontSize: "14px" }}>
                            <div><strong>{userStats.totalRatedSongs}</strong> total songs rated</div>
                            <div>
                                Ratio (play+good): {userStats.totalRatedSongs > 0 ? `${((userStats.goodPlayCount / userStats.totalRatedSongs) * 100).toFixed(0)}%` : "—"}
                            </div>
                            <div>
                                Special rate: {userStats.totalRatedSongs > 0 ? `${((userStats.specialCount / userStats.totalRatedSongs) * 100).toFixed(0)}%` : "—"}
                            </div>
                            {userStats.topGenres && userStats.topGenres.length > 0 && (
                                <div>Top genres: {userStats.topGenres.map(g => g.name).join(", ")}</div>
                            )}
                        </div>
                    )}

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
                <div style={{ display: "flex", justifyContent: isMobile ? "center" : "flex-start", gap: "4px" }}>
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
                                        width: isMobile ? "20%wv" : "140px",
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
                <div style={{ display: "flex", justifyContent: isMobile ? "center" : "flex-start", gap: "4px" }}>
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
                                        width: isMobile ? "90px" : "140px",
                                        height: isMobile ? "90px" : "140px",
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
    );
}