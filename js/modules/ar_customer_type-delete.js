export const deleteModal = async (customerTypeId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Confirm Delete";
  document.getElementById("blank-main-div").innerHTML = `<p>Delete this customer type? This cannot be undone.</p>`;

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
    const result = await deleteArCustomerType(customerTypeId);
    if (result == 1) {
      refreshDisplay();
      alert("Customer Type has been deleted.");
      myModal.hide();
    } else if (result && result.message) {
      alert(result.message);
    } else {
      alert("ERROR");
    }
  });

  myModal.show();
};

const deleteArCustomerType = async (customerTypeId) => {
  const params = {
    operation: "deleteCustomerType",
    json: JSON.stringify({ customerTypeId: customerTypeId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/ar_customer_type.php`,
    { params: params }
  );
  return response.data;
};
