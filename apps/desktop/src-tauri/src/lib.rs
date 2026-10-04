use arkive_core::bench::{self, BenchConfig, BenchReport};
use arkive_core::{
    create, extract, info, list, read_entry, repair, test, ArchiveInfo, CreateOptions, Entry,
    ExtractOptions, OperationStats, RepairReport, TestReport, NoProgress,
};
use std::path::{Path, PathBuf};

#[tauri::command]
fn list_archive(path: String, password: Option<String>) -> Result<Vec<Entry>, String> {
    list(Path::new(&path), password.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_archive_info(path: String, password: Option<String>) -> Result<ArchiveInfo, String> {
    info(Path::new(&path), password.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_archive(
    output: String,
    inputs: Vec<String>,
    options: CreateOptions,
) -> Result<OperationStats, String> {
    let input_paths: Vec<PathBuf> = inputs.into_iter().map(PathBuf::from).collect();
    create(Path::new(&output), &input_paths, &options, &NoProgress).map_err(|e| e.to_string())
}

#[tauri::command]
fn extract_archive(
    archive: String,
    dest: String,
    options: ExtractOptions,
) -> Result<OperationStats, String> {
    extract(Path::new(&archive), Path::new(&dest), &options, &NoProgress)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn test_archive(archive: String, password: Option<String>) -> Result<TestReport, String> {
    test(Path::new(&archive), password.as_deref(), &NoProgress).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_archive_entry(
    archive: String,
    entry_path: String,
    password: Option<String>,
    max_bytes: usize,
) -> Result<String, String> {
    let bytes = read_entry(
        Path::new(&archive),
        &entry_path,
        password.as_deref(),
        max_bytes,
    )
    .map_err(|e| e.to_string())?;
    String::from_utf8(bytes).map_err(|_| "Binary data cannot be displayed as UTF-8".to_string())
}

#[tauri::command]
fn repair_archive(archive: String, output: Option<String>) -> Result<RepairReport, String> {
    let in_path = PathBuf::from(&archive);
    let out_path = output
        .map(PathBuf::from)
        .unwrap_or_else(|| repair::suggest_output(&in_path));
    repair::repair_zip(&in_path, &out_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn run_benchmark(config: BenchConfig) -> Result<BenchReport, String> {
    bench::run(&config, &NoProgress).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            list_archive,
            get_archive_info,
            create_archive,
            extract_archive,
            test_archive,
            read_archive_entry,
            repair_archive,
            run_benchmark
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
