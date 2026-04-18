import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TopNav from "./components/Header"
import AlbumList from "./components/AlbumList";
import AlbumDetail from "./components/AlbumDetail";
import ArtistList from "./components/ArtistList";
import ArtistDetail from "./components/ArtistDetail";
import UserPage from "./components/UserPage";
import AuthPage from "./components/AuthPage";
import api from "./api/api";
import AlbumsPublic from "./components/AlbumsPublic";
import AlbumDetailPublic from "./components/AlbumDetailPublic";
import AddAlbum from "./components/AddAlbum";
import ArtistsPublic from "./components/ArtistsPublic";
import ArtistDetailPublic from "./components/ArtistDetailPublic";
import ListenList from "./components/ListenList";
import SearchResults from "./components/SearchResults";
import UserConnections from "./components/UserConnections";
import Community from "./components/Community";
import Home from "./components/Home"
import Recommendations from "./components/Recommendations";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api
        .get("/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem("token");
          setUser(null);
        });
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem("token", token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <BrowserRouter>
      {user && (
        <TopNav
          effectiveUsername={user.username}
          onLogout={handleLogout}
        />
      )}
      <div style={{ padding: "10px 16px 0 10px" }}>
        <Routes>
          {/* not logged in */}
          {!user && (
            <Route path="/*" element={<AuthPage onLogin={handleLogin} />} />
          )}

          {user && (
            <>
              {/* /me shortcuts (most specific) */}
              <Route path="/albums/:albumId/me" element={<AlbumDetail user={user} />} />
              <Route path="/artists/:artistId/me" element={<ArtistDetail user={user} />} />
              <Route path="/albums/me" element={<AlbumList user={user} />} />
              <Route path="/artists/me" element={<ArtistList user={user} />} />
              <Route path="/me" element={<UserPage user={user} />} />

              {/* user-owned pages */}
              <Route path="/albums/:albumId/users/:username" element={<AlbumDetail user={user} />} />
              <Route path="/artists/:artistId/users/:username" element={<ArtistDetail user={user} />} />
              <Route path="/albums/users/:username" element={<AlbumList user={user} />} />
              <Route path="/artists/users/:username" element={<ArtistList user={user} />} />
              <Route path="/users/:username/listen-list" element={<ListenList user={user} />} />
              <Route path="/users/:username" element={<UserPage user={user} />} />
              <Route path="/users/:username/connections" element={<UserConnections />} />

              {/* public pages */}
              <Route path="/albums/new" element={<AddAlbum user={user} />} />
              <Route path="/albums/:albumId" element={<AlbumDetailPublic user={user} />} />
              <Route path="/albums" element={<AlbumsPublic user={user} />} />
              <Route path="/artists/:artistId" element={<ArtistDetailPublic user={user} />} />
              <Route path="/artists" element={<ArtistsPublic user={user} />} />
              <Route path="/community/recommendations" element={<Recommendations user={user} />} />
              <Route path="/community" element={<Community user={user} />} />
              <Route path="/" element={<Home user={user} />} />

              <Route path="/search" element={<SearchResults user={user} />} />

              {/* catch-all */}
              <Route path="*" element={<Navigate to="/me" />} />
            </>
          )}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;