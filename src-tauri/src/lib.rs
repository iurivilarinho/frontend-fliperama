use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::State;
use tauri::{AppHandle, Emitter, Manager};
use tauri::webview::WebviewWindowBuilder;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use windows_sys::Win32::Foundation::HWND;
use windows_sys::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
use windows_sys::Win32::UI::WindowsAndMessaging::{
  GetForegroundWindow, GetWindowThreadProcessId, SetForegroundWindow,
};

struct FocusState(Mutex<HWND>);

/// Geração do timer de sessão. Cada agendamento incrementa o contador; a thread
/// agendada só age se sua geração ainda for a atual (não foi cancelada/superada).
struct SessionTimer(Arc<AtomicU64>);

use std::path::{Path, PathBuf};
use std::process::Command;

/// Encerra todos os emuladores conhecidos (à força).
fn kill_emulators() {
  #[cfg(target_os = "windows")]
  {
    let emulators = [
      "mame.exe",
      "Project64.exe",
      "nestopia.exe",
      "zsnesw.exe",
      "Fusion.exe",
      "retroarch.exe",
    ];
    for emulator in emulators {
      let _ = Command::new("taskkill")
        .arg("/IM")
        .arg(emulator)
        .arg("/F")
        .output();
    }
  }
}

/// Agenda o encerramento garantido da sessão: uma thread dorme `remaining_secs`
/// e então mata os emuladores e avisa o frontend (evento "session-expired"),
/// independente do app estar em foco. Cancela qualquer timer anterior.
#[tauri::command]
fn start_session_timer(app: AppHandle, state: State<'_, SessionTimer>, remaining_secs: u64) {
  let generation = state.0.fetch_add(1, Ordering::SeqCst) + 1;
  let counter = state.0.clone();

  std::thread::spawn(move || {
    std::thread::sleep(std::time::Duration::from_secs(remaining_secs));
    // Só age se ninguém reagendou ou cancelou nesse meio tempo.
    if counter.load(Ordering::SeqCst) == generation {
      kill_emulators();
      let _ = app.emit("session-expired", ());
    }
  });
}

/// Cancela o timer de sessão agendado (invalida qualquer thread pendente).
#[tauri::command]
fn cancel_session_timer(state: State<'_, SessionTimer>) {
  state.0.fetch_add(1, Ordering::SeqCst);
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
  app.exit(0);
}

#[tauri::command]
fn launch_mame(mame_path: String, rom_name: String, roms_dir: String) -> Result<(), String> {
    let mame_exists = Path::new(&mame_path).exists();
    let roms_exists = Path::new(&roms_dir).exists();

    if !mame_exists {
        return Err(format!("mame.exe não encontrado em: {}", mame_path));
    }

    if !roms_exists {
        return Err(format!("Pasta de ROMs não encontrada em: {}", roms_dir));
    }

    let mame_dir = Path::new(&mame_path)
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| format!("Não foi possível resolver pasta do mame.exe: {}", mame_path))?;

    let cfg_dir: PathBuf = mame_dir.join("cfg");
    let nvram_dir: PathBuf = mame_dir.join("nvram");

    std::fs::create_dir_all(&cfg_dir)
        .map_err(|e| format!("Falha ao criar diretório cfg '{}': {}", cfg_dir.display(), e))?;
    std::fs::create_dir_all(&nvram_dir).map_err(|e| {
        format!(
            "Falha ao criar diretório nvram '{}': {}",
            nvram_dir.display(),
            e
        )
    })?;

    Command::new(&mame_path)
        .current_dir(&mame_dir)
        .arg("-rompath")
        .arg(&roms_dir)
        .arg("-cfg_directory")
        .arg(&cfg_dir)
        .arg("-nvram_directory")
        .arg(&nvram_dir)
        .arg(&rom_name)
        .spawn()
        .map_err(|e| {
            format!(
                "Falha ao executar MAME. mame_path='{}', roms_dir='{}', rom_name='{}', cfg_dir='{}', nvram_dir='{}', erro='{}'",
                mame_path,
                roms_dir,
                rom_name,
                cfg_dir.display(),
                nvram_dir.display(),
                e
            )
        })?;

    Ok(())
}
#[tauri::command]
fn launch_generic(
    emulator_path: String,
    rom_path: String,
    args: Option<Vec<String>>,
) -> Result<(), String> {
    let emulator_exists = Path::new(&emulator_path).exists();
    let rom_exists = Path::new(&rom_path).exists();

    if !emulator_exists {
        return Err(format!("Emulador não encontrado em: {}", emulator_path));
    }

    if !rom_exists {
        return Err(format!("ROM não encontrada em: {}", rom_path));
    }

    let emulator_dir = Path::new(&emulator_path)
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| {
            format!(
                "Não foi possível resolver a pasta do emulador: {}",
                emulator_path
            )
        })?;

    let mut command = Command::new(&emulator_path);
    command.current_dir(&emulator_dir);
    for arg in args.unwrap_or_default() {
        command.arg(arg);
    }
    command
        .arg(&rom_path)
        .spawn()
        .map_err(|e| {
            format!(
                "Falha ao executar emulador. emulator_path='{}', rom_path='{}', erro='{}'",
                emulator_path, rom_path, e
            )
        })?;

    Ok(())
}

#[tauri::command]
fn launch_retroarch(
    retroarch_path: String,
    core_path: String,
    rom_path: String,
) -> Result<(), String> {
    if !Path::new(&retroarch_path).exists() {
        return Err(format!("RetroArch não encontrado em: {}", retroarch_path));
    }
    if !Path::new(&core_path).exists() {
        return Err(format!("Core não encontrado em: {}", core_path));
    }
    if !Path::new(&rom_path).exists() {
        return Err(format!("ROM não encontrada em: {}", rom_path));
    }

    let retroarch_dir = Path::new(&retroarch_path)
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| {
            format!(
                "Não foi possível resolver a pasta do RetroArch: {}",
                retroarch_path
            )
        })?;

    Command::new(&retroarch_path)
        .current_dir(&retroarch_dir)
        .arg("-L")
        .arg(&core_path)
        .arg(&rom_path)
        .spawn()
        .map_err(|e| {
            format!(
                "Falha ao executar RetroArch. retroarch='{}', core='{}', rom='{}', erro='{}'",
                retroarch_path, core_path, rom_path, e
            )
        })?;

    Ok(())
}

#[tauri::command]
fn save_foreground_window(state: State<'_, FocusState>) {
  let hwnd = unsafe { GetForegroundWindow() };
  if hwnd != 0 {
    let mut guard = state.0.lock().unwrap();
    *guard = hwnd;
  }
}


#[tauri::command]
async fn ensure_overlay_window(app: AppHandle) -> Result<(), String> {
  if app.get_webview_window("overlay").is_some() {
    return Ok(());
  }

  let cfg = app
    .config()
    .app
    .windows
    .iter()
    .find(|w| w.label == "overlay")
    .ok_or("WindowConfig 'overlay' não encontrado no tauri.conf")?
    .clone();

  WebviewWindowBuilder::from_config(&app, &cfg)
    .map_err(|e| e.to_string())?
    .build()
    .map_err(|e| e.to_string())?;

  Ok(())
}

#[tauri::command]
async fn ensure_overlay_mini_window(app: AppHandle) -> Result<(), String> {
  if app.get_webview_window("overlay_mini").is_some() {
    return Ok(());
  }

  let cfg = app
    .config()
    .app
    .windows
    .iter()
    .find(|w| w.label == "overlay_mini")
    .ok_or("WindowConfig 'overlay_mini' não encontrado no tauri.conf")?
    .clone();

  WebviewWindowBuilder::from_config(&app, &cfg)
    .map_err(|e| e.to_string())?
    .build()
    .map_err(|e| e.to_string())?;

  Ok(())
}

#[tauri::command]
fn restore_foreground_window(state: State<'_, FocusState>) {
  let hwnd = {
    let guard = state.0.lock().unwrap();
    *guard
  };

  if hwnd == 0 {
    return;
  }

  unsafe {
    let mut _pid: u32 = 0;
    let fg_thread = GetWindowThreadProcessId(hwnd, &mut _pid);
    let cur_thread = GetCurrentThreadId();

    if fg_thread != 0 && cur_thread != 0 {
      AttachThreadInput(cur_thread, fg_thread, 1);
      SetForegroundWindow(hwnd);
      AttachThreadInput(cur_thread, fg_thread, 0);
    } else {
      SetForegroundWindow(hwnd);
    }
  }
}

#[tauri::command]
fn close_overlay_mini_window(app: AppHandle) -> Result<(), String> {
  if let Some(overlay_mini) = app.get_webview_window("overlay_mini") {
    overlay_mini.close().map_err(|e| e.to_string())?;
  }

  Ok(())
}

#[tauri::command]
fn stop_running_overlays(app: AppHandle) -> Result<(), String> {
  if let Some(overlay) = app.get_webview_window("overlay") {
    overlay.close().map_err(|e| e.to_string())?;
  }

  if let Some(overlay_mini) = app.get_webview_window("overlay_mini") {
    overlay_mini.close().map_err(|e| e.to_string())?;
  }

  Ok(())
}


#[tauri::command]
fn stop_active_game() -> Result<(), String> {
    kill_emulators();
    Ok(())
}

fn db_migrations() -> Vec<tauri_plugin_sql::Migration> {
  use tauri_plugin_sql::{Migration, MigrationKind};

  vec![Migration {
    version: 1,
    description: "schema inicial do fliperama (admin, pricing, rooms, sessoes, pagamentos, uso, saves)",
    sql: "
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pricing_tiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        minutes INTEGER NOT NULL,
        price_cents INTEGER NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS platform_config (
        platform_name TEXT PRIMARY KEY,
        rom_extensions TEXT,
        enabled INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS game_stats (
        platform_name TEXT NOT NULL,
        rom_name TEXT NOT NULL,
        favorite INTEGER NOT NULL DEFAULT 0,
        play_count INTEGER NOT NULL DEFAULT 0,
        last_played_at TEXT,
        PRIMARY KEY (platform_name, rom_name)
      );

      CREATE TABLE IF NOT EXISTS uploaded_games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform_name TEXT NOT NULL,
        rom_name TEXT NOT NULL,
        title TEXT,
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS room_games (
        room_id INTEGER NOT NULL,
        platform_name TEXT NOT NULL,
        rom_name TEXT NOT NULL,
        PRIMARY KEY (room_id, platform_name, rom_name)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_minutes INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        expires_at TEXT
      );

      CREATE TABLE IF NOT EXISTS usage_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        platform_name TEXT,
        rom_name TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT
      );

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        provider_id TEXT,
        amount_cents INTEGER NOT NULL,
        minutes INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        paid_at TEXT
      );

      CREATE TABLE IF NOT EXISTS saves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        platform_name TEXT NOT NULL,
        rom_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO pricing_tiers (minutes, price_cents, active, sort_order)
      SELECT 5, 200, 1, 0 WHERE NOT EXISTS (SELECT 1 FROM pricing_tiers);
      INSERT INTO pricing_tiers (minutes, price_cents, active, sort_order)
      SELECT 10, 300, 1, 1 WHERE NOT EXISTS (SELECT 1 FROM pricing_tiers WHERE minutes = 10);
      INSERT INTO pricing_tiers (minutes, price_cents, active, sort_order)
      SELECT 15, 500, 1, 2 WHERE NOT EXISTS (SELECT 1 FROM pricing_tiers WHERE minutes = 15);
    ",
    kind: MigrationKind::Up,
  }]
}

// ── Servidor HTTP embarcado: acesso remoto ao painel admin pela rede ─────────
// Expõe o banco SQLite via HTTP (POST /api/db/select e /api/db/execute) para que
// outra máquina na MESMA REDE acesse o painel admin pela web. CORS liberado.
#[derive(serde::Deserialize)]
struct SqlReq {
  sql: String,
  #[serde(default)]
  params: Vec<serde_json::Value>,
}

fn json_to_sqlite(v: &serde_json::Value) -> rusqlite::types::Value {
  use rusqlite::types::Value;
  match v {
    serde_json::Value::Null => Value::Null,
    serde_json::Value::Bool(b) => Value::Integer(if *b { 1 } else { 0 }),
    serde_json::Value::Number(n) => {
      if let Some(i) = n.as_i64() {
        Value::Integer(i)
      } else if let Some(f) = n.as_f64() {
        Value::Real(f)
      } else {
        Value::Null
      }
    }
    serde_json::Value::String(s) => Value::Text(s.clone()),
    other => Value::Text(other.to_string()),
  }
}

fn sqlite_to_json(v: rusqlite::types::Value) -> serde_json::Value {
  use rusqlite::types::Value;
  match v {
    Value::Null => serde_json::Value::Null,
    Value::Integer(i) => serde_json::Value::Number(i.into()),
    Value::Real(f) => serde_json::json!(f),
    Value::Text(s) => serde_json::Value::String(s),
    Value::Blob(b) => serde_json::Value::String(String::from_utf8_lossy(&b).into_owned()),
  }
}

fn open_admin_conn(db_path: &Path) -> Result<rusqlite::Connection, String> {
  let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;
  let _ = conn.busy_timeout(std::time::Duration::from_secs(5));
  Ok(conn)
}

fn admin_db_select(db_path: &Path, body: &str) -> Result<String, String> {
  let req: SqlReq = serde_json::from_str(body).map_err(|e| e.to_string())?;
  let conn = open_admin_conn(db_path)?;
  let mut stmt = conn.prepare(&req.sql).map_err(|e| e.to_string())?;
  let cols: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
  let params: Vec<rusqlite::types::Value> = req.params.iter().map(json_to_sqlite).collect();
  let refs: Vec<&dyn rusqlite::ToSql> =
    params.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
  let mut rows = stmt.query(refs.as_slice()).map_err(|e| e.to_string())?;
  let mut out: Vec<serde_json::Map<String, serde_json::Value>> = Vec::new();
  while let Some(row) = rows.next().map_err(|e| e.to_string())? {
    let mut obj = serde_json::Map::new();
    for (i, name) in cols.iter().enumerate() {
      let val: rusqlite::types::Value = row.get(i).map_err(|e| e.to_string())?;
      obj.insert(name.clone(), sqlite_to_json(val));
    }
    out.push(obj);
  }
  serde_json::to_string(&out).map_err(|e| e.to_string())
}

fn admin_db_execute(db_path: &Path, body: &str) -> Result<String, String> {
  let req: SqlReq = serde_json::from_str(body).map_err(|e| e.to_string())?;
  let conn = open_admin_conn(db_path)?;
  let params: Vec<rusqlite::types::Value> = req.params.iter().map(json_to_sqlite).collect();
  let refs: Vec<&dyn rusqlite::ToSql> =
    params.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
  let affected = conn
    .execute(&req.sql, refs.as_slice())
    .map_err(|e| e.to_string())?;
  let last = conn.last_insert_rowid();
  Ok(format!(
    "{{\"rowsAffected\":{},\"lastInsertId\":{}}}",
    affected, last
  ))
}

/// Caminhos do host expostos ao admin remoto (banco + dirs base do app).
struct HostPaths {
  db_path: PathBuf,
  app_config_dir: PathBuf,
  app_local_data_dir: PathBuf,
}

// Ponte de filesystem para o admin remoto: espelha os usos do @tauri-apps/
// plugin-fs (exists/readDir/readTextFile/writeTextFile/readFile/writeFile/
// mkdir/copyFile/remove) e expõe os dirs base do app (/api/fs/dirs).
fn admin_fs(op: &str, body: &str, paths: &HostPaths) -> Result<String, String> {
  use base64::Engine;
  use serde_json::{json, Value};

  let v: Value = if body.trim().is_empty() {
    Value::Null
  } else {
    serde_json::from_str(body).map_err(|e| e.to_string())?
  };
  let get_str = |k: &str| -> Result<String, String> {
    v.get(k)
      .and_then(|x| x.as_str())
      .map(|s| s.to_string())
      .ok_or_else(|| format!("campo '{}' ausente", k))
  };
  let get_bool = |k: &str| v.get(k).and_then(|x| x.as_bool()).unwrap_or(false);

  match op {
    "dirs" => Ok(json!({
      "sep": std::path::MAIN_SEPARATOR.to_string(),
      "appConfigDir": paths.app_config_dir.to_string_lossy(),
      "appLocalDataDir": paths.app_local_data_dir.to_string_lossy(),
    })
    .to_string()),
    "exists" => {
      let p = get_str("path")?;
      Ok(json!({ "exists": Path::new(&p).exists() }).to_string())
    }
    "readDir" => {
      let p = get_str("path")?;
      let mut entries: Vec<Value> = Vec::new();
      for e in std::fs::read_dir(&p).map_err(|e| e.to_string())? {
        let e = e.map_err(|e| e.to_string())?;
        let ft = e.file_type().map_err(|e| e.to_string())?;
        entries.push(json!({
          "name": e.file_name().to_string_lossy(),
          "isDirectory": ft.is_dir(),
          "isFile": ft.is_file(),
          "isSymlink": ft.is_symlink(),
        }));
      }
      Ok(json!({ "entries": entries }).to_string())
    }
    "readTextFile" => {
      let p = get_str("path")?;
      let content = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
      Ok(json!({ "content": content }).to_string())
    }
    "writeTextFile" => {
      let p = get_str("path")?;
      std::fs::write(&p, get_str("content")?).map_err(|e| e.to_string())?;
      Ok("{\"ok\":true}".to_string())
    }
    "readFile" => {
      let p = get_str("path")?;
      let bytes = std::fs::read(&p).map_err(|e| e.to_string())?;
      let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
      Ok(json!({ "base64": b64 }).to_string())
    }
    "writeFile" => {
      let p = get_str("path")?;
      let bytes = base64::engine::general_purpose::STANDARD
        .decode(get_str("base64")?.as_bytes())
        .map_err(|e| e.to_string())?;
      std::fs::write(&p, bytes).map_err(|e| e.to_string())?;
      Ok("{\"ok\":true}".to_string())
    }
    "mkdir" => {
      let p = get_str("path")?;
      if get_bool("recursive") {
        std::fs::create_dir_all(&p)
      } else {
        std::fs::create_dir(&p)
      }
      .map_err(|e| e.to_string())?;
      Ok("{\"ok\":true}".to_string())
    }
    "copyFile" => {
      std::fs::copy(get_str("from")?, get_str("to")?).map_err(|e| e.to_string())?;
      Ok("{\"ok\":true}".to_string())
    }
    "remove" => {
      let p = get_str("path")?;
      let path = Path::new(&p);
      if path.is_dir() {
        if get_bool("recursive") {
          std::fs::remove_dir_all(path)
        } else {
          std::fs::remove_dir(path)
        }
      } else {
        std::fs::remove_file(path)
      }
      .map_err(|e| e.to_string())?;
      Ok("{\"ok\":true}".to_string())
    }
    _ => Err("rota fs desconhecida".to_string()),
  }
}

// Localiza a pasta `dist` (frontend buildado) para servir o painel pela rede.
fn frontend_root() -> Option<PathBuf> {
  let exe = std::env::current_exe().ok()?;
  let mut candidates: Vec<PathBuf> = Vec::new();
  if let Some(dir) = exe.parent() {
    candidates.push(dir.join("dist"));
    let mut p = dir.to_path_buf();
    for _ in 0..3 {
      if let Some(par) = p.parent() {
        p = par.to_path_buf();
      }
    }
    candidates.push(p.join("dist"));
  }
  candidates.into_iter().find(|c| c.join("index.html").exists())
}

fn content_type(path: &Path) -> &'static str {
  match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
    "html" => "text/html; charset=utf-8",
    "js" | "mjs" => "text/javascript; charset=utf-8",
    "css" => "text/css; charset=utf-8",
    "svg" => "image/svg+xml",
    "png" => "image/png",
    "jpg" | "jpeg" => "image/jpeg",
    "webp" => "image/webp",
    "gif" => "image/gif",
    "json" => "application/json",
    "ico" => "image/x-icon",
    "woff2" => "font/woff2",
    "woff" => "font/woff",
    "ttf" => "font/ttf",
    _ => "application/octet-stream",
  }
}

fn serve_frontend(url: &str, root: &Path) -> Option<(Vec<u8>, &'static str)> {
  let path = url.split('?').next().unwrap_or("/");
  if path.contains("..") {
    return None;
  }
  let rel = path.trim_start_matches('/');
  let candidate = if rel.is_empty() {
    root.join("index.html")
  } else {
    root.join(rel)
  };
  if candidate.is_file() {
    if let Ok(bytes) = std::fs::read(&candidate) {
      return Some((bytes, content_type(&candidate)));
    }
  }
  // SPA fallback: rotas como /admin -> index.html
  std::fs::read(root.join("index.html"))
    .ok()
    .map(|b| (b, "text/html; charset=utf-8"))
}

fn start_remote_admin_server(paths: HostPaths) {
  std::thread::spawn(move || {
    let server = match tiny_http::Server::http("0.0.0.0:8787") {
      Ok(s) => s,
      Err(e) => {
        log::error!("admin remoto: nao subiu na porta 8787: {}", e);
        return;
      }
    };
    let root = frontend_root();
    log::info!(
      "admin remoto: ouvindo em 0.0.0.0:8787 (frontend servido: {})",
      root.is_some()
    );
    for mut request in server.incoming_requests() {
      let cors_origin =
        tiny_http::Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap();
      let method = request.method().clone();
      let url = request.url().to_string();

      // Preflight CORS.
      if method == tiny_http::Method::Options {
        let mut resp = tiny_http::Response::from_string("").with_status_code(204);
        resp.add_header(cors_origin.clone());
        resp.add_header(
          tiny_http::Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, POST, OPTIONS"[..]).unwrap(),
        );
        resp.add_header(
          tiny_http::Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type"[..]).unwrap(),
        );
        let _ = request.respond(resp);
        continue;
      }

      // API (POST /api/db/* e /api/fs/*).
      if url.starts_with("/api/") {
        let mut body = String::new();
        let _ = request.as_reader().read_to_string(&mut body);
        let path_only = url.split('?').next().unwrap_or(&url);
        let result = if let Some(op) = path_only.strip_prefix("/api/fs/") {
          admin_fs(op, &body, &paths)
        } else {
          match path_only {
            "/api/db/select" => admin_db_select(&paths.db_path, &body),
            "/api/db/execute" => admin_db_execute(&paths.db_path, &body),
            _ => Err("rota desconhecida".to_string()),
          }
        };
        let (code, json) = match result {
          Ok(j) => (200u16, j),
          Err(e) => (
            400u16,
            format!("{{\"error\":{}}}", serde_json::Value::String(e).to_string()),
          ),
        };
        let mut resp = tiny_http::Response::from_string(json).with_status_code(code);
        resp.add_header(cors_origin.clone());
        resp.add_header(
          tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap(),
        );
        let _ = request.respond(resp);
        continue;
      }

      // Frontend estático (acesso remoto numa porta só: SPA + API no 8787).
      if let Some(root) = root.as_ref() {
        if let Some((bytes, ctype)) = serve_frontend(&url, root) {
          let mut resp = tiny_http::Response::from_data(bytes).with_status_code(200);
          resp.add_header(
            tiny_http::Header::from_bytes(&b"Content-Type"[..], ctype.as_bytes()).unwrap(),
          );
          resp.add_header(cors_origin.clone());
          let _ = request.respond(resp);
          continue;
        }
      }

      let _ = request
        .respond(tiny_http::Response::from_string("nao encontrado").with_status_code(404));
    }
  });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:fliperama.db", db_migrations())
        .build(),
    )
    .manage(FocusState(Mutex::new(0)))
    .manage(SessionTimer(Arc::new(AtomicU64::new(0))))
    .invoke_handler(tauri::generate_handler![
      save_foreground_window,
      restore_foreground_window,
      ensure_overlay_window,
      ensure_overlay_mini_window,
      close_overlay_mini_window,
      stop_running_overlays,
      launch_mame,
      launch_generic,
      launch_retroarch,
      stop_active_game,
      start_session_timer,
      cancel_session_timer,
      quit_app
    ])
    .setup(|app| {

 let show = MenuItem::with_id(app, "tray_show", "Mostrar", true, None::<&str>)?;
      let hide = MenuItem::with_id(app, "tray_hide", "Esconder", true, None::<&str>)?;
      let quit = MenuItem::with_id(app, "tray_quit", "Sair", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

      let icon = app.default_window_icon().cloned();


let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .icon(icon.unwrap())
        .on_menu_event(|app, event| {
          let window = app.get_webview_window("main");
          match event.id().as_ref() {
            "tray_show" => {
              if let Some(w) = window {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
              }
            }
            "tray_hide" => {
              if let Some(w) = window {
                let _ = w.hide();
              }
            }
            "tray_quit" => {
              app.exit(0);
            }
            _ => {}
          }
        })
        .on_tray_icon_event(|tray, event| {
          // clique esquerdo no ícone -> alterna mostrar/esconder
          if let TrayIconEvent::Click { button, button_state, .. } = event {
            if button == tauri::tray::MouseButton::Left
              && button_state == tauri::tray::MouseButtonState::Up
            {
              let app = tray.app_handle();
              if let Some(w) = app.get_webview_window("main") {
                let is_visible = w.is_visible().unwrap_or(false);
                if is_visible {
                  let _ = w.hide();
                } else {
                  let _ = w.show();
                  let _ = w.unminimize();
                  let _ = w.set_focus();
                }
              }
            }
          }
        })
        .build(app)?;



      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Servidor HTTP para acesso remoto ao painel admin (mesma rede).
      if let (Ok(cfg_dir), Ok(local_dir)) = (
        app.path().app_config_dir(),
        app.path().app_local_data_dir(),
      ) {
        start_remote_admin_server(HostPaths {
          db_path: cfg_dir.join("fliperama.db"),
          app_config_dir: cfg_dir,
          app_local_data_dir: local_dir,
        });
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
