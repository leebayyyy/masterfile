export const updateModal = async (posTerminalId, refreshDisplay) => {
  const myModal = new bootstrap.Modal(document.getElementById("blank-modal"), {
    keyboard: true,
    backdrop: "static",
  });

  document.getElementById("blank-modal-title").innerText = "Update POS Terminal";
  const record = await getPosTerminalDetails(posTerminalId);

  let myHtml = `
        <table class="table table-sm">
          <tr>
            <td>Terminal Name</td>
            <td><input type="text" id="update-terminal_name" class="form-control" maxlength="150" value="${record.terminal_name ?? ""}" required /></td>
          </tr>
        </table>
    `;
  document.getElementById("blank-main-div").innerHTML = myHtml;


  const modalFooter = document.getElementById("blank-modal-footer");
  modalFooter.innerHTML = `
      <button type="button" class="btn btn-primary btn-sm w-100 btn-update">UPDATE</button>
      <button type="button" class="btn btn-secondary btn-sm w-100" data-bs-dismiss="modal">Close</button>
    `;

  modalFooter.querySelector(".btn-update").addEventListener("click", async () => {
    if (await updatePosTerminal(posTerminalId) == 1) {
      refreshDisplay();
      alert("POS Terminal record has been successfully updated!");
      myModal.hide();
    } else {
      alert("ERROR!");
    }
  });

  myModal.show();
};

const getPosTerminalDetails = async (posTerminalId) => {
  const params = {
    operation: "getPosTerminal",
    json: JSON.stringify({ posTerminalId: posTerminalId }),
  };
  const response = await axios.get(
    `${sessionStorage.baseAPIUrl}/pos_terminal.php`,
    { params: params }
  );
  return response.data[0];
};

const updatePosTerminal = async (posTerminalId) => {
  const jsonData = {
    terminalName: document.getElementById("update-terminal_name").value,
    posTerminalId: posTerminalId,
  };
  const formData = new FormData();
  formData.append("operation", "updatePosTerminal");
  formData.append("json", JSON.stringify(jsonData));
  const response = await axios({
    url: `${sessionStorage.baseAPIUrl}/pos_terminal.php`,
    method: "POST",
    data: formData,
  });
  return response.data;
};
