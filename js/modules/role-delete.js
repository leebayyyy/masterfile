export const deleteModal = async (roleId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Confirm Delete";
  document.getElementById("blank-main-div").innerHTML = `<p>Delete this role? This cannot be undone.</p>`;

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
    const result = await deleteRole(roleId);
    if (result == 1) {
      refreshDisplay();
      alert("Role has been deleted.");
      myModal.hide();
    } else if (result && result.message) {
      alert(result.message);
    } else {
      alert("ERROR");
    }
  });

  myModal.show();
};

const deleteRole = async (roleId) => {
  const params = {
    operation: "deleteRole",
    json: JSON.stringify({ roleId: roleId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/role.php`,
    { params: params }
  );
  return response.data;
};
