const {app,BrowserWindow,Menu,ipcMain,shell}=require("electron");const path=require("path");

function createWindow(){
  const w=new BrowserWindow({
    width:1440,height:900,minWidth:1050,minHeight:700,backgroundColor:"#f5f7fb",
    webPreferences:{contextIsolation:true,nodeIntegration:false,preload:path.join(__dirname,"preload.js")}
  });
  w.loadFile(path.join(__dirname,"index.html"));
}

ipcMain.handle("open-whatsapp",async(_event,url)=>{
  try{
    if(typeof url!=="string")return {success:false,error:"Invalid WhatsApp link."};
    const parsed=new URL(url);
    if(parsed.protocol!=="https:"||parsed.hostname!=="wa.me"||!/^\/\d{10,15}$/.test(parsed.pathname)||!parsed.searchParams.has("text"))return {success:false,error:"Invalid WhatsApp link."};
    await shell.openExternal(url);
    return {success:true};
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
