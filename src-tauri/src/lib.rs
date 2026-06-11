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
fn launch_generic(emulator_path: String, rom_path: String) -> Result<(), String> {
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

    Command::new(&emulator_path)
        .current_dir(&emulator_dir)
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
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
