const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("posPrinter", {
  printReceipt: (args) => ipcRenderer.invoke("print-receipt", args),
  saveReceiptPdf: (args) => ipcRenderer.invoke("save-receipt-pdf", args),
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  openWhatsApp: (url) => ipcRenderer.invoke("open-whatsapp", url),
  saveAIKey: (key) => ipcRenderer.invoke("ai-save-key", key),
  getAIKeyStatus: () => ipcRenderer.invoke("ai-key-status"),
  analyzeProductImage: (args) => ipcRenderer.invoke("ai-analyze-product-image", args)
});
