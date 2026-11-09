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


function aiConfigPath(){return path.join(app.getPath("userData"),"ai-provider-config.enc")}
function readAIConfig(){
  try{
    if(!safeStorage.isEncryptionAvailable())return null;
    if(fs.existsSync(aiConfigPath())){
      const encrypted=fs.readFileSync(aiConfigPath());
      const config=JSON.parse(safeStorage.decryptString(encrypted));
      return config&&typeof config==="object"?config:null;
    }
    // Migrate the previous OpenAI-only encrypted key without exposing it.
    const legacyPath=path.join(app.getPath("userData"),"openai-api-key.enc");
    if(fs.existsSync(legacyPath)){
      const legacyKey=safeStorage.decryptString(fs.readFileSync(legacyPath));
      return {provider:"openai",apiKey:legacyKey,model:"gpt-4.1-mini",baseUrl:""};
    }
    return null;
  }catch{return null}
}
ipcMain.handle("ai-key-status",async()=>{
  const config=readAIConfig();
  return {configured:Boolean(config?.apiKey),provider:config?.provider||"openai",model:config?.model||"",baseUrl:config?.baseUrl||"",secureStorageAvailable:safeStorage.isEncryptionAvailable()};
});
ipcMain.handle("ai-save-config",async(_event,input)=>{
  if(!safeStorage.isEncryptionAvailable())return {success:false,error:"Windows secure storage is unavailable. The API key was not saved."};
  if(!input||typeof input!=="object")return {success:false,error:"Enter provider settings."};
  const provider=String(input.provider||"openai");
  const previous=readAIConfig();
  const apiKey=String(input.apiKey||"").trim()||String(previous?.apiKey||"");
  const model=String(input.model||"").trim();
  const baseUrl=String(input.baseUrl||"").trim();
  const allowed=["openai","gemini","openrouter","groq","together","custom"];
  if(!allowed.includes(provider))return {success:false,error:"Choose a supported provider."};
  if(!apiKey||apiKey.length>500)return {success:false,error:"Enter a valid API key."};
  if(!model||model.length>200)return {success:false,error:"Enter a model name."};
  if(provider==="custom"){
    try{const u=new URL(baseUrl);if(u.protocol!=="https:"||u.username||u.password)return {success:false,error:"Custom API endpoint must be a valid HTTPS URL without embedded credentials."};}
    catch{return {success:false,error:"Enter a valid HTTPS API endpoint for your custom provider."};}
  }
  const config={provider,apiKey,model,baseUrl};
  try{fs.writeFileSync(aiConfigPath(),safeStorage.encryptString(JSON.stringify(config)),{mode:0o600});return {success:true};}
  catch(error){return {success:false,error:"Could not securely save provider settings: "+error.message};}
});
ipcMain.handle("ai-analyze-product-image",async(_event,args)=>{
  const config=readAIConfig();
  if(!config?.apiKey)return {success:false,error:"Choose an AI provider and save its API key first."};
  const data=args?.dataUrl,mime=args?.mime;
  if(!["image/jpeg","image/png","image/webp"].includes(mime)||typeof data!=="string"||!data.startsWith("data:"+mime+";base64,"))return {success:false,error:"Choose a JPG, PNG, or WEBP image."};
  const base64=data.slice(data.indexOf(",")+1);
  if(base64.length>11000000)return {success:false,error:"Image is too large. Choose an image under about 8 MB."};
  const instructions="Extract product rows from the provided handwritten inventory list, product price list, or supplier receipt. Return only a JSON object with key products, an array of objects with fields name (string), price (number or null), cost (number or null), unit (one of kg, g, unit, L, or other). price means selling price only when clearly labelled as retail/sale price. cost means purchase/wholesale cost only when clearly labelled. Do not guess unclear values; use null. Do not treat receipt quantities as current stock. Ignore totals, taxes, payment details, customer information, and non-product rows. Deduplicate repeated rows where safe. Never invent a product name or number.";
  const userText="Read this image carefully. Handwriting may be unclear. Extract every clearly identifiable product and its clearly labelled prices. If a number or name is uncertain, leave that field blank/null rather than guessing.";
  try{
    let response,payload;
    if(config.provider==="gemini"){
      const url="https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(config.model)+":generateContent?key="+encodeURIComponent(config.apiKey);
      response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        systemInstruction:{parts:[{text:instructions}]},
        contents:[{role:"user",parts:[{text:userText},{inline_data:{mime_type:mime,data:base64}}]}],
        generationConfig:{responseMimeType:"application/json",temperature:0.1}
      })});
      payload=await response.json().catch(()=>({}));
      if(!response.ok)return {success:false,error:payload?.error?.message||("Gemini API request failed ("+response.status+"). Check the key, model access, and billing/quotas.")};
      const content=payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";
      const parsed=JSON.parse(content);
      if(!Array.isArray(parsed.products))return {success:false,error:"The AI response did not contain a product list. Try a clearer photo."};
      return normalizeAIProducts(parsed.products);
    }
    let base;
    if(config.provider==="openai")base="https://api.openai.com/v1";
    else if(config.provider==="openrouter")base="https://openrouter.ai/api/v1";
    else if(config.provider==="groq")base="https://api.groq.com/openai/v1";
    else if(config.provider==="together")base="https://api.together.xyz/v1";
    else base=config.baseUrl.replace(/\/+$/,"").replace(/\/chat\/completions$/,"");
    const endpoint=base.replace(/\/+$/,"")+"/chat/completions";
    response=await fetch(endpoint,{method:"POST",headers:{"Authorization":"Bearer "+config.apiKey,"Content-Type":"application/json"},body:JSON.stringify({
      model:config.model,
      response_format:{type:"json_object"},
      messages:[
        {role:"system",content:instructions},
        {role:"user",content:[{type:"text",text:userText},{type:"image_url",image_url:{url:data,detail:"high"}}]}
      ],
      max_tokens:5000,temperature:0.1
    })});
    payload=await response.json().catch(()=>({}));
    if(!response.ok)return {success:false,error:payload?.error?.message||("AI provider request failed ("+response.status+"). Check provider, model, key, image support, and billing/quotas.")};
    const content=payload?.choices?.[0]?.message?.content||"";
    const parsed=JSON.parse(typeof content==="string"?content:JSON.stringify(content));
    if(!Array.isArray(parsed.products))return {success:false,error:"The AI response did not contain a product list. Try a clearer photo."};
    return normalizeAIProducts(parsed.products);
  }catch(error){return {success:false,error:"Could not read the image. Check the provider endpoint, model's image support, internet connection, and API access. ("+error.message+")"}}
});
function normalizeAIProducts(rows){
  const products=rows.slice(0,300).map(x=>({
    name:typeof x.name==="string"?x.name.trim().slice(0,120):"",
    price:x.price!==null&&x.price!==""&&Number.isFinite(Number(x.price))?Math.max(0,Number(x.price)):null,
    cost:x.cost!==null&&x.cost!==""&&Number.isFinite(Number(x.cost))?Math.max(0,Number(x.cost)):null,
    unit:["kg","g","unit","L","other"].includes(x.unit)?x.unit:"unit"
  })).filter(x=>x.name);
  return {success:true,products};
}

app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate",()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
