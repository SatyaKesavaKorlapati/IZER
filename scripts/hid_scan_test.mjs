async function evalScript(script) {
  const res = await fetch("http://127.0.0.1:1422/eval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script }),
  });
  return res.json();
}

const out = await evalScript(`(async () => {
  const listPromise = new Promise((resolve) => {
    const t = setTimeout(() => resolve({ timeout: true, list: [] }), 8000);
    window.addEventListener(
      "izer-hid-device-list",
      (e) => {
        clearTimeout(t);
        resolve({ timeout: false, list: e.detail });
      },
      { once: true },
    );
  });
  if (window.electronAPI?.beginHidScan) await window.electronAPI.beginHidScan();
  const req = navigator.hid.requestDevice({ filters: [] });
  const list = await listPromise;
  await window.electronAPI?.cancelHidPick?.();
  await req.catch(() => []);
  return list;
})()`);

console.log(JSON.stringify(out, null, 2));
