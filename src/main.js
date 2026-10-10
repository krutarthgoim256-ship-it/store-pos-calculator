const {app,BrowserWindow,Menu,ipcMain,shell,dialog}=require("electron");const path=require("path");const fs=require("fs");

function createWindow(){
  const w=new BrowserWindow({
    width:1440,height:900,minWidth:1050,minHeight:700,backgroundColor:"#f5f7fb",
    webPreferences:{contextIsolation:true,nodeIntegration:false,preload:path.join(__dirname,"preload.js")}
  });
  w.loadFile(path.join(__dirname,"index.html"));
}

ipcMain.handle("open-whatsapp",async(_event,links)=>{
  try{
    if(!links||typeof links!=="object")return {success:false,error:"Invalid WhatsApp link."};
    const validWeb=(value)=>{
      try{
        const u=new URL(value);
        return u.protocol==="https:"&&u.hostname==="wa.me"&&/^\/\d{10,15}$/.test(u.pathname)&&u.searchParams.has("text");
      }catch{return false;}
    };
    const validDesktop=(value)=>{
      try{
        const u=new URL(value);
        return u.protocol==="whatsapp:"&&u.hostname==="send"&&/^\d{10,15}$/.test(u.searchParams.get("phone")||"")&&u.searchParams.has("text");
      }catch{return false;}
    };
    if(!validDesktop(links.desktopUrl)||!validWeb(links.webUrl))return {success:false,error:"Invalid WhatsApp link."};
    try{
      await shell.openExternal(links.desktopUrl);
      return {success:true,opened:"desktop"};
    }catch(_desktopError){
      await shell.openExternal(links.webUrl);
      return {success:true,opened:"web"};
    }
  }catch(error){return {success:false,error:error.message};}
});


ipcMain.handle("save-receipt-pdf",async(event,args)=>{
  const html=args?.html;
  const filename=String(args?.filename||"Receipt.pdf").replace(/[\\/:*?"<>|]/g,"-");
  if(typeof html!=="string"||!html.trim())return {success:false,error:"Empty receipt"};
  const folder=path.join(app.getPath("documents"),"Store POS Receipts");
  try{
    fs.mkdirSync(folder,{recursive:true});
    const choice=await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender),{
      title:"Save PDF Receipt",
      defaultPath:path.join(folder,filename),
      buttonLabel:"Save Receipt",
      filters:[{name:"PDF Receipt",extensions:["pdf"]}]
    });
    if(choice.canceled||!choice.filePath)return {success:false,cancelled:true};
    const pdfWin=new BrowserWindow({show:false,width:900,height:1100,webPreferences:{contextIsolation:true,nodeIntegration:false}});
    try{
      await pdfWin.loadURL("data:text/html;charset=utf-8,"+encodeURIComponent(html));
      const pdf=await pdfWin.webContents.printToPDF({pageSize:"A4",printBackground:true,margins:{top:0.35,bottom:0.35,left:0.35,right:0.35}});
      fs.writeFileSync(choice.filePath,pdf);
    }finally{
      if(!pdfWin.isDestroyed())pdfWin.close();
    }
    shell.showItemInFolder(choice.filePath);
    return {success:true,path:choice.filePath};
  }catch(error){return {success:false,error:error.message};}
});

ipcMain.handle("get-printers",async(event)=>{
  try{return await event.sender.getPrintersAsync();}catch(error){return [];}
});

ipcMain.handle("print-receipt",async(event,args)=>{
  const html=args?.html;
  const deviceName=args?.deviceName||"";
  const silent=Boolean(args?.silent);
  if(typeof html!=="string"||!html.trim())return {success:false,error:"Empty receipt"};

  const printers=await event.sender.getPrintersAsync().catch(()=>[]);
  if(!printers.length)return {success:false,error:"Windows reports that no printers are installed or available."};

  if(deviceName&&!printers.some(p=>p.name===deviceName)){
    return {success:false,error:"The selected printer is not available. Click Refresh Printers in Settings and select it again."};
  }

  const parent=BrowserWindow.fromWebContents(event.sender);
  const printWin=new BrowserWindow({
    width:420,height:700,show:!silent,parent,title:"Receipt",
    webPreferences:{contextIsolation:true,nodeIntegration:false}
  });

  try{
    await printWin.loadURL("data:text/html;charset=utf-8,"+encodeURIComponent(html));
    await new Promise(resolve=>setTimeout(resolve,300));
    const result=await new Promise(resolve=>{
      printWin.webContents.print({
        silent,
        deviceName:deviceName||undefined,
        printBackground:true,
        margins:{marginType:"none"}
      },(success,failureReason)=>resolve({success,failureReason}));
    });
    setTimeout(()=>{if(!printWin.isDestroyed())printWin.close()},500);
    return result;
  }catch(error){
    if(!printWin.isDestroyed())printWin.close();
    return {success:false,error:error.message};
  }
});

app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate",()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
