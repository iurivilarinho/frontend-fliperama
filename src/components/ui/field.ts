// Base visual compartilhada dos controles de formulário (Input/Select). Altura
// fixa (h-10) garante alinhamento idêntico entre input, select e botão, mesmo
// com tamanhos de texto ou bordas diferentes — antes a altura divergia.
export const fieldBase =
  "h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50";
