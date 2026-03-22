use eframe::egui;
use eframe::wasm_bindgen::{self, prelude::*};
use js_sys::Function;
use serde::{Deserialize, Serialize};
use std::any::Any;
use std::sync::Arc;
use web_sys::HtmlCanvasElement;

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "_tag")]
enum EguiCommand {
    Increment,
    Reset,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "_tag")]
enum EguiEvent {
    CounterChanged { value: u32 },
}

struct TmnlEguiApp {
    counter: u32,
    events: Vec<EguiEvent>,
    event_callback: Option<Function>,
    egui_ctx: Option<egui::Context>,
}

impl TmnlEguiApp {
    fn new(cc: &eframe::CreationContext<'_>) -> Self {
        apply_tmnl_theme(&cc.egui_ctx);
        Self {
            counter: 0,
            events: Vec::new(),
            event_callback: None,
            egui_ctx: None,
        }
    }

    fn push_event(&mut self, event: EguiEvent) {
        let payload = vec![event.clone()];
        self.events.push(event);
        if let Some(callback) = &self.event_callback {
            if let Ok(value) = serde_wasm_bindgen::to_value(&payload) {
                let _ = callback.call1(&wasm_bindgen::JsValue::NULL, &value);
            }
        }
    }

    fn emit_counter_changed(&mut self) {
        self.push_event(EguiEvent::CounterChanged {
            value: self.counter,
        });
    }

    fn handle_command(&mut self, command: EguiCommand) {
        match command {
            EguiCommand::Increment => {
                self.counter = self.counter.saturating_add(1);
                self.emit_counter_changed();
            }
            EguiCommand::Reset => {
                self.counter = 0;
                self.emit_counter_changed();
            }
        }
        if let Some(ctx) = &self.egui_ctx {
            ctx.request_repaint();
        }
    }

    fn drain_events(&mut self) -> Vec<EguiEvent> {
        std::mem::take(&mut self.events)
    }
}

impl eframe::App for TmnlEguiApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.egui_ctx = Some(ctx.clone());
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("TMNL · egui wasm");
            ui.label("Immediate-mode UI running inside MorphCard canvas.");
            if ui.button("Increment").clicked() {
                self.handle_command(EguiCommand::Increment);
            }
            if ui.button("Reset").clicked() {
                self.handle_command(EguiCommand::Reset);
            }
            ui.label(format!("Counter: {}", self.counter));
        });
    }

    fn as_any_mut(&mut self) -> Option<&mut dyn Any> {
        Some(self)
    }
}

fn apply_tmnl_theme(ctx: &egui::Context) {
    let mut fonts = egui::FontDefinitions::default();
    fonts.font_data.insert(
        "tmnl-space-grotesk".to_owned(),
        Arc::new(egui::FontData::from_static(include_bytes!(
            "../../../assets/data/fonts/Space_Grotesk/SpaceGrotesk-VariableFont_wght.ttf"
        ))),
    );
    fonts.font_data.insert(
        "tmnl-share-tech-mono".to_owned(),
        Arc::new(egui::FontData::from_static(include_bytes!(
            "../../../assets/data/fonts/Share_Tech_Mono/ShareTechMono-Regular.ttf"
        ))),
    );
    if let Some(family) = fonts.families.get_mut(&egui::FontFamily::Proportional) {
        family.insert(0, "tmnl-space-grotesk".to_owned());
    }
    if let Some(family) = fonts.families.get_mut(&egui::FontFamily::Monospace) {
        family.insert(0, "tmnl-share-tech-mono".to_owned());
    }
    ctx.set_fonts(fonts);

    ctx.set_theme(egui::Theme::Dark);
    let mut visuals = egui::Visuals::dark();
    visuals.panel_fill = egui::Color32::from_rgb(10, 10, 10);
    visuals.window_fill = egui::Color32::from_rgb(8, 8, 8);
    visuals.faint_bg_color = egui::Color32::from_rgb(16, 16, 16);
    visuals.extreme_bg_color = egui::Color32::from_rgb(0, 0, 0);
    visuals.widgets.noninteractive.bg_fill = egui::Color32::from_rgb(10, 10, 10);
    visuals.widgets.noninteractive.bg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(26, 26, 26));
    visuals.widgets.inactive.bg_fill = egui::Color32::from_rgb(12, 12, 12);
    visuals.widgets.inactive.bg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(32, 32, 32));
    visuals.widgets.hovered.bg_fill = egui::Color32::from_rgb(20, 20, 20);
    visuals.widgets.hovered.bg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(70, 70, 70));
    visuals.widgets.active.bg_fill = egui::Color32::from_rgb(24, 24, 24);
    visuals.widgets.active.bg_stroke =
        egui::Stroke::new(1.0, egui::Color32::from_rgb(220, 220, 220));
    visuals.selection.bg_fill = egui::Color32::from_rgba_premultiplied(59, 130, 246, 80);
    visuals.selection.stroke = egui::Stroke::new(1.0, egui::Color32::from_rgb(59, 130, 246));
    visuals.hyperlink_color = egui::Color32::from_rgb(59, 130, 246);
    visuals.override_text_color = Some(egui::Color32::from_rgb(220, 220, 220));
    ctx.set_visuals(visuals);

    ctx.all_styles_mut(|style| {
        use egui::{FontFamily, FontId, TextStyle};
        let mut text_styles = std::collections::BTreeMap::new();
        text_styles.insert(TextStyle::Heading, FontId::new(18.0, FontFamily::Proportional));
        text_styles.insert(TextStyle::Body, FontId::new(16.0, FontFamily::Proportional));
        text_styles.insert(TextStyle::Button, FontId::new(14.0, FontFamily::Proportional));
        text_styles.insert(TextStyle::Monospace, FontId::new(14.0, FontFamily::Monospace));
        text_styles.insert(TextStyle::Small, FontId::new(12.0, FontFamily::Proportional));
        style.text_styles = text_styles;
        style.spacing.item_spacing = egui::vec2(10.0, 8.0);
        style.spacing.button_padding = egui::vec2(10.0, 6.0);
    });
}

#[wasm_bindgen]
pub struct WebHandle {
    runner: eframe::WebRunner,
}

#[wasm_bindgen]
impl WebHandle {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_error_panic_hook::set_once();
        let _ = eframe::WebLogger::init(log::LevelFilter::Debug);
        Self {
            runner: eframe::WebRunner::new(),
        }
    }

    #[wasm_bindgen]
    pub async fn start(&self, canvas: HtmlCanvasElement) -> Result<(), wasm_bindgen::JsValue> {
        self.runner
            .start(
                canvas,
                eframe::WebOptions::default(),
                Box::new(|cc| Ok(Box::new(TmnlEguiApp::new(cc)))),
            )
            .await
    }

    #[wasm_bindgen]
    pub fn send_command(&self, command: wasm_bindgen::JsValue) -> Result<(), wasm_bindgen::JsValue> {
        let parsed: EguiCommand = serde_wasm_bindgen::from_value(command)?;
        if let Some(mut app) = self.runner.app_mut::<TmnlEguiApp>() {
            app.handle_command(parsed);
            return Ok(());
        }
        Err(wasm_bindgen::JsValue::from_str(
            "egui app not available (runner panicked?)",
        ))
    }

    #[wasm_bindgen]
    pub fn drain_events(&self) -> Result<wasm_bindgen::JsValue, wasm_bindgen::JsValue> {
        if let Some(mut app) = self.runner.app_mut::<TmnlEguiApp>() {
            let events = app.drain_events();
            return serde_wasm_bindgen::to_value(&events).map_err(|err| err.into());
        }
        Ok(wasm_bindgen::JsValue::NULL)
    }

    #[wasm_bindgen]
    pub fn set_event_callback(&self, callback: Function) -> Result<(), wasm_bindgen::JsValue> {
        if let Some(mut app) = self.runner.app_mut::<TmnlEguiApp>() {
            app.event_callback = Some(callback);
            return Ok(());
        }
        Err(wasm_bindgen::JsValue::from_str(
            "egui app not available (runner panicked?)",
        ))
    }

    #[wasm_bindgen]
    pub fn clear_event_callback(&self) {
        if let Some(mut app) = self.runner.app_mut::<TmnlEguiApp>() {
            app.event_callback = None;
        }
    }

    #[wasm_bindgen]
    pub fn destroy(&self) {
        self.runner.destroy();
    }

    #[wasm_bindgen]
    pub fn has_panicked(&self) -> bool {
        self.runner.has_panicked()
    }
}
