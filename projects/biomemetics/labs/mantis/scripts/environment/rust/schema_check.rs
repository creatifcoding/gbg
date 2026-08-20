//! Zero-dependency checker for the shared environment JSON Schema fixtures.
//!
//! This is not a general Draft 2020-12 implementation. It reads the committed
//! schema fixture, asserts the locked rules, and applies them to the positive
//! and negative instances so Rust participates in the same workflow as Python
//! and TypeScript.

use std::env;
use std::fs;
use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<String> = env::args().collect();
    if args.len() != 4 {
        eprintln!("usage: schema_check SCHEMA POSITIVE NEGATIVE");
        return ExitCode::from(64);
    }
    let schema = match fs::read_to_string(&args[1]) {
        Ok(text) => text,
        Err(err) => {
            eprintln!("schema: {err}");
            return ExitCode::from(1);
        }
    };
    if !schema.contains("environment-fixture")
        || !schema.contains("\"additionalProperties\": false")
        || !schema.contains("\"minimum\": 0")
    {
        eprintln!("schema fixture does not declare the locked environment-fixture rules");
        return ExitCode::from(1);
    }

    let positive = match load_instance(&args[2]) {
        Ok(value) => value,
        Err(err) => {
            eprintln!("positive: {err}");
            return ExitCode::from(1);
        }
    };
    let negative = match load_instance(&args[3]) {
        Ok(value) => value,
        Err(err) => {
            eprintln!("negative: {err}");
            return ExitCode::from(1);
        }
    };

    if let Err(err) = validate(&positive) {
        eprintln!("positive fixture must validate: {err}");
        return ExitCode::from(1);
    }
    if validate(&negative).is_ok() {
        eprintln!("negative fixture must not validate");
        return ExitCode::from(1);
    }
    println!("rust schema_check: positive ok, negative rejected");
    ExitCode::SUCCESS
}

#[derive(Debug)]
#[allow(dead_code)]
enum Json {
    Null,
    Bool(bool),
    Number(i64),
    String(String),
    Array(Vec<Json>),
    Object(Vec<(String, Json)>),
}

fn load_instance(path: &str) -> Result<Json, String> {
    let text = fs::read_to_string(path).map_err(|err| err.to_string())?;
    parse_json(&text)
}

fn validate(value: &Json) -> Result<(), String> {
    let Json::Object(fields) = value else {
        return Err("instance must be an object".into());
    };
    let mut kind = None;
    let mut number = None;
    for (key, item) in fields {
        match key.as_str() {
            "kind" => kind = Some(item),
            "value" => number = Some(item),
            other => return Err(format!("additional property: {other}")),
        }
    }
    match kind {
        Some(Json::String(text)) if text == "environment-fixture" => {}
        _ => return Err("kind must be the const environment-fixture".into()),
    }
    match number {
        Some(Json::Number(value)) if *value >= 0 => Ok(()),
        Some(Json::Number(_)) => Err("value must be >= 0".into()),
        _ => Err("value must be an integer".into()),
    }
}

struct Parser<'a> {
    input: &'a [u8],
    pos: usize,
}

fn parse_json(input: &str) -> Result<Json, String> {
    let mut parser = Parser {
        input: input.as_bytes(),
        pos: 0,
    };
    let value = parser.parse_value()?;
    parser.skip_ws();
    if parser.pos != parser.input.len() {
        return Err("trailing data".into());
    }
    Ok(value)
}

impl<'a> Parser<'a> {
    fn peek(&self) -> Option<u8> {
        self.input.get(self.pos).copied()
    }

    fn bump(&mut self) -> Option<u8> {
        let byte = self.peek()?;
        self.pos += 1;
        Some(byte)
    }

    fn skip_ws(&mut self) {
        while matches!(self.peek(), Some(b' ' | b'\n' | b'\r' | b'\t')) {
            self.pos += 1;
        }
    }

    fn parse_value(&mut self) -> Result<Json, String> {
        self.skip_ws();
        match self.peek() {
            Some(b'{') => self.parse_object(),
            Some(b'[') => self.parse_array(),
            Some(b'"') => Ok(Json::String(self.parse_string()?)),
            Some(b't') => self.parse_ident(b"true", Json::Bool(true)),
            Some(b'f') => self.parse_ident(b"false", Json::Bool(false)),
            Some(b'n') => self.parse_ident(b"null", Json::Null),
            Some(b'-') | Some(b'0'..=b'9') => self.parse_number(),
            Some(byte) => Err(format!("unexpected {}", byte as char)),
            None => Err("unexpected end".into()),
        }
    }

    fn parse_ident(&mut self, expected: &[u8], value: Json) -> Result<Json, String> {
        if self.input.get(self.pos..self.pos + expected.len()) != Some(expected) {
            return Err(format!("expected {}", String::from_utf8_lossy(expected)));
        }
        self.pos += expected.len();
        Ok(value)
    }

    fn parse_number(&mut self) -> Result<Json, String> {
        let start = self.pos;
        if self.peek() == Some(b'-') {
            self.pos += 1;
        }
        while matches!(self.peek(), Some(b'0'..=b'9')) {
            self.pos += 1;
        }
        if matches!(self.peek(), Some(b'.' | b'e' | b'E')) {
            return Err("environment fixtures use integers only".into());
        }
        let text = std::str::from_utf8(&self.input[start..self.pos]).map_err(|err| err.to_string())?;
        text.parse::<i64>()
            .map(Json::Number)
            .map_err(|err| err.to_string())
    }

    fn parse_string(&mut self) -> Result<String, String> {
        self.bump();
        let mut text = String::new();
        loop {
            match self.bump() {
                Some(b'"') => return Ok(text),
                Some(b'\\') => match self.bump() {
                    Some(byte) => text.push(byte as char),
                    None => return Err("unterminated escape".into()),
                },
                Some(byte) => text.push(byte as char),
                None => return Err("unterminated string".into()),
            }
        }
    }

    fn parse_array(&mut self) -> Result<Json, String> {
        self.bump();
        self.skip_ws();
        let mut items = Vec::new();
        if self.peek() == Some(b']') {
            self.bump();
            return Ok(Json::Array(items));
        }
        loop {
            items.push(self.parse_value()?);
            self.skip_ws();
            match self.bump() {
                Some(b',') => continue,
                Some(b']') => return Ok(Json::Array(items)),
                _ => return Err("expected comma or ]".into()),
            }
        }
    }

    fn parse_object(&mut self) -> Result<Json, String> {
        self.bump();
        self.skip_ws();
        let mut fields = Vec::new();
        if self.peek() == Some(b'}') {
            self.bump();
            return Ok(Json::Object(fields));
        }
        loop {
            self.skip_ws();
            if self.peek() != Some(b'"') {
                return Err("expected string key".into());
            }
            let key = self.parse_string()?;
            self.skip_ws();
            if self.bump() != Some(b':') {
                return Err("expected colon".into());
            }
            let value = self.parse_value()?;
            fields.push((key, value));
            self.skip_ws();
            match self.bump() {
                Some(b',') => continue,
                Some(b'}') => return Ok(Json::Object(fields)),
                _ => return Err("expected comma or }".into()),
            }
        }
    }
}
