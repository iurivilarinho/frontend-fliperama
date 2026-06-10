use std::sync::Mutex;
use tauri::State;
use tauri::{AppHandle, Manager};
use tauri::webview::WebviewWindowBuilder;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use windows_sys::Win32::Foundation::HWND;
use windows_sys::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
use windows_sys::Win32::UI::WindowsAndMessaging::{
  GetForegroundWindow, GetWindowThreadProcessId, SetForegroundWindow,
};

struct FocusState(Mutex<HWND>);


use std::path::{Path, PathBuf};
use std::process::Command;

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
    #[cfg(target_os = "windows")]
    {
        // Encerra qualquer emulador conhecido que possa estar rodando.
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
                .output()
                .map_err(|e| format!("Falha ao executar taskkill: {}", e))?;
        }

        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .manage(FocusState(Mutex::new(0)))
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
