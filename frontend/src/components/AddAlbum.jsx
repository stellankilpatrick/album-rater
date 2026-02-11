import { useState } from "react";
import { Link, useNavigate, useParams, Navigate } from "react-router-dom";
import AddAlbumForm from "../components/AddAlbumForm";

export default function AddAlbum({ user }) {
    const [addedAlbum, setAddedAlbum] = useState(null);
    const navigate = useNavigate();
    const { username } = useParams();

    // Determine which username to use
    const effectiveUsername =  user?.username;

    // Redirect if no user is available
    if (!effectiveUsername) {
        return <Navigate to="/login" />;
    }

    const handleAdd = (album) => {
        setAddedAlbum(album);
        navigate(`/albums/${album.id}`);
    };

    return (
        <div className="add-album-page">
            <h1>Add a New Album</h1>

            <AddAlbumForm onAdd={handleAdd} />

            {addedAlbum && (
                <div className="added-album-summary">
                    <h2>Album Added!</h2>
                    <p>
                        <strong>Title:</strong> {addedAlbum.title} <br />
                        <strong>Artist:</strong> {addedAlbum.artist} <br />
                        <strong>Release Date:</strong> {addedAlbum.releaseDate || "N/A"}
                    </p>
                </div>
            )}
        </div>
    );
}