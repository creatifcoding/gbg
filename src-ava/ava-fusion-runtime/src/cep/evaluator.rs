//! Predicate expression compiler and evaluator for CEP cross-step predicates.
//!
//! Compiles predicate strings (e.g., `"step_0.speed < 1.0"`,
//! `"haversine(step_0.geo_lat, step_0.geo_lon, step_2.geo_lat, step_2.geo_lon) < 50000"`)
//! into an evaluable AST at pattern registration time.
//!
//! Five AST variants (from synthesis §6.3):
//!   - Field(step_idx, field_name) — references a matched event's field
//!   - Literal(f64) — numeric constant
//!   - BinOp(lhs, op, rhs) — arithmetic/comparison
//!   - FuncCall(name, args) — built-in functions (haversine, abs, min, max)
//!   - Not(inner) — logical negation

use super::shared_buffer::{EventRef, SharedBuffer};

// ---------------------------------------------------------------------------
// AST types
// ---------------------------------------------------------------------------

/// Binary operator.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Op {
    Add,
    Sub,
    Mul,
    Div,
    Lt,
    Le,
    Gt,
    Ge,
    Eq,
    Ne,
    And,
    Or,
}

/// Expression AST node.
#[derive(Debug, Clone)]
pub enum Expr {
    /// Reference to a matched event's field: step index + field name.
    Field(u32, String),
    /// Numeric literal.
    Literal(f64),
    /// Binary operation.
    BinOp(Box<Expr>, Op, Box<Expr>),
    /// Function call with arguments.
    FuncCall(String, Vec<Expr>),
    /// Logical negation.
    Not(Box<Expr>),
}

// ---------------------------------------------------------------------------
// MatchContext — evaluation environment
// ---------------------------------------------------------------------------

/// Evaluation context: the matched events for a partial/complete sequence.
pub struct MatchContext<'a> {
    /// References to matched events, indexed by step.
    pub matched_events: &'a [EventRef],
    /// The SharedBuffer containing event data.
    pub buffer: &'a SharedBuffer,
}

impl<'a> MatchContext<'a> {
    /// Look up a field from a matched step's event.
    pub fn field(&self, step: u32, field_name: &str) -> Option<f64> {
        let event_ref = self.matched_events.get(step as usize)?;
        let data = self.buffer.get(event_ref)?;
        data.field(field_name)
    }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

impl Expr {
    /// Evaluate this expression in the given match context.
    ///
    /// Returns `f64` — comparisons return 1.0 (true) or 0.0 (false).
    /// Returns `f64::NAN` if a field is missing or a function fails.
    pub fn eval(&self, ctx: &MatchContext<'_>) -> f64 {
        match self {
            Expr::Field(step, name) => ctx.field(*step, name).unwrap_or(f64::NAN),

            Expr::Literal(v) => *v,

            Expr::BinOp(lhs, op, rhs) => {
                let l = lhs.eval(ctx);
                let r = rhs.eval(ctx);
                match op {
                    Op::Add => l + r,
                    Op::Sub => l - r,
                    Op::Mul => l * r,
                    Op::Div => {
                        if r.abs() < 1e-30 {
                            f64::NAN
                        } else {
                            l / r
                        }
                    }
                    Op::Lt => bool_to_f64(l < r),
                    Op::Le => bool_to_f64(l <= r),
                    Op::Gt => bool_to_f64(l > r),
                    Op::Ge => bool_to_f64(l >= r),
                    Op::Eq => bool_to_f64((l - r).abs() < 1e-9),
                    Op::Ne => bool_to_f64((l - r).abs() >= 1e-9),
                    Op::And => bool_to_f64(is_truthy(l) && is_truthy(r)),
                    Op::Or => bool_to_f64(is_truthy(l) || is_truthy(r)),
                }
            }

            Expr::FuncCall(name, args) => {
                let vals: Vec<f64> = args.iter().map(|a| a.eval(ctx)).collect();
                eval_builtin(name, &vals)
            }

            Expr::Not(inner) => {
                let v = inner.eval(ctx);
                bool_to_f64(!is_truthy(v))
            }
        }
    }

    /// Evaluate as a boolean (truthy check).
    pub fn eval_bool(&self, ctx: &MatchContext<'_>) -> bool {
        is_truthy(self.eval(ctx))
    }

    /// Returns the highest step index referenced by this expression.
    /// Used for predicate pushdown — evaluate at earliest possible state.
    pub fn max_step_ref(&self) -> Option<u32> {
        match self {
            Expr::Field(step, _) => Some(*step),
            Expr::Literal(_) => None,
            Expr::BinOp(lhs, _, rhs) => match (lhs.max_step_ref(), rhs.max_step_ref()) {
                (Some(a), Some(b)) => Some(a.max(b)),
                (a, b) => a.or(b),
            },
            Expr::FuncCall(_, args) => args.iter().filter_map(|a| a.max_step_ref()).max(),
            Expr::Not(inner) => inner.max_step_ref(),
        }
    }
}

fn bool_to_f64(b: bool) -> f64 {
    if b {
        1.0
    } else {
        0.0
    }
}

fn is_truthy(v: f64) -> bool {
    v != 0.0 && !v.is_nan()
}

// ---------------------------------------------------------------------------
// Built-in functions
// ---------------------------------------------------------------------------

fn eval_builtin(name: &str, args: &[f64]) -> f64 {
    match name {
        "abs" if args.len() == 1 => args[0].abs(),
        "min" if args.len() == 2 => args[0].min(args[1]),
        "max" if args.len() == 2 => args[0].max(args[1]),
        "sqrt" if args.len() == 1 => args[0].sqrt(),
        "haversine" if args.len() == 4 => {
            // haversine(lat1, lon1, lat2, lon2) → distance in meters
            haversine_m(args[0], args[1], args[2], args[3])
        }
        _ => f64::NAN,
    }
}

/// Haversine distance between two lat/lon points in meters.
fn haversine_m(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const R: f64 = 6_371_000.0; // Earth radius in meters.
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let lat1_r = lat1.to_radians();
    let lat2_r = lat2.to_radians();
    let a = (d_lat / 2.0).sin().powi(2) + lat1_r.cos() * lat2_r.cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    R * c
}

// ---------------------------------------------------------------------------
// Simple predicate parser
// ---------------------------------------------------------------------------

/// Parse a simple predicate string into an Expr.
///
/// Supports a limited grammar sufficient for IIoT CEP predicates:
///   - `step_N.field_name` → Field(N, "field_name")
///   - `number` → Literal
///   - `lhs < rhs`, `lhs > rhs`, `lhs <= rhs`, `lhs >= rhs`, `lhs == rhs`, `lhs != rhs`
///   - `func(arg1, arg2, ...)` → FuncCall
///   - `!expr` → Not
///
/// This is intentionally simple. For production, use `evalexpr` or a proper
/// parser combinator. But for the CEP engine's needs this covers the common
/// cases without pulling in dependencies.
pub fn parse_predicate(input: &str) -> Result<Expr, String> {
    let tokens = tokenize(input)?;
    let (expr, rest) = parse_or(&tokens)?;
    if !rest.is_empty() {
        return Err(format!("Unexpected trailing tokens: {:?}", rest));
    }
    Ok(expr)
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
enum Token {
    Ident(String),
    Number(f64),
    Op(String),
    LParen,
    RParen,
    Comma,
    Not,
    Dot,
}

fn tokenize(input: &str) -> Result<Vec<Token>, String> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        match chars[i] {
            ' ' | '\t' | '\n' => {
                i += 1;
            }
            '(' => {
                tokens.push(Token::LParen);
                i += 1;
            }
            ')' => {
                tokens.push(Token::RParen);
                i += 1;
            }
            ',' => {
                tokens.push(Token::Comma);
                i += 1;
            }
            '!' if i + 1 < chars.len() && chars[i + 1] == '=' => {
                tokens.push(Token::Op("!=".into()));
                i += 2;
            }
            '!' => {
                tokens.push(Token::Not);
                i += 1;
            }
            '<' if i + 1 < chars.len() && chars[i + 1] == '=' => {
                tokens.push(Token::Op("<=".into()));
                i += 2;
            }
            '<' => {
                tokens.push(Token::Op("<".into()));
                i += 1;
            }
            '>' if i + 1 < chars.len() && chars[i + 1] == '=' => {
                tokens.push(Token::Op(">=".into()));
                i += 2;
            }
            '>' => {
                tokens.push(Token::Op(">".into()));
                i += 1;
            }
            '=' if i + 1 < chars.len() && chars[i + 1] == '=' => {
                tokens.push(Token::Op("==".into()));
                i += 2;
            }
            '+' => {
                tokens.push(Token::Op("+".into()));
                i += 1;
            }
            '-' if i + 1 < chars.len() && chars[i + 1].is_ascii_digit() && (tokens.is_empty() || matches!(tokens.last(), Some(Token::LParen) | Some(Token::Comma) | Some(Token::Op(_)))) => {
                // Negative number literal.
                let start = i;
                i += 1;
                while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.') {
                    i += 1;
                }
                let s: String = chars[start..i].iter().collect();
                tokens.push(Token::Number(
                    s.parse().map_err(|_| format!("Invalid number: {s}"))?,
                ));
            }
            '-' => {
                tokens.push(Token::Op("-".into()));
                i += 1;
            }
            '*' => {
                tokens.push(Token::Op("*".into()));
                i += 1;
            }
            '/' => {
                tokens.push(Token::Op("/".into()));
                i += 1;
            }
            '.' => {
                tokens.push(Token::Dot);
                i += 1;
            }
            '&' if i + 1 < chars.len() && chars[i + 1] == '&' => {
                tokens.push(Token::Op("&&".into()));
                i += 2;
            }
            '|' if i + 1 < chars.len() && chars[i + 1] == '|' => {
                tokens.push(Token::Op("||".into()));
                i += 2;
            }
            c if c.is_ascii_digit() => {
                let start = i;
                while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.') {
                    i += 1;
                }
                let s: String = chars[start..i].iter().collect();
                tokens.push(Token::Number(
                    s.parse().map_err(|_| format!("Invalid number: {s}"))?,
                ));
            }
            c if c.is_ascii_alphabetic() || c == '_' => {
                let start = i;
                while i < chars.len() && (chars[i].is_ascii_alphanumeric() || chars[i] == '_') {
                    i += 1;
                }
                let s: String = chars[start..i].iter().collect();
                tokens.push(Token::Ident(s));
            }
            c => return Err(format!("Unexpected character: '{c}'")),
        }
    }
    Ok(tokens)
}

// ---------------------------------------------------------------------------
// Recursive descent parser
// ---------------------------------------------------------------------------

type ParseResult<'a> = Result<(Expr, &'a [Token]), String>;

fn parse_or<'a>(tokens: &'a [Token]) -> ParseResult<'a> {
    let (mut left, mut rest) = parse_and(tokens)?;
    while let Some(Token::Op(op)) = rest.first() {
        if op == "||" {
            let (right, r) = parse_and(&rest[1..])?;
            left = Expr::BinOp(Box::new(left), Op::Or, Box::new(right));
            rest = r;
        } else {
            break;
        }
    }
    Ok((left, rest))
}

fn parse_and<'a>(tokens: &'a [Token]) -> ParseResult<'a> {
    let (mut left, mut rest) = parse_comparison(tokens)?;
    while let Some(Token::Op(op)) = rest.first() {
        if op == "&&" {
            let (right, r) = parse_comparison(&rest[1..])?;
            left = Expr::BinOp(Box::new(left), Op::And, Box::new(right));
            rest = r;
        } else {
            break;
        }
    }
    Ok((left, rest))
}

fn parse_comparison<'a>(tokens: &'a [Token]) -> ParseResult<'a> {
    let (left, rest) = parse_additive(tokens)?;
    if let Some(Token::Op(op)) = rest.first() {
        let bin_op = match op.as_str() {
            "<" => Some(Op::Lt),
            "<=" => Some(Op::Le),
            ">" => Some(Op::Gt),
            ">=" => Some(Op::Ge),
            "==" => Some(Op::Eq),
            "!=" => Some(Op::Ne),
            _ => None,
        };
        if let Some(bin_op) = bin_op {
            let (right, rest2) = parse_additive(&rest[1..])?;
            return Ok((Expr::BinOp(Box::new(left), bin_op, Box::new(right)), rest2));
        }
    }
    Ok((left, rest))
}

fn parse_additive<'a>(tokens: &'a [Token]) -> ParseResult<'a> {
    let (mut left, mut rest) = parse_multiplicative(tokens)?;
    while let Some(Token::Op(op)) = rest.first() {
        let bin_op = match op.as_str() {
            "+" => Some(Op::Add),
            "-" => Some(Op::Sub),
            _ => None,
        };
        if let Some(bin_op) = bin_op {
            let (right, r) = parse_multiplicative(&rest[1..])?;
            left = Expr::BinOp(Box::new(left), bin_op, Box::new(right));
            rest = r;
        } else {
            break;
        }
    }
    Ok((left, rest))
}

fn parse_multiplicative<'a>(tokens: &'a [Token]) -> ParseResult<'a> {
    let (mut left, mut rest) = parse_unary(tokens)?;
    while let Some(Token::Op(op)) = rest.first() {
        let bin_op = match op.as_str() {
            "*" => Some(Op::Mul),
            "/" => Some(Op::Div),
            _ => None,
        };
        if let Some(bin_op) = bin_op {
            let (right, r) = parse_unary(&rest[1..])?;
            left = Expr::BinOp(Box::new(left), bin_op, Box::new(right));
            rest = r;
        } else {
            break;
        }
    }
    Ok((left, rest))
}

fn parse_unary<'a>(tokens: &'a [Token]) -> ParseResult<'a> {
    if let Some(Token::Not) = tokens.first() {
        let (inner, rest) = parse_unary(&tokens[1..])?;
        return Ok((Expr::Not(Box::new(inner)), rest));
    }
    parse_primary(tokens)
}

fn parse_primary<'a>(tokens: &'a [Token]) -> ParseResult<'a> {
    match tokens.first() {
        Some(Token::Number(n)) => Ok((Expr::Literal(*n), &tokens[1..])),

        Some(Token::LParen) => {
            let (expr, rest) = parse_or(&tokens[1..])?;
            match rest.first() {
                Some(Token::RParen) => Ok((expr, &rest[1..])),
                _ => Err("Expected ')'".into()),
            }
        }

        Some(Token::Ident(name)) => {
            // Check for function call: name(args...)
            if tokens.len() > 1 && tokens[1] == Token::LParen {
                let func_name = name.clone();
                let mut rest = &tokens[2..];
                let mut args = Vec::new();

                if rest.first() != Some(&Token::RParen) {
                    let (arg, r) = parse_or(rest)?;
                    args.push(arg);
                    rest = r;
                    while rest.first() == Some(&Token::Comma) {
                        let (arg, r) = parse_or(&rest[1..])?;
                        args.push(arg);
                        rest = r;
                    }
                }

                match rest.first() {
                    Some(Token::RParen) => {
                        Ok((Expr::FuncCall(func_name, args), &rest[1..]))
                    }
                    _ => Err("Expected ')' after function arguments".into()),
                }
            }
            // Check for step_N.field pattern.
            else if name.starts_with("step_") && tokens.len() > 2 && tokens[1] == Token::Dot {
                let step_idx: u32 = name[5..]
                    .parse()
                    .map_err(|_| format!("Invalid step index in '{name}'"))?;
                match &tokens[2] {
                    Token::Ident(field) => Ok((Expr::Field(step_idx, field.clone()), &tokens[3..])),
                    _ => Err(format!("Expected field name after '{name}.'")),
                }
            }
            // Bare identifier — treat as field on step 0 (single-step predicate).
            else {
                Ok((Expr::Field(0, name.clone()), &tokens[1..]))
            }
        }

        _ => Err(format!("Unexpected token: {:?}", tokens.first())),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::shared_buffer::{EventData, SharedBuffer};

    fn make_ctx<'a>(
        buffer: &'a SharedBuffer,
        refs: &'a [EventRef],
    ) -> MatchContext<'a> {
        MatchContext {
            matched_events: refs,
            buffer,
        }
    }

    fn insert_event(buf: &mut SharedBuffer, fields: Vec<(&str, f64)>, ts: u64) -> EventRef {
        buf.insert(EventData {
            signal_kind: "test".into(),
            entity_id: "e1".into(),
            timestamp: ts,
            fields: fields.into_iter().map(|(k, v)| (k.into(), v)).collect(),
        })
    }

    #[test]
    fn literal_eval() {
        let buf = SharedBuffer::new();
        let ctx = make_ctx(&buf, &[]);
        let expr = Expr::Literal(42.0);
        assert!((expr.eval(&ctx) - 42.0).abs() < 1e-10);
    }

    #[test]
    fn field_lookup() {
        let mut buf = SharedBuffer::new();
        let r = insert_event(&mut buf, vec![("speed", 12.5)], 1000);
        let refs = [r];
        let ctx = make_ctx(&buf, &refs);
        let expr = Expr::Field(0, "speed".into());
        assert!((expr.eval(&ctx) - 12.5).abs() < 1e-10);
    }

    #[test]
    fn field_missing_returns_nan() {
        let mut buf = SharedBuffer::new();
        let r = insert_event(&mut buf, vec![("speed", 12.5)], 1000);
        let refs = [r];
        let ctx = make_ctx(&buf, &refs);
        let expr = Expr::Field(0, "nonexistent".into());
        assert!(expr.eval(&ctx).is_nan());
    }

    #[test]
    fn comparison_lt() {
        let mut buf = SharedBuffer::new();
        let r = insert_event(&mut buf, vec![("speed", 0.5)], 1000);
        let refs = [r];
        let ctx = make_ctx(&buf, &refs);
        let expr = Expr::BinOp(
            Box::new(Expr::Field(0, "speed".into())),
            Op::Lt,
            Box::new(Expr::Literal(1.0)),
        );
        assert!(expr.eval_bool(&ctx));
    }

    #[test]
    fn arithmetic_ops() {
        let buf = SharedBuffer::new();
        let ctx = make_ctx(&buf, &[]);
        // (3 + 4) * 2 = 14
        let expr = Expr::BinOp(
            Box::new(Expr::BinOp(
                Box::new(Expr::Literal(3.0)),
                Op::Add,
                Box::new(Expr::Literal(4.0)),
            )),
            Op::Mul,
            Box::new(Expr::Literal(2.0)),
        );
        assert!((expr.eval(&ctx) - 14.0).abs() < 1e-10);
    }

    #[test]
    fn func_call_abs() {
        let buf = SharedBuffer::new();
        let ctx = make_ctx(&buf, &[]);
        let expr = Expr::FuncCall("abs".into(), vec![Expr::Literal(-5.0)]);
        assert!((expr.eval(&ctx) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn func_call_haversine() {
        let buf = SharedBuffer::new();
        let ctx = make_ctx(&buf, &[]);
        // London (51.5074, -0.1278) to Paris (48.8566, 2.3522) ≈ 343 km
        let expr = Expr::FuncCall(
            "haversine".into(),
            vec![
                Expr::Literal(51.5074),
                Expr::Literal(-0.1278),
                Expr::Literal(48.8566),
                Expr::Literal(2.3522),
            ],
        );
        let dist = expr.eval(&ctx);
        assert!(
            dist > 340_000.0 && dist < 350_000.0,
            "London-Paris should be ~343km, got {}m",
            dist
        );
    }

    #[test]
    fn not_negation() {
        let buf = SharedBuffer::new();
        let ctx = make_ctx(&buf, &[]);
        let expr = Expr::Not(Box::new(Expr::Literal(0.0)));
        assert!(expr.eval_bool(&ctx)); // !false = true
        let expr2 = Expr::Not(Box::new(Expr::Literal(1.0)));
        assert!(!expr2.eval_bool(&ctx)); // !true = false
    }

    #[test]
    fn cross_step_field_access() {
        let mut buf = SharedBuffer::new();
        let r0 = insert_event(&mut buf, vec![("speed", 12.0)], 1000);
        let r1 = insert_event(&mut buf, vec![("speed", 0.3)], 2000);
        let refs = [r0, r1];
        let ctx = make_ctx(&buf, &refs);

        // step_0.speed > step_1.speed
        let expr = Expr::BinOp(
            Box::new(Expr::Field(0, "speed".into())),
            Op::Gt,
            Box::new(Expr::Field(1, "speed".into())),
        );
        assert!(expr.eval_bool(&ctx));
    }

    #[test]
    fn max_step_ref() {
        let expr = Expr::BinOp(
            Box::new(Expr::FuncCall(
                "haversine".into(),
                vec![
                    Expr::Field(0, "lat".into()),
                    Expr::Field(0, "lon".into()),
                    Expr::Field(2, "lat".into()),
                    Expr::Field(2, "lon".into()),
                ],
            )),
            Op::Lt,
            Box::new(Expr::Literal(50000.0)),
        );
        assert_eq!(expr.max_step_ref(), Some(2));
    }

    // -- Parser tests --

    #[test]
    fn parse_simple_comparison() {
        let expr = parse_predicate("speed < 1.0").unwrap();
        let mut buf = SharedBuffer::new();
        let r = insert_event(&mut buf, vec![("speed", 0.5)], 1000);
        let refs = [r];
        let ctx = make_ctx(&buf, &refs);
        assert!(expr.eval_bool(&ctx));
    }

    #[test]
    fn parse_step_field() {
        let expr = parse_predicate("step_0.speed < 1.0").unwrap();
        let mut buf = SharedBuffer::new();
        let r = insert_event(&mut buf, vec![("speed", 0.5)], 1000);
        let refs = [r];
        let ctx = make_ctx(&buf, &refs);
        assert!(expr.eval_bool(&ctx));
    }

    #[test]
    fn parse_cross_step() {
        let expr = parse_predicate("step_0.speed > step_1.speed").unwrap();
        let mut buf = SharedBuffer::new();
        let r0 = insert_event(&mut buf, vec![("speed", 10.0)], 1000);
        let r1 = insert_event(&mut buf, vec![("speed", 0.5)], 2000);
        let refs = [r0, r1];
        let ctx = make_ctx(&buf, &refs);
        assert!(expr.eval_bool(&ctx));
    }

    #[test]
    fn parse_function_call() {
        let expr = parse_predicate("abs(step_0.delta) < 5.0").unwrap();
        let mut buf = SharedBuffer::new();
        let r = insert_event(&mut buf, vec![("delta", -3.0)], 1000);
        let refs = [r];
        let ctx = make_ctx(&buf, &refs);
        assert!(expr.eval_bool(&ctx));
    }

    #[test]
    fn parse_haversine_predicate() {
        let expr = parse_predicate(
            "haversine(step_0.lat, step_0.lon, step_2.lat, step_2.lon) < 50000",
        )
        .unwrap();
        assert_eq!(expr.max_step_ref(), Some(2));
    }

    #[test]
    fn parse_negation() {
        let expr = parse_predicate("!(speed > 10.0)").unwrap();
        let mut buf = SharedBuffer::new();
        let r = insert_event(&mut buf, vec![("speed", 5.0)], 1000);
        let refs = [r];
        let ctx = make_ctx(&buf, &refs);
        assert!(expr.eval_bool(&ctx)); // speed=5, !(5>10) = true
    }

    #[test]
    fn parse_logical_and() {
        let expr = parse_predicate("speed > 0.0 && speed < 10.0").unwrap();
        let mut buf = SharedBuffer::new();
        let r = insert_event(&mut buf, vec![("speed", 5.0)], 1000);
        let refs = [r];
        let ctx = make_ctx(&buf, &refs);
        assert!(expr.eval_bool(&ctx));
    }

    #[test]
    fn parse_arithmetic() {
        let expr = parse_predicate("step_0.a + step_0.b > 10.0").unwrap();
        let mut buf = SharedBuffer::new();
        let r = insert_event(&mut buf, vec![("a", 7.0), ("b", 5.0)], 1000);
        let refs = [r];
        let ctx = make_ctx(&buf, &refs);
        assert!(expr.eval_bool(&ctx)); // 7+5=12 > 10
    }

    #[test]
    fn parse_nested_parens() {
        let expr = parse_predicate("(speed + 1.0) * 2.0 > 10.0").unwrap();
        let mut buf = SharedBuffer::new();
        let r = insert_event(&mut buf, vec![("speed", 5.0)], 1000);
        let refs = [r];
        let ctx = make_ctx(&buf, &refs);
        assert!(expr.eval_bool(&ctx)); // (5+1)*2=12 > 10
    }
}
