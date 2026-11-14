//! Making games (Create): each game a creator makes is a folder of its own
//! in Documents\Orlis Play\Games - the game (game.js, orlis.json), and
//! Orlis Play's rules and guardrails for Claude Code (CLAUDE.md, .claude\).
//!
//! The page asks for a game's folder by its name only - never a path - and
//! everything it reads or writes stays inside that folder. What it may write
//! after the folder is made is Orlis Play's own part (.claude\, and the notes
//! in .orlis\): the game itself is the creator's and Claude's.

use serde_json::{json, Value};
use std::{collections::HashMap, fs, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager};

/// Where the games live.
fn games_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let docs = app.path().document_dir().map_err(|_| "Couldn't find the Documents folder.".to_string())?;
    let dir = docs.join("Orlis Play").join("Games");
    fs::create_dir_all(&dir).map_err(|e| format!("Couldn't make the Games folder: {e}"))?;
    Ok(dir)
}

/// A folder name from a game's name: what Windows allows, up to 40 letters.
fn folder_name(name: &str) -> String {
    let s: String = name
        .chars()
        .filter(|c| !c.is_control() && !"<>:\"/\\|?*".contains(*c))
        .take(40)
        .collect();
    let s = s.trim().trim_matches('.').trim().to_string();
    if s.is_empty() { "My game".into() } else { s }
}

/// One of the games' folders, by name (and only that: no paths).
fn game_dir(app: &AppHandle, folder: &str) -> Result<PathBuf, String> {
    if folder.is_empty() || folder != folder_name(folder) || folder.contains("..") {
        return Err("That isn't one of the games.".into());
    }
    let dir = games_dir(app)?.join(folder);
    if !dir.join("orlis.json").is_file() {
        return Err("That game's folder isn't there any more.".into());
    }
    Ok(dir)
}

/// A file inside a game's folder: a plain relative path, no way out of it.
fn inside(dir: &Path, rel: &str) -> Result<PathBuf, String> {
    let ok = !rel.is_empty()
        && !rel.starts_with('/')
        && !rel.starts_with('\\')
        && !rel.contains(':')
        && rel.split(['/', '\\']).all(|p| !p.is_empty() && p != "." && p != "..");
    if !ok {
        return Err(format!("Not a file in the game's folder: {rel}"));
    }
    Ok(dir.join(rel))
}

fn write_all(dir: &Path, files: &HashMap<String, String>) -> Result<(), String> {
    for (rel, text) in files {
        let p = inside(dir, rel)?;
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Couldn't write {rel}: {e}"))?;
        }
        fs::write(&p, text).map_err(|e| format!("Couldn't write {rel}: {e}"))?;
    }
    Ok(())
}

/// Every game in the folder: its folder's name, its orlis.json, and when it
/// last changed (newest first).
#[tauri::command]
pub fn games_list(app: AppHandle) -> Result<Vec<Value>, String> {
    let dir = games_dir(&app)?;
    let mut out = vec![];
    for e in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let p = e.path();
        let Some(folder) = p.file_name().and_then(|n| n.to_str()).map(String::from) else { continue };
        let Ok(manifest) = fs::read_to_string(p.join("orlis.json")) else { continue };
        let changed = ["game.js", "orlis.json"]
            .iter()
            .filter_map(|f| fs::metadata(p.join(f)).ok()?.modified().ok())
            .max()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        out.push(json!({ "folder": folder, "manifest": manifest, "changed": changed }));
    }
    out.sort_by_key(|v| std::cmp::Reverse(v["changed"].as_u64().unwrap_or(0)));
    Ok(out)
}

/// A new game: a folder named after it (another number on the end if
/// that's taken), with these files in it. Gives back the folder's name.
#[tauri::command]
pub fn game_make(app: AppHandle, name: String, files: HashMap<String, String>) -> Result<String, String> {
    let root = games_dir(&app)?;
    let base = folder_name(&name);
    let mut folder = base.clone();
    let mut n = 2;
    while root.join(&folder).exists() {
        folder = format!("{base} {n}");
        n += 1;
    }
    let dir = root.join(&folder);
    fs::create_dir_all(&dir).map_err(|e| format!("Couldn't make the game's folder: {e}"))?;
    if let Err(e) = write_all(&dir, &files) {
        let _ = fs::remove_dir_all(&dir);
        return Err(e);
    }
    Ok(folder)
}

/// Orlis Play's own part of a game's folder, brought up to date (the
/// guardrails, as they are in this version) - or the preview's notes.
#[tauri::command]
pub fn game_write(app: AppHandle, folder: String, files: HashMap<String, String>) -> Result<(), String> {
    let dir = game_dir(&app, &folder)?;
    for rel in files.keys() {
        let r = rel.replace('\\', "/");
        if !(r.starts_with(".claude/") || r == ".orlis/preview.txt") {
            return Err(format!("Orlis Play doesn't change {rel} - that's the game's own."));
        }
    }
    write_all(&dir, &files)
}

/// A new version number in the game's orlis.json (before it's sent, so each
/// version sent replaces the last) - the only change Orlis Play makes to the
/// game itself; everything else in it stays as it was.
#[tauri::command]
pub fn game_version(app: AppHandle, folder: String, version: String) -> Result<(), String> {
    let ok = !version.is_empty()
        && version.len() <= 12
        && version.split('.').count() <= 3
        && version.split('.').all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()));
    if !ok {
        return Err("Versions look like 0.2 or 1.10.".into());
    }
    let dir = game_dir(&app, &folder)?;
    let path = dir.join("orlis.json");
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut m: Value = serde_json::from_str(&text).map_err(|_| "orlis.json isn't valid JSON - ask Claude to fix it first.".to_string())?;
    let Some(obj) = m.as_object_mut() else { return Err("orlis.json isn't a game's details.".into()) };
    obj.insert("version".into(), Value::String(version));
    let out = serde_json::to_string_pretty(&m).map_err(|e| e.to_string())? + "\n";
    fs::write(&path, out).map_err(|e| format!("Couldn't write orlis.json: {e}"))
}

/// The game as it is now: game.js and orlis.json.
#[tauri::command]
pub fn game_read(app: AppHandle, folder: String) -> Result<Value, String> {
    let dir = game_dir(&app, &folder)?;
    let read = |f: &str| fs::read_to_string(dir.join(f)).ok();
    Ok(json!({ "game": read("game.js"), "manifest": read("orlis.json") }))
}

/// The game's folder, in File Explorer.
#[tauri::command]
pub fn game_show(app: AppHandle, folder: String) -> Result<(), String> {
    let dir = game_dir(&app, &folder)?;
    #[cfg(windows)]
    {
        std::process::Command::new("explorer.exe").arg(&dir).spawn().map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = dir;
        Err("Only in Orlis Play for Windows.".into())
    }
}

/// Where Claude Code is, if it's on this PC: on the PATH, or where its
/// installers put it.
#[cfg(windows)]
fn find_claude() -> Option<PathBuf> {
    use std::os::windows::process::CommandExt;
    const NO_WINDOW: u32 = 0x0800_0000;
    if let Ok(out) = std::process::Command::new("where.exe").arg("claude").creation_flags(NO_WINDOW).output() {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            // (an .exe or .cmd first: "where" lists every match)
            let mut found: Vec<PathBuf> = text.lines().map(|l| PathBuf::from(l.trim())).filter(|p| p.is_file()).collect();
            found.sort_by_key(|p| !matches!(p.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref(), Some("exe") | Some("cmd")));
            if let Some(p) = found.into_iter().next() {
                return Some(p);
            }
        }
    }
    let home = std::env::var_os("USERPROFILE").map(PathBuf::from);
    let appdata = std::env::var_os("APPDATA").map(PathBuf::from);
    [
        home.as_ref().map(|h| h.join(".local").join("bin").join("claude.exe")),
        appdata.as_ref().map(|a| a.join("npm").join("claude.cmd")),
    ]
    .into_iter()
    .flatten()
    .find(|p| p.is_file())
}

/// Claude Code, opened in the game's folder in a window of its own, with a
/// first thing to do. If it isn't on this PC: { opened: false, missing: true }.
#[tauri::command]
pub fn claude_open(app: AppHandle, folder: String, prompt: String) -> Result<Value, String> {
    let dir = game_dir(&app, &folder)?;
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const NEW_CONSOLE: u32 = 0x0000_0010;
        let Some(claude) = find_claude() else { return Ok(json!({ "opened": false, "missing": true })) };
        // (the window's title, Claude Code, and what to do first: handed
        // over as settings rather than written into the command, so nothing
        // in a game's name or idea can change what runs)
        let script = "$host.UI.RawUI.WindowTitle = $env:ORLIS_TITLE; if ($env:ORLIS_PROMPT) { & $env:ORLIS_CLAUDE $env:ORLIS_PROMPT } else { & $env:ORLIS_CLAUDE }";
        std::process::Command::new("powershell.exe")
            .args(["-NoLogo", "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", script])
            .current_dir(&dir)
            .env("ORLIS_TITLE", format!("{folder} - Claude Code (Orlis Play)"))
            .env("ORLIS_CLAUDE", &claude)
            .env("ORLIS_PROMPT", prompt.chars().take(2000).collect::<String>())
            .creation_flags(NEW_CONSOLE)
            .spawn()
            .map_err(|e| format!("Couldn't open Claude Code: {e}"))?;
        Ok(json!({ "opened": true }))
    }
    #[cfg(not(windows))]
    {
        let _ = (dir, prompt);
        Ok(json!({ "opened": false, "missing": true }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folder_names_are_what_windows_allows() {
        assert_eq!(folder_name("Bird Hoops!"), "Bird Hoops!");
        assert_eq!(folder_name("a/b\\c:d*e?f"), "abcdef");
        assert_eq!(folder_name("  ..  "), "My game");
        assert_eq!(folder_name("...Dots..."), "Dots");
    }

    #[test]
    fn files_stay_in_the_folder() {
        let d = Path::new("games/Bird Hoops");
        assert!(inside(d, "game.js").is_ok());
        assert!(inside(d, ".claude/hooks/guard.ps1").is_ok());
        for bad in ["", "../x", "a/../../x", "/etc/x", "\\x", "C:\\x", "a//b", "./x"] {
            assert!(inside(d, bad).is_err(), "{bad}");
        }
    }
}
