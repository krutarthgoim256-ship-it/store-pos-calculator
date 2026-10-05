const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("posPrinter", {
  printReceipt: (html) => ipcRenderer.invoke("print-receipt", html),
  getPrinters: () => ipcRenderer.invoke("get-printers")
});
