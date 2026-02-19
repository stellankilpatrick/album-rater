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

  const { username } = useParams();
  const effectiveUsername = username ?? user?.username;

  useEffect(() => {
    fetchArtist();
  }, [artistId]);

  const fetchArtist = async () => {
    try {
      const res = await api.get(`/artists/${artistId}`); // public endpoint

      setArtist(res.data.artist);

      // normalize release date
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
      const res = await api.patch(`/artists/${artistId}/image`, {
        image: editImage.trim()
      });
      setArtist(res.data);
      setIsEditingImage(false);
    } catch (err) {
      console.error("Failed to update artist image", err);
      alert("Failed to save image.");
    }
  };

  if (loading) return <p>Loading artist...</p>;
  if (!artist) return <p>Artist not found.</p>;

  return (
    <div>

      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {artist.image && !isEditingImage && (
            <img
              src={artist.image}
              alt={`${artist.name} cover`}
              onClick={() => setIsEditingImage(true)}
              style={{
                width: "150px",
                height: "150px",
                objectFit: "cover",
                borderRadius: "50%",
                cursor: "pointer"
              }}
            />
          )}

          <h1 style={{ margin: 0 }}>Albums by {artist.name}</h1>

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

      {albums.length === 0 ? (
        <p>No albums for this artist.</p>
      ) : (
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
            {albums
              .slice()
              .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))
              .map((album, i) => (
                <tr
                  key={album.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/albums/${album.id}`)}
                >
                  <td>{i + 1}</td>
                  <td style={{ textAlign: "left" }}>
                    {album.albumCoverArt && (
                      <img
                        src={album.albumCoverArt}
                        alt={album.title}
                        style={{ width: "22px", height: "22px", objectFit: "cover", borderRadius: "3px" }}
                      />
                    )}
                  </td>
                  <td style={{ padding: "4px 8px" }}><i>{album.title}</i></td>
                  <td style={{ padding: "4px 8px" }}>
                    {album.releaseDate ? album.releaseDate.slice(0, 4) : ""}
                  </td>
                  <td style={{ padding: "4px 8px" }}>
                    {(album.avgScore ?? 0).toFixed(1)}
                  </td>
                  <td style={{ padding: "4px 8px" }}>{album.ratingCount ?? 0}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      <Link to={`/artists/${artist.id}/users/${effectiveUsername}`} style={{}}>
        Your favorite albums by {artist.name}
      </Link>
    </div>
  );
}