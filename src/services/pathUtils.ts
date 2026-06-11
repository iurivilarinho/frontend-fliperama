// Lógica pura de manipulação de caminhos usada pela ponte de path remota
// (sem Tauri). Separada para ser testável em node. `sep` é o separador do host
// (vem de /api/fs/dirs); aceitamos barra normal e invertida na entrada.

// Junta segmentos com o separador do host, colapsando barras duplicadas/mistas.
// Não toca em ":" — preserva prefixos de drive do Windows ("D:").
export function jsJoin(sep: string, parts: string[]): string {
  const joined = parts.filter((p) => p != null && p !== "").join(sep);
  return joined.replace(/[\\/]+/g, sep);
}

// Último segmento não-vazio (nome do arquivo/pasta).
export function jsBasename(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

// Tudo antes do último segmento, com o separador do host.
export function jsDirname(sep: string, path: string): string {
  const parts = path.split(/[\\/]+/);
  parts.pop();
  return parts.join(sep);
}
