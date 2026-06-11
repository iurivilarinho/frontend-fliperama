// Detecção de runtime e base da API HTTP embarcada (Rust, porta 8787).
//
// No APP (Tauri) usamos os plugins nativos (sql/fs/path). Num NAVEGADOR REMOTO
// (outra máquina na mesma rede acessando o painel admin pela web) não há runtime
// Tauri — então as operações de banco, filesystem e path são roteadas para o
// servidor HTTP embarcado no host. Este módulo é o ponto único dessa decisão.

const REMOTE_API_PORT = 8787;

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function apiBase(): string {
  const host =
    typeof window !== "undefined" ? window.location.hostname : "localhost";
  return `http://${host}:${REMOTE_API_PORT}`;
}
