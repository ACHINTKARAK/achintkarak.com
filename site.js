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

      const descriptiveAlt = album.alts && album.alts[String(imageNumber)];
      featureLink.href = albumUrl;
      featureLink.setAttribute(
        "aria-label",
        "Open " + album.title + " photo journal"
      );

      featureImage.src = imageUrl;
      featureImage.alt =
        typeof descriptiveAlt === "string" && descriptiveAlt.trim()
          ? descriptiveAlt
          : imageAlt;

      const exploreLink = document.getElementById("homeFeatureExplore");
      if (exploreLink) exploreLink.href = albumUrl;

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

  // ---------- Optional full-screen album gallery ----------
  function initializeAlbumGallery() {
    const sourcePhotos = Array.from(document.querySelectorAll("figure.frame > img"));
    if (
      sourcePhotos.length === 0 ||
      typeof HTMLDialogElement === "undefined" ||
      typeof HTMLDialogElement.prototype.showModal !== "function"
    ) {
      return;
    }

    function create(tag, className, label) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (label !== undefined) node.textContent = label;
      return node;
    }

    function getAlbumLink(anchor, baseUrl) {
      if (!anchor || !anchor.matches("a[href]")) return null;
      const href = new URL(anchor.getAttribute("href"), baseUrl);
      if (href.origin !== window.location.origin) return null;
      const fullName = anchor.querySelector(".album-name-full");
      const name = (fullName?.textContent || anchor.textContent || "")
        .replace(/^\s*←\s*/, "")
        .replace(/\s*→\s*$/, "")
        .trim();
      return { url: href.href, name: name || "Album" };
    }

    function shortAlbumName(name) {
      const firstPart = name.split(",")[0].trim();
      if (firstPart === "Kilkee and Lahinch") return "Kilkee";
      if (firstPart === "Westcork") return "West Cork";
      return firstPart;
    }

    function setAlbumButton(anchor, destination, isPrevious) {
      anchor.href = destination.url;
      const full = create(
        "span",
        "ak-gallery__album-label-full",
        isPrevious
          ? "← Previous album · " + destination.name
          : "Next album · " + destination.name + " →"
      );
      const compact = create(
        "span",
        "ak-gallery__album-label-short",
        (isPrevious ? "← " : "") + shortAlbumName(destination.name) +
          (isPrevious ? "" : " →")
      );
      anchor.replaceChildren(full, compact);
    }

    function parseAlbum(doc, albumUrl) {
      const frames = Array.from(doc.querySelectorAll("figure.frame"));
      if (frames.length !== 7) {
        throw new Error("Expected seven photographs in the selected album.");
      }
      const images = frames.map(function (frame) {
        const photo = frame.querySelector("img[src]");
        if (!photo) throw new Error("Album photograph is missing.");
        return {
          url: new URL(photo.getAttribute("src"), albumUrl).href,
          alt: photo.getAttribute("alt") || "",
          caption: frame.querySelector("figcaption")?.textContent.trim() || ""
        };
      });
      const name = doc.querySelector(".meta .place")?.textContent.trim();
      if (!name) throw new Error("Album title could not be found.");
      const nav = doc.querySelector('nav[aria-label="Album navigation"]');
      const items = Array.from(nav?.children || []);
      return {
        name,
        images,
        previous: getAlbumLink(items[0], albumUrl),
        next: getAlbumLink(items[items.length - 1], albumUrl)
      };
    }

    const originUrl = window.location.href;
    let originalAlbum;
    try {
      originalAlbum = parseAlbum(document, originUrl);
    } catch (error) {
      console.warn("Gallery unavailable for this album.", error);
      return;
    }

    const albumCache = new Map([[originUrl, originalAlbum]]);
    let activeAlbum = originalAlbum;
    let index = 0;
    let loading = false;
    let sourceFocus = null;
    let gesture = null;
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let scrollBeforeOpen = null;

    const dialog = create("dialog", "ak-gallery");
    dialog.setAttribute("aria-label", "Photograph gallery");
    const layout = create("div", "ak-gallery__layout");
    const header = create("div", "ak-gallery__header");
    const title = create("span", "ak-gallery__title", activeAlbum.name);
    title.setAttribute("aria-live", "polite");
    const close = create("button", "ak-gallery__close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close gallery");
    header.append(title, close);

    const stage = create("div", "ak-gallery__stage");
    const enlarged = create("img", "ak-gallery__image");
    enlarged.alt = "";
    enlarged.draggable = false;
    const previousPhoto = create("button", "ak-gallery__previous", "‹");
    previousPhoto.type = "button";
    previousPhoto.setAttribute("aria-label", "Previous photograph");
    const nextPhoto = create("button", "ak-gallery__following", "›");
    nextPhoto.type = "button";
    nextPhoto.setAttribute("aria-label", "Next photograph");
    stage.append(enlarged, previousPhoto, nextPhoto);

    const footer = create("div", "ak-gallery__footer");
    const caption = create("p", "ak-gallery__caption");
    const counter = create("span", "ak-gallery__count");
    const albumLinks = create("nav", "ak-gallery__album-links");
    albumLinks.setAttribute("aria-label", "Continue to another album");
    const previousAlbum = create("a", "ak-gallery__onward ak-gallery__go-back");
    const nextAlbum = create("a", "ak-gallery__onward ak-gallery__go-next");
    albumLinks.append(previousAlbum, nextAlbum);
    const status = create("p", "ak-gallery__status");
    status.setAttribute("role", "status");
    status.hidden = true;
    footer.append(caption, counter, albumLinks, status);
    layout.append(header, stage, footer);
    dialog.append(layout);
    document.body.append(dialog);

    // Scale only the photograph and constrain panning to its visible bounds.
    function applyZoom(scale, x, y) {
      zoom = Math.max(1, Math.min(4, scale));
      const ratio = enlarged.naturalWidth && enlarged.naturalHeight
        ? Math.min(enlarged.clientWidth / enlarged.naturalWidth, enlarged.clientHeight / enlarged.naturalHeight)
        : 0;
      const maxX = Math.max(0, (enlarged.naturalWidth * ratio * zoom - stage.clientWidth) / 2);
      const maxY = Math.max(0, (enlarged.naturalHeight * ratio * zoom - stage.clientHeight) / 2);
      panX = zoom === 1 ? 0 : Math.max(-maxX, Math.min(maxX, x));
      panY = zoom === 1 ? 0 : Math.max(-maxY, Math.min(maxY, y));
      enlarged.style.transform = zoom === 1 ? "" :
        "translate(" + panX + "px, " + panY + "px) scale(" + zoom + ")";
      stage.classList.toggle("is-zoomed", zoom > 1);
    }

    function resetZoom() {
      gesture = null;
      applyZoom(1, 0, 0);
    }

    function pinchGeometry(touches) {
      const first = touches[0], second = touches[1];
      const bounds = stage.getBoundingClientRect();
      return {
        distance: Math.max(1, Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)),
        x: (first.clientX + second.clientX) / 2 - bounds.left - bounds.width / 2,
        y: (first.clientY + second.clientY) / 2 - bounds.top - bounds.height / 2
      };
    }

    function beginPinch(touches) {
      const point = pinchGeometry(touches);
      gesture = { kind: "pinch", distance: point.distance, x: point.x, y: point.y,
        scale: zoom, panX, panY };
    }

    function beginSingleTouch(touch, allowSwipe) {
      gesture = { kind: zoom > 1 ? "pan" : allowSwipe ? "swipe" : "ignore",
        x: touch.clientX, y: touch.clientY, panX, panY };
    }

    function preloadNeighbor(photoIndex) {
      if (photoIndex < 0 || photoIndex >= activeAlbum.images.length) return;
      const preload = new Image();
      preload.src = activeAlbum.images[photoIndex].url;
    }

    function updateView(photoIndex) {
      if (photoIndex < 0 || photoIndex >= activeAlbum.images.length) return;
      resetZoom();
      index = photoIndex;
      const photo = activeAlbum.images[index];
      enlarged.src = photo.url;
      enlarged.alt = photo.alt || (activeAlbum.name + ", photograph " + (index + 1));
      title.textContent = activeAlbum.name;
      caption.textContent = photo.caption;
      caption.hidden = !photo.caption;
      counter.textContent = (index + 1) + " / " + activeAlbum.images.length;
      previousPhoto.hidden = index === 0;
      nextPhoto.hidden = index === activeAlbum.images.length - 1;

      const atEnd = index === activeAlbum.images.length - 1;
      const back = activeAlbum.previous;
      const forward = activeAlbum.next;
      albumLinks.hidden = !atEnd || (!back && !forward);
      previousAlbum.hidden = !atEnd || !back;
      nextAlbum.hidden = !atEnd || !forward;
      if (back) {
        setAlbumButton(previousAlbum, back, true);
      }
      if (forward) {
        setAlbumButton(nextAlbum, forward, false);
      }
      status.hidden = true;
      preloadNeighbor(index + 1);
    }

    async function changeAlbum(destination) {
      if (!destination || loading) return;
      loading = true;
      layout.setAttribute("aria-busy", "true");
      status.textContent = "Opening " + destination.name + "…";
      status.hidden = false;
      try {
        let album = albumCache.get(destination.url);
        if (!album) {
          const response = await fetch(destination.url, { credentials: "same-origin" });
          if (!response.ok) throw new Error("HTTP " + response.status);
          const html = await response.text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          album = parseAlbum(doc, response.url || destination.url);
          albumCache.set(destination.url, album);
        }
        activeAlbum = album;
        updateView(0);
        close.focus();
      } catch (error) {
        console.warn("Could not open gallery album:", destination.url, error);
        status.textContent = "Couldn't load the album. Please try again.";
        status.hidden = false;
      } finally {
        loading = false;
        layout.removeAttribute("aria-busy");
      }
    }

    function open(indexToOpen) {
      if (dialog.open) return;
      activeAlbum = originalAlbum;
      sourceFocus = sourcePhotos[indexToOpen];
      scrollBeforeOpen = { x: window.scrollX, y: window.scrollY };
      updateView(indexToOpen);
      dialog.showModal();
      document.body.classList.add("ak-gallery-open");
      close.focus({ preventScroll: true });
    }

    sourcePhotos.forEach(function (photo, photoIndex) {
      photo.setAttribute("role", "button");
      photo.tabIndex = 0;
      photo.setAttribute("data-ak-gallery-photo", "");
      photo.setAttribute(
        "aria-label",
        "Open photograph " + (photoIndex + 1) + " of " + sourcePhotos.length +
          (photo.alt ? ": " + photo.alt : "")
      );
      photo.addEventListener("click", function () { open(photoIndex); });
      photo.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(photoIndex);
        }
      });
    });

    previousAlbum.addEventListener("click", function (event) {
      event.preventDefault();
      changeAlbum(activeAlbum.previous);
    });
    nextAlbum.addEventListener("click", function (event) {
      event.preventDefault();
      changeAlbum(activeAlbum.next);
    });
    previousPhoto.addEventListener("click", function () { updateView(index - 1); });
    nextPhoto.addEventListener("click", function () { updateView(index + 1); });
    close.addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("close", function () {
      document.body.classList.remove("ak-gallery-open");
      resetZoom();
      if (sourceFocus && typeof sourceFocus.focus === "function") {
        sourceFocus.focus({ preventScroll: true });
      }
      if (scrollBeforeOpen) {
        window.scrollTo({ left: scrollBeforeOpen.x, top: scrollBeforeOpen.y, behavior: "instant" });
        scrollBeforeOpen = null;
      }
    });
    dialog.addEventListener("keydown", function (event) {
      if (loading) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        updateView(index - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        updateView(index + 1);
      }
    });

    stage.addEventListener("touchstart", function (event) {
      if (loading || event.target.closest("button")) return;
      if (event.touches.length >= 2) beginPinch(event.touches);
      else if (event.touches.length === 1) beginSingleTouch(event.touches[0], true);
    }, { passive: true });

    stage.addEventListener("touchmove", function (event) {
      if (!gesture || loading) return;
      if (event.cancelable) event.preventDefault();
      if (event.touches.length >= 2) {
        if (gesture.kind !== "pinch") beginPinch(event.touches);
        const point = pinchGeometry(event.touches);
        const scale = Math.max(1, Math.min(4, gesture.scale * point.distance / gesture.distance));
        const factor = scale / gesture.scale;
        applyZoom(scale, point.x - (gesture.x - gesture.panX) * factor,
          point.y - (gesture.y - gesture.panY) * factor);
      } else if (event.touches.length === 1 && gesture.kind === "pan") {
        const touch = event.touches[0];
        applyZoom(zoom, gesture.panX + touch.clientX - gesture.x,
          gesture.panY + touch.clientY - gesture.y);
      }
    }, { passive: false });

    stage.addEventListener("touchend", function (event) {
      if (!gesture || loading) return;
      if (event.touches.length >= 2) {
        beginPinch(event.touches);
        return;
      }
      if (event.touches.length === 1) {
        // After a pinch, the remaining finger must never change photographs.
        beginSingleTouch(event.touches[0], false);
        return;
      }
      const previous = gesture;
      gesture = null;
      if (previous.kind !== "swipe" || zoom !== 1 || event.changedTouches.length !== 1) return;
      const dx = event.changedTouches[0].clientX - previous.x;
      const dy = event.changedTouches[0].clientY - previous.y;
      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      updateView(index + (dx < 0 ? 1 : -1));
    }, { passive: true });

    stage.addEventListener("touchcancel", function () { gesture = null; });
    window.addEventListener("resize", function () {
      if (dialog.open) {
        gesture = null;
        applyZoom(zoom, panX, panY);
      }
    });
  }

  function initializePage() {
    initializeThemeControls();
    initializeDiscoveryImage();
    initializeAlbumGallery();
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
