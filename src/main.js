const {app,BrowserWindow,Menu}=require("electron");const path=require("path");
function createWindow(){const w=new BrowserWindow({width:1440,height:900,minWidth:1050,minHeight:700,backgroundColor:"#f5f7fb",webPreferences:{contextIsolation:true,nodeIntegration:false}});w.loadFile(path.join(__dirname,"index.html"))}
app.whenReady().then(()=>{Menu.setApplicationMenu(null);createWindow();app.on("activate",()=>{if(!BrowserWindow.getAllWindows().length)createWindow()})});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit()});