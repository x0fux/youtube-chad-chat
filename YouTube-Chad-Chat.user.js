// ==UserScript==
// @name            YouTube Chad Chat
// @namespace       https://github.com/x0fux/youtube-chad-chat
// @version         0.20.1
// @author          0fux
// @description     Enhance YouTube live chats like a Chad.
// @encoding        utf-8
// @homepage        https://github.com/x0fux/youtube-chad-chat
// @icon            https://github.com/x0fux/youtube-chad-chat/raw/main/icon.png
// @updateURL       https://github.com/x0fux/youtube-chad-chat/raw/main/YouTube-Chad-Chat.user.js
// @downloadURL     https://github.com/x0fux/youtube-chad-chat/raw/main/YouTube-Chad-Chat.user.js
// @supportURL      https://github.com/x0fux/youtube-chad-chat/issues
// @match           *://*.youtube.com/live_chat*
// @compatible      chrome
// @compatible      edge
// @compatible      firefox
// @compatible      opera
// @compatible      safari
// @run-at          document-end
// ==/UserScript==

(function () {
  "use strict";

  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    window.trustedTypes.createPolicy('default', {
      createHTML: string => string,
      createScriptURL: string => string,
      createScript: string => string,
    });
  }

  // Mirrors the @version header above; kept as a plain constant (rather
  // than read from GM_info) since GM_info isn't guaranteed to be exposed
  // under @grant none across both Tampermonkey and Safari's Userscripts.
  // Bump this alongside @version whenever the version changes.
  const YTCC_VERSION = "0.20.1";

  // ===== Stylesheet ========================================
  const YTCC_STYLESHEET = `
  :root {
    --ytcc-mention-rgb: 244, 100, 52;
    --ytcc-mention-color: rgba(var(--ytcc-mention-rgb), 1.0);
    --ytcc-mention-bg-color: rgba(var(--ytcc-mention-rgb), 0.25);

    /* Dialog colors follow YouTube's own theme variables; the literal
       values are only fallbacks (light by default, dark under html[dark]). */
    --ytcc-text: var(--yt-spec-text-primary, #0f0f0f);
    --ytcc-text-secondary: var(--yt-spec-text-secondary, #606060);
    --ytcc-border: var(--yt-spec-10-percent-layer, rgba(0, 0, 0, 0.1));
    --ytcc-input-bg: var(--yt-spec-base-background, #ffffff);
    --ytcc-stripe: rgba(128, 128, 128, 0.08);
  }

  html[dark] {
    --ytcc-text: var(--yt-spec-text-primary, #ffffff);
    --ytcc-text-secondary: var(--yt-spec-text-secondary, #aaaaaa);
    --ytcc-border: var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.1));
    --ytcc-input-bg: var(--yt-spec-base-background, #121212);
  }

  /* The "Alternate rows" setting toggles .ytcc-alt-rows on <html>. :where()
     keeps these rules at their original specificity so .ytcc-me below
     still overrides the alternate background. */
  :where(.ytcc-alt-rows) yt-live-chat-text-message-renderer {
    border-bottom: 1px solid #60606040;
  }

  yt-live-chat-text-message-renderer #author-name {
    cursor: pointer;
  }

  :where(.ytcc-alt-rows) .ytcc-alt {
    background-color: #80808020;
  }

  .ytcc-me {
    padding-left: 16px;
    border-left: 8px solid var(--ytcc-mention-color);
    background-color: var(--ytcc-mention-bg-color);
  }

  /* Mentions are wrapped in YouTube's own "mention" class (see
     ytcc_wrapMatchesInElement below), so they inherit YouTube's native
     mention styling automatically - no ytcc-specific rule needed here. */

  /* ----- Header settings button ----- */
  .ytcc-header-icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 8px;
    margin: 0;
    border: none;
    background: transparent;
    color: var(--yt-spec-icon-inactive, currentColor);
    cursor: pointer;
    border-radius: 50%;
    box-sizing: border-box;
    vertical-align: middle;
  }

  .ytcc-header-icon-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .ytcc-header-icon-button svg {
    width: 24px;
    height: 24px;
  }

  /* ----- Author context menu ----- */
  .ytcc-context-menu {
    position: fixed;
    z-index: 99999;
    min-width: 190px;
    background: var(--yt-live-chat-background-color, #212121);
    color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,0.5);
    overflow: hidden;
    font-family: "Roboto", "Arial", sans-serif;
  }

  .ytcc-context-menu-header {
    padding: 10px 16px;
    font-weight: 500;
    font-size: 13px;
    color: #aaaaaa;
    border-bottom: 1px solid #3f3f3f;
    pointer-events: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 260px;
  }

  .ytcc-context-menu-item {
    cursor: pointer;
    font-size: 14px;
    white-space: nowrap;
  }

  /* Small raised count pill after a menu label (e.g. History entries). */
  .ytcc-menu-badge {
    position: relative;
    top: -0.45em;
    margin-left: 6px;
    padding: 0 6px;
    font-size: 0.7em;
    line-height: 1.6;
    border-radius: 999px;
    background: rgba(128, 128, 128, 0.25);
    opacity: 0.8;
  }

  .ytcc-context-menu-item[disabled] {
    opacity: 0.5;
    cursor: default;
  }

  /* ----- Dialogs (Mark / Settings) ----- */
  .ytcc-dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ytcc-mark-dialog {
    background: var(--yt-live-chat-background-color, #212121);
    color: var(--ytcc-text);
    border-radius: 12px;
    min-width: 280px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    font-family: "Roboto", "Arial", sans-serif;
    overflow: hidden;
  }

  .ytcc-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--ytcc-border);
    gap: 12px;
  }

  .ytcc-dialog-title {
    font-size: 15px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
  }

  .ytcc-dialog-version {
    font-size: 0.7em;
    font-weight: 400;
    color: var(--ytcc-text-secondary);
    margin-left: 6px;
  }

  .ytcc-dialog-close, .ytcc-color-clear {
    background: none;
    border: none;
    color: var(--ytcc-text-secondary);
    font-size: 14px;
    cursor: pointer;
    line-height: 1;
    padding: 4px;
    flex: 0 0 auto;
  }

  .ytcc-dialog-close {
    font-size: 16px;
  }

  .ytcc-dialog-close:hover, .ytcc-color-clear:hover {
    color: var(--ytcc-text);
  }

  .ytcc-dialog-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .ytcc-color-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    gap: 12px;
  }

  .ytcc-color-row-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ytcc-color-row input[type="color"] {
    width: 32px;
    height: 28px;
    border: none;
    background: none;
    cursor: pointer;
    padding: 0;
    flex: 0 0 auto;
  }

  .ytcc-color-row input[type="range"] {
    width: 70px;
    cursor: pointer;
  }

  .ytcc-dialog-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 12px 16px;
    border-top: 1px solid var(--ytcc-border);
    gap: 12px;
  }

  .ytcc-settings-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .ytcc-setting-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
  }

  .ytcc-setting-row input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .ytcc-setting-row-disabled,
  .ytcc-setting-row-disabled input[type="checkbox"] {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ytcc-setting-row-text {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    cursor: default;
  }

  .ytcc-setting-text {
    background: var(--ytcc-input-bg);
    color: var(--ytcc-text);
    border: 1px solid var(--ytcc-border);
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 13px;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }

  .ytcc-setting-text:focus {
    outline: none;
    border-color: #909090;
  }

  /* ----- Mark dialog: Author font combobox ----- */
  .ytcc-font-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    gap: 12px;
  }

  .ytcc-font-row-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ytcc-font-combo {
    position: relative;
  }

  .ytcc-font-combo .ytcc-setting-text {
    width: 150px;
  }

  .ytcc-font-options {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    right: 0;
    z-index: 1;
    max-height: 150px;
    overflow-y: auto;
    background: var(--yt-live-chat-background-color, #212121);
    border: 1px solid var(--ytcc-border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  }

  .ytcc-font-option {
    padding: 6px 10px;
    font-size: 14px;
    white-space: nowrap;
    cursor: pointer;
  }

  .ytcc-font-option:hover {
    background: rgba(128, 128, 128, 0.2);
  }

  .ytcc-marked {
    transition: background-color 0.2s ease;
  }

  /* ----- History dialog ----- */
  .ytcc-history-dialog {
    min-width: 320px;
  }

  .ytcc-history-table-wrap {
    max-height: 260px;
    overflow-y: auto;
    border: 1px solid var(--ytcc-border);
    border-radius: 6px;
  }

  .ytcc-history-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .ytcc-history-table th, .ytcc-history-table td {
    text-align: left;
    padding: 6px 10px;
    white-space: nowrap;
  }

  .ytcc-history-table thead th {
    position: sticky;
    top: 0;
    background: var(--yt-live-chat-background-color, #212121);
    border-bottom: 1px solid var(--ytcc-border);
    font-weight: 500;
  }

  .ytcc-history-table tbody tr:nth-child(odd) {
    background: var(--ytcc-stripe);
  }

  .ytcc-history-empty {
    text-align: center;
    color: var(--ytcc-text-secondary);
    padding: 16px 10px;
    white-space: normal;
  }

  .ytcc-history-channel-link {
    color: inherit;
    text-decoration: none;
  }

  .ytcc-history-channel-link:hover {
    text-decoration: underline;
  }

  .ytcc-dialog-link {
    display: block;
    text-align: center;
    color: inherit;
    text-decoration: none;
    font-size: 12px;
    opacity: 0.7;
    flex: 1;
  }

  .ytcc-dialog-link:hover {
    text-decoration: underline;
    opacity: 1;
  }
  `;


  // ===== Cross-Tab Write Safety (Web Locks API) ===============
  // localStorage has no atomic read-modify-write primitive, so two tabs
  // (e.g. the main chat and a popped-out chat window, both on the same
  // stream) can race: both read the same snapshot, both write, and
  // whichever writes second silently discards the other's update. The
  // Web Locks API provides a real mutex shared across all tabs of the
  // same origin, so every read-modify-write below is wrapped in a named
  // lock (one per storage key) rather than left as separate, racy
  // load()/save() calls.
  //
  // ytcc_withLock falls back to running unprotected if the API isn't
  // available (older engines); this keeps the script working, just
  // without the cross-tab guarantee, and warns once via the console.
  let ytcc_warnedNoLocks = false;

  function ytcc_withLock(name, fn) {
    if (window.navigator && navigator.locks && navigator.locks.request) {
      return navigator.locks.request(name, fn);
    }
    if (!ytcc_warnedNoLocks) {
      ytcc_warnedNoLocks = true;
      console.warn("YTCC: Web Locks API unavailable; localStorage writes are not protected against cross-tab races.");
    }
    return Promise.resolve().then(fn);
  }

  // Loads the current value for a storage key, lets `mutator` change it
  // in place (or return a replacement value), then saves the result -
  // all inside a single lock acquisition so no other tab's write can
  // land in between the read and the save.
  function ytcc_mutateMarks(mutator) {
    return ytcc_withLock("ytcc-marks", async () => {
      const marks = ytcc_loadMarks();
      const result = mutator(marks) ?? marks;
      ytcc_saveMarks(result);
      return result;
    });
  }

  function ytcc_mutateSettings(mutator) {
    return ytcc_withLock("ytcc-settings", async () => {
      const settings = ytcc_loadSettings();
      const result = mutator(settings) ?? settings;
      ytcc_saveSettings(result);
      return result;
    });
  }

  function ytcc_mutateHistory(mutator) {
    return ytcc_withLock("ytcc-history", async () => {
      const history = ytcc_loadHistory();
      const result = mutator(history) ?? history;
      ytcc_saveHistory(result);
      return result;
    });
  }


  // ===== Settings Storage (localStorage) ====================
  const YTCC_SETTINGS_KEY = "ytcc_settings";
  const YTCC_DEFAULT_SETTINGS = {
    autoLiveChat: true,
    alternateRows: true,
    clickToMention: true,
    spamSend: true,
    trackHistory: false,
    notifyOnMention: false,
    mentionRegex: ""
  };

  function ytcc_loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(YTCC_SETTINGS_KEY)) || {};
      return Object.assign({}, YTCC_DEFAULT_SETTINGS, stored);
    } catch (e) {
      console.warn("YTCC: failed to parse stored settings, using defaults.", e);
      return Object.assign({}, YTCC_DEFAULT_SETTINGS);
    }
  }

  function ytcc_saveSettings(settings) {
    try {
      localStorage.setItem(YTCC_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("YTCC: failed to save settings.", e);
    }
  }


  // ===== Author Mark Storage (localStorage) ================
  // Each mark can independently set (all values are #RRGGBBAA, alpha included):
  //   authorColor      - plain text color on #author-name
  //   authorHighlight  - a rounded "chip" background on #author-name,
  //                       matching the shape YouTube uses for #author-name.owner
  //   chatHighlight    - background color across the whole message row
  //   authorFont       - CSS font-family value for #author-name
  const YTCC_MARKS_KEY = "ytcc_author_marks";

  function ytcc_loadMarks() {
    try {
      return JSON.parse(localStorage.getItem(YTCC_MARKS_KEY)) || {};
    } catch (e) {
      console.warn("YTCC: failed to parse stored author marks, resetting.", e);
      return {};
    }
  }

  function ytcc_saveMarks(marks) {
    try {
      localStorage.setItem(YTCC_MARKS_KEY, JSON.stringify(marks));
    } catch (e) {
      console.warn("YTCC: failed to save author marks.", e);
    }
  }

  // Registry so a mark change can be applied live to every currently
  // rendered message from that author, not just new ones.
  const ytcc_keyToNodes = new Map();

  function ytcc_registerNode(key, node) {
    if (!ytcc_keyToNodes.has(key)) ytcc_keyToNodes.set(key, new Set());
    ytcc_keyToNodes.get(key).add(node);
  }

  function ytcc_unregisterNode(node) {
    if (!node || !node.dataset) return;
    const key = node.dataset.ytccAuthorKey;
    if (key && ytcc_keyToNodes.has(key)) {
      ytcc_keyToNodes.get(key).delete(node);
      if (ytcc_keyToNodes.get(key).size === 0) ytcc_keyToNodes.delete(key);
    }
  }

  // ----- "Owner chip" shape mirroring -----
  // Rather than hardcoding guessed padding/border-radius values for the
  // owner-style badge, capture the real computed shape from any genuine
  // span#author-name.owner we encounter in this chat, and reuse it. Falls
  // back to a reasonable default until (or unless) one shows up.
  let ytcc_ownerBadgeMetrics = null;

  function ytcc_captureOwnerBadgeMetrics(authorNameEl) {
    if (!authorNameEl) return;
    const cs = window.getComputedStyle(authorNameEl);
    ytcc_ownerBadgeMetrics = {
      borderRadius: cs.borderRadius && cs.borderRadius !== "0px" ? cs.borderRadius : "8px",
      padding: cs.padding && cs.padding !== "0px" ? cs.padding : "2px 6px",
      fontWeight: cs.fontWeight || "500",
    };
  }

  function ytcc_getOwnerBadgeMetrics() {
    return ytcc_ownerBadgeMetrics || {
      borderRadius: "8px",
      padding: "2px 6px",
      fontWeight: "500",
    };
  }

  function ytcc_applyMarkToNode(node) {
    const key = node.dataset.ytccAuthorKey;
    if (!key) return;

    const marks = ytcc_loadMarks();
    const mark = marks[key];
    const authorEl = node.querySelector("#author-name");

    // Reset to defaults first, then layer on whatever is set.
    if (authorEl) {
      authorEl.style.color = "";
      authorEl.style.backgroundColor = "";
      authorEl.style.borderRadius = "";
      authorEl.style.padding = "";
      authorEl.style.display = "";
      authorEl.style.fontWeight = "";
      authorEl.style.fontFamily = "";
    }
    node.style.backgroundColor = "";
    node.classList.remove("ytcc-marked");

    if (!mark) return;

    if (mark.authorFont && authorEl) {
      authorEl.style.fontFamily = mark.authorFont;
    }

    if (mark.authorColor && authorEl) {
      authorEl.style.color = mark.authorColor;
    }

    if (mark.authorHighlight && authorEl) {
      const metrics = ytcc_getOwnerBadgeMetrics();
      authorEl.style.backgroundColor = mark.authorHighlight;
      authorEl.style.borderRadius = metrics.borderRadius;
      authorEl.style.padding = metrics.padding;
      authorEl.style.fontWeight = metrics.fontWeight;
      authorEl.style.display = "inline-block";
    }

    if (mark.chatHighlight) {
      node.style.backgroundColor = mark.chatHighlight;
      node.classList.add("ytcc-marked");
    }
  }

  function ytcc_updateAllNodesForKey(key) {
    const nodes = ytcc_keyToNodes.get(key);
    if (!nodes) return;
    nodes.forEach(ytcc_applyMarkToNode);
  }

  function ytcc_reapplyAllMarks() {
    ytcc_keyToNodes.forEach((nodes) => nodes.forEach(ytcc_applyMarkToNode));
  }

  // ----- #RRGGBBAA helpers (native <input type="color"> has no alpha) -----
  function ytcc_splitHex8(hex8, fallbackColor, fallbackAlpha) {
    const clean = (hex8 || "").replace("#", "");
    if (clean.length >= 6) {
      const color = `#${clean.slice(0, 6)}`;
      const alpha = clean.length >= 8 ? parseInt(clean.slice(6, 8), 16) : 255;
      return { color, alpha: Number.isNaN(alpha) ? 255 : alpha };
    }
    return { color: fallbackColor || "#000000", alpha: fallbackAlpha != null ? fallbackAlpha : 255 };
  }

  function ytcc_combineHex8(colorHex, alpha) {
    const clean = (colorHex || "#000000").replace("#", "");
    const aHex = Math.max(0, Math.min(255, Number(alpha) || 0)).toString(16).padStart(2, "0");
    return `#${clean}${aHex}`;
  }


  // ===== History Storage (localStorage) ======================
  // Only active when the "Track history" setting is checked. Structure:
  //   { [authorKey]: { [channelName]: isoTimestampOfMostRecentAppearance } }
  // Each author/channel pair keeps a single entry that's overwritten with
  // the newest timestamp every time that author chats on that channel,
  // so a channel they haven't visited since keeps its own last-seen time.
  const YTCC_HISTORY_KEY = "ytcc_history";

  function ytcc_loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(YTCC_HISTORY_KEY)) || {};
    } catch (e) {
      console.warn("YTCC: failed to parse stored history, resetting.", e);
      return {};
    }
  }

  function ytcc_saveHistory(history) {
    try {
      localStorage.setItem(YTCC_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn("YTCC: failed to save history.", e);
    }
  }

  function ytcc_recordHistory(authorKey) {
    if (!ytcc_loadSettings().trackHistory) return;

    const channelInfo = ytcc_getCurrentChannelInfo();
    if (!channelInfo || !channelInfo.name) return;

    ytcc_mutateHistory((history) => {
      const entry = history[authorKey] || {};
      entry[channelInfo.name] = new Date().toISOString();
      history[authorKey] = entry;
    }).catch((e) => console.warn("YTCC: failed to record history.", e));
  }

  function ytcc_clearHistoryForKey(key) {
    return ytcc_mutateHistory((history) => {
      delete history[key];
    });
  }

  function ytcc_clearAllHistory() {
    return ytcc_withLock("ytcc-history", async () => {
      ytcc_saveHistory({});
    });
  }

  function ytcc_formatTimestamp(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // History channel entries are stored as one of: an "@handle" (resolved
  // name), a ~24-char channel ID, an 11-char video ID (fallback when no
  // channel identity was resolved), or the literal "Unknown channel"
  // string (fallback when even the video ID was unavailable). Video and
  // channel IDs are their fixed, distinct lengths, which is what makes
  // them distinguishable from each other without a stored "kind" flag.
  // Note: the meta-tag/inline-data detection fallbacks (see
  // ytcc_detectChannelFromMetaTags/InlineData above) return a plain
  // display name with none of these shapes, so entries recorded from
  // those paths won't resolve to a working link here.
  function ytcc_getChannelHistoryLink(name) {
    if (!name || name === "Unknown channel") return null;
    if (name.startsWith("@")) return `https://www.youtube.com/${name}`;
    if (name.length === 11) return `https://www.youtube.com/watch?v=${name}`;
    return `https://www.youtube.com/channel/${name}`;
  }


  // ===== Author Identity =====================================
  // Best-effort resolution of a channel link for the "Visit channel" item
  // and a stable key to store marks against. YouTube's internal live-chat
  // markup isn't guaranteed to be stable, so this tries a few strategies
  // and falls back gracefully (disabling "Visit channel" and keying marks
  // by name) rather than throwing.
  function ytcc_getAuthorChannelInfo(node) {
    const linkSelectors = [
      'a[href*="/channel/"]',
      'a[href*="/@"]',
      "#author-photo a",
      "yt-live-chat-author-chip a"
    ];

    for (const sel of linkSelectors) {
      const a = node.querySelector(sel);
      if (a && a.href) {
        const handleMatch = a.href.match(/\/(@[\w.-]+)/);
        if (handleMatch) {
          return { handle: handleMatch[1], channelId: null, url: `https://www.youtube.com/${handleMatch[1]}` };
        }
        const channelMatch = a.href.match(/\/channel\/(UC[\w-]+)/);
        if (channelMatch) {
          return { handle: null, channelId: channelMatch[1], url: `https://www.youtube.com/channel/${channelMatch[1]}` };
        }
      }
    }

    // Fall back to the Polymer data model backing the element, if exposed.
    const dataSource = node.data || (node.__data && node.__data.item) || null;
    if (dataSource && dataSource.authorExternalChannelId) {
      const channelId = dataSource.authorExternalChannelId;
      return { handle: null, channelId, url: `https://www.youtube.com/channel/${channelId}` };
    }

    console.debug("YTCC: could not resolve a channel link for this message; inspect this node to help refine selectors.", node);
    return null;
  }

  function ytcc_getAuthorKey(authorName, channelInfo) {
    if (channelInfo) {
      return channelInfo.channelId ? `id:${channelInfo.channelId}` : `handle:${channelInfo.handle}`;
    }
    // Name-based fallback: not guaranteed unique, but keeps the feature
    // working even when a channel link can't be found.
    return `name:${(authorName || "").trim().toLowerCase()}`;
  }

  function ytcc_escapeHtml(str) {
    const div = document.createElement("div");
    div.innerText = str;
    return div.innerHTML;
  }

  // ----- Current (broadcasting) channel, for History -----
  // The live_chat page doesn't show the streaming channel's name in one
  // guaranteed place, so several sources are tried, in order of how
  // trustworthy they are. Once any of the first four succeeds the result
  // is locked in for the rest of the session (they should all agree, and
  // locking avoids re-scanning the DOM on every single chat message).
  // Only the final video-ID fallback is left unlocked, so detection keeps
  // retrying the real sources on later calls until one of them appears.
  //
  //   1) The "Show your support for @Handle" aria-label on the Super
  //      Thanks / heart button in the message input bar - confirmed
  //      working by testing against a real monetized channel's chat.
  //      Only present on monetized channels.
  //   2) The broadcasting channel's own messages in chat: any message
  //      whose #author-name carries YouTube's "owner" class is the
  //      streamer, and we already resolve a real channel handle/ID for
  //      every message via ytcc_getAuthorChannelInfo() - so once the
  //      broadcaster has said anything at all, that resolution is reused
  //      here directly instead of re-parsing the page (see
  //      ytcc_confirmCurrentChannel, called from ytcc_processNode).
  //   3) window.ytInitialData participants list: the entry whose
  //      authorBadges include a tooltip of "Owner" (falling back to
  //      participants[0] when the list is a single item). Found under
  //      either contents.liveChatRenderer or
  //      continuationContents.liveChatContinuation.
  //   4) schema.org meta tags / an inline ytInitialData "channelName"
  //      field, if present - unverified against a live page, kept as a
  //      lower-confidence fallback for non-monetized channels.
  //   5) The video ID from the URL, so History entries are at least
  //      distinguishable even with no channel name available yet.
  let ytcc_currentChannelInfo = null;

  function ytcc_confirmCurrentChannel(info) {
    if (!ytcc_currentChannelInfo && info && (info.handle || info.channelId)) {
      ytcc_currentChannelInfo = {
        name: info.handle || info.channelId,
        id: info.channelId || null,
        source: "owner-message"
      };
    }
  }

  function ytcc_decodeJsonString(raw) {
    try {
      return JSON.parse(`"${raw}"`);
    } catch (e) {
      return raw;
    }
  }

  function ytcc_detectChannelFromSupportButton() {
    const button = document.querySelector('button[aria-label*="Show your support for"]');
    if (!button) return null;
    const label = button.getAttribute("aria-label") || "";
    const match = label.match(/Show your support for (@\S+)/i);
    return match ? { name: match[1], id: null, source: "support-button" } : null;
  }

  function ytcc_detectChannelFromMetaTags() {
    const nameLink = document.querySelector('link[itemprop="name"]');
    if (!nameLink || !nameLink.content) return null;
    const channelIdMeta = document.querySelector('meta[itemprop="channelId"]');
    return { name: nameLink.content, id: channelIdMeta ? channelIdMeta.content : null, source: "meta-tag" };
  }

  function ytcc_detectChannelFromInlineData() {
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const text = script.textContent;
      if (!text || !text.includes("channelName")) continue;
      const match = text.match(/"channelName":"((?:[^"\\]|\\.)*)"/);
      if (match) return { name: ytcc_decodeJsonString(match[1]), id: null, source: "inline-data" };
    }
    return null;
  }

  function ytcc_participantHasOwnerBadge(participant) {
    const badges = participant &&
        participant.liveChatParticipantRenderer &&
        participant.liveChatParticipantRenderer.authorBadges;
    if (!Array.isArray(badges)) return false;
    return badges.some((badge) => {
      const tooltip = badge &&
          badge.liveChatAuthorBadgeRenderer &&
          badge.liveChatAuthorBadgeRenderer.tooltip;
      return tooltip === "Owner";
    });
  }

  function ytcc_channelInfoFromParticipant(participant) {
    const renderer = participant && participant.liveChatParticipantRenderer;
    if (!renderer) return null;
    const name = renderer.authorName && renderer.authorName.simpleText;
    if (!name) return null;
    const channelId = renderer.authorExternalChannelId || null;
    return { name, id: channelId, source: "yt-initial-data" };
  }

  function ytcc_detectChannelFromInitialData() {
    const data = window.ytInitialData;
    if (!data || typeof data !== "object") return null;

    const participants =
        (data.contents &&
            data.contents.liveChatRenderer &&
            data.contents.liveChatRenderer.participantsList &&
            data.contents.liveChatRenderer.participantsList.liveChatParticipantsListRenderer &&
            data.contents.liveChatRenderer.participantsList.liveChatParticipantsListRenderer.participants) ||
        (data.continuationContents &&
            data.continuationContents.liveChatContinuation &&
            data.continuationContents.liveChatContinuation.participantsList &&
            data.continuationContents.liveChatContinuation.participantsList.liveChatParticipantsListRenderer &&
            data.continuationContents.liveChatContinuation.participantsList.liveChatParticipantsListRenderer.participants) ||
        null;

    if (!Array.isArray(participants) || participants.length === 0) return null;

    const owner = participants.find(ytcc_participantHasOwnerBadge);
    if (owner) return ytcc_channelInfoFromParticipant(owner);

    // Single unverified entry is still worth using; a multi-item list
    // without an Owner badge is too ambiguous.
    if (participants.length === 1) return ytcc_channelInfoFromParticipant(participants[0]);
    return null;
  }

  function ytcc_getCurrentChannelInfo() {
    if (ytcc_currentChannelInfo) return ytcc_currentChannelInfo;

    const detected = ytcc_detectChannelFromSupportButton()
        || ytcc_detectChannelFromInitialData()
        || ytcc_detectChannelFromMetaTags()
        || ytcc_detectChannelFromInlineData();

    if (detected) {
      ytcc_currentChannelInfo = detected;
      return detected;
    }

    // Not cached: keep retrying the real sources above on future calls.
    const videoId = new URLSearchParams(window.location.search).get("v");
    return { name: videoId || "Unknown channel", id: null, source: "video-id" };
  }


  // ===== Chat Mention ======================================
  // Clicking an author name moves focus/selection away from the chat
  // input, so document.getSelection() is useless by the time we insert.
  // YouTube also rebuilds the contenteditable's text nodes on blur / send,
  // which invalidates a saved Range. Store a character offset into the
  // current plain text instead, and re-apply it against whatever DOM is
  // present when the mention is inserted. An empty box (after sending a
  // chat) resets the offset to 0.
  let ytcc_savedCaretOffset = null;

  function ytcc_getInputBox() {
    const panel = document.querySelector("#input-panel");
    const inputField = panel && panel.querySelector("yt-live-chat-text-input-field-renderer");
    return inputField ? inputField.querySelector("#input") : null;
  }

  function ytcc_inputPlainText(inputBox) {
    return inputBox ? (inputBox.innerText || inputBox.textContent || "") : "";
  }

  function ytcc_selectionOffsetIn(inputBox) {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const start = range.startContainer;
    if (start !== inputBox && !inputBox.contains(start)) return null;
    const prefix = document.createRange();
    prefix.selectNodeContents(inputBox);
    try {
      prefix.setEnd(range.startContainer, range.startOffset);
    } catch (e) {
      return null;
    }
    return prefix.toString().length;
  }

  function ytcc_setCaretOffset(inputBox, offset) {
    const textLength = ytcc_inputPlainText(inputBox).length;
    let remaining = Math.max(0, Math.min(offset == null ? textLength : offset, textLength));

    const walker = document.createTreeWalker(inputBox, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const len = node.nodeValue.length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const selection = document.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      remaining -= len;
    }

    const range = document.createRange();
    range.selectNodeContents(inputBox);
    range.collapse(false);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function ytcc_captureCaretOffset() {
    const inputBox = ytcc_getInputBox();
    if (!inputBox) return;
    const text = ytcc_inputPlainText(inputBox);
    if (!text) {
      ytcc_savedCaretOffset = 0;
      return;
    }
    const offset = ytcc_selectionOffsetIn(inputBox);
    if (offset != null) ytcc_savedCaretOffset = offset;
  }

  function ytcc_trackInputSelection() {
    const inputBox = ytcc_getInputBox();
    if (!inputBox) return false;
    if (inputBox.dataset.ytccTracked) return true;
    inputBox.dataset.ytccTracked = "true";

    document.addEventListener("selectionchange", ytcc_captureCaretOffset);
    inputBox.addEventListener("input", ytcc_captureCaretOffset);
    inputBox.addEventListener("keyup", ytcc_captureCaretOffset);
    inputBox.addEventListener("click", ytcc_captureCaretOffset);
    inputBox.addEventListener("focus", ytcc_captureCaretOffset);

    return true;
  }

  function ytcc_ensureInputSelectionTracking() {
    if (ytcc_trackInputSelection()) return;
    const watcher = new MutationObserver(() => {
      if (ytcc_trackInputSelection()) watcher.disconnect();
    });
    watcher.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => watcher.disconnect(), 15000);
  }

  function ytcc_mentionAuthor(mention, event) {
    if (!ytcc_loadSettings().clickToMention) return;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const inputBox = ytcc_getInputBox();
    if (!inputBox) return;

    const insert = `${mention} `;
    // Snapshot before the click-driven focus change can rebuild the box.
    const offsetAtClick = ytcc_savedCaretOffset;

    setTimeout(function () {
      const box = ytcc_getInputBox();
      if (!box) return;
      box.focus();

      const currentText = ytcc_inputPlainText(box);
      const offset = currentText.length === 0
          ? 0
          : Math.max(0, Math.min(offsetAtClick == null ? currentText.length : offsetAtClick, currentText.length));

      ytcc_setCaretOffset(box, offset);

      if (document.execCommand) {
        document.execCommand("insertText", false, insert);
      } else {
        const sel = document.getSelection();
        if (sel && sel.rangeCount > 0) {
          sel.getRangeAt(0).deleteContents();
          sel.getRangeAt(0).insertNode(document.createTextNode(insert));
        }
      }

      ytcc_savedCaretOffset = offset + insert.length;
      ytcc_setCaretOffset(box, ytcc_savedCaretOffset);
    }, 0);
  }


  // ===== Author Context Menu ================================
  // Built from the same tp-yt-paper-listbox / tp-yt-paper-item custom
  // elements YouTube already uses on this page (see the chat-mode
  // switcher below), so it inherits YouTube's own theming for free.
  let ytcc_activeMenu = null;

  function ytcc_closeContextMenu() {
    if (ytcc_activeMenu) {
      ytcc_activeMenu.remove();
      ytcc_activeMenu = null;
      document.removeEventListener("click", ytcc_onDocumentClickCloseMenu, true);
      document.removeEventListener("keydown", ytcc_onEscCloseMenu, true);
    }
  }

  function ytcc_onDocumentClickCloseMenu(e) {
    if (ytcc_activeMenu && !ytcc_activeMenu.contains(e.target)) {
      ytcc_closeContextMenu();
    }
  }

  function ytcc_onEscCloseMenu(e) {
    if (e.key === "Escape") {
      ytcc_closeContextMenu();
      ytcc_closeDialog();
    }
  }

  function ytcc_openContextMenu(x, y, chatData) {
    ytcc_closeContextMenu();
    ytcc_closeDialog();

    const authorName = chatData.author.innerText;
    const key = chatData.authorKey;
    const channelInfo = chatData.channelInfo;

    const menu = document.createElement("div");
    menu.className = "ytcc-context-menu";

    const listbox = document.createElement("tp-yt-paper-listbox");
    listbox.setAttribute("role", "listbox");

    const header = document.createElement("div");
    header.className = "ytcc-context-menu-header";
    header.innerText = authorName;
    listbox.appendChild(header);

    const visitItem = document.createElement("tp-yt-paper-item");
    visitItem.className = "ytcc-context-menu-item";
    visitItem.innerText = "Visit channel";
    if (!channelInfo) {
      visitItem.setAttribute("disabled", "");
      visitItem.title = "Couldn't determine this viewer's channel link";
    } else {
      visitItem.addEventListener("click", () => {
        window.open(channelInfo.url, "_blank", "noopener,noreferrer");
        ytcc_closeContextMenu();
      });
    }
    listbox.appendChild(visitItem);

    const markItem = document.createElement("tp-yt-paper-item");
    markItem.className = "ytcc-context-menu-item";
    markItem.innerText = "Mark\u2026";
    markItem.addEventListener("click", () => {
      ytcc_closeContextMenu();
      ytcc_openMarkDialog(authorName, key);
    });
    listbox.appendChild(markItem);

    const historyItem = document.createElement("tp-yt-paper-item");
    historyItem.className = "ytcc-context-menu-item";
    historyItem.textContent = "History\u2026";
    const historyCount = Object.keys(ytcc_loadHistory()[key] || {}).length;
    const historyBadge = document.createElement("span");
    historyBadge.className = "ytcc-menu-badge";
    historyBadge.textContent = historyCount;
    historyItem.appendChild(historyBadge);
    historyItem.addEventListener("click", () => {
      ytcc_closeContextMenu();
      ytcc_openHistoryDialog(authorName, key);
    });
    listbox.appendChild(historyItem);

    menu.appendChild(listbox);
    document.body.appendChild(menu);

    // Keep the menu inside the viewport.
    const rect = menu.getBoundingClientRect();
    const posX = Math.min(x, window.innerWidth - rect.width - 8);
    const posY = Math.min(y, window.innerHeight - rect.height - 8);
    menu.style.left = `${Math.max(8, posX)}px`;
    menu.style.top = `${Math.max(8, posY)}px`;

    ytcc_activeMenu = menu;
    // Deferred so the contextmenu event that opened this doesn't
    // immediately trigger the outside-click close handler.
    setTimeout(() => {
      document.addEventListener("click", ytcc_onDocumentClickCloseMenu, true);
      document.addEventListener("keydown", ytcc_onEscCloseMenu, true);
    }, 0);
  }


  // ===== Dialogs (Mark / Settings) ===========================
  let ytcc_activeDialog = null;

  function ytcc_closeDialog() {
    if (ytcc_activeDialog) {
      ytcc_activeDialog.remove();
      ytcc_activeDialog = null;
    }
  }

  // ----- Mark dialog -----
  // Three independent color options, each with its own clear ("x") button:
  //   Author color      -> plain text color
  //   Author highlight  -> rounded chip background, same shape as the
  //                        owner badge (see ytcc_getOwnerBadgeMetrics)
  //   Chat highlight    -> full message row background
  // Every color includes an alpha slider alongside the native color swatch,
  // since <input type="color"> alone has no alpha support.
  const YTCC_MARK_FIELDS = [
    { field: "authorColor", label: "Author color", defaultValue: "#FFFFFFB3" },
    { field: "authorHighlight", label: "Author highlight", defaultValue: "#00000000" },
    { field: "chatHighlight", label: "Chat highlight", defaultValue: "#00000000" }
  ];

  // Generic CSS font families offered by the "Author font" combobox.
  const YTCC_GENERIC_FONTS = [
    "sans-serif", "serif", "monospace", "cursive", "fantasy",
    "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded"
  ];

  function ytcc_openMarkDialog(authorName, key) {
    ytcc_closeDialog();

    const marks = ytcc_loadMarks();
    const existing = marks[key] || {};

    const overlay = document.createElement("div");
    overlay.className = "ytcc-dialog-overlay";

    const dialog = document.createElement("div");
    dialog.className = "ytcc-mark-dialog";

    const rowsHtml = YTCC_MARK_FIELDS.map(({ field, label, defaultValue }) => {
      const fallback = ytcc_splitHex8(defaultValue);
      const current = ytcc_splitHex8(existing[field], fallback.color, fallback.alpha);
      return `
      <div class="ytcc-color-row">
        <span>${ytcc_escapeHtml(label)}</span>
        <div class="ytcc-color-row-controls">
          <input type="color" class="ytcc-mark-color" data-field="${field}"
                 data-default-color="${fallback.color}" data-default-alpha="${fallback.alpha}"
                 value="${current.color}">
          <input type="range" class="ytcc-mark-alpha" data-field="${field}" min="0" max="255"
                 value="${current.alpha}" title="Opacity">
          <button type="button" class="ytcc-color-clear" data-field="${field}" aria-label="Clear ${ytcc_escapeHtml(label)}">\u2715</button>
        </div>
      </div>
      `;
    }).join("");

    dialog.innerHTML = `
      <div class="ytcc-dialog-header">
        <span class="ytcc-dialog-title">Mark ${ytcc_escapeHtml(authorName)}</span>
        <button type="button" class="ytcc-dialog-close" aria-label="Close">\u2715</button>
      </div>
      <div class="ytcc-dialog-body">
        <div class="ytcc-font-row">
          <span>Author font</span>
          <div class="ytcc-font-row-controls">
            <div class="ytcc-font-combo">
              <input type="text" class="ytcc-setting-text ytcc-mark-font" placeholder="Default"
                     autocomplete="off" spellcheck="false">
              <div class="ytcc-font-options" hidden></div>
            </div>
            <button type="button" class="ytcc-color-clear ytcc-font-clear" aria-label="Clear Author font">\u2715</button>
          </div>
        </div>
        ${rowsHtml}
      </div>
      <div class="ytcc-dialog-footer">
        <tp-yt-paper-button class="ytcc-unmark-btn">Clear all</tp-yt-paper-button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // No explicit "Save" button: every color/alpha change is persisted and
    // applied live immediately.
    function persistField(field, colorHex, alpha) {
      ytcc_mutateMarks((marks) => {
        const mark = marks[key] || {};
        mark[field] = ytcc_combineHex8(colorHex, alpha);
        marks[key] = mark;
      }).then(() => ytcc_updateAllNodesForKey(key))
          .catch((e) => console.warn("YTCC: failed to save mark.", e));
    }

    function clearField(field, colorInput, alphaInput) {
      ytcc_mutateMarks((marks) => {
        const mark = marks[key];
        if (mark) {
          delete mark[field];
          if (Object.keys(mark).length === 0) delete marks[key];
        }
      }).then(() => {
        ytcc_updateAllNodesForKey(key);
        colorInput.value = colorInput.dataset.defaultColor;
        alphaInput.value = colorInput.dataset.defaultAlpha;
      }).catch((e) => console.warn("YTCC: failed to clear mark.", e));
    }

    // ----- Author font combobox -----
    // A free-text CSS font-family input plus a filtered suggestion list of
    // the generic families, each previewed in its own font. Set via .value
    // (not the HTML template) since font values commonly contain quotes.
    const fontInput = dialog.querySelector(".ytcc-mark-font");
    const fontOptions = dialog.querySelector(".ytcc-font-options");
    fontInput.value = existing.authorFont || "";

    function persistFont(value) {
      const font = value.trim();
      ytcc_mutateMarks((marks) => {
        const mark = marks[key] || {};
        if (font) {
          mark.authorFont = font;
          marks[key] = mark;
        } else {
          delete mark.authorFont;
          if (Object.keys(mark).length === 0) delete marks[key];
          else marks[key] = mark;
        }
      }).then(() => ytcc_updateAllNodesForKey(key))
          .catch((e) => console.warn("YTCC: failed to save mark.", e));
    }

    function renderFontOptions(filter) {
      const needle = filter.trim().toLowerCase();
      fontOptions.textContent = "";
      YTCC_GENERIC_FONTS.filter((name) => name.includes(needle)).forEach((name) => {
        const option = document.createElement("div");
        option.className = "ytcc-font-option";
        option.textContent = name;
        option.style.fontFamily = name;
        // Keep focus in the input so choosing doesn't blur-close the list.
        option.addEventListener("mousedown", (e) => e.preventDefault());
        option.addEventListener("click", () => {
          fontInput.value = name;
          fontOptions.hidden = true;
          persistFont(name);
        });
        fontOptions.appendChild(option);
      });
      fontOptions.hidden = fontOptions.childElementCount === 0;
    }

    fontInput.addEventListener("focus", () => renderFontOptions(""));
    fontInput.addEventListener("click", () => {
      if (fontOptions.hidden) renderFontOptions("");
    });
    fontInput.addEventListener("input", () => {
      renderFontOptions(fontInput.value);
      persistFont(fontInput.value);
    });
    fontInput.addEventListener("blur", () => { fontOptions.hidden = true; });
    fontInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fontOptions.hidden = true;
    });
    dialog.querySelector(".ytcc-font-clear").addEventListener("click", () => {
      fontInput.value = "";
      fontOptions.hidden = true;
      persistFont("");
    });

    dialog.querySelectorAll(".ytcc-color-row").forEach((row) => {
      const colorInput = row.querySelector(".ytcc-mark-color");
      const alphaInput = row.querySelector(".ytcc-mark-alpha");
      const field = colorInput.dataset.field;

      const onChange = () => persistField(field, colorInput.value, alphaInput.value);
      colorInput.addEventListener("input", onChange);
      alphaInput.addEventListener("input", onChange);

      row.querySelector(".ytcc-color-clear").addEventListener("click", () => {
        clearField(field, colorInput, alphaInput);
      });
    });

    dialog.querySelector(".ytcc-dialog-close").addEventListener("click", ytcc_closeDialog);

    dialog.querySelector(".ytcc-unmark-btn").addEventListener("click", () => {
      ytcc_mutateMarks((marks) => {
        delete marks[key];
      }).then(() => {
        ytcc_updateAllNodesForKey(key);
        fontInput.value = "";
        fontOptions.hidden = true;
        dialog.querySelectorAll(".ytcc-color-row").forEach((row) => {
          const colorInput = row.querySelector(".ytcc-mark-color");
          const alphaInput = row.querySelector(".ytcc-mark-alpha");
          colorInput.value = colorInput.dataset.defaultColor;
          alphaInput.value = colorInput.dataset.defaultAlpha;
        });
      }).catch((e) => console.warn("YTCC: failed to clear marks.", e));
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) ytcc_closeDialog();
    });

    ytcc_activeDialog = overlay;
  }

  // ----- History dialog -----
  // Shows every {channel, last-seen time} entry recorded for this author,
  // newest first. "Clear History" wipes only this author's entries and
  // stays open (matching the Mark dialog's "Clear all"), refreshing the
  // table in place rather than closing.
  function ytcc_openHistoryDialog(authorName, key) {
    ytcc_closeDialog();

    const history = ytcc_loadHistory();
    const entries = Object.entries(history[key] || {})
        .sort((a, b) => new Date(b[1]) - new Date(a[1]));

    const overlay = document.createElement("div");
    overlay.className = "ytcc-dialog-overlay";

    const dialog = document.createElement("div");
    dialog.className = "ytcc-mark-dialog ytcc-history-dialog";

    const rowsHtml = entries.length
        ? entries.map(([channel, iso]) => {
          const link = ytcc_getChannelHistoryLink(channel);
          const channelCell = link
              ? `<a href="${ytcc_escapeHtml(link)}" target="_blank" rel="noopener noreferrer" class="ytcc-history-channel-link">${ytcc_escapeHtml(channel)}</a>`
              : ytcc_escapeHtml(channel);
          return `
          <tr>
            <td>${channelCell}</td>
            <td>${ytcc_escapeHtml(ytcc_formatTimestamp(iso))}</td>
          </tr>
        `;
        }).join("")
        : `<tr><td colspan="2" class="ytcc-history-empty">No history recorded yet.</td></tr>`;

    dialog.innerHTML = `
      <div class="ytcc-dialog-header">
        <span class="ytcc-dialog-title">${ytcc_escapeHtml(authorName)} History</span>
        <button type="button" class="ytcc-dialog-close" aria-label="Close">\u2715</button>
      </div>
      <div class="ytcc-dialog-body">
        <div class="ytcc-history-table-wrap">
          <table class="ytcc-history-table">
            <thead>
              <tr><th>Channel</th><th>Time</th></tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
      <div class="ytcc-dialog-footer">
        <tp-yt-paper-button class="ytcc-clear-history-btn">Clear History</tp-yt-paper-button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    dialog.querySelector(".ytcc-dialog-close").addEventListener("click", ytcc_closeDialog);

    dialog.querySelector(".ytcc-clear-history-btn").addEventListener("click", () => {
      ytcc_clearHistoryForKey(key)
          .then(() => ytcc_openHistoryDialog(authorName, key))
          .catch((e) => console.warn("YTCC: failed to clear history.", e));
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) ytcc_closeDialog();
    });

    ytcc_activeDialog = overlay;
  }

  // ----- Settings dialog -----
  function ytcc_openSettingsDialog() {
    ytcc_closeDialog();
    ytcc_closeContextMenu();

    const settings = ytcc_loadSettings();
    const notifySupported = ytcc_isNotificationSupported();
    const myHandle = ytcc_resolveCurrentUserHandle();
    const mentionPlaceholder = myHandle ? `Defaults to ${myHandle}` : "Defaults to your handle";

    const overlay = document.createElement("div");
    overlay.className = "ytcc-dialog-overlay";

    const dialog = document.createElement("div");
    dialog.className = "ytcc-mark-dialog ytcc-settings-dialog";
    dialog.innerHTML = `
      <div class="ytcc-dialog-header">
        <span class="ytcc-dialog-title">Chad Chat<span class="ytcc-dialog-version">v${ytcc_escapeHtml(YTCC_VERSION)}</span></span>
        <button type="button" class="ytcc-dialog-close" aria-label="Close">\u2715</button>
      </div>
      <div class="ytcc-dialog-body">
        <label class="ytcc-setting-row" title="Automatically switch from Top chat to Live chat on load">
          <input type="checkbox" class="ytcc-setting-checkbox" data-setting="autoLiveChat" ${settings.autoLiveChat ? "checked" : ""}>
          <span>Auto-Live chat</span>
        </label>
        <label class="ytcc-setting-row" title="Highlight every other chat">
          <input type="checkbox" class="ytcc-setting-checkbox" data-setting="alternateRows" ${settings.alternateRows ? "checked" : ""}>
          <span>Alternate rows</span>
        </label>
        <label class="ytcc-setting-row" title="Mention other chatters by left-clicking on their user handles">
          <input type="checkbox" class="ytcc-setting-checkbox" data-setting="clickToMention" ${settings.clickToMention ? "checked" : ""}>
          <span>Click-to-mention</span>
        </label>
        <label class="ytcc-setting-row" title="Hold ${ytcc_isMac() ? "Option" : "Alt"} key to save chat when sending">
          <input type="checkbox" class="ytcc-setting-checkbox" data-setting="spamSend" ${settings.spamSend ? "checked" : ""}>
          <span>Spam send</span>
        </label>
        <label class="ytcc-setting-row" title="Keep track of each chatter's most recent chats on each channel">
          <input type="checkbox" class="ytcc-setting-checkbox" data-setting="trackHistory" ${settings.trackHistory ? "checked" : ""}>
          <span>Track history</span>
        </label>
        <div class="ytcc-settings-actions">
          <tp-yt-paper-button class="ytcc-import-history-btn" title="Import Chad Chat history file">Import history</tp-yt-paper-button>
          <tp-yt-paper-button class="ytcc-export-history-btn" title="Export Chad Chat history file">Export history</tp-yt-paper-button>
          <tp-yt-paper-button class="ytcc-clear-history-btn" title="Clear the entire chatter history">Clear history</tp-yt-paper-button>
        </div>
        <label class="ytcc-setting-row${notifySupported ? "" : " ytcc-setting-row-disabled"}" title="${notifySupported ? "Send a notification when mentioned in chat" : "Notifications aren't supported in this browser"}">
          <input type="checkbox" class="ytcc-setting-checkbox" data-setting="notifyOnMention"${notifySupported && settings.notifyOnMention ? " checked" : ""}${notifySupported ? "" : " disabled"}>
          <span>Notify on mention</span>
        </label>
        <label class="ytcc-setting-row ytcc-setting-row-text" title="Custom regex for highlighting mentions in chat (empty is YouTube default)">
          <span>Match mention (regex)</span>
          <input type="text" class="ytcc-setting-text" data-setting="mentionRegex"
                 value="${ytcc_escapeHtml(settings.mentionRegex || "")}"
                 placeholder="${ytcc_escapeHtml(mentionPlaceholder)}">
        </label>
        <div class="ytcc-settings-actions">
          <tp-yt-paper-button class="ytcc-import-btn" title="Import Chad Chat settings file">Import settings</tp-yt-paper-button>
          <tp-yt-paper-button class="ytcc-export-btn" title="Export Chad Chat settings file">Export settings</tp-yt-paper-button>
        </div>
      </div>
      <div class="ytcc-dialog-footer">
        <a class="ytcc-dialog-link" href="https://x.com/_0fux_" target="_blank" rel="noopener noreferrer">𝕏 @_0fux_</a>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    dialog.querySelectorAll(".ytcc-setting-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", async () => {
        const key = checkbox.dataset.setting;

        // Enabling notifications requires permission first. The request
        // is kicked off synchronously from this click so the browser
        // still counts it as a user gesture; if permission isn't
        // granted, the box is reverted and false is what gets saved.
        if (key === "notifyOnMention" && checkbox.checked) {
          const granted = await ytcc_ensureNotificationPermission();
          if (!granted) checkbox.checked = false;
        }

        if (key === "alternateRows") ytcc_applyAlternateRows(checkbox.checked);

        ytcc_mutateSettings((settings) => {
          settings[key] = checkbox.checked;
        }).catch((e) => console.warn("YTCC: failed to save settings.", e));
      });
    });

    dialog.querySelectorAll(".ytcc-setting-text").forEach((input) => {
      input.addEventListener("input", () => {
        ytcc_mutateSettings((settings) => {
          settings[input.dataset.setting] = input.value;
        }).catch((e) => console.warn("YTCC: failed to save settings.", e));
      });
    });

    dialog.querySelector(".ytcc-clear-history-btn").addEventListener("click", () => {
      ytcc_clearAllHistory().catch((e) => console.warn("YTCC: failed to clear all history.", e));
    });
    dialog.querySelector(".ytcc-export-history-btn").addEventListener("click", ytcc_exportHistory);
    dialog.querySelector(".ytcc-import-history-btn").addEventListener("click", ytcc_importHistory);

    dialog.querySelector(".ytcc-dialog-version").addEventListener("click", ytccee_hit);
    dialog.querySelector(".ytcc-dialog-close").addEventListener("click", ytcc_closeDialog);
    dialog.querySelector(".ytcc-export-btn").addEventListener("click", ytcc_exportSettings);
    dialog.querySelector(".ytcc-import-btn").addEventListener("click", () => ytcc_importSettings(dialog));

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) ytcc_closeDialog();
    });

    ytcc_activeDialog = overlay;
  }

  // Downloads `data` as a timestamped JSON file named `<prefix>-<stamp>.json`.
  function ytcc_downloadJson(data, prefix) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prefix}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Opens a file picker for a JSON file and calls onParsed(parsedObject)
  // once it has been read and parsed. `label` is only used in warnings.
  function ytcc_pickJsonFile(label, onParsed) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.style.display = "none";

    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        let parsed;
        try {
          parsed = JSON.parse(reader.result);
        } catch (e) {
          console.warn(`YTCC: failed to import ${label} file.`, e);
          return;
        }
        onParsed(parsed);
      };
      reader.readAsText(file);
    });

    document.body.appendChild(input);
    input.click();
  }

  // Settings files hold marks + settings only; history has its own file.
  function ytcc_exportSettings() {
    ytcc_downloadJson({
      marks: ytcc_loadMarks(),
      settings: ytcc_loadSettings()
    }, "chad-chat-settings");
  }

  function ytcc_importSettings(dialogForRefresh) {
    ytcc_pickJsonFile("settings", (parsed) => {
      const tasks = [];

      if (parsed.marks && typeof parsed.marks === "object") {
        tasks.push(ytcc_withLock("ytcc-marks", async () => {
          ytcc_saveMarks(parsed.marks);
        }));
      }

      let mergedSettings = null;
      if (parsed.settings && typeof parsed.settings === "object") {
        tasks.push(ytcc_withLock("ytcc-settings", async () => {
          mergedSettings = Object.assign({}, YTCC_DEFAULT_SETTINGS, parsed.settings);
          if (!ytcc_isNotificationSupported()) mergedSettings.notifyOnMention = false;
          mergedSettings.score = Math.max(ytcc_loadSettings().score || 0, mergedSettings.score || 0);
          ytcc_saveSettings(mergedSettings);
        }));
      }

      Promise.all(tasks).then(() => {
        if (parsed.marks && typeof parsed.marks === "object") {
          ytcc_reapplyAllMarks();
        }
        if (mergedSettings && dialogForRefresh) {
          const autoBox = dialogForRefresh.querySelector('[data-setting="autoLiveChat"]');
          if (autoBox) autoBox.checked = mergedSettings.autoLiveChat;
          const altBox = dialogForRefresh.querySelector('[data-setting="alternateRows"]');
          if (altBox) altBox.checked = mergedSettings.alternateRows;
          ytcc_applyAlternateRows(mergedSettings.alternateRows);
          const clickBox = dialogForRefresh.querySelector('[data-setting="clickToMention"]');
          if (clickBox) clickBox.checked = mergedSettings.clickToMention;
          const spamBox = dialogForRefresh.querySelector('[data-setting="spamSend"]');
          if (spamBox) spamBox.checked = mergedSettings.spamSend;
          const historyBox = dialogForRefresh.querySelector('[data-setting="trackHistory"]');
          if (historyBox) historyBox.checked = mergedSettings.trackHistory;
          const notifyBox = dialogForRefresh.querySelector('[data-setting="notifyOnMention"]');
          if (notifyBox) notifyBox.checked = !!mergedSettings.notifyOnMention;
          const mentionBox = dialogForRefresh.querySelector('[data-setting="mentionRegex"]');
          if (mentionBox) mentionBox.value = mergedSettings.mentionRegex || "";
        }
        console.log("YTCC: settings imported successfully.");
      }).catch((e) => {
        console.warn("YTCC: failed to import settings file.", e);
      });
    });
  }

  // History files are `{ "history": { [authorKey]: { [channel]: isoTimestamp } } }`.
  // Importing replaces the stored history.
  function ytcc_exportHistory() {
    ytcc_downloadJson({ history: ytcc_loadHistory() }, "chad-chat-history");
  }

  function ytcc_importHistory() {
    ytcc_pickJsonFile("history", (parsed) => {
      if (!parsed || !parsed.history || typeof parsed.history !== "object" || Array.isArray(parsed.history)) {
        console.warn("YTCC: failed to import history file: no history found in it.");
        return;
      }
      ytcc_withLock("ytcc-history", async () => {
        ytcc_saveHistory(parsed.history);
      }).then(() => {
        console.log("YTCC: history imported successfully.");
      }).catch((e) => {
        console.warn("YTCC: failed to import history file.", e);
      });
    });
  }


  function ytccee_run(){if(document.getElementById("ytccee_o"))return;const e=20,t=10,n=[[[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],"#ffd600"],[[[1,0,0],[1,1,1],[0,0,0]],"#7406ac"],[[[0,0,1],[1,1,1],[0,0,0]],"#c62273"],[[[1,1],[1,1]],"#2ba640"],[[[0,1,1],[1,1,0],[0,0,0]],"#ff5722"],[[[0,1,0],[1,1,1],[0,0,0]],"#5e84f1"],[[[1,1,0],[0,1,1],[0,0,0]],"#c30027"]],o=()=>n[7*Math.random()|0],l=document.createElement("div"),i=document.createElement("canvas"),r=document.createElement("button"),c=i.getContext("2d");l.id="ytccee_o",l.tabIndex=-1,l.style.cssText="position:fixed;inset:0;z-index:2147483647;background:#111;outline:none;touch-action:none",i.style.cssText="display:block;width:100%;height:100%",r.type="button",r.textContent="✕",r.style.cssText="position:absolute;top:8px;right:10px;background:none;border:0;color:#aaa;font-size:20px;line-height:1;padding:4px;cursor:pointer",l.append(i,r),document.body.appendChild(l);let a,f=ytcc_loadSettings().score||0,s=0,d=0,m=!1,y=!1,u=Array.from({length:e},()=>Array(t).fill(null)),h=o(),w=Date.now(),p=0,x=0,g=0,v=0,E=0,b=0,k=1,S=0,_=0;const L=()=>{const n=window.devicePixelRatio||1;E=window.innerWidth,b=window.innerHeight,i.width=E*n,i.height=b*n,c.setTransform(n,0,0,n,0,0),k=Math.max(1,Math.floor(Math.min(E/t,(b-52)/e))),S=Math.floor((E-k*t)/2),_=52+Math.floor((b-52-k*e)/2)},T=(n,o,l)=>{for(let i=0;i<n.length;i++)for(let r=0;r<n[i].length;r++){if(!n[i][r])continue;const c=a.x+r+o,f=a.y+i+l;if(c<0||c>=t||f>=e)return!0;if(f>=0&&u[f][c])return!0}return!1},A=()=>{a={m:h[0],c:h[1],x:3,y:-2},h=o()},M=()=>{m=!0,a=null,g=Date.now(),v=setTimeout(H,7e3)},C=()=>{const n=a.m;for(let e=0;e<n.length;e++)for(let t=0;t<n[e].length;t++)if(n[e][t]){if(a.y+e<0)return M();u[a.y+e][a.x+t]=a.c}let o=0;for(let n=0;n<e;n++)u[n].every(Boolean)&&(o++,u.splice(n,1),u.unshift(Array(t).fill(null)));var l;o&&(d+=o,s+=100*o,s>f&&(f=s,l=f,ytcc_mutateSettings(e=>{(e.score||0)<l&&(e.score=l)}).catch(e=>console.warn("YTCC: failed to save settings.",e)))),A()},D=()=>{T(a.m,0,1)?C():a.y++},R=e=>{if(e.metaKey||e.ctrlKey)return;if(e.preventDefault(),e.stopImmediatePropagation(),m||!a)return;const t=e.key;if("ArrowLeft"===t||"a"===t)T(a.m,-1,0)||a.x--;else if("ArrowRight"===t||"d"===t)T(a.m,1,0)||a.x++;else if("ArrowUp"===t||"w"===t)(()=>{const e=a.m,t=e.length,n=[];for(let o=0;o<t;o++){n[o]=[];for(let l=0;l<t;l++)n[o][l]=e[t-l-1][o]}let o=0;T(n,0,0)&&(o=a.x>5?-1:1),T(n,o,0)||(a.x+=o,a.m=n)})();else if("ArrowDown"===t||"s"===t)D();else if(" "===t&&!e.repeat){for(;!T(a.m,0,1);)a.y++;C()}},I=e=>{e.metaKey||e.ctrlKey||(e.preventDefault(),e.stopImmediatePropagation())},z=(e,t,n,o)=>{c.fillStyle=n,c.fillRect(e,t,o,o),c.strokeStyle="#111",c.strokeRect(e,t,o,o)},B=()=>{const o=Date.now();if(m){if(x<e&&o-g>=90){for(let e=0;e<t;e++)u[x][e]=n[7*Math.random()|0][1];x++,g=o}}else o-w>1e3&&(D(),w=o);(()=>{c.fillStyle="#111",c.fillRect(0,0,E,b);for(let n=0;n<e;n++)for(let e=0;e<t;e++)z(S+e*k,_+n*k,u[n][e]||"#000",k);const n=Math.max(9,Math.min(14,.5*k));c.font=n+"px 'Courier New', monospace",c.textAlign="center",c.textBaseline="top",c.fillStyle="#444",["CONTROLS","← / → : Move","↑ : Rotate","↓ : Soft Drop","Space : Hard Drop"].forEach((e,o)=>c.fillText(e,S+k*t/2,_+2*k+o*n*1.5)),c.textAlign="left";for(let n=0;n<e;n++)for(let e=0;e<t;e++)u[n][e]&&z(S+e*k,_+n*k,u[n][e],k);if(a)for(let e=0;e<a.m.length;e++)for(let t=0;t<a.m[e].length;t++)a.m[e][t]&&a.y+e>=0&&z(S+(a.x+t)*k,_+(a.y+e)*k,a.c,k);c.strokeStyle="#444",c.lineWidth=2,c.strokeRect(S-1,_-1,k*t+2,k*e+2),c.lineWidth=1,c.font="bold 14px 'Courier New', monospace",c.textBaseline="alphabetic",c.fillStyle=s===f?"#ffd600":"#2ba640",c.fillText("SCORE "+s,12,22),c.fillStyle="#2ba640",c.fillText("LINES "+d,12,42),c.fillStyle="#ffd600",c.fillText("HIGH "+f,Math.min(150,E/2-20),22);const o=h[0],l=E-90,i=(4-o.length)/2;for(let e=0;e<o.length;e++)for(let t=0;t<o[e].length;t++)o[e][t]&&z(l+10*(i+t),8+10*(i+e),h[1],10)})(),p=requestAnimationFrame(B)};function H(){y||(y=!0,cancelAnimationFrame(p),clearTimeout(v),window.removeEventListener("keydown",R,!0),window.removeEventListener("keyup",I,!0),window.removeEventListener("keypress",I,!0),window.removeEventListener("resize",L),l.remove())}r.addEventListener("click",H),window.addEventListener("keydown",R,!0),window.addEventListener("keyup",I,!0),window.addEventListener("keypress",I,!0),window.addEventListener("resize",L),document.activeElement&&document.activeElement.blur&&document.activeElement.blur(),l.focus(),L(),A(),B()}
  let ytccee_c=[];function ytccee_hit(){const e=Date.now();ytccee_c.push(e),ytccee_c.length>5&&ytccee_c.shift(),5===ytccee_c.length&&e-ytccee_c[0]<=3e3&&(ytccee_c=[],ytccee_run())}


  // ===== "Chad Chat" Header Button ============================
  // A standalone icon button placed to the left of the header's overflow
  // menu (yt-live-chat-button#live-chat-header-context-menu) and the
  // #close-button, matching their size/position but built as a plain
  // <button> rather than YouTube's own custom element - the previous
  // attempt at adding an entry into YouTube's own popup menu didn't work
  // reliably, so this is a simpler, self-contained control instead.
  function ytcc_createSettingsButton() {
    const button = document.createElement("button");
    button.id = "ytcc-settings-button";
    button.type = "button";
    button.className = "ytcc-header-icon-button";
    button.title = "Chad Chat";
    button.setAttribute("aria-label", "Chad Chat");
    button.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" focusable="false" fill="currentColor" style="pointer-events:none;display:block;width:100%;height:100%;">
<path d="m17.259 22.735c2.5162-0.63477 4.5892-2.2833 5.0628-2.9836 0.47358-0.70027 0.73205-1.5655 0.66922-3.3753-0.062829-1.8098-0.39184-3.4335-1.9786-5.0629-1.5867-1.6294-3.2689-2.4113-5.5866-2.4109-2.3177 4.15e-4 -3.6708 0.87232-4.4809 1.537-0.8101 0.66464-2.142 2.4767-2.3933 3.0468-0.092895 0.21077-0.22844 0.42614-0.46861 0.4344-0.14481 0.004977-0.26347-0.16508-0.42602-0.28672-0.26009-0.19463-0.53299-2.1992-0.66922-3.2547s-0.54939-2.2107 0.23277-2.4109c0.26765-0.068508 0.45421 0.12454 0.61757 0.077443 0.35419-0.10212 0.37172-0.43908 0.37172-0.43908s0.24101 0.11032 0.51219 0.12088c0.090392 0.003521 0.18414-0.004042 0.27342-0.030468 0.35715-0.10571 0.46555-0.42191 0.46555-0.42191s0.094249 0.044062 0.26231 0.042211c0.10084-0.00111 0.22825-0.018747 0.37782-0.072347 0.39885-0.14293 0.58193-0.63287 0.58193-0.63287s0.006003 0.16488 0.32366 0.13638c0.10588-0.0095 0.2464-0.040491 0.43286-0.10624 0.74584-0.26299 0.70282-1.8569 0.55284-2.7424-0.14998-0.88547-0.43482-2.3554-1.0475-2.7424-0.61266-0.38706-2.7996 0.006091-4.6555 0.45205-1.8559 0.44596-3.1474 1.1304-3.4334 1.7479 0 0-0.56316 3.577-0.58193 3.9479-0.018772 0.37084-0.64052 2.886-0.96019 4.9725-0.31967 2.0865-0.43276 3.7578-0.1597 4.6215 0.27305 0.86365 0.55006 2.9889 0.71254 3.5756 0.16249 0.58669 1.1022 1.3045 1.6876 1.2356 0.073175-0.008611 0.16847-0.011362 0.28019-0.00963 0.72618 0.011257 2.1462 0.21183 2.6939 0.22183l0.11029-0.001335c0.49742-0.026445 1.3674-0.12046 1.3674-0.12046s0.37776 0.17553 1.8331 0.54246c1.0005 0.25226 2.943 0.64283 4.8769 0.65606 0.87908 0.006012 1.7564-0.065939 2.5428-0.2642zm-2.8803-1.2219c-1.6726-0.011885-3.1482-0.30844-4.0135-0.53514-1.2587-0.32974-2.0514-0.62432-2.0514-0.62432s-0.99683 0.065426-1.427 0.08919l-0.14865 0.05946c-0.47368-0.008992-1.0665-0.049343-1.6946-0.05946-0.096623-0.001556-1.2151-0.18612-1.2784-0.17838-0.50629 0.06192-0.48575-0.24523-0.62432-0.77297-0.16571-0.63108-0.50202-2.1987-0.68378-3.1216-0.15676-0.79596 0.054238-2.4683 0.33071-4.3434s0.8142-4.1353 0.83044-4.4685c0.016235-0.33326 0.50329-3.5478 0.50329-3.5478 0.2474-0.5549 1.5764-0.76656 3.1815-1.1673 1.6051-0.40076 2.3711-0.63853 2.9135-0.2973 0.35067 0.63232 0.4289 1.5163 0.50541 2.3189 0.069923 0.73353-0.39829 0.43642-0.74324 0.56486-0.12936 0.048169-0.26994 0.38469-0.56486 0.38649-0.33914 0.002064-0.28522-0.018877-0.5054 0.08919-0.08044 0.039478-0.16744 0.14269-0.2973 0.23784-0.06517 0.047748-0.22756 0.035465-0.2973 0-0.23687-0.12045-0.39199-0.091511-0.47568-0.059458-0.13347 0.051119-0.21546 0.15794-0.32703 0.20811l-0.23784 0.20811c-0.18051 0.020872-0.26757 0-0.26757 0s-1.7972 0.22305-1.3676 4.073c0.38813 3.4778 0.54835 3.7116 1.4568 4.5189 0.13311 0.11831 0.50783 0.30188 1.0108 0.2973 0.3382-0.003084 0.9766-0.1377 1.2486-0.56486 0.29785-0.46768 1.5886-2.5243 2.2892-3.1216 0.70063-0.59727 1.6225-1.3375 3.627-1.3378 2.0045-3.75e-4 3.2413 0.33224 4.3108 1.4568 0.98861 1.0395 1.7813 2.1835 1.9324 4.1027 0.15034 1.9092 0.36609 2.0611-0.41622 3.0027-0.47982 0.57754-1.9169 1.8063-4.3405 2.4081-0.68233 0.16943-1.6181 0.18378-2.3784 0.17838z" fill-rule="evenodd"/>
<path d="m9.9784 17.719c-0.13936 0.65801 2.4663 1.879 5.2027 1.7541 2.7364-0.1249 4.8751-1.6446 4.727-2.1405-0.14804-0.49598-0.67653 0.71945-4.727 1.1s-5.0633-1.3715-5.2027-0.71351z" fill-rule="evenodd"/>
</svg>`;

    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      ytcc_openSettingsDialog();
    });

    return button;
  }

  function ytcc_installSettingsButton() {
    if (document.getElementById("ytcc-settings-button")) return true;
    const contextMenuButton = document.querySelector("yt-live-chat-button#live-chat-header-context-menu");
    if (!contextMenuButton || !contextMenuButton.parentElement) return false;
    contextMenuButton.insertAdjacentElement("beforebegin", ytcc_createSettingsButton());
    return true;
  }

  function ytcc_ensureSettingsButtonInstalled() {
    if (ytcc_installSettingsButton()) return;
    // The header may not be rendered yet this early; watch briefly for it
    // rather than polling forever.
    const watcher = new MutationObserver(() => {
      if (ytcc_installSettingsButton()) watcher.disconnect();
    });
    watcher.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => watcher.disconnect(), 15000);
  }


  // ===== Current User Identity =================================
  // Who "I" am, for the "ytcc-me" row highlight and the default mention
  // match. Resolved from the participant panel's own author-name element
  // (tp-yt-iron-pages#panel-pages span#author-name) rather than hardcoded,
  // so the script works for any viewer, not just the original author.
  // This element may not exist yet at document-end, so resolution is
  // retried (cheaply - one querySelector) on every message until it
  // succeeds, then cached for the rest of the session, since the signed-in
  // viewer won't change mid-session.
  let ytcc_currentUserHandle = null;

  function ytcc_resolveCurrentUserHandle() {
    if (ytcc_currentUserHandle) return ytcc_currentUserHandle;
    const el = document.querySelector("tp-yt-iron-pages#panel-pages span#author-name");
    const text = el ? (el.innerText || el.textContent || "").trim() : "";
    if (text) ytcc_currentUserHandle = text;
    return ytcc_currentUserHandle;
  }

  // Strips a leading "@" and normalizes case/whitespace, so the panel's
  // handle text and a message's author-name text compare equal even if
  // one includes the "@" and the other doesn't.
  function ytcc_normalizeHandle(text) {
    return (text || "").trim().replace(/^@/, "").toLowerCase();
  }


  // ===== Chat Match ========================================
  // Two concerns, each still a simple (data) => {...} rule run over every
  // message by ytcc_processNode - the array itself isn't what changed,
  // just what the two rules do:
  //
  //   1) "Is this message mine?" - now an exact (normalized) comparison
  //      against the current viewer's own resolved handle, instead of a
  //      hardcoded regex for one specific person. Still applies "ytcc-me"
  //      to the whole message row.
  //
  //   2) "Does this message mention me?" - previously highlighted the
  //      entire row via a hardcoded misspelling-tolerant regex. Now:
  //        - it's driven by the "Match mention (regex)" setting, so any
  //          viewer can supply their own misspelling patterns;
  //        - when that setting is empty, it falls back to an exact
  //          (escaped, non-pattern) match of the viewer's own handle -
  //          i.e. the same thing YouTube's own native mention highlight
  //          already does;
  //        - instead of highlighting the whole row, it wraps each match
  //          with <span class="mention style-scope
  //          yt-live-chat-text-message-renderer">, YouTube's own native
  //          class, so it inherits YouTube's default mention styling
  //          with no ytcc-specific CSS needed - see ytcc_wrapMatchesInElement.
  const ytcc_matchObservers = [];

  // Caches each message's resolved "data" object (author/message elements,
  // channelInfo, authorKey) keyed by its YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER
  // node, so the delegated 'click'/'contextmenu' listeners on #chat (see
  // ENTRY POINT) can reuse it instead of re-resolving on every interaction.
  // A WeakMap means entries are GC'd automatically once a message node is
  // removed from the DOM and no longer referenced elsewhere.
  const ytcc_nodeDataMap = new WeakMap();

  // Walks the text nodes under `root` (skipping existing elements, e.g.
  // emoji <img> tags or YouTube's own already-wrapped mention spans) and
  // replaces every regex match with a <span class="mention ...">,
  // splicing the surrounding text back in around it. `regex` must carry
  // the "g" flag. Returns true if anything was wrapped.
  function ytcc_wrapMatchesInElement(root, regex) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    let matchedAny = false;

    textNodes.forEach((textNode) => {
      const text = textNode.nodeValue;
      regex.lastIndex = 0;

      let match;
      let lastIndex = 0;
      let matchedHere = false;
      const fragment = document.createDocumentFragment();

      while ((match = regex.exec(text)) !== null) {
        if (match[0].length === 0) {
          // Avoid an infinite loop on zero-length matches (e.g. a regex
          // with only optional groups).
          regex.lastIndex++;
          continue;
        }
        matchedHere = true;

        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        const span = document.createElement("span");
        span.className = "mention style-scope yt-live-chat-text-message-renderer";
        span.textContent = match[0];
        fragment.appendChild(span);

        lastIndex = match.index + match[0].length;
      }

      if (matchedHere) {
        matchedAny = true;
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    });

    return matchedAny;
  }

  // Cached so a RegExp isn't recompiled on every single chat message -
  // only when the setting or the resolved handle actually changes.
  let ytcc_mentionRegexCache = { key: null, regex: null };

  function ytcc_getMentionRegex() {
    const custom = (ytcc_loadSettings().mentionRegex || "").trim();
    const handle = ytcc_resolveCurrentUserHandle();
    const cacheKey = `${custom}|||${handle || ""}`;

    if (ytcc_mentionRegexCache.key === cacheKey) return ytcc_mentionRegexCache.regex;

    let regex = null;
    if (custom) {
      try {
        regex = new RegExp(custom, "gi");
      } catch (e) {
        console.warn('YTCC: invalid "Match mention (regex)" pattern, falling back to an exact handle match.', e);
      }
    }

    if (!regex && handle) {
      const escaped = handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      regex = new RegExp(escaped, "gi");
    }

    ytcc_mentionRegexCache = { key: cacheKey, regex };
    return regex;
  }

  // ===== Mention Notifications ===============================
  function ytcc_isNotificationSupported() {
    return typeof Notification !== "undefined";
  }

  // Resolves to true if the Notifications API is usable and permission is
  // (now) granted. Must be called synchronously from a user gesture (the
  // settings checkbox) for the permission prompt to be allowed to show.
  function ytcc_ensureNotificationPermission() {
    if (typeof Notification === "undefined") {
      console.warn("YTCC: the Notifications API isn't available in this browser.");
      return Promise.resolve(false);
    }
    if (Notification.permission === "granted") return Promise.resolve(true);
    if (Notification.permission === "denied") {
      console.warn("YTCC: notification permission is blocked for this site; allow it in the browser's site settings.");
      return Promise.resolve(false);
    }
    try {
      // Older Safari only supports the callback form, so handle both.
      return new Promise((resolve) => {
        const maybePromise = Notification.requestPermission((result) => resolve(result === "granted"));
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then((result) => resolve(result === "granted"), () => resolve(false));
        }
      });
    } catch (e) {
      console.warn("YTCC: failed to request notification permission.", e);
      return Promise.resolve(false);
    }
  }

  // The chat usually lives in an iframe, where document.hasFocus() is
  // false whenever the user clicks the video instead, even though the tab
  // itself is focused. The top document reports true for any focused
  // descendant frame, so prefer that (same-origin on youtube.com), falling
  // back to this frame if it's inaccessible.
  function ytcc_isTabFocused() {
    try {
      return window.top.document.hasFocus();
    } catch (e) {
      return document.hasFocus();
    }
  }

  // Plain-text rendering of a message: unlike innerText, keeps emoji
  // (<img alt="...">) instead of dropping them.
  function ytcc_getMessageText(el) {
    let text = "";
    el.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.nodeValue;
      } else if (child.nodeName === "IMG") {
        text += child.alt || child.getAttribute("aria-label") || "";
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        text += ytcc_getMessageText(child);
      }
    });
    return text.trim();
  }

  // Finds the message again when its notification is clicked: normally
  // the same node, but fall back to an id lookup in case it was re-rendered.
  function ytcc_findMessageNode(node, id) {
    if (node.isConnected) return node;
    if (!id) return null;
    const all = document.querySelectorAll("yt-live-chat-text-message-renderer");
    for (const candidate of all) {
      if (candidate.id === id) return candidate;
    }
    return null;
  }

  // A message is only ever notified about once, even if it contains
  // several mentions (or its node is somehow processed again).
  const ytcc_notifiedNodes = new WeakSet();

  function ytcc_notifyIfMention(node) {
    if (!node || node.nodeName !== "YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER") return;
    if (ytcc_notifiedNodes.has(node)) return;

    const data = ytcc_nodeDataMap.get(node);
    if (!data || !data.message || !data.message.querySelector("span.mention")) return;
    if (!ytcc_loadSettings().notifyOnMention) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (ytcc_isTabFocused()) return;

    ytcc_notifiedNodes.add(node);

    const id = node.id;
    const options = { body: ytcc_getMessageText(data.message) };
    if (id) options.tag = id;

    let notification;
    try {
      notification = new Notification(data.author.innerText.trim(), options);
    } catch (e) {
      console.warn("YTCC: failed to show mention notification.", e);
      return;
    }

    notification.onclick = (event) => {
      try {
        if (event && event.preventDefault) event.preventDefault();

        // Bring the tab to the foreground, then focus the chat frame.
        try { window.top.focus(); } catch (e) { /* cross-origin top */ }
        window.focus();

        const target = ytcc_findMessageNode(node, id);
        if (target) target.scrollIntoView({ block: "center" });
      } catch (e) {
        console.warn("YTCC: failed to handle mention notification click.", e);
      } finally {
        notification.close();
      }
    };
  }


  const ytcc_matchRules = [
    (data) => {
      const myHandle = ytcc_resolveCurrentUserHandle();
      if (myHandle && ytcc_normalizeHandle(data.author.innerText) === ytcc_normalizeHandle(myHandle)) {
        data.node.classList.add("ytcc-me");
      }
    },
    (data) => {
      const regex = ytcc_getMentionRegex();
      if (!regex || !data.message) return;
      if (ytcc_wrapMatchesInElement(data.message, regex)) {
        console.log(`YTCC: mention matched in message: ${data.message.innerText}`);
      }
    }
  ];

  var ytcc_chatIndex = 0;

  function ytcc_processNode(node) {
    if (node && node.nodeName == "YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER") {
      var data = {
        "node": node,
        "picture": node.querySelector("#img").src,
        "timestamp": node.querySelector("#timestamp"),
        "author": node.querySelector("#author-name"),
        "chip": node.querySelector("yt-live-chat-author-chip"),
        "badges": node.querySelector("#chat-badges"),
        "message": node.querySelector("#message")
      };

      // Alternate background color
      if (ytcc_chatIndex % 2 == 0)
        data.node.classList.add("ytcc-alt");
      ytcc_chatIndex++;

      // If this is a genuine channel-owner message, capture the real
      // pill shape YouTube renders it with, so our "Author highlight"
      // mark can mimic it exactly. Their resolved channel identity also
      // doubles as a reliable source for History's "current channel".
      if (data.author.classList.contains("owner")) {
        ytcc_captureOwnerBadgeMetrics(data.author);
      }

      // Resolve author identity (for "Visit channel" + persistent marks)
      data.channelInfo = ytcc_getAuthorChannelInfo(node);
      data.authorKey = ytcc_getAuthorKey(data.author.innerText, data.channelInfo);
      if (data.author.classList.contains("owner")) {
        ytcc_confirmCurrentChannel(data.channelInfo);
      }
      node.dataset.ytccAuthorKey = data.authorKey;
      ytcc_registerNode(data.authorKey, node);
      ytcc_applyMarkToNode(node);
      ytcc_recordHistory(data.authorKey);

      // The full "data" object is cached here (rather than closing over it
      // in a per-node handler) so the delegated 'click'/'contextmenu'
      // listeners on #chat (see ENTRY POINT) can look it up by ancestor
      // node instead of every message wiring its own listeners.
      ytcc_nodeDataMap.set(node, data);

      // Click profile picture: open a full-size (s1024) version in a new tab
      const photoWrapper = node.querySelector("yt-img-shadow");
      if (photoWrapper) {
        photoWrapper.style.cursor = "pointer";
        photoWrapper.addEventListener("click", (e) => {
          e.stopPropagation();
          const img = photoWrapper.querySelector("img");
          if (!img || !img.src) return;
          const fullSizeUrl = img.src.replace(/=s\d+-/, "=s1024-");
          window.open(fullSizeUrl, "_blank", "noopener,noreferrer");
        });
      }

      var rule;
      for (rule of ytcc_matchRules) {
        rule(data);
      }
    }
  }

  function ytcc_mutationObserver(mutations, observer) {
    mutations.forEach(mutation => {
      if (mutation.type == "childList") {
        mutation.addedNodes.forEach((added) => {
          ytcc_processNode(added);
          // Only live additions notify - the initial backlog scan below
          // calls ytcc_processNode directly, so old messages never do.
          ytcc_notifyIfMention(added);
        });
        mutation.removedNodes.forEach(ytcc_unregisterNode);
      }
    });
  }

  // Shared by the delegated 'click'/'contextmenu' listeners below: finds
  // the #author-name the event actually happened on (if any), then the
  // message-data cached for its YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER
  // ancestor in ytcc_processNode. Returns null for clicks anywhere else
  // (including the unrelated #author-name inside panel-pages).
  function ytcc_getMessageDataFromEvent(e) {
    const authorEl = e.target && e.target.closest && e.target.closest("#author-name");
    if (!authorEl) return null;
    const node = authorEl.closest("yt-live-chat-text-message-renderer");
    if (!node) return null;
    return ytcc_nodeDataMap.get(node) || null;
  }


  // ===== ENTRY POINT =======================================

  // ===== Spam send =============================================
  // Holding Option (Mac) / Alt (elsewhere) while sending a chat - via
  // Enter or the send button - keeps the text in the input box. YouTube
  // clears the box itself on send, so the contents are snapshotted just
  // before that happens (capture-phase listeners run first) and put back
  // as soon as the box is seen to have been emptied.
  function ytcc_isMac() {
    const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    return /mac/i.test(platform);
  }

  let ytcc_pendingRestore = null;

  function ytcc_cancelPendingRestore() {
    if (!ytcc_pendingRestore) return;
    ytcc_pendingRestore.observer.disconnect();
    clearTimeout(ytcc_pendingRestore.timer);
    ytcc_pendingRestore = null;
  }

  function ytcc_inputBoxIsEmpty(box) {
    return !ytcc_inputPlainText(box).trim() && !box.querySelector("img");
  }

  function ytcc_preserveInputOnSend() {
    if (!ytcc_loadSettings().spamSend) return;
    const box = ytcc_getInputBox();
    if (!box || ytcc_inputBoxIsEmpty(box)) return;

    ytcc_cancelPendingRestore();
    const savedHtml = box.innerHTML;

    const restore = () => {
      ytcc_cancelPendingRestore();
      // Skip if something has already been typed since the send.
      if (!ytcc_inputBoxIsEmpty(box)) return;
      box.innerHTML = savedHtml;
      box.dispatchEvent(new InputEvent("input", { bubbles: true }));
      if (document.activeElement === box) {
        const range = document.createRange();
        range.selectNodeContents(box);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    };

    const observer = new MutationObserver(() => {
      if (!ytcc_inputBoxIsEmpty(box)) return;
      observer.disconnect();
      setTimeout(restore, 0);
    });
    observer.observe(box, { childList: true, characterData: true, subtree: true });

    // If the send never clears the box (e.g. it was rejected), give up.
    ytcc_pendingRestore = {
      observer,
      timer: setTimeout(ytcc_cancelPendingRestore, 2000)
    };
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.altKey || e.shiftKey || e.isComposing) return;
    const box = ytcc_getInputBox();
    if (!box || !box.contains(e.target)) return;
    ytcc_preserveInputOnSend();
  }, true);

  document.addEventListener("click", (e) => {
    if (!e.altKey || !e.target.closest || !e.target.closest("#send-button")) return;
    ytcc_preserveInputOnSend();
  }, true);

  // Toggles the class that enables the alternating-row background and
  // row separators (see the stylesheet).
  function ytcc_applyAlternateRows(enabled) {
    document.documentElement.classList.toggle("ytcc-alt-rows", !!enabled);
  }

  const ytcc_settings = ytcc_loadSettings();
  ytcc_applyAlternateRows(ytcc_settings.alternateRows);

  // Notifications: without API support the setting is forced off; with
  // support, an enabled setting has its permission re-verified (and
  // re-requested if it's no longer granted).
  if (!ytcc_isNotificationSupported()) {
    if (ytcc_settings.notifyOnMention) {
      ytcc_mutateSettings((settings) => {
        settings.notifyOnMention = false;
      }).catch((e) => console.warn("YTCC: failed to save settings.", e));
    }
  } else if (ytcc_settings.notifyOnMention && Notification.permission !== "granted") {
    ytcc_ensureNotificationPermission().then(() => {
      // Only an explicit block turns the setting off. An unanswered or
      // dismissed prompt leaves it on, so it is asked again next load.
      if (Notification.permission !== "denied") return;
      return ytcc_mutateSettings((settings) => {
        settings.notifyOnMention = false;
      });
    }).catch((e) => console.warn("YTCC: failed to update notification setting.", e));
  }

  // Switch to Live Chat (only when "Auto-Live chat" is enabled)
  if (ytcc_settings.autoLiveChat) {
    document.querySelectorAll("tp-yt-paper-listbox tp-yt-paper-item")?.[1]?.click?.();
  }

  // Add custom stylesheet
  let styleNode = document.createElement("style");
  styleNode.type = "text/css";
  styleNode.id = "ytcc-stylesheet"
  styleNode.innerHTML = YTCC_STYLESHEET;
  document.head.appendChild(styleNode);

  // Add the "Chad Chat" settings button next to the header's own icon buttons
  ytcc_ensureSettingsButtonInstalled();

  // Track the chat input's caret position so ytcc_mentionAuthor can
  // restore it (see ===== Chat Mention =====).
  ytcc_ensureInputSelectionTracking();

  // Chat Highlighter
  let chats = document.querySelector("#chat");
  if (chats) {
    // Process existing chats
    chats.querySelectorAll("yt-live-chat-text-message-renderer").forEach(ytcc_processNode);

    // Create observer and monitor for new chats
    var observer = new MutationObserver(ytcc_mutationObserver);
    observer.observe(chats, {childList: true, subtree: true});
    ytcc_matchObservers.push(observer);

    // Left click / right click on an author name: mention / context menu.
    // Delegated to #chat itself (one pair of listeners for the whole chat)
    // rather than wired per-message in ytcc_processNode - toggling
    // "Click-to-mention" off is then just the settings check inside
    // ytcc_mentionAuthor, with nothing to attach or detach per node.
    chats.addEventListener("click", (e) => {
      const data = ytcc_getMessageDataFromEvent(e);
      if (!data) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      ytcc_mentionAuthor(data.author.innerText, e);
    }, true);

    chats.addEventListener("contextmenu", (e) => {
      const data = ytcc_getMessageDataFromEvent(e);
      if (!data) return;
      e.preventDefault();
      e.stopPropagation();
      ytcc_openContextMenu(e.clientX, e.clientY, data);
    });
  }
})();