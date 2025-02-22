// Ensure Mammoth.js is loaded via CDN in the HTML file.
document.getElementById("docConvertBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("docInput");
  if (!fileInput.files[0]) {
    alert("Please select a DOCX file.");
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const arrayBuffer = e.target.result;
    // Use Mammoth to convert DOCX to HTML and plain text.
    mammoth.convertToHtml({arrayBuffer: arrayBuffer})
      .then(result => {
        document.getElementById("docHtmlOutput").innerHTML = result.value;
      })
      .catch(err => {
        console.error(err);
        alert("Error converting DOCX to HTML.");
      });
      
    mammoth.extractRawText({arrayBuffer: arrayBuffer})
      .then(result => {
        document.getElementById("docTxtOutput").value = result.value;
      })
      .catch(err => {
        console.error(err);
        alert("Error extracting text from DOCX.");
      });
  };
  reader.readAsArrayBuffer(file);
});
