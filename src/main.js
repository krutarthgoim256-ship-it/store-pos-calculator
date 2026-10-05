const {app,BrowserWindow,Menu,ipcMain}=require("electron");const path=require("path");

function createWindow(){
  const w=new BrowserWindow({
    width:1440,height:900,minWidth:1050,minHeight:700,backgroundColor:"#f5f7fb",
    webPreferences:{contextIsolation:true,nodeIntegration:false,preload:path.join(__dirname,"preload.js")}
  });
  w.loadFile(path.join(__dirname,"index.html"));
}

ipcMain.handle("get-printers",async(event)=>{
  try{
    return await event.sender.getPrintersAsync();
  }catch(error){
    return [];
  }
});

ipcMain.handle("print-receipt",async(event,html)=>{
  if(typeof html!=="string"||!html.trim()) return {success:false,error:"Empty receipt"};

  const parent=BrowserWindow.fromWebContents(event.sender);
  let printers=[];
  try{
    printers=await event.sender.getPrintersAsync();
  }catch{}

  if(!printers.length){
    return {success:false,error:"No printer was found by Windows. Connect and install your receipt printer, then try again."};
  }

  const printWin=new BrowserWindow({
    width:420,
    height:700,
    show:true,
    parent,
    title:"Receipt",
    webPreferences:{contextIsolation:true,nodeIntegration:false}
  });

  try{
    await printWin.loadURL("data:text/html;charset=utf-8,"+encodeURIComponent(html));
    await new Promise(resolve=>setTimeout(resolve,300));

    const result=await new Promise(resolve=>{
      printWin.webContents.print({
        silent:false,
        printBackground:true,
        margins:{marginType:"none"}
      },(success,failureReason)=>{
        resolve({success,failureReason});
      });
    });

    setTimeout(()=>{
      if(!printWin.isDestroyed()) printWin.close();
    },500);

    return result;
  }catch(error){
    if(!printWin.isDestroyed()) printWin.close();
    return {success:false,error:error.message};
  }
});

app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate",()=>{
    if(!BrowserWindow.getAllWindows().length) createWindow();
  });
});

app.on("window-all-closed",()=>{
  if(process.platform!=="darwin") app.quit();
});
