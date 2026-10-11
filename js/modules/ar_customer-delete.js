export const deactivateModal = async (arCustomerId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Confirm Deactivate";
  document.getElementById("blank-main-div").innerHTML = `<p>Deactivate this AR customer? It can be restored later.</p>`;

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
    const result = await deactivateArCustomer(arCustomerId);
    if (result == 1) {
      refreshDisplay();
      alert("AR Customer has been deactivated.");
      myModal.hide();
    } else if (result && result.message) {
      alert(result.message);
    } else {
      alert("ERROR");
    }
  });

  myModal.show();
};

const deactivateArCustomer = async (arCustomerId) => {
  const params = {
    operation: "deactivateCustomer",
    json: JSON.stringify({ arCustomerId: arCustomerId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/ar_customer.php`,
    { params: params }
  );
  return response.data;
};
