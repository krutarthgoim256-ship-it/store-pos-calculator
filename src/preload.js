const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("posPrinter", {
  printReceipt: (args) => ipcRenderer.invoke("print-receipt", args),
  saveReceiptPdf: (args) => ipcRenderer.invoke("save-receipt-pdf", args),
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  openWhatsApp: (url) => ipcRenderer.invoke("open-whatsapp", url)
});
