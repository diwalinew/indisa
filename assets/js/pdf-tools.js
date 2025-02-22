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
  reader.onload = async function () {
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
  inputEl.addEventListener("change", function () {
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

// ------------------------
// Merge PDF Tool (Fixed)
// ------------------------
let mergePages = [];
document.getElementById("prepareMergeBtn").addEventListener("click", async () => {
  const files = document.getElementById("mergeInput").files;
  if (files.length < 2) {
    alert("Please select at least 2 PDF files to merge.");
    return;
  }
  const progressObj = showProgress("Merging PDFs...", files.length);
  mergePages = [];
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    const totalPages = pdfDoc.getPageCount();
    for (let i = 0; i < totalPages; i++) {
      mergePages.push({ fileName: file.name, pageIndex: i, arrayBuffer: arrayBuffer });
    }
    updateProgress(progressObj, `Loaded ${file.name}`);
  }
  const listEl = document.getElementById("mergePageList");
  listEl.innerHTML = "";
  mergePages.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "border p-2";
    li.style.width = "120px";
    li.style.cursor = "move";
    li.setAttribute("data-index", index);
    li.innerHTML = `<strong>${item.fileName}</strong><br>Page ${item.pageIndex + 1}`;
    listEl.appendChild(li);
  });
  Sortable.create(listEl, {
    animation: 150,
    onEnd: function () {
      const newOrder = [];
      listEl.querySelectorAll("li").forEach(li => {
        const idx = li.getAttribute("data-index");
        newOrder.push(mergePages[idx]);
      });
      mergePages = newOrder;
      listEl.querySelectorAll("li").forEach((li, newIndex) => {
        li.setAttribute("data-index", newIndex);
      });
    }
  });
  setTimeout(() => { new bootstrap.Modal(document.getElementById("mergeModal")).show(); }, 500);
});

document.getElementById("mergeConfirmBtn").addEventListener("click", async () => {
  if (mergePages.length === 0) return;
  const progressObj = showProgress("Merging PDFs...", mergePages.length);
  const mergedPdf = await PDFLib.PDFDocument.create();
  for (const item of mergePages) {
    const pdf = await PDFLib.PDFDocument.load(item.arrayBuffer);
    const [copiedPage] = await mergedPdf.copyPages(pdf, [item.pageIndex]);
    mergedPdf.addPage(copiedPage);
    updateProgress(progressObj, `Merged page ${item.pageIndex + 1} of ${item.fileName}`);
  }
  const mergedBytes = await mergedPdf.save();
  const blob = new Blob([mergedBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  document.getElementById("mergeDownload").innerHTML = `<a href="${url}" download="merged.pdf" class="btn btn-success">Download Merged PDF</a>`;
  new bootstrap.Modal(document.getElementById("mergeModal")).hide();
});

// ------------------------
// Split PDF Tool (Fixed)
// ------------------------
document.getElementById("splitBtn").addEventListener("click", async () => {
  const file = document.getElementById("splitInput").files[0];
  const splitAfter = parseInt(document.getElementById("splitPage").value);
  if (!file || isNaN(splitAfter) || splitAfter < 1) {
    alert("Please select a PDF and provide a valid page number.");
    return;
  }
  const progressObj = showProgress("Splitting PDF...", 1);
  const reader = new FileReader();
  reader.onload = async function() {
    const typedarray = new Uint8Array(this.result);
    const pdf = await PDFLib.PDFDocument.load(typedarray);
    const totalPages = pdf.getPageCount();
    if (splitAfter >= totalPages) {
      alert("Split page must be less than total pages.");
      progressObj.modal.hide();
      return;
    }
    const firstPdf = await PDFLib.PDFDocument.create();
    const secondPdf = await PDFLib.PDFDocument.create();
    const indices = Array.from({ length: totalPages }, (_, i) => i);
    const firstPages = await firstPdf.copyPages(pdf, indices.slice(0, splitAfter));
    firstPages.forEach(page => firstPdf.addPage(page));
    const secondPages = await secondPdf.copyPages(pdf, indices.slice(splitAfter));
    secondPages.forEach(page => secondPdf.addPage(page));
    const firstPdfBytes = await firstPdf.save();
    const secondPdfBytes = await secondPdf.save();
    document.getElementById("splitDownloadContainer").innerHTML = `
      <a href="${URL.createObjectURL(new Blob([firstPdfBytes], { type: "application/pdf" }))}" download="split-part1.pdf" class="btn btn-success me-2">Download Part 1</a>
      <a href="${URL.createObjectURL(new Blob([secondPdfBytes], { type: "application/pdf" }))}" download="split-part2.pdf" class="btn btn-success">Download Part 2</a>
    `;
    updateProgress(progressObj, "Split completed");
  };
  reader.readAsArrayBuffer(file);
});

// ------------------------
// Revised PDF Cropping Tool
// ------------------------
// Workflow:
// 1. When a PDF is selected in the Cut section, the crop modal opens automatically.
// 2. In the modal, the first page is rendered on a canvas with an overlaid, free-form (no fixed aspect ratio) crop box.
// 3. The user drags/resizes the crop box to select the desired area.
// 4. When the user clicks "Crop PDF" in the modal, the crop box’s coordinates (relative to the canvas) are transferred to the numeric inputs.
// 5. Then, using those exact numeric values, the tool crops every page of the PDF and automatically triggers a download.
// 6. The modal closes reliably.

let cropPdfDoc = null;
let cropFile = null;
let cropSelection = null;
const cropCanvas = document.getElementById("cropCanvas");
const cropCtx = cropCanvas.getContext("2d");

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
  cropSelection = {
    x: boxRect.left - canvasRect.left,
    y: boxRect.top - canvasRect.top,
    width: boxRect.width,
    height: boxRect.height
  };
}

document.getElementById("applyCropBtn").addEventListener("click", async () => {
  if (!cropSelection) {
    alert("Please select a crop area.");
    return;
  }
  // Transfer the crop selection to numeric fields.
  document.getElementById("cutX").value = Math.round(cropSelection.x);
  document.getElementById("cutY").value = Math.round(cropSelection.y);
  document.getElementById("cutWidth").value = Math.round(cropSelection.width);
  document.getElementById("cutHeight").value = Math.round(cropSelection.height);
  // Close the crop modal.
  const modalInstance = bootstrap.Modal.getInstance(document.getElementById("cropModal"));
  modalInstance.hide();
  // Process the crop for all pages.
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
    // Apply the user-selected crop region to every page.
    pages.forEach(page => {
      page.setCropBox(x, y, width, height);
    });
    const croppedBytes = await pdfDoc.save();
    const blob = new Blob([croppedBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    // Trigger download automatically.
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
      alert("An error occurred while extracting text from the PDF.");
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
  reader.onload = async function () {
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