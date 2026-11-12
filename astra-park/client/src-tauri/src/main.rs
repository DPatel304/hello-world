//! Orlis Play for Windows: the game in a window of its own.
//!
//! On every start it: checks for a newer version of the app (a few seconds
//! at most; offline, it just opens) and installs it if there is one; lists
//! the songs in the family's "Orlis Play" music folder for the game to play;
//! opens the game full screen; and lets the game use the camera without a
//! question - this window only ever shows Orlis Play's own pages, and the
//! video never leaves the machine.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{path::Path, time::Duration};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::UpdaterExt;

/// Song files the game can play.
const SONGS: &[&str] = &["mp3", "m4a", "aac", "ogg", "oga", "opus", "wav", "flac", "webm"];

/// How long the update check may hold up the start.
const UPDATE_WAIT: Duration = Duration::from_secs(4);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
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
    let script = format!(
        "window.ASTRA_MUSIC = {};\nwindow.ORLIS_LOCAL = true;\n{}",
        serde_json::to_string(&songs(app)).unwrap_or_else(|_| "[]".into()),
        FULLSCREEN_KEY
    );
    let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Orlis Play")
        .inner_size(1280.0, 720.0)
        .min_inner_size(640.0, 360.0)
        .center()
        .fullscreen(true)
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

/// F11: in and out of full screen, like any Windows game.
const FULLSCREEN_KEY: &str = r#"
addEventListener('keydown', async (e) => {
  if (e.key !== 'F11') return;
  e.preventDefault();
  const w = window.__TAURI__ && window.__TAURI__.window && window.__TAURI__.window.getCurrentWindow();
  if (w) await w.setFullscreen(!(await w.isFullscreen()));
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
