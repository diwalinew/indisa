document.getElementById("zipBtn").addEventListener("click", async function () {
  const files = document.getElementById("fileInput").files;
  if (files.length === 0) {
    alert("Please select at least one file.");
    return;
  }
  
  const zip = new JSZip();
  for (const file of files) {
    const fileData = await file.arrayBuffer();
    zip.file(file.name, fileData);
  }
  
  zip.generateAsync({type:"blob"}).then(function(content) {
    const downloadLink = document.getElementById("downloadZip");
    const url = URL.createObjectURL(content);
    downloadLink.href = url;
    downloadLink.download = "archive.zip";
    downloadLink.style.display = "block";
    downloadLink.innerText = "Download ZIP Archive";
  });
});