export const deactivateModal = async (userId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Confirm Deactivate";
  document.getElementById("blank-main-div").innerHTML = `<p>Deactivate this user? It can be restored later.</p>`;

  const modalFooter = document.getElementById("blank-modal-footer");
  modalFooter.innerHTML = `
      <button type="button" class="btn btn-danger btn-sm w-100 me-2 btn-confirm">Deactivate</button>
      <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
    `;

  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), {
    keyboard: true,
    backdrop: "static",
  });

  modalFooter.querySelector(".btn-confirm").addEventListener("click", async () => {
    const result = await deactivateUser(userId);
    if (result == 1) {
      refreshDisplay();
      alert("User has been deactivated.");
      myModal.hide();
    } else if (result && result.message) {
      alert(result.message);
    } else {
      alert("ERROR");
    }
  });

  myModal.show();
};

const deactivateUser = async (userId) => {
  const params = {
    operation: "deactivateUser",
    json: JSON.stringify({ userId: userId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/user.php`,
    { params: params }
  );
  return response.data;
};
