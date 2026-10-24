/** Aviso breve abajo (sin React: lo usan la ficha SSR, el shell y el calendario). */
export function toast(message: string) {
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 4000);
}
