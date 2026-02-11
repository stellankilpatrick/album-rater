import db from "../db/database.js";

// MOVE TO USER.MODELS.JS, rename getUserArtistRankings()
export function getArtistRankings() {
  // Get all artists
  const artists = db.prepare("SELECT * FROM artists").all();

  return artists
    .map(artist => {
      // Get albums for this artist
      const albums = db.prepare(`
      SELECT a.* 
      FROM albums a
      WHERE a.artist_id = ?
    `).all(artist.id);

      const albumsWithRating = attachAlbumStats(albums);

      return {
        ...artist,
        albums: albumsWithRating,
      };
    })
    .filter(artist => artist.albums.length > 0);
}

export function getAllRatedArtists() {
  return db.prepare(`
    WITH user_album_scores AS (
      SELECT
        a.id AS album_id,
        a.artist_id,
        sr.user_id,
        (SUM(sr.rating) * SUM(sr.rating)) * 1.0 / COUNT(sr.rating) AS userScore
      FROM albums a
      JOIN songs s ON s.album_id = a.id
      JOIN song_ratings sr ON sr.song_id = s.id
      GROUP BY a.id, sr.user_id
    ),
    album_scores AS (
      SELECT
        album_id,
        artist_id,
        AVG(userScore) AS albumScore,
        COUNT(user_id) AS ratingCount
      FROM user_album_scores
      GROUP BY album_id
    )
    SELECT
      ar.id,
      ar.name,
      ar.image,
      ROUND(AVG(album_scores.albumScore), 2) AS avgRating,
      SUM(album_scores.ratingCount) AS ratingCount,
      COUNT(album_scores.album_id) AS albumCount
    FROM artists ar
    JOIN album_scores ON album_scores.artist_id = ar.id
    GROUP BY ar.id
    ORDER BY avgRating DESC
  `).all();
}

/**
 * Returns all albums (with statistics) that an artist has
 */
export function getArtistAlbums(artistId) {
  const albums = db.prepare(`
    SELECT a.*
    FROM albums a
    WHERE a.artist_id = ?
    `).all(artistId);

  return attachAlbumStats(albums);
}

function attachAlbumStats(albums, userId) {
  return albums.map(album => {
    const stats = db.prepare(`
      SELECT
        COUNT(s.id) AS totalSongs,
        SUM(CASE WHEN sr.rating > 0 THEN 1 ELSE 0 END) AS ratedSongs,
        SUM(COALESCE(sr.rating, 0)) AS sumRatings
      FROM songs s
      LEFT JOIN song_ratings sr
        ON sr.song_id = s.id
       AND sr.user_id = ?
      WHERE s.album_id = ?
    `).get(userId, album.id);

    const totalSongs = stats?.totalSongs ?? 0;
    const ratedSongs = stats?.ratedSongs ?? 0;
    const sumRatings = stats?.sumRatings ?? 0;

    return {
      ...album,
      rating: totalSongs > 0
        ? Math.pow(sumRatings, 2) / totalSongs
        : 0,
      rate: `${ratedSongs}/${totalSongs}`
    };
  });
}

export function getArtistAlbumsWithTotal(artistId) {
  const albums = db.prepare(`
    WITH user_album_scores AS (
      SELECT
        a.id AS albumId,
        a.cover_art AS albumCoverArt,
        sr.user_id,
        (SUM(sr.rating) * SUM(sr.rating)) * 1.0 / COUNT(sr.rating) AS userScore
      FROM albums a
      JOIN songs s ON s.album_id = a.id
      JOIN song_ratings sr ON sr.song_id = s.id
      WHERE a.artist_id = ?
      GROUP BY a.id, sr.user_id
    )
    SELECT
      a.id,
      a.title,
      a.release_date AS releaseDate,
      a.cover_art AS albumCoverArt,
      ar.name AS artist,
      ar.image AS artistImage,
      ROUND(AVG(uas.userScore), 2) AS avgScore,
      COUNT(uas.user_id) AS ratingCount
    FROM albums a
    JOIN artists ar ON ar.id = a.artist_id
    LEFT JOIN user_album_scores uas ON uas.albumId = a.id
    WHERE a.artist_id = ?
    GROUP BY a.id
    ORDER BY avgScore DESC
  `).all(artistId, artistId);

  const totalRating = albums.reduce(
    (sum, a) => sum + (a.avgScore * a.ratingCount),
    0
  );

  return { albums, totalRating };
}

export function getUserRatedAlbumsByArtist(userId, artistId) {
  return db.prepare(`
    SELECT
      a.id,
      a.title,
      a.release_date AS releaseDate,
      a.cover_art AS coverArt,
      ar.id AS artistId,
      ar.name AS artist,
      ar.image AS artistImage,

      COUNT(s.id) AS numSongs,
      COUNT(CASE WHEN sr.rating > 0 THEN 1 END) AS ratedSongs,
      COALESCE(SUM(sr.rating), 0) AS totalValue

    FROM albums a
    JOIN artists ar ON ar.id = a.artist_id
    JOIN songs s ON s.album_id = a.id
    LEFT JOIN song_ratings sr
      ON sr.song_id = s.id
     AND sr.user_id = ?

    WHERE ar.id = ?

    GROUP BY a.id
    HAVING ratedSongs > 0
    ORDER BY (COALESCE(SUM(sr.rating), 0) * COALESCE(SUM(sr.rating), 0)) / COUNT(s.id) DESC
  `).all(userId, artistId)
  .map(a => ({
    ...a,
    rating: a.numSongs > 0
      ? Math.pow(a.totalValue, 2) / a.numSongs
      : 0,
    rate: `${a.ratedSongs}/${a.numSongs}`
  }));
}

export function attachUserAlbumStats(albums, userId) {
  return albums.map(a => {
    const stats = db.prepare(`
      SELECT
        COUNT(s.id) AS numSongs,
        COUNT(CASE WHEN sr.rating > 0 THEN 1 END) AS ratedSongs,
        SUM(sr.rating) AS totalRating
      FROM songs s
      LEFT JOIN song_ratings sr
        ON sr.song_id = s.id AND sr.user_id = ?
      WHERE s.album_id = ?
    `).get(userId, a.id);

    const numSongs = stats?.numSongs ?? 0;
    const ratedSongs = stats?.ratedSongs ?? 0;
    const totalRating = stats?.totalRating ?? 0;

    return {
      ...a,
      personalScore:
        numSongs > 0 ? Math.pow(totalRating, 2) / numSongs : 0,
      rate: `${ratedSongs}/${numSongs}`
    };
  });
}

export function getUserArtistStats(userId) {
  return db.prepare(`
    WITH album_scores AS (
      SELECT
        a.id AS album_id,
        a.artist_id,
        a.cover_art AS coverArt,
        SUM(sr.rating) AS ratingSum,
        COUNT(sr.rating) AS ratedSongs
      FROM albums a
      JOIN songs s ON s.album_id = a.id
      LEFT JOIN song_ratings sr
        ON sr.song_id = s.id
       AND sr.user_id = ?
      GROUP BY a.id
      HAVING ratedSongs > 0
    )
    SELECT
      ar.id,
      ar.name,
      ar.image,
      COUNT(album_scores.album_id) AS albumCount,
      SUM((ratingSum * ratingSum) * 1.0 / ratedSongs) AS totalScore
    FROM artists ar
    JOIN album_scores ON album_scores.artist_id = ar.id
    GROUP BY ar.id
    ORDER BY totalScore DESC
  `).all(userId);
}