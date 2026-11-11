const script = `(async () => {
  const granted = await navigator.hid.getDevices();
  const listed = granted.map((d) => ({
    vendorId: d.vendorId,
    productId: d.productId,
    name: d.productName,
    forget: typeof d.forget === "function",
  }));
  window.__izerTest?.openPicker?.();
  return { granted: listed, unpaired: localStorage.getItem("ja11-hid-unpaired") };
})()`;

const res = await fetch("http://127.0.0.1:1422/eval", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ script }),
});
const text = await res.text();
console.log(text);
