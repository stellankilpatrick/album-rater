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
            const res = await api.put(`/users/${effectiveUsername}/banner`, { banner: bannerInput });
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
        if (isMe) return;

        api.get(`/users/${effectiveUsername}/is-following`)
            .then(res => setIsFollowing(res.data.isFollowing));
    }, [effectiveUsername, isMe]);


    if (loading) return <div>Loading...</div>;

    return (
        <div>
            {/* Banner */}
            <div
                onClick={() => isMe && setEditingBanner(true)}
                style={{
                    height: "180px",
                    backgroundColor: "#222",
                    backgroundImage: banner ? `url(${banner})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    cursor: isMe ? "pointer" : "default",
                    marginLeft: "calc(-50vw + 50%)",
                    marginRight: "calc(-50vw + 50%)",
                    marginTop: "-16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {isMe && !banner && <span style={{ color: "#666" }}>Click to add banner</span>}
            </div>

            {isMe && editingBanner && (
                <div style={{ marginBottom: "12px", visibility: editingBanner ? "visible" : "hidden", height: "32px" }}>
                    <input
                        type="text"
                        value={bannerInput}
                        onChange={e => setBannerInput(e.target.value)}
                        placeholder="Paste image URL"
                        style={{ width: "260px", marginLeft: "400px" }}
                    />
                </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "16px" }}>
                {/* Profile Picture */}
                <div>
                    <img
                        src={pfp}
                        alt="profile"
                        onClick={() => isMe && setEditingPfp(true)}
                        style={{
                            width: "220px",
                            height: "220px",
                            objectFit: "cover",
                            borderRadius: "50%",
                            marginTop: "-75px",
                            marginLeft: "20px",
                            cursor: isMe ? "pointer" : "default",
                        }}
                    />

                    {isMe && editingPfp && (
                        <div style={{ marginTop: "8px" }}>
                            <input
                                type="text"
                                value={pfpInput}
                                onChange={e => setPfpInput(e.target.value)}
                                placeholder="Paste image URL"
                                style={{ width: "260px" }}
                            />
                        </div>
                    )}
                </div>

                {/* User Info */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <h1 style={{ margin: 0 }}>{effectiveUsername}</h1>
                        {!isMe && (
                            <button onClick={toggleFollow}>
                                {isFollowing ? "Following" : "Follow"}
                            </button>
                        )}
                        {isMe && (
                            <>
                                <button onClick={() => {
                                    if (editingPfp || editingBanner) {
                                        savePfp();
                                        saveBanner();
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
                                    <button onClick={() => { setEditingPfp(false); setEditingBanner(false); }}>
                                        Cancel
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: "16px" }}>
                        <Link
                            to={`/users/${effectiveUsername}/connections#followers`}
                            style={{ textDecoration: "none", color: "inherit" }}
                        >
                            <strong>{followCounts.followers}</strong> Followers
                        </Link>

                        <Link
                            to={`/users/${effectiveUsername}/connections#following`}
                            style={{ textDecoration: "none", color: "inherit" }}
                        >
                            <strong>{followCounts.following}</strong> Following
                        </Link>
                    </div>

                    <div style={{ display: "flex", gap: "16px" }}>
                        <div>
                            <strong>{ratingCounts.albums}</strong> {ratingCounts.albums === 1 ? "Album" : "Albums"}
                        </div>
                        <div>
                            <strong>{ratingCounts.artists}</strong> {ratingCounts.artists === 1 ? "Artist" : "Artists"}
                        </div>
                    </div>
                </div>
            </div>

            <h3><Link to={`/users/${effectiveUsername}/listen-list`}>Listen List</Link></h3>

            {/* Top 5 Albums */}
            <Link to={`/albums/users/${effectiveUsername}`}><h2>Top Albums</h2></Link>
            {topAlbums.length > 0 && (
                <div style={{ display: "flex", gap: "4px" }}>
                    {topAlbums.map(album => (
                        album.coverArt && (
                            <Link
                                key={album.id}
                                to={`/albums/${album.id}/users/${effectiveUsername}`}
                            >
                                <img
                                    src={album.coverArt}
                                    alt={album.title}
                                    style={{ width: "140px", height: "140px", objectFit: "cover", borderRadius: "4px" }}
                                />
                            </Link>
                        )
                    ))}
                </div>
            )}

            {/* Top 5 Artists */}
            <Link to={`/artists/users/${effectiveUsername}`}><h2>Top Artists</h2></Link>
            {topArtists.length > 0 && (
                <div style={{ display: "flex", gap: "4px" }}>
                    {topArtists.map(artist => (
                        artist.image && (
                            <Link
                                key={artist.id}
                                to={`/artists/${artist.id}/users/${effectiveUsername}`}
                            >
                                <img
                                    src={artist.image}
                                    alt=""
                                    style={{ width: "140px", height: "140px", objectFit: "cover", borderRadius: "50%" }}
                                />
                            </Link>
                        )
                    ))}
                </div>
            )}
        </div>
    );
}