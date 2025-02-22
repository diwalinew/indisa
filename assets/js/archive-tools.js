// Unzip Tool
document.getElementById("unzipBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("zipInput");
  if (!fileInput.files[0]) {
    alert("Please select a ZIP file to extract.");
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const zip = await JSZip.loadAsync(e.target.result);
      const fileList = [];
      Object.keys(zip.files).forEach(filename => {
        fileList.push(filename);
      });
      document.getElementById("zipFileList").innerText = "Files: " + fileList.join(", ");
    } catch (err) {
      console.error(err);
      alert("Failed to unzip the file.");
    }
  };
  reader.readAsArrayBuffer(file);
});

// Create ZIP Tool
document.getElementById("createZipBtn").addEventListener("click", () => {
  const filesInput = document.getElementById("filesToZip");
  if (!filesInput.files.length) {
    alert("Please select one or more files to zip.");
    return;
  }
  const zip = new JSZip();
  Array.from(filesInput.files).forEach(file => {
    zip.file(file.name, file);
  });
  zip.generateAsync({type:"blob"})
    .then(function(content) {
      // Trigger download
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = "archive.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
});
