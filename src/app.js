const KEY="store_pos_v1";const blank={settings:{shop:"My Store",currency:"₹",threshold:5},products:[],sales:[],expenses:[]};let db=load(),cart=[];const $=s=>document.querySelector(s);const $$=s=>document.querySelectorAll(s);function load(){try{const raw=JSON.parse(localStorage.getItem(KEY)||"{}");const settings={...blank.settings,...(raw.settings||{})};const products=Array.isArray(raw.products)?raw.products.map(p=>({...p,id:p.id||id(),name:String(p.name??""),price:Number(p.price)||0,cost:Number(p.cost)||0,stock:Number(p.stock)||0,unit:p.unit||"kg"})):[];const sales=Array.isArray(raw.sales)?raw.sales.map(x=>({...x,id:x.id||id(),date:x.date||today(),time:x.time||"",payment:x.payment||"Other",total:Number(x.total)||0,profit:Number(x.profit)||0,items:Array.isArray(x.items)?x.items:[]})):[];const expenses=Array.isArray(raw.expenses)?raw.expenses.map(x=>({...x,id:x.id||id(),date:x.date||today(),note:String(x.note??""),amount:Number(x.amount)||0})):[];return {settings,products,sales,expenses}}catch{return {...blank,settings:{...blank.settings},products:[],sales:[],expenses:[]}}}function save(){localStorage.setItem(KEY,JSON.stringify(db));renderAll()}function money(n){return (db.settings.currency||"₹")+Number(n||0).toFixed(2)}function id(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}function today(){return new Date().toISOString().slice(0,10)}function daysAgo(n){let d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10)}function go(page){$$(".page").forEach(x=>x.classList.toggle("active",x.id===page));$$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===page));$("#pageTitle").textContent={dashboard:"Dashboard",billing:"New Bill",products:"Products",sales:"Sales History",reports:"Reports",expenses:"Expenses",settings:"Settings"}[page];renderAll()}function renderAll(){renderDash();renderProducts();renderSelect();renderCart();renderSales();renderReports(30);renderExpenses();$("#shopName").textContent=db.settings.shop;$("#setShop").value=db.settings.shop;$("#setCurrency").value=db.settings.currency;$("#setThreshold").value=db.settings.threshold;if($("#setPrinter")&&db.settings.printer)$("#setPrinter").value=db.settings.printer}function renderDash(){const s=db.sales.filter(x=>x.date===today()),total=s.reduce((a,x)=>a+x.total,0),profit=s.reduce((a,x)=>a+x.profit,0);$("#dSales").textContent=money(total);$("#dProfit").textContent=money(profit);$("#dTx").textContent=s.length;$("#dLow").textContent=db.products.filter(p=>p.stock<=db.settings.threshold).length;$("#recentSales").innerHTML=s.slice(-6).reverse().map(x=>'<div class="row" style="grid-template-columns:1fr 100px 90px"><span>'+x.id+'<small>'+x.time+' · '+x.payment+'</small></span><b>'+money(x.total)+'</b><span>'+money(x.profit)+'</span></div>').join("")||'<div class="empty">No sales today</div>';$("#lowStock").innerHTML=db.products.filter(p=>p.stock<=db.settings.threshold).map(p=>'<div class="row" style="grid-template-columns:1fr 80px"><span>'+esc(p.name)+'</span><b>'+p.stock+' '+p.unit+'</b></div>').join("")||'<div class="empty">Stock looks good</div>'}function renderSelect(){let opts='<option value="">Select a product...</option>'+db.products.map(p=>'<option value="'+p.id+'">'+esc(p.name)+' — '+money(p.price)+'/'+p.unit+'</option>').join("");$("#productSelect").innerHTML=opts}function renderCart(){let sub=cart.reduce((a,x)=>a+x.line,0),disc=+$("#discount").value||0,total=Math.max(0,sub-disc);$("#cart").innerHTML=cart.map((x,i)=>'<div class="cartitem"><span><b>'+esc(x.name)+'</b><small>'+x.qty+' '+x.unit+' × '+money(x.price)+'</small></span><span>'+money(x.cost)+'</span><b>'+money(x.line)+'</b><button class="remove" data-i="'+i+'">×</button></div>').join("")||'<div class="empty">Add products to start a bill</div>';$("#subtotal").textContent=money(sub);$("#total").textContent=money(total);let cash=+$("#cash").value||0;$("#change").textContent=money(Math.max(0,cash-total))}function renderProducts(){let q=($("#productSearch")?.value||"").toLowerCase();let a=db.products.filter(p=>String(p.name||"").toLowerCase().includes(q));$("#productsTable").innerHTML='<table class="table"><thead><tr><th>Product</th><th>Sale rate</th><th>Cost rate</th><th>Stock</th><th>Unit</th><th></th></tr></thead><tbody>'+a.map(p=>'<tr><td><b>'+esc(p.name)+'</b></td><td>'+money(p.price)+'</td><td>'+money(p.cost)+'</td><td>'+p.stock+'</td><td>'+p.unit+'</td><td><button class="ghost editp" data-id="'+p.id+'">Edit</button></td></tr>').join("")+'</tbody></table>'+(a.length?'':'<div class="empty">No products yet. Add your first product.</div>');$$(".editp").forEach(b=>b.onclick=()=>productModal(b.dataset.id))}function renderSales(){let q=($("#salesSearch")?.value||"").toLowerCase(),a=db.sales.filter(x=>(x.id+" "+x.payment+" "+x.date).toLowerCase().includes(q)).slice().reverse();$("#salesTable").innerHTML='<table class="table"><thead><tr><th>Bill</th><th>Date</th><th>Items</th><th>Payment</th><th>Total</th><th>Profit</th><th></th></tr></thead><tbody>'+a.map(x=>'<tr><td>'+esc(x.id)+'</td><td>'+esc(x.date+' '+x.time)+'</td><td>'+((Array.isArray(x.items)?x.items:[]).length)+'</td><td><span class="pill">'+esc(x.payment)+'</span></td><td><b>'+money(x.total)+'</b></td><td>'+money(x.profit)+'</td><td><button type="button" class="ghost" onclick="window.reprintSale(\''+esc(x.id)+'\')">Print</button></td></tr>').join("")+'</tbody></table>'+(a.length?'':'<div class="empty">No sales found.</div>')}function renderReports(n){let from=n==="today"?today():daysAgo(n-1),a=db.sales.filter(x=>x.date>=from),sales=a.reduce((s,x)=>s+x.total,0),profit=a.reduce((s,x)=>s+x.profit,0),exp=db.expenses.filter(x=>x.date>=from).reduce((s,x)=>s+x.amount,0);$("#rToday").textContent=money(db.sales.filter(x=>x.date===today()).reduce((s,x)=>s+x.total,0));let m=today().slice(0,7);$("#rMonth").textContent=money(db.sales.filter(x=>x.date.startsWith(m)).reduce((s,x)=>s+x.total,0));$("#rProfit").textContent=money(profit);$("#rExpenses").textContent=money(exp);$("#reportTable").innerHTML='<div class="cards" style="margin:0"><div class="card"><span>Sales</span><b>'+money(sales)+'</b></div><div class="card"><span>Gross Profit</span><b>'+money(profit)+'</b></div><div class="card"><span>Expenses</span><b>'+money(exp)+'</b></div><div class="card"><span>Est. Net</span><b>'+money(profit-exp)+'</b></div></div><p style="color:#667085;font-size:13px">Estimated gross profit is sales minus recorded product cost. Net estimate also subtracts recorded expenses.</p>'}function renderExpenses(){let a=db.expenses.slice().reverse();$("#expenseTable").innerHTML='<table class="table"><thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead><tbody>'+a.map(x=>'<tr><td>'+x.date+'</td><td>'+esc(x.note)+'</td><td><b>'+money(x.amount)+'</b></td></tr>').join("")+'</tbody></table>'+(a.length?'':'<div class="empty">No expenses recorded.</div>')}function productModal(pid){let p=db.products.find(x=>x.id===pid)||{name:"",price:"",cost:"",stock:"",unit:"kg"};modal('<h2>'+(pid?"Edit":"Add")+' Product</h2><label>Product name<input id="mName" value="'+esc(p.name)+'"></label><label>Sale rate per unit<input id="mPrice" type="number" step="0.01" value="'+p.price+'"></label><label>Cost rate per unit<input id="mCost" type="number" step="0.01" value="'+p.cost+'"></label><label>Stock<input id="mStock" type="number" step="0.001" value="'+p.stock+'"></label><label>Unit<select id="mUnit"><option '+(p.unit==="kg"?"selected":"")+'>kg</option><option '+(p.unit==="g"?"selected":"")+'>g</option><option '+(p.unit==="unit"?"selected":"")+'>unit</option><option '+(p.unit==="L"?"selected":"")+'>L</option></select></label><div class="modal-actions"><button class="ghost" id="cancel">Cancel</button><button class="primary" id="saveP">Save</button></div>');$("#saveP").onclick=()=>{let obj={id:pid||id(),name:$("#mName").value.trim(),price:+$("#mPrice").value||0,cost:+$("#mCost").value||0,stock:+$("#mStock").value||0,unit:$("#mUnit").value};if(!obj.name)return alert("Enter a product name.");let i=db.products.findIndex(x=>x.id===obj.id);if(i>=0)db.products[i]=obj;else db.products.push(obj);closeModal();save()};$("#cancel").onclick=closeModal}function expenseModal(){modal('<h2>Add Expense</h2><label>Description<input id="eNote" placeholder="Electricity, transport, rent..."></label><label>Amount<input id="eAmount" type="number" min="0" step="0.01"></label><div class="modal-actions"><button class="ghost" id="cancel">Cancel</button><button class="primary" id="saveE">Save</button></div>');$("#saveE").onclick=()=>{let note=$("#eNote").value.trim(),amount=+$("#eAmount").value||0;if(!note||amount<=0)return alert("Enter a description and amount.");db.expenses.push({id:id(),date:today(),note,amount});closeModal();save()};$("#cancel").onclick=closeModal}function modal(html){$("#modalContent").innerHTML=html;$("#modal").classList.add("show")}function closeModal(){$("#modal").classList.remove("show")}function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function loadPrinters(){
  const sel=$("#setPrinter"),status=$("#printerStatus");
  if(!sel||!window.posPrinter?.getPrinters)return;
  const old=db.settings.printer||sel.value||"";
  const printers=await window.posPrinter.getPrinters();
  sel.innerHTML='<option value="">Not selected</option>'+printers.map(p=>'<option value="'+esc(p.name)+'">'+esc(p.name)+(p.isDefault?" (Default)":"")+'</option>').join("");
  if(printers.some(p=>p.name===old))sel.value=old;
  if(status)status.textContent=printers.length?printers.length+" printer(s) detected by Windows.":"No printers detected by Windows.";
}
function selectedPrinter(){return $("#setPrinter")?.value||db.settings.printer||""}
function receiptHTML(sale){
  const shop=esc(db.settings.shop||"My Store"),cur=esc(db.settings.currency||"₹");
  const items=sale.items.map(x=>'<tr><td>'+esc(x.name)+'<small>'+Number(x.qty).toFixed(3)+' '+esc(x.unit)+' × '+cur+Number(x.price).toFixed(2)+'</small></td><td>'+cur+Number(x.line).toFixed(2)+'</td></tr>').join("");
  return '<!doctype html><html><head><meta charset="UTF-8"><style>@page{size:80mm auto;margin:0}*{box-sizing:border-box}body{width:80mm;margin:0;padding:5mm;font-family:Arial,sans-serif;color:#000;font-size:12px}h1{text-align:center;font-size:18px;margin:0 0 4px}.center{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse}td{padding:4px 0;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}small{display:block;font-size:10px}.total{font-size:16px;font-weight:bold}footer{text-align:center;margin-top:12px;font-size:10px}</style></head><body><h1>'+shop+'</h1><div class="center">Bill '+esc(sale.id)+'<br>'+esc(sale.date)+' '+esc(sale.time)+'</div><div class="line"></div><table>'+items+'</table><div class="line"></div><table><tr><td>Payment</td><td>'+esc(sale.payment)+'</td></tr><tr class="total"><td>Total</td><td>'+cur+Number(sale.total).toFixed(2)+'</td></tr></table><footer>Thank you!</footer></body></html>';
}
function receiptPdfHTML(sale){
  const shop=esc(db.settings.shop||"My Store"),cur=esc(db.settings.currency||"₹");
  const items=sale.items.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+Number(x.qty).toFixed(3)+' '+esc(x.unit)+'</td><td>'+cur+Number(x.price).toFixed(2)+'</td><td>'+cur+Number(x.line).toFixed(2)+'</td></tr>').join("");
  return '<!doctype html><html><head><meta charset="UTF-8"><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#182230;font-size:12px;line-height:1.45}h1{font-size:26px;margin:0 0 5px;color:#101828}.muted{color:#667085}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #344054;padding-bottom:16px;margin-bottom:18px}.bill{font-size:22px;font-weight:700;text-align:right}table{width:100%;border-collapse:collapse;margin-top:18px}th{background:#f2f4f7;text-align:left;color:#344054}th,td{padding:10px 8px;border-bottom:1px solid #eaecf0}th:nth-child(n+2),td:nth-child(n+2){text-align:right}.totals{width:280px;margin-left:auto;margin-top:18px}.totals td{border:0;padding:5px 8px}.grand{font-size:18px;font-weight:bold;border-top:2px solid #344054!important}.footer{text-align:center;margin-top:45px;padding-top:15px;border-top:1px solid #eaecf0;color:#667085}</style></head><body><div class="top"><div><h1>'+shop+'</h1><div class="muted">Sales receipt</div></div><div class="bill">RECEIPT<br><span class="muted" style="font-size:12px;font-weight:normal">Bill '+esc(sale.id)+'</span></div></div><p><b>Date:</b> '+esc(sale.date)+' &nbsp;&nbsp; <b>Time:</b> '+esc(sale.time)+'<br><b>Payment method:</b> '+esc(sale.payment)+'</p><table><thead><tr><th>Item</th><th>Qty / Weight</th><th>Rate</th><th>Amount</th></tr></thead><tbody>'+items+'</tbody></table><table class="totals"><tr><td>Subtotal</td><td>'+cur+Number(sale.items.reduce((a,x)=>a+Number(x.line||0),0)).toFixed(2)+'</td></tr><tr class="grand"><td>Total</td><td>'+cur+Number(sale.total).toFixed(2)+'</td></tr></table><div class="footer">Thank you for shopping with us!</div></body></html>';
}
async function printReceipt(sale){
  if(!window.posPrinter?.printReceipt)return alert("Printing is not available in this build.");
  const printer=selectedPrinter();
  if(!printer){
    alert("No receipt printer is selected. Go to Settings → Receipt Printer, select your printer, and Save Settings.");
    go("settings");return;
  }
  const result=await window.posPrinter.printReceipt({html:receiptHTML(sale),deviceName:printer,silent:true});
  if(!result?.success)alert(result?.error||("Printing failed: "+(result?.failureReason||"Unknown error")));
}
async function testPrinter(){
  const printer=selectedPrinter();
  if(!printer)return alert("Select a receipt printer first.");
  const testSale={id:"TEST",date:new Date().toISOString().slice(0,10),time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),payment:"TEST",total:0,items:[{name:"Printer Test",qty:1,unit:"unit",price:0,line:0}]};
  const result=await window.posPrinter.printReceipt({html:receiptHTML(testSale),deviceName:printer,silent:true});
  if(result?.success)alert("Test receipt sent successfully to "+printer+".");
  else alert(result?.error||("Test print failed: "+(result?.failureReason||"Unknown error")));
}
window.reprintSale=async function(saleId){const sale=db.sales.find(x=>x.id===saleId);if(!sale)return alert("This bill could not be found.");await printReceipt(sale)}
function safe(fn){try{fn()}catch(e){console.error("Store POS UI error:",e);alert("The app encountered a UI error. Please restart the app.\n\n"+(e?.message||e));}}
function bindEvents(){
  safe(()=>{$$(".nav").forEach(b=>b.onclick=()=>safe(()=>go(b.dataset.page)));});
  safe(()=>{$$("[data-go]").forEach(b=>b.onclick=()=>safe(()=>go(b.dataset.go)));});
  safe(()=>{$("#quickBill").onclick=()=>safe(()=>go("billing"));});
  safe(()=>{$("#newProduct").onclick=()=>safe(()=>productModal());});
  safe(()=>{$("#newExpense").onclick=()=>safe(()=>expenseModal());});
  safe(()=>{$("#closeModal").onclick=()=>safe(closeModal);});
  safe(()=>{$("#productSearch").oninput=renderProducts;});
  safe(()=>{$("#salesSearch").oninput=renderSales;});
  safe(()=>{$("#discount").oninput=renderCart;});
  safe(()=>{$("#cash").oninput=renderCart;});
  safe(()=>{$("#addItem").onclick=()=>safe(()=>{let p=db.products.find(x=>x.id===$("#productSelect").value),q=+$("#qty").value||0;if(!p||q<=0)return alert("Select a product and enter a quantity.");let factor=$("#unit").value==="g"&&p.unit==="kg"?0.001:1;let qty=q*factor;cart.push({productId:p.id,name:p.name,qty,unit:p.unit,price:p.price,cost:p.cost,stock:p.stock,line:qty*p.price,costTotal:qty*p.cost});renderCart()});});
  safe(()=>{$("#cart").onclick=e=>{if(e.target.classList.contains("remove")){cart.splice(+e.target.dataset.i,1);renderCart()}};});
  safe(()=>{$("#clearCart").onclick=()=>{cart=[];renderCart()};});
  async function completeSale(sendWhatsApp){
    if(!cart.length)return alert("Add at least one item.");
    let sub=cart.reduce((a,x)=>a+x.line,0),disc=+$("#discount").value||0,total=Math.max(0,sub-disc),cash=+$("#cash").value||0;
    if($("#payment").value==="Cash"&&cash<total)return alert("Cash received is less than the total.");
    let phone=($("#customerWhatsApp")?.value||"").replace(/\D/g,"");
    if(sendWhatsApp&&!phone)return alert("Enter the customer's WhatsApp number, including country code.");
    if(sendWhatsApp&&(phone.length<10||phone.length>15))return alert("Enter a valid WhatsApp number with country code, digits only.");
    let sale={id:"B-"+Date.now().toString().slice(-6),date:today(),time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),payment:$("#payment").value,total,profit:total-cart.reduce((a,x)=>a+x.costTotal,0),customerWhatsApp:phone||"",items:cart.map(x=>({...x}))};
    db.sales.push(sale);
    cart.forEach(x=>{let p=db.products.find(p=>p.id===x.productId);if(p)p.stock=Math.max(0,p.stock-x.qty)});
    cart=[];$("#discount").value=0;$("#cash").value=0;save();
    if(sendWhatsApp){
      if(!window.posPrinter?.saveReceiptPdf)return alert("PDF receipt sharing is unavailable in this build. The sale has been saved.");
      let pdfResult;
      try{pdfResult=await window.posPrinter.saveReceiptPdf({html:receiptPdfHTML(sale),filename:"Receipt-"+sale.id+".pdf"});}
      catch(error){alert("The sale was saved, but the PDF could not be created: "+(error?.message||error));return;}
      if(!pdfResult?.success){
        if(!pdfResult?.cancelled)alert(pdfResult?.error||"The sale was saved, but the PDF could not be created.");
        return;
      }
      const message="Hello, please find attached the PDF receipt for bill "+sale.id+".";
      const encodedText=encodeURIComponent(message);
      const desktopUrl="whatsapp://send?phone="+phone+"&text="+encodedText;
      const webUrl="https://wa.me/"+phone+"?text="+encodedText;
      if(window.posPrinter?.openWhatsApp)window.posPrinter.openWhatsApp({desktopUrl,webUrl}).then(r=>{
        if(!r?.success)alert(r?.error||"Could not open WhatsApp. Your PDF is saved at: "+pdfResult.path);
        else alert("PDF receipt saved and WhatsApp opened. In WhatsApp, attach the PDF from the folder that opened, then tap Send.\n\nFile: "+pdfResult.path);
      }).catch(()=>alert("PDF saved at "+pdfResult.path+". Please open WhatsApp and attach the PDF manually."));
      else alert("PDF saved at "+pdfResult.path+". WhatsApp sharing is unavailable in this build.");
    }else{
      const shouldPrint=confirm("Sale completed: "+sale.id+" · "+money(total)+"\n\nPrint receipt now?");
      if(shouldPrint)printReceipt(sale);
    }
  }
  safe(()=>{$("#completeSale").onclick=()=>safe(()=>completeSale(false));});
  safe(()=>{$("#completeSaleWhatsApp").onclick=()=>safe(()=>{completeSale(true).catch(e=>alert("Could not prepare the PDF receipt: "+(e?.message||e)));});});
  safe(()=>{$$(".range").forEach(b=>b.onclick=()=>safe(()=>renderReports(b.dataset.range==="today"?"today":+b.dataset.range)));});
  safe(()=>{$("#saveSettings").onclick=()=>safe(()=>{db.settings.shop=$("#setShop").value.trim()||"My Store";db.settings.currency=$("#setCurrency").value||"₹";db.settings.threshold=+$("#setThreshold").value||0;db.settings.printer=$("#setPrinter")?.value||"";save();alert("Settings saved.")});});
  safe(()=>{$("#refreshPrinters").onclick=()=>safe(()=>loadPrinters());});
  safe(()=>{$("#testPrinter").onclick=()=>safe(()=>testPrinter());});
  safe(()=>{$("#exportSales").onclick=()=>safe(()=>{let rows=[["Bill","Date","Time","Payment","Total","Profit"],...db.sales.map(x=>[x.id,x.date,x.time,x.payment,x.total,x.profit])];download(rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n"),"sales.csv","text/csv")});});
  safe(()=>{$("#backup").onclick=()=>safe(()=>download(JSON.stringify(db,null,2),"store-pos-backup.json","application/json"));});
  safe(()=>{$("#restore").onclick=()=>safe(()=>$("#restoreFile").click());});
  safe(()=>{$("#restoreFile").onchange=e=>{let file=e.target.files[0];if(!file)return;let r=new FileReader();r.onload=()=>{try{db=JSON.parse(r.result);db=load();save();alert("Backup restored.")}catch{alert("Invalid backup file.")}};r.readAsText(file)};});
  safe(()=>{$("#reset").onclick=()=>safe(()=>{if(confirm("Delete all products, sales and expenses?")){db={...blank,settings:{...blank.settings}};cart=[];save()}});});
}
function startup(){
  try{renderAll();}catch(e){console.error("Store POS startup error:",e);alert("Store POS could not finish starting.\n\n"+(e?.message||e));}
  bindEvents();
  setTimeout(()=>loadPrinters().catch(()=>{}),0);
}
startup();;function download(c,n,t){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([c],{type:t}));a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}renderAll();setTimeout(()=>loadPrinters().catch(()=>{}),0);