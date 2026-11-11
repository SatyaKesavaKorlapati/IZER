async function post(url, body) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

await post("http://127.0.0.1:1422/click", { x: 330, y: 390 });
await new Promise((r) => setTimeout(r, 500));
let state = await post("http://127.0.0.1:1422/eval", {
  script: `(() => ({
    modal: Boolean(document.querySelector(".themed-hid-modal-overlay")),
    rows: document.querySelectorAll(".themed-hid-device-row").length,
  }))()`,
});
console.log("after connect click", JSON.stringify(state));

await post("http://127.0.0.1:1422/click", { x: 330, y: 430 });
await new Promise((r) => setTimeout(r, 1500));
state = await post("http://127.0.0.1:1422/eval", {
  script: `(() => ({
    modal: Boolean(document.querySelector(".themed-hid-modal-overlay")),
    rows: document.querySelectorAll(".themed-hid-device-row").length,
    labels: [...document.querySelectorAll(".themed-hid-section-label")].map((n) => n.textContent),
    empty: document.querySelector(".themed-hid-empty")?.textContent,
  }))()`,
});
console.log("modal state", JSON.stringify(state));

await post("http://127.0.0.1:1422/click", { x: 420, y: 560 });
await new Promise((r) => setTimeout(r, 2500));
state = await post("http://127.0.0.1:1422/eval", {
  script: `(() => ({
    rows: document.querySelectorAll(".themed-hid-device-row").length,
    labels: [...document.querySelectorAll(".themed-hid-section-label")].map((n) => n.textContent),
    names: [...document.querySelectorAll(".themed-hid-device-name")].map((n) => n.textContent),
  }))()`,
});
console.log("after refresh", JSON.stringify(state));
