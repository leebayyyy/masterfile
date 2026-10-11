export const deactivateModal = async (productId, refreshDisplay) => {
  document.getElementById("blank-modal-title").innerText = "Confirm Deactivate";
  document.getElementById("blank-main-div").innerHTML = `<p>Deactivate this product? It can be restored later.</p>`;

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
    const result = await deactivateProduct(productId);
    if (result == 1) {
      refreshDisplay();
      alert("Product has been deactivated.");
      myModal.hide();
    } else if (result && result.message) {
      alert(result.message);
    } else {
      alert("ERROR");
    }
  });

  myModal.show();
};

const deactivateProduct = async (productId) => {
  const params = {
    operation: "deactivateProduct",
    json: JSON.stringify({ productId: productId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/product.php`,
    { params: params }
  );
  return response.data;
};
