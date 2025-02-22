// DOC Tools JavaScript

// Convert DOCX to HTML and display in #docHtmlOutput
document.getElementById("convertToHtmlBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("docInput");
  if (!fileInput.files[0]) {
    alert("Please select a DOCX file.");
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const arrayBuffer = e.target.result;
    mammoth.convertToHtml({arrayBuffer: arrayBuffer})
      .then(result => {
        document.getElementById("docHtmlOutput").innerHTML = result.value;
      })
      .catch(err => {
        console.error(err);
        alert("Error converting DOCX to HTML.");
      });
  };
  reader.readAsArrayBuffer(file);
});

// Convert DOCX to TXT and display in #docTxtOutput
document.getElementById("convertToTxtBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("docInput");
  if (!fileInput.files[0]) {
    alert("Please select a DOCX file.");
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const arrayBuffer = e.target.result;
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

// Convert DOCX to PDF using extracted text and jsPDF
document.getElementById("convertToPdfBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("docInput");
  if (!fileInput.files[0]) {
    alert("Please select a DOCX file.");
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = async function(e) {
    const arrayBuffer = e.target.result;
    try {
      const result = await mammoth.extractRawText({arrayBuffer: arrayBuffer});
      const text = result.value;
      // Create a PDF using jsPDF
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const lines = doc.splitTextToSize(text, 180);
      doc.text(lines, 10, 10);
      doc.save("converted.pdf");
    } catch (err) {
      console.error(err);
      alert("Error converting DOCX to PDF.");
    }
  };
  reader.readAsArrayBuffer(file);
});

// Convert DOCX to Image using converted HTML and html2canvas
document.getElementById("convertToImageBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("docInput");
  if (!fileInput.files[0]) {
    alert("Please select a DOCX file.");
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const arrayBuffer = e.target.result;
    mammoth.convertToHtml({arrayBuffer: arrayBuffer})
      .then(result => {
        // Create a temporary container
        const tempDiv = document.createElement("div");
        tempDiv.style.position = "absolute";
        tempDiv.style.top = "-10000px";
        tempDiv.innerHTML = result.value;
        document.body.appendChild(tempDiv);
        // Use html2canvas to capture the rendered HTML as image
        html2canvas(tempDiv).then(canvas => {
          document.getElementById("docImageOutput").src = canvas.toDataURL("image/png");
          document.body.removeChild(tempDiv);
        });
      })
      .catch(err => {
        console.error(err);
        alert("Error converting DOCX to image.");
      });
  };
  reader.readAsArrayBuffer(file);
});

// Crop DOC Tool (Placeholder example)
// This tool allows a user to select a region from the rendered HTML and then crop that region.
// For simplicity, this example uses a pre‑defined cropping (you can enhance this with a draggable/resizable overlay as in PDF tools).
document.getElementById("cropDocBtn").addEventListener("click", () => {
  // For example, we assume the user wants to crop the rendered HTML output (if any)
  const element = document.getElementById("docHtmlOutput");
  if (!element.innerHTML.trim()) {
    alert("No HTML content to crop.");
    return;
  }
  // Here you could implement a cropping library (like Cropper.js) on the element.
  // For simplicity, we'll just hide some parts.
  element.style.overflow = "hidden";
  element.style.height = "300px"; // crop height to 300px as an example.
  alert("Document cropped (example).");
});
