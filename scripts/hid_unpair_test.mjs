async function evalScript(script) {
  const res = await fetch("http://127.0.0.1:1422/eval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script }),
  });
  return res.json();
}

const before = await evalScript(`(async()=>navigator.hid.getDevices().then(d=>d.filter(x=>x.vendorId===0x2972).map(x=>({p:x.productId,n:x.productName}))))()`);
console.log("before", JSON.stringify(before));

const unpair = await evalScript(`(async()=>{
  const devices = await navigator.hid.getDevices();
  let ok = false;
  for (const d of devices) {
    if (d.vendorId !== 0x2972) continue;
    if (typeof d.forget === "function") { await d.forget(); ok = true; }
  }
  localStorage.setItem("ja11-hid-unpaired","1");
  return { ok, left: (await navigator.hid.getDevices()).filter(d=>d.vendorId===0x2972).length };
})()`);
console.log("unpair", JSON.stringify(unpair));

const after = await evalScript(`(async()=>({granted:(await navigator.hid.getDevices()).filter(d=>d.vendorId===0x2972).length, flag:localStorage.getItem("ja11-hid-unpaired")}))()`);
console.log("after", JSON.stringify(after));
