document.getElementById("convertBtn").addEventListener("click", function () {
  const file = document.getElementById("docInput").files[0];
  if (!file) {
    alert("Please select a DOCX file.");
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(event) {
    const arrayBuffer = event.target.result;
    mammoth.convertToHtml({arrayBuffer: arrayBuffer})
      .then(function(result) {
        document.getElementById("output").innerHTML = result.value;
      })
      .catch(function(err) {
        console.error("Error converting file: ", err);
      });
  };
  reader.readAsArrayBuffer(file);
});