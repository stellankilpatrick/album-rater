import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/api";

export default function ArtistDetailPublic({ user }) {
  const { artistId } = useParams();
  const navigate = useNavigate();

  const [artist, setArtist] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editImage, setEditImage] = useState("");
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [hasRatedArtist, setHasRatedArtist] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [sortMode, setSortMode] = useState("reviews");
  const [viewMode, setViewMode] = useState("grid");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const { username } = useParams();
  const effectiveUsername = username ?? user?.username;

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setViewMode("grid");
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetchArtist();
  }, [artistId]);

  useEffect(() => {
    if (!user || !artistId) return;
    api.get(`/artists/${artistId}/users/${effectiveUsername}`)
      .then(res => setHasRatedArtist(res.data.albums?.length > 0))
      .catch(() => setHasRatedArtist(false));
  }, [artistId, effectiveUsername]);

  const fetchArtist = async () => {
    try {
      const res = await api.get(`/artists/${artistId}`);
      setArtist(res.data.artist);
      const normalized = res.data.albums.map(a => ({
        ...a,
        releaseDate: a.releaseDate ?? a.release_date ?? "",
        avgScore: a.avgScore ?? 0
      }));
      setAlbums(normalized);
      setEditImage(res.data.artist.image || "");
    } catch (err) {
      console.error("Failed to fetch artist", err);
    } finally {
      setLoading(false);
    }
  };

  const saveArtistImage = async () => {
    if (!editImage.trim()) return;
    try {
      const res = await api.patch(`/artists/${artistId}/image`, { image: editImage.trim() });
      setArtist(res.data);
      setIsEditingImage(false);
    } catch (err) {
      console.error("Failed to update artist image", err);
      alert("Failed to save image.");
    }
  };

  const saveArtistName = async () => {
    if (!editName.trim()) return;
    try {
      const res = await api.patch(`/artists/${artistId}/name`, { name: editName.trim() });
      setArtist(res.data);
      setIsEditingName(false);
    } catch (err) {
      console.error("Failed to update artist name", err);
      alert("Failed to save name.");
    }
  };

  const deleteArtist = async () => {
    if (!window.confirm("Delete this artist?")) return;
    try {
      await api.delete(`/artists/${artistId}`);
      navigate("/artists");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete artist");
    }
  };

  if (loading) return <p>Loading artist...</p>;
  if (!artist) return <p>Artist not found.</p>;

  const sortedAlbums = albums.slice().sort((a, b) => {
    if (sortMode === "chronological") return new Date(a.releaseDate) - new Date(b.releaseDate);
    if (sortMode === "reviews") {
      const diff = (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
      return diff !== 0 ? diff : (b.avgScore ?? 0) - (a.avgScore ?? 0);
    }
    return 0;
  });

  return (
    <div>
      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          {artist.image && !isEditingImage && (
            <img
              src={artist.image}
              alt={`${artist.name} cover`}
              onClick={() => setIsEditingImage(true)}
              style={{ width: isMobile ? "80px" : "200px", height: isMobile ? "80px" : "200px", objectFit: "cover", borderRadius: "50%", cursor: "pointer" }}
            />
          )}

          {isEditingName ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveArtistName()}
                style={{ fontSize: "1.5rem", borderRadius: "3px" }}
              />
              <button onClick={saveArtistName}>Save</button>
              <button onClick={() => setIsEditingName(false)}>Cancel</button>
            </div>
          ) : (
            <h1
              style={{ margin: 0, cursor: "pointer", fontSize: isMobile ? "1.3rem" : undefined }}
              onClick={() => { setEditName(artist.name); setIsEditingName(true); }}
            >
              Albums by {artist.name}
            </h1>
          )}

          {isEditingImage && (
            <div>
              <input
                type="text"
                placeholder="Paste image URL here"
                value={editImage}
                onChange={e => setEditImage(e.target.value)}
                style={{ maxWidth: "250px", marginRight: "6px", borderRadius: "3px" }}
              />
              <button onClick={saveArtistImage}>Save</button>
              <button onClick={() => setIsEditingImage(false)}>Cancel</button>
            </div>
          )}
        </div>

        {!artist.image && !isEditingImage && (
          <button onClick={() => setIsEditingImage(true)}>Add Artist Image</button>
        )}
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
        <button onClick={() => setSortMode(prev => prev === "chronological" ? "reviews" : "chronological")}>
          {sortMode === "chronological" ? "Sort: Chronological" : "Sort: Reviews"}
        </button>
        {!isMobile && (
          <button onClick={() => setViewMode(prev => prev === "list" ? "grid" : "list")}>
            {viewMode === "list" ? "Grid View" : "List View"}
          </button>
        )}
        {hasRatedArtist && (
          <button>
            <Link to={`/artists/${artist.id}/users/${effectiveUsername}`}>
              Your rated albums by {artist.name}
            </Link>
          </button>
        )}
      </div>

      {albums.length === 0 ? (
        <div>
          <p>No albums for this artist.</p>
          {user && (
            <button
              onClick={deleteArtist}
              style={{ backgroundColor: "red", color: "white", border: "none", borderRadius: "4px", padding: "0.3rem 0.6rem", cursor: "pointer" }}
            >
              Delete artist
            </button>
          )}
        </div>
      ) : viewMode === "list" ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Rank</th>
              <th></th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Album</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Released</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Avg Score</th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Reviews</th>
            </tr>
          </thead>
          <tbody>
            {sortedAlbums.map((album, i) => (
              <tr key={album.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/albums/${album.id}`)}>
                <td>{i + 1}</td>
                <td>
                  {album.albumCoverArt && (
                    <img src={album.albumCoverArt} alt={album.title} style={{ width: "22px", height: "22px", objectFit: "cover", borderRadius: "3px" }} />
                  )}
                </td>
                <td style={{ padding: "4px 8px" }}><i>{album.title}</i></td>
                <td style={{ padding: "4px 8px" }}>{album.releaseDate ? album.releaseDate.slice(0, 4) : ""}</td>
                <td style={{ padding: "4px 8px" }}>{(album.avgScore ?? 0).toFixed(1)}</td>
                <td style={{ padding: "4px 8px" }}>{album.ratingCount ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(auto-fill, minmax(200px, 1fr))",
          gap: isMobile ? "10px" : "16px"
        }}>
          {sortedAlbums.map((album, i) => (
            <div
              key={album.id}
              style={{ cursor: "pointer", textAlign: "center" }}
              onClick={() => navigate(`/albums/${album.id}`)}
            >
              {(album.albumCoverArt || album.coverArt) && (
                <img
                  src={album.albumCoverArt || album.coverArt}
                  alt={album.title}
                  style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: "6px", marginBottom: "4px" }}
                />
              )}
              <div style={{ fontSize: isMobile ? "11px" : "15px", fontWeight: 500 }}>
                <i>{album.title}</i> · {album.releaseDate?.slice(0, 4)}
              </div>
              <div style={{ fontSize: isMobile ? "10px" : "14px", color: "#888" }}>
                {album.ratingCount ?? 0} reviews · {(album.avgScore ?? 0).toFixed(1)} avg
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}