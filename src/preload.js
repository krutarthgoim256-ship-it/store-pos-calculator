const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("posPrinter", {
  printReceipt: (args) => ipcRenderer.invoke("print-receipt", args),
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  openWhatsApp: (url) => ipcRenderer.invoke("open-whatsapp", url)
});
