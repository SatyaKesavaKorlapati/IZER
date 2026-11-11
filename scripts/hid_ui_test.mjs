async function evalScript(script) {
  const res = await fetch("http://127.0.0.1:1422/eval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script }),
  });
  return res.json();
}

async function modalState() {
  return evalScript(`(async () => {
    const rows = [...document.querySelectorAll(".themed-hid-device-row")];
    const labels = [...document.querySelectorAll(".themed-hid-section-label")].map((n) => n.textContent?.trim());
    const unpair = document.querySelector(".themed-hid-btn-unpair-foot");
    return {
      rows: rows.length,
      labels,
      unpairVisible: Boolean(unpair),
      unpairDisabled: unpair?.disabled ?? null,
      names: rows.map((r) => r.querySelector(".themed-hid-device-name")?.textContent?.trim()),
      selected: document.querySelector(".themed-hid-device-row.selected .themed-hid-device-name")?.textContent?.trim(),
      unpairedFlag: localStorage.getItem("ja11-hid-unpaired"),
      status: document.querySelector(".sr-only")?.textContent?.trim(),
    };
  })()`);
}

await evalScript(`(async () => {
  localStorage.removeItem("ja11-hid-unpaired");
  if (window.electronAPI?.allowJa11Hid) await window.electronAPI.allowJa11Hid();
})()`);

await evalScript(
  `(() => { const b = [...document.querySelectorAll("button.pill-link")].find((x) => /Device/i.test(x.textContent || "")); b?.click(); return true; })()`,
);
await evalScript(
  `(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").trim() === "Other device"); b?.click(); return true; })()`,
);
await new Promise((r) => setTimeout(r, 1500));
console.log("open", JSON.stringify(await modalState()));

await evalScript(`(() => { document.querySelector(".themed-hid-device-row")?.click(); return true; })()`);
await new Promise((r) => setTimeout(r, 200));
console.log("selected", JSON.stringify(await modalState()));

await evalScript(`(() => { const b = document.querySelector(".themed-hid-btn-unpair-foot"); if (b && !b.disabled) { b.click(); return "clicked"; } return { disabled: b?.disabled, missing: !b }; })()`);
await new Promise((r) => setTimeout(r, 3500));
console.log("after unpair", JSON.stringify(await modalState()));
