(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const THEME_KEY = "ak_theme";
  const DISCOVERY_QUEUE_KEY = "ak_discovery_queue_v1";
  const DISCOVERY_LAST_ALBUM_KEY = "ak_discovery_last_album_v1";
  const DISCOVERY_LAST_IMAGE_KEY = "ak_discovery_last_image_v1";

  const html = document.documentElement;

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // The page still works when localStorage is unavailable.
    }
  }

  function readTheme() {
    const saved = safeGet(THEME_KEY);

    if (saved === "dark" || saved === "light") {
      return saved;
    }

    return "light";
  }

  function updateThemeButton(theme) {
    const themeButton = document.getElementById("themeToggle");

    if (!themeButton) {
      return;
    }

    const label =
      theme === "dark"
        ? "Use light theme"
        : "Use dark theme";

    themeButton.textContent = "\u25D0";
    themeButton.setAttribute("aria-label", label);
    themeButton.setAttribute("title", label);
  }

  function applyTheme(theme) {
    html.setAttribute("data-theme", theme);
    safeSet(THEME_KEY, theme);
    updateThemeButton(theme);
  }

  function initializeThemeControls() {
    const themeButton = document.getElementById("themeToggle");

    updateThemeButton(
      html.getAttribute("data-theme") || "light"
    );

    if (!themeButton) {
      return;
    }

    themeButton.addEventListener("click", function () {
      const current =
        html.getAttribute("data-theme") || "light";

      applyTheme(
        current === "dark" ? "light" : "dark"
      );
    });
  }

  function shuffle(items) {
    const shuffled = items.slice();

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(
        Math.random() * (index + 1)
      );

      [shuffled[index], shuffled[randomIndex]] =
        [shuffled[randomIndex], shuffled[index]];
    }

    return shuffled;
  }

  function readStoredQueue(validUrls) {
    const rawQueue = safeGet(DISCOVERY_QUEUE_KEY);

    if (!rawQueue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawQueue);

      if (!Array.isArray(parsed)) {
        return [];
      }

      const seen = new Set();
      const queue = [];

      for (const url of parsed) {
        if (
          typeof url === "string" &&
          validUrls.has(url) &&
          !seen.has(url)
        ) {
          queue.push(url);
          seen.add(url);
        }
      }

      return queue;
    } catch (error) {
      return [];
    }
  }

  function chooseDiscoveryAlbum(albums) {
    const albumsByUrl = new Map(
      albums.map(function (album) {
        return [album.url, album];
      })
    );

    const validUrls = new Set(albumsByUrl.keys());
    let queue = readStoredQueue(validUrls);

    const queuedUrls = new Set(queue);
    const missingUrls = albums
      .map(function (album) {
        return album.url;
      })
      .filter(function (url) {
        return !queuedUrls.has(url);
      });

    if (queue.length > 0 && missingUrls.length > 0) {
      queue.push(...shuffle(missingUrls));
    }

    if (queue.length === 0) {
      queue = shuffle(Array.from(validUrls));

      const previousAlbum =
        safeGet(DISCOVERY_LAST_ALBUM_KEY);

      if (
        queue.length > 1 &&
        queue[0] === previousAlbum
      ) {
        const swapIndex =
          1 + Math.floor(Math.random() * (queue.length - 1));

        [queue[0], queue[swapIndex]] =
          [queue[swapIndex], queue[0]];
      }
    }

    const selectedUrl = queue.shift();

    safeSet(
      DISCOVERY_QUEUE_KEY,
      JSON.stringify(queue)
    );

    safeSet(
      DISCOVERY_LAST_ALBUM_KEY,
      selectedUrl
    );

    return albumsByUrl.get(selectedUrl);
  }

  function chooseDiscoveryImage(album) {
    const count = Number(album.count) || 1;
    const firstEligible = count >= 3 ? 3 : 1;

    let choices = [];

    for (
      let imageNumber = firstEligible;
      imageNumber <= count;
      imageNumber += 1
    ) {
      choices.push(imageNumber);
    }

    const previousImage =
      safeGet(DISCOVERY_LAST_IMAGE_KEY);

    if (choices.length > 1) {
      choices = choices.filter(function (imageNumber) {
        return (
          album.url + "|" + imageNumber !== previousImage
        );
      });
    }

    const selected =
      choices[Math.floor(Math.random() * choices.length)];

    safeSet(
      DISCOVERY_LAST_IMAGE_KEY,
      album.url + "|" + selected
    );

    return selected;
  }

  async function preloadImage(url) {
    await new Promise(function (resolve, reject) {
      const image = new Image();

      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
  }

  async function initializeDiscoveryImage() {
    const featureLink =
      document.getElementById("homeFeatureLink");

    const featureImage =
      document.getElementById("homeFeatureImage");

    const featureSource =
      document.getElementById("homeFeatureSource");

    if (!featureLink || !featureImage || !featureSource) {
      return;
    }

    function revealFeatureImage() {
      requestAnimationFrame(function () {
        featureImage.classList.add("is-ready");
      });
    }

    try {
      const response = await fetch(
        "/journal/journal.json",
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(
          "Journal data request failed with status " +
          response.status
        );
      }

      const journal = await response.json();
      const albums = [];

      for (const month of journal.months || []) {
        for (const album of month.albums || []) {
          if (
            album &&
            album.url &&
            album.title &&
            Number(album.count) > 0
          ) {
            albums.push({
              ...album,
              monthTitle: month.title || ""
            });
          }
        }
      }

      if (albums.length === 0) {
        revealFeatureImage();
        return;
      }

      const album = chooseDiscoveryAlbum(albums);
      const imageNumber = chooseDiscoveryImage(album);

      const extension = String(
        album.ext || "jpg"
      ).replace(/^\./, "");

      const albumUrl = album.url.endsWith("/")
        ? album.url
        : album.url + "/";

      const imageUrl =
        albumUrl + imageNumber + "." + extension;

      await preloadImage(imageUrl);

      const imageAlt =
        album.title +
        " \u2014 photograph " +
        imageNumber +
        " of " +
        album.count;

      featureLink.href = albumUrl;
      featureLink.setAttribute(
        "aria-label",
        "Open " + album.title + " photo journal"
      );

      featureImage.src = imageUrl;
      featureImage.alt = imageAlt;

      featureSource.textContent =
        album.title +
        " \u00B7 " +
        album.monthTitle;

      featureSource.hidden = false;
      revealFeatureImage();
    } catch (error) {
      console.warn(
        "The discovery image could not be loaded. " +
        "Using the selected fallback image.",
        error
      );

      revealFeatureImage();
    }
  }

  function initializePage() {
    initializeThemeControls();
    initializeDiscoveryImage();
  }

  applyTheme(readTheme());

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializePage
    );
  } else {
    initializePage();
  }
})();
