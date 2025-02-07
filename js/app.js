(() => {
  let db;

  // Initialize IndexedDB
  function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("ChatDB", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("media")) {
          db.createObjectStore("media", { keyPath: "id" });
        }
      };
    });
  }

  // Store media in IndexedDB
  async function storeMedia(id, blob) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["media"], "readwrite");
      const store = transaction.objectStore("media");
      const request = store.put({ id, blob });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get media from IndexedDB
  async function getMedia(id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["media"], "readonly");
      const store = transaction.objectStore("media");
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result?.blob);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all media from IndexedDB
  async function getAllMedia() {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["media"], "readonly");
      const store = transaction.objectStore("media");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Convert Blob to Base64
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Convert Base64 to Blob
  function base64ToBlob(base64, type) {
    const binStr = atob(base64);
    const len = binStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      arr[i] = binStr.charCodeAt(i);
    }
    return new Blob([arr], { type });
  }

  async function saveChat() {
    try {
      const messages = document.querySelector("textarea").value;
      const mediaItems = await getAllMedia();

      // Convert blobs to base64
      const mediaWithBase64 = await Promise.all(
        mediaItems.map(async (item) => ({
          id: item.id,
          type: item.blob.type,
          data: await blobToBase64(item.blob),
        })),
      );

      const exportData = {
        version: 1,
        messages,
        media: mediaWithBase64,
      };

      // Create and download the file
      const blob = new Blob([JSON.stringify(exportData)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error saving chat:", error);
      alert("Failed to save chat backup");
    }
  }

  async function importChatFromJSON(importData) {
    if (!importData.version || !importData.messages || !importData.media) {
      throw new Error("Invalid backup file format");
    }

    // Clear existing data
    localStorage.removeItem("chat-state");
    const transaction = db.transaction(["media"], "readwrite");
    const store = transaction.objectStore("media");
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = resolve;
      request.onerror = reject;
    });

    // Import messages
    const textarea = document.querySelector("textarea");
    textarea.value = importData.messages;
    localStorage.setItem("chat-state", importData.messages);

    // Import media
    for (const item of importData.media) {
      const blob = base64ToBlob(item.data, item.type);
      await storeMedia(item.id, blob);
    }

    await updatePreview(textarea);
  }

  async function importDefaultChat() {
    try {
      const response = await fetch("intro.json");
      if (response.ok) {
        const data = await response.json();
        importChatFromJSON(data);
      }
    } catch (error) {
      console.error("Error loading intro.json:", error);
    }
  }

  async function importChat() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          importChatFromJSON(data);
          alert("Chat backup restored successfully");
        } catch (error) {
          console.error("Error importing chat:", error);
          alert("Failed to import chat backup");
        }
      }
    };
    input.click();
  }

  function handleTab(event) {
    if (event.key !== "Tab") return;

    event.preventDefault();
    const textarea = event.target;

    // Get cursor position and text content
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    // Find the start and end of the current line
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", start);
    const currentLine = value.substring(
      lineStart,
      lineEnd === -1 ? value.length : lineEnd,
    );

    // Check if line starts with a tab
    const hasTab = currentLine.startsWith("\t");

    // Create new content
    const beforeLine = value.substring(0, lineStart);
    const afterLine = value.substring(lineEnd === -1 ? value.length : lineEnd);
    const newLine = hasTab ? currentLine.substring(1) : `\t${currentLine}`;

    // Update textarea content
    textarea.value = beforeLine + newLine + afterLine;

    // Restore cursor position
    const newCursorPos = start + (hasTab ? -1 : 1);
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    updatePreview(textarea);
  }

  async function handleDrop(file) {
    const fileType = file.type.split("/")[0];
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await storeMedia(id, file);
    const msg = `[${fileType}]: ${id}`;

    const textarea = document.querySelector("textarea");
    const cursorPos = textarea.selectionStart;
    const value = textarea.value;

    // Find the start of the current line
    const lineStart = value.lastIndexOf("\n", cursorPos - 1) + 1;

    // Insert msg on a new line before the current line
    const textBefore = value.substring(0, lineStart);
    const textAfter = value.substring(lineStart);

    // biome-ignore lint: this is more clear
    textarea.value = textBefore + msg + "\n" + textAfter;

    // Move cursor to the end of the inserted line
    const newCursorPos = lineStart + msg.length + 1;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    updatePreview(textarea);
  }

  function addDropListeners() {
    // Set up file drop handler
    document.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    document.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleDrop(e.dataTransfer.files[0]);
      }
    });

    // Set up paste handler
    document.addEventListener("paste", (e) => {
      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        handleDrop(e.clipboardData.files[0]);
      }
    });
  }

  function insertTag(tag, value = "") {
    const textarea = document.querySelector("textarea");
    const insertion = `\t[${tag}]: ${value}\n`;
    textarea.value = insertion + textarea.value;

    // update cursor position by
    const newCursorPos = value
      ? textarea.selectionStart + insertion.length
      : insertion.length - 1;
    textarea.focus();
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    updatePreview(textarea);
  }

  function updateName(name) {
    const nameElement = document.querySelector("#name");
    nameElement.textContent = name;
  }

  function updateStatus(status) {
    const statusElement = document.querySelector("#status");
    statusElement.textContent = status;
  }

  function updateAvatar(imageUrl) {
    const avatarElement = document.querySelector("#avatar");
    avatarElement.src = imageUrl;
  }

  async function getPreview(text) {
    const preview = document.createElement("ul");
    preview.id = "preview";

    const rawMessages = text.split("\n");
    for (let raw of rawMessages) {
      const isTheir = raw.startsWith("\t");
      raw = raw.trim();
      if (!raw) continue;
      const msg = document.createElement("li");
      msg.className = isTheir ? "their" : "our";
      const match = raw.match(/^\[(.+)]: (.+)$/);
      if (match) {
        const [_, type, value] = match;
        let el;
        let url;
        switch (type) {
          case "image":
            msg.classList.add("media");
            url = URL.createObjectURL(await getMedia(value));
            el = document.createElement("img");
            el.src = url;
            msg.appendChild(el);
            break;

          case "video":
            msg.classList.add("media");
            url = URL.createObjectURL(await getMedia(value));
            el = document.createElement("video");
            el.src = url;
            el.controls = true;
            msg.appendChild(el);
            break;

          case "name":
            updateName(value);
            break;

          case "status":
            url = updateStatus(value);
            break;

          case "dp":
          case "DP":
            url = URL.createObjectURL(await getMedia(value));
            updateAvatar(url);
            break;

          default:
            break;
        }
      } else {
        // Check if the text is a single emoji
        const emojiRegex = new RegExp(
          "^" +
            "(\\p{Emoji_Presentation}|\\p{Extended_Pictographic})" + // Base emoji
            "(" +
            "\\u200d" + // ZWJ (Zero Width Joiner)
            "(\\p{Emoji_Presentation}|\\p{Extended_Pictographic})" +
            ")*" +
            "[\\uFE0F\\u20E3]*" + // Emoji style variation selector and enclosing keycap
            "(\\p{EMod})?" + // Emoji Modifier
            "$",
          "u",
        );
        if (emojiRegex.test(raw)) {
          msg.classList.add("emoji");
        }
        msg.innerText = raw;
      }
      preview.appendChild(msg);
    }
    return preview;
  }

  async function updatePreview(textarea) {
    const existing = document.getElementById("preview");
    // Store current scroll position
    const scrollTop = existing.scrollTop;
    const scrollHeight = existing.scrollHeight;
    const clientHeight = existing.clientHeight;
    const wasScrolledToBottom = scrollHeight - scrollTop === clientHeight;

    const preview = await getPreview(textarea.value);
    existing.replaceWith(preview);

    // Restore scroll position
    if (wasScrolledToBottom) {
      // If we were at the bottom, keep it at bottom
      preview.scrollTop = preview.scrollHeight;
    } else {
      // Otherwise restore the previous position
      preview.scrollTop = scrollTop;
    }

    // save state in browser cache
    localStorage.setItem("chat-state", textarea.value);
  }

  async function clearChat() {
    try {
      // Clear textarea
      const textarea = document.querySelector("textarea");
      textarea.value = "";

      // Clear localStorage
      localStorage.removeItem("chat-state");

      // Clear IndexedDB media store
      const transaction = db.transaction(["media"], "readwrite");
      const store = transaction.objectStore("media");
      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = resolve;
        request.onerror = reject;
      });

      // Update preview
      await updatePreview(textarea);
    } catch (error) {
      console.error("Error clearing chat:", error);
      alert("Failed to clear chat");
    }
  }

  async function main() {
    await initDB();
    addDropListeners();

    // Restore saved state on load
    const textarea = document.querySelector("textarea");
    const savedState = localStorage.getItem("chat-state");
    if (savedState) {
      textarea.value = savedState;
      await updatePreview(textarea);
    }

    // load default chat if empty
    if (!textarea.value) {
      importDefaultChat();
    }

    async function handleAvatarClick() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          await storeMedia(id, file);

          insertTag("DP", id);
        }
      };
      input.click();
    }

    window.App = {
      handleTab: handleTab,
      updatePreview: updatePreview,
      clearChat: clearChat,
      saveChat: saveChat,
      importChat: importChat,
      insertTag: insertTag,
      handleAvatarClick: handleAvatarClick,
    };
  }
  main();
})();
