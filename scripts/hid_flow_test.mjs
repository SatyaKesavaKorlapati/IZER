async function evalScript(script) {
  const res = await fetch("http://127.0.0.1:1422/eval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script }),
  });
  return res.json();
}

async function state() {
  return evalScript(`(() => {
    const rows = [...document.querySelectorAll(".themed-hid-device-row")];
    return {
      labels: [...document.querySelectorAll(".themed-hid-section-label")].map((n) => n.textContent?.trim()),
      names: rows.map((r) => r.querySelector(".themed-hid-device-name")?.textContent?.trim()),
      flag: localStorage.getItem("ja11-hid-unpaired"),
    };
  })()`);
}

await evalScript(`(async () => {
  localStorage.removeItem("ja11-hid-unpaired");
  if (window.electronAPI?.allowJa11Hid) await window.electronAPI.allowJa11Hid();
})()`);

await evalScript(`(() => { [...document.querySelectorAll("button.pill-link")].find((x) => /Device/i.test(x.textContent || ""))?.click(); return true; })()`);
await evalScript(`(() => { [...document.querySelectorAll("button")].find((x) => (x.textContent || "").trim() === "Other device")?.click(); return true; })()`);
await new Promise((r) => setTimeout(r, 1500));
console.log("paired open", JSON.stringify(await state()));

await evalScript(`(() => { document.querySelector(".themed-hid-device-row")?.click(); document.querySelector(".themed-hid-btn-unpair-foot")?.click(); return true; })()`);
await new Promise((r) => setTimeout(r, 2500));
console.log("after unpair", JSON.stringify(await state()));

await evalScript(`(() => { document.querySelector(".themed-hid-btn-pair-new")?.click(); return true; })()`);
await new Promise((r) => setTimeout(r, 2000));
console.log("after refresh", JSON.stringify(await state()));
