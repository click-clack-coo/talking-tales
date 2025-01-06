(() => {
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
  }

  function handleDrop(file) {
    const url = URL.createObjectURL(file);
    const fileType = file.type.split("/")[0];
    const msg = `${fileType}(${url})`;

    const textarea = document.querySelector("textarea");
    const cursorPos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursorPos);
    const textAfter = textarea.value.substring(cursorPos);

    textarea.value = textBefore + msg + textAfter;

    // Move cursor after inserted text
    const newCursorPos = cursorPos + msg.length;
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

  function getPreview(text) {
    const preview = document.createElement("ul");
    preview.id = "preview";

    const rawMessages = text.split("\n");
    for (const raw of rawMessages) {
      const msg = document.createElement("li");
      msg.innerText = raw;
      preview.appendChild(msg);
    }
    return preview;
  }

  function updatePreview(textarea) {
    const preview = getPreview(textarea.value);
    const existing = document.getElementById("preview");
    existing.replaceWith(preview);
  }

  function main() {
    addDropListeners();
    window.App = {
      handleTab: handleTab,
      updatePreview: updatePreview,
    };
  }
  main();
})();
