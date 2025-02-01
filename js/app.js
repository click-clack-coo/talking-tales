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

  async function getPreview(text) {
    const preview = document.createElement("ul");
    preview.id = "preview";

    const rawMessages = text.split("\n");
    for (let raw of rawMessages) {
      if (!raw.trim()) continue;
      const msg = document.createElement("li");
      msg.className = raw.startsWith("\t") ? "their" : "our";
      raw = raw.trim();
      const match = raw.match(/^\[(image|video)]: (.+)$/);
      if (match) {
        msg.classList.add("media");
        const [, type, id] = match;
        const blob = await getMedia(id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          if (type === "image") {
            const img = document.createElement("img");
            img.src = url;
            msg.appendChild(img);
          } else if (type === "video") {
            const video = document.createElement("video");
            video.src = url;
            video.controls = true;
            msg.appendChild(video);
          }
        }
      } else {
        msg.innerText = raw;
      }
      preview.appendChild(msg);
    }
    return preview;
  }

  async function updatePreview(textarea) {
    const preview = await getPreview(textarea.value);
    const existing = document.getElementById("preview");
    existing.replaceWith(preview);
    // save state in browser cache
    localStorage.setItem("chat-state", textarea.value);
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

    window.App = {
      handleTab: handleTab,
      updatePreview: updatePreview,
    };
  }
  main();
})();
