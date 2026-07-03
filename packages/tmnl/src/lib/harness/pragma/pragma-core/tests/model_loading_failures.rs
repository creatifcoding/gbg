//! T2: Model loading failure mode tests — never panics, always returns safely.

use pragma_core::loader::ModelRegistry;
use pragma_core::models::ModelId;

#[test]
#[serial_test::serial]
fn loading_from_nonexistent_dir_returns_not_ready() {
    std::env::set_var("PRAGMA_MODELS_DIR", "/tmp/pragma-nonexistent-dir-xyz");
    let registry = ModelRegistry::load_all();
    std::env::remove_var("PRAGMA_MODELS_DIR");
    assert!(!registry.is_ready());
}

#[test]
#[serial_test::serial]
fn warmup_response_when_no_models() {
    std::env::set_var("PRAGMA_MODELS_DIR", "/tmp/pragma-nonexistent-dir-abc");
    let registry = ModelRegistry::load_all();
    std::env::remove_var("PRAGMA_MODELS_DIR");
    let response = registry.warmup_response(0);
    assert!(!response.ready);
}

#[test]
#[serial_test::serial]
fn degradation_warnings_when_missing() {
    std::env::set_var("PRAGMA_MODELS_DIR", "/tmp/pragma-nonexistent-dir-def");
    let registry = ModelRegistry::load_all();
    std::env::remove_var("PRAGMA_MODELS_DIR");
    let warnings = registry.degradation_warnings();
    assert!(!warnings.is_empty());
}

#[test]
fn model_dir_returns_path_for_all_ids() {
    for id in ModelId::all() {
        let path = pragma_core::models::model_dir(*id);
        assert!(!path.as_os_str().is_empty());
    }
}
