/** Command palette: `/` or Ctrl/⌘+K. Fuzzy-filtered commands, keyboard + pointer. */
import { $ } from "../core/dom.js";
import { t, toggleLang } from "../core/i18n.js";
import { scrollToTarget } from "../core/motion.js";
import { toggleSound } from "../effects/sound.js";

const go = (id) => () => { const el = document.getElementById(id); if (el) scrollToTarget(el); };

// hint: literal shell-ish text, or an i18n key prefixed with "@"
const COMMANDS = [
  { name: "about", hint: "cd ~/about", run: go("about") },
  { name: "journey", hint: "git log --graph", run: go("journey") },
  { name: "stack", hint: "ls ./stack", run: go("skills") },
  { name: "projects", hint: "ls ./projects", run: go("projects") },
  { name: "contact", hint: "./grab_a_coffee.sh", run: go("contact") },
  { name: "github", hint: "@cmd.open", run: () => open("https://github.com/303N1TY", "_blank", "noopener") },
  { name: "wikiboosters", hint: "@cmd.open", run: () => open("https://wikiboosters.com", "_blank", "noopener") },
  { name: "lang", hint: "@cmd.lang", stay: true, run: () => { toggleLang(); return t("cmd.langdone"); } },
  { name: "sound", hint: "@cmd.sound", stay: true, run: () => t(toggleSound() ? "cmd.soundon" : "cmd.soundoff") },
  { name: "redpill", hint: "@cmd.theme", run: () => document.body.classList.toggle("red-pill") },
  { name: "top", hint: "cd ~", run: go("top") },
  { name: "whoami", hint: "@cmd.print", print: "cmd.whoami" },
  { name: "coffee", hint: "@cmd.brew", print: "cmd.coffee" },
  { name: "sudo", hint: "@cmd.try", print: "cmd.sudo" },
];
const hint = (c) => (c.hint.startsWith("@") ? t(c.hint.slice(1)) : c.hint);

/** Subsequence match: "pjt" matches "projects". */
function fuzzy(q, name) {
  let i = 0;
  for (const ch of name) if (ch === q[i]) i++;
  return i === q.length;
}

export function initCmd() {
  const dlg = $("#cmd"), input = $("#cmd-input"), list = $("#cmd-list");
  let items = [], sel = 0, output = "";

  const render = () => {
    const q = input.value.trim().toLowerCase();
    items = COMMANDS.filter((c) => fuzzy(q, c.name));
    if (q && !items.length) output = t("cmd.notfound") + q;
    sel = Math.min(sel, Math.max(0, items.length - 1));
    list.replaceChildren(
      ...(output ? [Object.assign(document.createElement("li"), { className: "cmd__out", textContent: output })] : []),
      ...items.map((c, i) => {
        const li = document.createElement("li");
        li.id = `cmd-${c.name}`;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", i === sel);
        li.innerHTML = `<span></span><small></small>`;
        li.firstChild.textContent = c.name;
        li.lastChild.textContent = hint(c);
        li.addEventListener("pointermove", () => { if (sel !== i) { sel = i; render(); } });
        li.addEventListener("click", () => exec(c));
        return li;
      }),
    );
    input.setAttribute("aria-activedescendant", items[sel] ? `cmd-${items[sel].name}` : "");
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  };

  const exec = (c) => {
    if (!c) return;
    if (c.print || c.stay) {
      output = c.print ? t(c.print) : c.run();
      input.value = "";
      return render();
    }
    dlg.close();
    c.run();
  };

  const show = () => {
    if (dlg.open) return;
    output = ""; input.value = ""; sel = 0;
    render();
    dlg.showModal();
    input.focus();
  };

  $("#cmd-open").addEventListener("click", show);
  addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
    if ((e.key === "/" && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      show();
    }
  });
  input.addEventListener("input", () => { output = ""; sel = 0; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % (items.length || 1); render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + items.length) % (items.length || 1); render(); }
    else if (e.key === "Enter") { e.preventDefault(); exec(items[sel]); }
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
}
