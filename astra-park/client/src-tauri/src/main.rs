//! Orlis Play for Windows: the game in a window of its own.
//!
//! On every start it: checks for a newer version of the app (a few seconds
//! at most; offline, it just opens) and installs it if there is one; lists
//! the songs in the family's "Orlis Play" music folder for the game to play;
//! opens the game in the display mode last chosen (a window, or Big Picture:
//! full screen, for the TV); and lets the game use the camera without a
//! question - this window only ever shows Orlis Play's own pages, and the
//! video never leaves the machine.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{path::Path, time::Duration};
use tauri::{AppHandle, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::UpdaterExt;

/// Song files the game can play.
const SONGS: &[&str] = &["mp3", "m4a", "aac", "ogg", "oga", "opus", "wav", "flac", "webm"];

/// The display mode a new install starts in: "window" while the games are
/// being made and tried out; "bigpicture" (full screen, for the TV) once
/// Orlis Play is released. Settings > Display changes it, and it's kept.
const DEFAULT_MODE: &str = "window";
const MODES: &[&str] = &["window", "bigpicture"];
/// The window, in window mode.
const WINDOW_SIZE: (f64, f64) = (1280.0, 720.0);

/// How long the update check may hold up the start.
const UPDATE_WAIT: Duration = Duration::from_secs(4);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![set_display_mode])
        .setup(|app| {
            let app = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if update(&app).await {
                    return; // installing; the new version starts itself
                }
                if let Err(e) = open(&app) {
                    eprintln!("could not open the game: {e}");
                    app.exit(1);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Orlis Play failed to start");
}

/// A newer version, if there is one and it comes quickly: downloaded,
/// installed, and the app restarted on it. True if that's under way.
async fn update(app: &AppHandle) -> bool {
    let check = async {
        let updater = app.updater().ok()?;
        updater.check().await.ok().flatten()
    };
    let Ok(Some(found)) = tokio::time::timeout(UPDATE_WAIT, check).await else {
        return false;
    };
    match found.download_and_install(|_, _| {}, || {}).await {
        Ok(()) => {
            app.restart();
        }
        Err(e) => {
            eprintln!("update failed, opening this version: {e}");
            false
        }
    }
}

/// The game's window.
fn open(app: &AppHandle) -> tauri::Result<()> {
    let mode = display_mode(app);
    let script = format!(
        "window.ASTRA_MUSIC = {};\nwindow.ORLIS_LOCAL = true;\nwindow.ORLIS_DISPLAY = {};\n{}",
        serde_json::to_string(&songs(app)).unwrap_or_else(|_| "[]".into()),
        serde_json::to_string(&mode).unwrap_or_else(|_| "\"window\"".into()),
        DISPLAY_SCRIPT
    );
    let title = app.config().product_name.clone().unwrap_or_else(|| "Orlis Play".into());
    let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title(&title)
        .inner_size(WINDOW_SIZE.0, WINDOW_SIZE.1)
        .min_inner_size(640.0, 360.0)
        .center()
        .fullscreen(mode == "bigpicture")
        .initialization_script(&script)
        // Sound may start before anyone clicks (the intro's chime, the
        // music), plus the engine's usual defaults, which this replaces.
        .additional_browser_args(
            "--autoplay-policy=no-user-gesture-required \
             --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection",
        )
        .build()?;
    allow_camera(&window);
    Ok(())
}

/// Where the chosen display mode is kept, in the app's own settings folder.
fn display_file(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("display.json"))
}

/// The display mode last chosen, or the default for a new install.
fn display_mode(app: &AppHandle) -> String {
    display_file(app)
        .and_then(|f| std::fs::read_to_string(f).ok())
        .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
        .and_then(|v| v.get("mode").and_then(|m| m.as_str()).map(String::from))
        .filter(|m| MODES.contains(&m.as_str()))
        .unwrap_or_else(|| DEFAULT_MODE.into())
}

/// Settings > Display (and F11): switch to a mode, now, and keep it.
#[tauri::command]
fn set_display_mode(app: AppHandle, mode: String) -> Result<String, String> {
    if !MODES.contains(&mode.as_str()) {
        return Err(format!("no such display mode: {mode}"));
    }
    if let Some(f) = display_file(&app) {
        if let Some(dir) = f.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(&f, serde_json::json!({ "mode": mode }).to_string());
    }
    if let Some(w) = app.get_webview_window("main") {
        let big = mode == "bigpicture";
        w.set_fullscreen(big).map_err(|e| e.to_string())?;
        if !big {
            let _ = w.set_size(LogicalSize::new(WINDOW_SIZE.0, WINDOW_SIZE.1));
            let _ = w.center();
        }
    }
    Ok(mode)
}

/// The display mode, for the game's Settings screen; and F11, which switches
/// between the two like full screen in any Windows game.
const DISPLAY_SCRIPT: &str = r#"
window.orlisDisplay = {
  get mode(){ return window.ORLIS_DISPLAY; },
  async set(mode){
    window.ORLIS_DISPLAY = await window.__TAURI__.core.invoke('set_display_mode', { mode });
    return window.ORLIS_DISPLAY;
  }
};
addEventListener('keydown', (e) => {
  if (e.key !== 'F11') return;
  e.preventDefault();
  window.orlisDisplay.set(window.ORLIS_DISPLAY === 'bigpicture' ? 'window' : 'bigpicture');
}, true);
"#;

/// The family's songs: every song file in Music\Orlis Play (made if it isn't
/// there, so it's ready to drop songs into), as addresses the game can play.
fn songs(app: &AppHandle) -> Vec<String> {
    let Ok(music) = app.path().audio_dir() else { return vec![] };
    let dir = music.join("Orlis Play");
    let _ = std::fs::create_dir_all(&dir);
    let Ok(entries) = std::fs::read_dir(&dir) else { return vec![] };
    let mut files: Vec<_> = entries
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.is_file() && is_song(p))
        .collect();
    files.sort();
    files.iter().map(|p| asset_url(p)).collect()
}

fn is_song(p: &Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| SONGS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// A file on disk as the app's asset address (allowed for the music folder
/// only, in tauri.conf.json).
fn asset_url(p: &Path) -> String {
    let path = p.to_string_lossy();
    let mut enc = String::new();
    for b in path.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => enc.push(*b as char),
            _ => enc.push_str(&format!("%{b:02X}")),
        }
    }
    if cfg!(windows) {
        format!("http://asset.localhost/{enc}")
    } else {
        format!("asset://localhost/{enc}")
    }
}

/// The camera (and nothing else) allowed without a prompt.
#[cfg(windows)]
fn allow_camera(window: &tauri::WebviewWindow) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2PermissionRequestedEventArgs, COREWEBVIEW2_PERMISSION_KIND,
        COREWEBVIEW2_PERMISSION_KIND_CAMERA, COREWEBVIEW2_PERMISSION_STATE_ALLOW,
    };
    use webview2_com::PermissionRequestedEventHandler;
    let _ = window.with_webview(|wv| unsafe {
        let Ok(core) = wv.controller().CoreWebView2() else { return };
        let handler = PermissionRequestedEventHandler::create(Box::new(
            |_, args: Option<ICoreWebView2PermissionRequestedEventArgs>| {
                if let Some(args) = args {
                    let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
                    args.PermissionKind(&mut kind)?;
                    if kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA {
                        args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)?;
                    }
                }
                Ok(())
            },
        ));
        let mut token = Default::default();
        let _ = core.add_PermissionRequested(&handler, &mut token);
    });
}

#[cfg(not(windows))]
fn allow_camera(_: &tauri::WebviewWindow) {}
