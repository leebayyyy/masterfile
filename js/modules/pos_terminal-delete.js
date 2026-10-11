export const deleteModal = async (posTerminalId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Confirm Delete";
  document.getElementById("blank-main-div").innerHTML = `<p>Delete this POS terminal? This cannot be undone.</p>`;

  const modalFooter = document.getElementById("blank-modal-footer");
  modalFooter.innerHTML = `
      <button type="button" class="btn btn-danger btn-sm w-100 me-2 btn-confirm">Delete</button>
      <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
    `;

  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), {
    keyboard: true,
    backdrop: "static",
  });

  modalFooter.querySelector(".btn-confirm").addEventListener("click", async () => {
    const result = await deletePosTerminal(posTerminalId);
    if (result == 1) {
      refreshDisplay();
      alert("POS Terminal has been deleted.");
      myModal.hide();
    } else if (result && result.message) {
      alert(result.message);
    } else {
      alert("ERROR");
    }
  });

  myModal.show();
};

const deletePosTerminal = async (posTerminalId) => {
  const params = {
    operation: "deletePosTerminal",
    json: JSON.stringify({ posTerminalId: posTerminalId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/pos_terminal.php`,
    { params: params }
  );
  return response.data;
};
