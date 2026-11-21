import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from "react-router-dom";
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
import Drafts from './components/Drafts';
import SearchResults from "./components/SearchResults";
import UserConnections from "./components/UserConnections";
import Community from "./components/Community";
import Home from "./components/Home"
import Recommendations from "./components/Recommendations";
import Help from "./components/Help";
import RequestPasswordReset from "./components/RequestPasswordReset";
import ResetPassword from "./components/ResetPassword";

const SCROLL_POSITION_PREFIX = "album-rater-scroll:";
const SCROLL_PATH_PREFIX = "album-rater-scroll-path:";
const SCROLL_ENTRY_STATE_KEY = "__albumRaterScrollKey";

function readStoredScrollPosition(key) {
  const storedPosition = sessionStorage.getItem(key);
  if (storedPosition === null) return null;

  const position = Number(storedPosition);
  return Number.isFinite(position) ? position : null;
}

function restorePendingScroll(pendingPosition) {
  const position = pendingPosition.current;
  if (position === null) return;

  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  if (position <= maxScroll) {
    window.scrollTo(0, position);
    pendingPosition.current = null;
  }
}

function getScrollEntryKey(locationKey) {
  if (locationKey !== "default") return locationKey;

  const state = window.history.state;
  if (typeof state?.[SCROLL_ENTRY_STATE_KEY] === "string") {
    return state[SCROLL_ENTRY_STATE_KEY];
  }

  const key = crypto.randomUUID();
  window.history.replaceState({ ...(state ?? {}), [SCROLL_ENTRY_STATE_KEY]: key }, "");
  return key;
}

function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map());
  const positionsByPath = useRef(new Map());
  const pendingPosition = useRef(null);
  const currentKey = useRef(null);
  const currentPath = useRef(`${location.pathname}${location.search}${location.hash}`);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useEffect(() => {
    const savePosition = () => {
      const position = window.scrollY;
      const key = currentKey.current;
      if (key === null) return;
      positions.current.set(key, position);
      sessionStorage.setItem(`${SCROLL_POSITION_PREFIX}${key}`, String(position));
      const path = currentPath.current;
      positionsByPath.current.set(path, position);
      sessionStorage.setItem(`${SCROLL_PATH_PREFIX}${path}`, String(position));
    };

    const saveBeforeNavigation = (event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link || link.target === "_blank") return;

      const destination = new URL(link.href, window.location.href);
      if (destination.origin === window.location.origin) savePosition();
    };

    window.addEventListener("scroll", savePosition, { passive: true });
    window.addEventListener("pagehide", savePosition);
    document.addEventListener("click", saveBeforeNavigation, true);

    return () => {
      window.removeEventListener("scroll", savePosition);
      window.removeEventListener("pagehide", savePosition);
      document.removeEventListener("click", saveBeforeNavigation, true);
    };
  }, []);

  useLayoutEffect(() => {
    const nextKey = getScrollEntryKey(location.key);
    currentKey.current = nextKey;
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    currentPath.current = nextPath;

    const entryPosition = positions.current.get(nextKey)
      ?? readStoredScrollPosition(`${SCROLL_POSITION_PREFIX}${nextKey}`);
    const pathPosition = positionsByPath.current.get(nextPath)
      ?? readStoredScrollPosition(`${SCROLL_PATH_PREFIX}${nextPath}`);
    const nextPosition = navigationType === "POP"
      ? pathPosition ?? entryPosition ?? 0
      : 0;
    pendingPosition.current = Number.isFinite(nextPosition) ? nextPosition : 0;
    restorePendingScroll(pendingPosition);
  }, [location.key, location.pathname, location.search, location.hash, navigationType]);

  useEffect(() => {
    const observer = new ResizeObserver(() => restorePendingScroll(pendingPosition));
    const mutations = new MutationObserver(() => restorePendingScroll(pendingPosition));
    observer.observe(document.documentElement);
    observer.observe(document.body);
    mutations.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);

  return null;
}

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
      <ScrollRestoration />
      {user && (
        <TopNav
          effectiveUsername={user.username}
          email={user.email}
          onLogout={handleLogout}
        />
      )}
      <div style={{ padding: "10px 16px 0 10px" }}>
        <Routes>
          {/* public password-reset pages */}
          <Route path="/request-password-reset" element={<RequestPasswordReset />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/help" element={<Help />} />
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
              <Route path="/users/:username/drafts" element={<Drafts user={user} />} />
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