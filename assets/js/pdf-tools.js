// ------------------------
// Utility: Progress Modal Functions
// ------------------------
function showProgress(title, stepsTotal) {
  const progressModal = new bootstrap.Modal(document.getElementById("progressModal"));
  document.getElementById("progressModalLabel").innerText = title;
  document.getElementById("progressBar").style.width = "0%";
  document.getElementById("progressInfo").innerText = "Starting process...";
  progressModal.show();
  return { modal: progressModal, stepsDone: 0, stepsTotal: stepsTotal };
}

function updateProgress(progressObj, message) {
  progressObj.stepsDone++;
  const percent = Math.floor((progressObj.stepsDone / progressObj.stepsTotal) * 100);
  document.getElementById("progressBar").style.width = percent + "%";
  document.getElementById("progressInfo").innerText = `${message} (${progressObj.stepsDone}/${progressObj.stepsTotal})`;
  if (progressObj.stepsDone >= progressObj.stepsTotal) {
    setTimeout(() => progressObj.modal.hide(), 500);
  }
}

// ------------------------
// Global PDF Viewer Section
// ------------------------
let globalPdfDoc = null;
let globalCurrentPage = 1;
let globalZoom = 1.0;

async function renderGlobalPage(num) {
  if (!globalPdfDoc) return;
  const page = await globalPdfDoc.getPage(num);
  const viewport = page.getViewport({ scale: globalZoom });
  const canvas = document.getElementById("globalPreviewCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: ctx, viewport: viewport }).promise;
  document.getElementById("pageInfo").innerText = `Page ${num} / ${globalPdfDoc.numPages}`;
}

async function loadGlobalPDF(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function() {
    const typedarray = new Uint8Array(this.result);
    globalPdfDoc = await pdfjsLib.getDocument({ data: typedarray }).promise;
    globalCurrentPage = 1;
    globalZoom = 1.0;
    await renderGlobalPage(globalCurrentPage);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const totalPages = globalPdfDoc.numPages;
    const firstPage = await globalPdfDoc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1.0 });
    const resolution = `${viewport.width} x ${viewport.height}`;
    document.getElementById("globalFileInfo").innerHTML =
      `<strong>File Size:</strong> ${fileSizeMB} MB | <strong>Total Pages:</strong> ${totalPages} | <strong>Resolution:</strong> ${resolution}`;
  };
  reader.readAsArrayBuffer(file);
}

["mergeInput", "splitInput", "cutInput", "pdfToDocInput", "pdfToImagesInput"].forEach(id => {
  const inputEl = document.getElementById(id);
  inputEl.addEventListener("change", function() {
    if (this.files[0]) loadGlobalPDF(this.files[0]);
  });
});

document.getElementById("prevPage").addEventListener("click", async () => {
  if (globalPdfDoc && globalCurrentPage > 1) {
    globalCurrentPage--;
    await renderGlobalPage(globalCurrentPage);
  }
});
document.getElementById("nextPage").addEventListener("click", async () => {
  if (globalPdfDoc && globalCurrentPage < globalPdfDoc.numPages) {
    globalCurrentPage++;
    await renderGlobalPage(globalCurrentPage);
  }
});
document.getElementById("zoomIn").addEventListener("click", async () => {
  if (globalPdfDoc) {
    globalZoom *= 1.2;
    await renderGlobalPage(globalCurrentPage);
  }
});
document.getElementById("zoomOut").addEventListener("click", async () => {
  if (globalPdfDoc) {
    globalZoom /= 1.2;
    await renderGlobalPage(globalCurrentPage);
  }
});

// (Merge, Split, PDF-to-DOC, and PDF-to-Images code remain unchanged)

// ------------------------
// Revised PDF Cropping Tool
// ------------------------
// Workflow:
// 1. When a PDF is selected in the Cut section, open the graphical crop modal automatically.
// 2. In the modal, render the first page on a canvas with an overlaid crop box (no fixed aspect ratio).
// 3. The user drags/resizes the crop box to select the desired area.
// 4. When the user clicks the "Crop PDF" button in the modal, the exact coordinates (relative to the canvas) are captured and immediately transferred into the numeric input fields in the Cut section.
// 5. Then the tool processes the crop: using those numeric values, the same crop region is applied to every page of the PDF, and the cropped PDF is automatically downloaded.
// 6. The crop modal reliably closes.

let cropPdfDoc = null;
let cropFile = null;
let cropSelection = null;
const cropCanvas = document.getElementById("cropCanvas");
const cropCtx = cropCanvas.getContext("2d");

// Automatically open crop modal when a file is selected in the Cut section.
document.getElementById("cutInput").addEventListener("change", function() {
  if (!this.files[0]) return;
  cropFile = this.files[0];
  openCropModal();
});

async function openCropModal() {
  const reader = new FileReader();
  reader.onload = async function() {
    try {
      const typedarray = new Uint8Array(this.result);
      cropPdfDoc = await pdfjsLib.getDocument({ data: typedarray }).promise;
      const page = await cropPdfDoc.getPage(1);
      const scale = 1.0;
      const viewport = page.getViewport({ scale: scale });
      cropCanvas.width = viewport.width;
      cropCanvas.height = viewport.height;
      await page.render({ canvasContext: cropCtx, viewport: viewport }).promise;
      // Reset crop box: center it covering half the canvas.
      const cropBox = document.querySelector('.crop-box');
      cropBox.style.transform = 'translate(0px, 0px)';
      cropBox.style.width = (viewport.width / 2) + 'px';
      cropBox.style.height = (viewport.height / 2) + 'px';
      cropBox.style.top = (viewport.height / 4) + 'px';
      cropBox.style.left = (viewport.width / 4) + 'px';
      cropBox.setAttribute('data-x', 0);
      cropBox.setAttribute('data-y', 0);
      updateCropSelection();
    } catch (error) {
      console.error("Error loading PDF for cropping:", error);
      alert("Failed to load PDF for cropping.");
    }
  };
  reader.readAsArrayBuffer(cropFile);
  new bootstrap.Modal(document.getElementById("cropModal")).show();
}

// Enable draggable & resizable crop box using Interact.js.
interact('.crop-box')
  .draggable({
    inertia: true,
    modifiers: [interact.modifiers.restrictRect({ restriction: 'parent', endOnly: true })],
    listeners: {
      move (event) {
        const target = event.target;
        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
        target.style.transform = `translate(${x}px, ${y}px)`;
        target.setAttribute('data-x', x);
        target.setAttribute('data-y', y);
        updateCropSelection();
      }
    }
  })
  .resizable({
    edges: { left: true, right: true, bottom: true, top: true },
    modifiers: [
      interact.modifiers.restrictEdges({ outer: 'parent' }),
      interact.modifiers.restrictSize({ min: { width: 50, height: 50 } })
    ],
    inertia: true
  })
  .on('resizemove', function (event) {
    const target = event.target;
    let x = (parseFloat(target.getAttribute('data-x')) || 0) + event.deltaRect.left;
    let y = (parseFloat(target.getAttribute('data-y')) || 0) + event.deltaRect.top;
    target.style.width = event.rect.width + 'px';
    target.style.height = event.rect.height + 'px';
    target.style.transform = `translate(${x}px, ${y}px)`;
    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
    updateCropSelection();
  });

function updateCropSelection() {
  const cropBox = document.querySelector('.crop-box');
  const canvasRect = cropCanvas.getBoundingClientRect();
  const boxRect = cropBox.getBoundingClientRect();
  // Calculate selection relative to canvas.
  cropSelection = {
    x: boxRect.left - canvasRect.left,
    y: boxRect.top - canvasRect.top,
    width: boxRect.width,
    height: boxRect.height
  };
}

// When user clicks "Crop PDF" in the modal, transfer values and process crop.
document.getElementById("applyCropBtn").addEventListener("click", async () => {
  if (!cropSelection) {
    alert("Please select a crop area.");
    return;
  }
  // Transfer crop selection to numeric input fields.
  document.getElementById("cutX").value = Math.round(cropSelection.x);
  document.getElementById("cutY").value = Math.round(cropSelection.y);
  document.getElementById("cutWidth").value = Math.round(cropSelection.width);
  document.getElementById("cutHeight").value = Math.round(cropSelection.height);
  
  // Close the crop modal.
  const modalInstance = bootstrap.Modal.getInstance(document.getElementById("cropModal"));
  modalInstance.hide();
  
  // Process crop for all pages using the transferred values.
  processCrop();
});

async function processCrop() {
  const file = document.getElementById("cutInput").files[0];
  const x = parseFloat(document.getElementById("cutX").value);
  const y = parseFloat(document.getElementById("cutY").value);
  const width = parseFloat(document.getElementById("cutWidth").value);
  const height = parseFloat(document.getElementById("cutHeight").value);
  if (!file || isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
    alert("Invalid crop values.");
    return;
  }
  const progressObj = showProgress("Cropping PDF...", 1);
  const reader = new FileReader();
  reader.onload = async function() {
    const typedarray = new Uint8Array(this.result);
    const pdfDoc = await PDFLib.PDFDocument.load(typedarray);
    const pages = pdfDoc.getPages();
    // Apply the exact crop region (user-selected) to every page.
    pages.forEach(page => {
      page.setCropBox(x, y, width, height);
    });
    const croppedBytes = await pdfDoc.save();
    const blob = new Blob([croppedBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    // Automatically trigger download.
    const a = document.createElement("a");
    a.href = url;
    a.download = "cropped.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    updateProgress(progressObj, "Crop completed");
  };
  reader.readAsArrayBuffer(file);
}

// ------------------------
// PDF to DOC (Text Extraction) with Modal & Progress
// ------------------------
document.getElementById("pdfToDocBtn").addEventListener("click", async () => {
  const file = document.getElementById("pdfToDocInput").files[0];
  if (!file) {
    alert("Please select a PDF.");
    return;
  }
  const reader = new FileReader();
  reader.onload = async function() {
    try {
      const typedarray = new Uint8Array(this.result);
      const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
      let fullText = "";
      const totalPages = pdf.numPages;
      const progressObj = showProgress("Extracting text...", totalPages);
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        fullText += strings.join(" ") + "\n\n";
        updateProgress(progressObj, `Extracted page ${i}`);
      }
      document.getElementById("extractedTextArea").value = fullText;
      new bootstrap.Modal(document.getElementById("docModal")).show();
    } catch (error) {
      console.error("Error extracting text:", error);
      alert("An error occurred while extracting text.");
    }
  };
  reader.readAsArrayBuffer(file);
});

document.getElementById("downloadTxtBtn").addEventListener("click", () => {
  const text = document.getElementById("extractedTextArea").value;
  if (!text) return;
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "extracted.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

document.getElementById("downloadDocBtn").addEventListener("click", () => {
  const text = document.getElementById("extractedTextArea").value;
  if (!text) return;
  const blob = new Blob([text], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "extracted.doc";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

// ------------------------
// PDF to Images with ZIP Download and Progress
// ------------------------
document.getElementById("pdfToImagesBtn").addEventListener("click", async () => {
  const file = document.getElementById("pdfToImagesInput").files[0];
  if (!file) {
    alert("Please select a PDF.");
    return;
  }
  const outputDiv = document.getElementById("pdfToImagesOutput");
  outputDiv.innerHTML = "";
  const reader = new FileReader();
  reader.onload = async function() {
    const typedarray = new Uint8Array(this.result);
    const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
    const totalPages = pdf.numPages;
    const progressObj = showProgress("Converting pages to images...", totalPages);
    const imageDataURLs = [];
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      const dataURL = canvas.toDataURL("image/png");
      imageDataURLs.push({ dataURL, index: i });
      const img = document.createElement("img");
      img.src = dataURL;
      img.className = "img-fluid mb-3";
      img.style.border = "1px solid #ccc";
      outputDiv.appendChild(img);
      updateProgress(progressObj, `Converted page ${i}`);
    }
    new bootstrap.Modal(document.getElementById("imagesModal")).show();
    document.getElementById("downloadImagesZipBtn").onclick = async () => {
      const zip = new JSZip();
      imageDataURLs.forEach(item => {
        const base64Data = item.dataURL.split(",")[1];
        zip.file(`page-${item.index}.png`, base64Data, { base64: true });
      });
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipURL = URL.createObjectURL(zipBlob);
      const tempLink = document.createElement("a");
      tempLink.href = zipURL;
      tempLink.download = "images.zip";
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
    };
  };
  reader.readAsArrayBuffer(file);
});