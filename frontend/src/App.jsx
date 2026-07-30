import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TopNav from "./components/TopNav"
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
  const [user, setUser] = useState(undefined); // undefined = loading, null = no user
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setUser(null);
        setAuthChecking(false);
        return;
      }

      try {
        const res = await api.get("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        setUser(res.data);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem("token");
        }
        setUser(null);
      } finally {
        setAuthChecking(false);
      }
    };

    bootstrap();
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem("token", token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 6, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 24, height: 24, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {user && (
        <TopNav
          effectiveUsername={user.username}
          email={user.email}
          onLogout={handleLogout}
        />
      )}
      <div style={{ padding: "10px 16px 0 10px" }}>
        <Routes>
          {/* not logged in */}
          {user === null && (
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