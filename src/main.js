const {app,BrowserWindow,Menu,ipcMain,shell,dialog,safeStorage}=require("electron");const path=require("path");const fs=require("fs");

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


function aiKeyPath(){return path.join(app.getPath("userData"),"openai-api-key.enc")}
function readAIKey(){
  try{
    if(!safeStorage.isEncryptionAvailable())return "";
    const encrypted=fs.readFileSync(aiKeyPath());
    return safeStorage.decryptString(encrypted);
  }catch{return ""}
}
ipcMain.handle("ai-key-status",async()=>({configured:Boolean(readAIKey()),secureStorageAvailable:safeStorage.isEncryptionAvailable()}));
ipcMain.handle("ai-save-key",async(_event,key)=>{
  if(!safeStorage.isEncryptionAvailable())return {success:false,error:"Windows secure storage is unavailable. The API key was not saved."};
  if(typeof key!=="string"||!key.trim()||key.trim().length>300)return {success:false,error:"Enter a valid API key."};
  try{fs.writeFileSync(aiKeyPath(),safeStorage.encryptString(key.trim()),{mode:0o600});return {success:true}}
  catch(error){return {success:false,error:"Could not securely save the API key: "+error.message}}
});
ipcMain.handle("ai-analyze-product-image",async(_event,args)=>{
  const apiKey=readAIKey();
  if(!apiKey)return {success:false,error:"Add and save your OpenAI API key first."};
  const data=args?.dataUrl,mime=args?.mime;
  if(!["image/jpeg","image/png","image/webp"].includes(mime)||typeof data!=="string"||!data.startsWith("data:"+mime+";base64,"))return {success:false,error:"Choose a JPG, PNG, or WEBP image."};
  const base64=data.slice(data.indexOf(",")+1);
  if(base64.length>11000000)return {success:false,error:"Image is too large. Choose an image under about 8 MB."};
  try{
    const response=await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"gpt-4.1-mini",
        response_format:{type:"json_object"},
        messages:[
          {role:"system",content:"Extract product rows from the provided handwritten inventory list, product price list, or supplier receipt. Return only a JSON object with key products, an array of objects with fields name (string), price (number or null), cost (number or null), unit (one of kg, g, unit, L, or other). price means selling price only when clearly labelled as retail/sale price. cost means purchase/wholesale cost only when clearly labelled. Do not guess unclear values; use null. Do not treat receipt quantities as current stock. Ignore totals, taxes, payment details, customer information, and non-product rows. Deduplicate repeated rows where safe. Never invent a product name or number."},
          {role:"user",content:[
            {type:"text",text:"Read this image carefully. Handwriting may be unclear. Extract every clearly identifiable product and its clearly labelled prices. If a number or name is uncertain, leave that field blank/null rather than guessing."},
            {type:"image_url",image_url:{url:data,detail:"high"}}
          ]}
        ],
        max_tokens:5000
      })
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      const message=payload?.error?.message||("OpenAI API request failed ("+response.status+").");
      return {success:false,error:response.status===401?"The API key was rejected. Check the key and try again.":response.status===429?"API rate limit or billing limit reached. Check your API account billing/limits.":message};
    }
    const content=payload?.choices?.[0]?.message?.content||"";
    const parsed=JSON.parse(content);
    if(!Array.isArray(parsed.products))return {success:false,error:"The AI response did not contain a product list. Try a clearer photo."};
    const products=parsed.products.slice(0,300).map(x=>({
      name:typeof x.name==="string"?x.name.trim().slice(0,120):"",
      price:Number.isFinite(Number(x.price))&&x.price!==null?Math.max(0,Number(x.price)):null,
      cost:Number.isFinite(Number(x.cost))&&x.cost!==null?Math.max(0,Number(x.cost)):null,
      unit:["kg","g","unit","L","other"].includes(x.unit)?x.unit:"unit"
    })).filter(x=>x.name);
    return {success:true,products};
  }catch(error){return {success:false,error:"Could not read the image. Check your internet connection and API access, then try again. ("+error.message+")"}}
});

app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate",()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
