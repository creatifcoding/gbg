//! Handler trait and implementations.
//!
//! Handlers are functions that take extractors as parameters and return
//! a type implementing [`IntoResponse`]. Both synchronous and asynchronous
//! handlers are supported.
//!
//! Handler wrappers are generated via macros for arities 0 through 8.
//! For N > 0 extractors, extractors T1..T(N-1) implement [`FromRequestParts`]
//! (non-consuming), and TN implements [`FromRequest`] (may consume the body).

use std::future::Future;
use std::pin::Pin;

use crate::extractor::{FromRequest, FromRequestParts, Request};
use crate::response::{IntoResponse, Response};

// ── Handler Trait ───────────────────────────────────────────────────────────

/// A request handler.
///
/// Implemented for sync fns (via `FnHandler`) and async fns (via `AsyncFnHandler`).
/// The router stores handlers as `Box<dyn ErasedHandler>`.
pub trait Handler: Send + Sync + 'static {
    /// Handle a request, producing a response.
    fn call(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>>;
}

/// Type-erased handler for storage in the router.
pub(crate) trait ErasedHandler: Send + Sync {
    fn call_erased(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>>;
}

impl<H: Handler> ErasedHandler for H {
    fn call_erased(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        self.call(req)
    }
}

// ── Macro: Sync Handler (arity 0) ──────────────────────────────────────────

/// Wrapper for a sync function with 0 extractors.
pub struct FnHandler<F>(pub F);

impl<F> FnHandler<F> {
    pub fn new(func: F) -> Self {
        Self(func)
    }
}

impl<F, Res> Handler for FnHandler<F>
where
    F: Fn() -> Res + Send + Sync + 'static,
    Res: IntoResponse,
{
    fn call(&self, _req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        let resp = (self.0)().into_response();
        Box::pin(async move { resp })
    }
}

// ── Macro: Async Handler (arity 0) ─────────────────────────────────────────

/// Wrapper for an async function with 0 extractors.
pub struct AsyncFnHandler<F>(pub F);

impl<F> AsyncFnHandler<F> {
    pub fn new(func: F) -> Self {
        Self(func)
    }
}

impl<F, Fut, Res> Handler for AsyncFnHandler<F>
where
    F: Fn() -> Fut + Send + Sync + 'static,
    Fut: Future<Output = Res> + Send + 'static,
    Res: IntoResponse,
{
    fn call(&self, _req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        Box::pin(async move { (self.0)().await.into_response() })
    }
}

// ── Macro: Sync Handler (arity 1 — single FromRequest) ────────────────────

/// Generate a sync handler wrapper for arity 1.
///
/// With a single extractor, T1 uses `FromRequest` (may consume body).
macro_rules! impl_sync_handler_1 {
    ($name:ident, $t1:ident) => {
        pub struct $name<F, $t1>(pub F, std::marker::PhantomData<$t1>);

        impl<F, $t1> $name<F, $t1> {
            pub fn new(func: F) -> Self {
                Self(func, std::marker::PhantomData)
            }
        }

        impl<F, $t1, Res> Handler for $name<F, $t1>
        where
            F: Fn($t1) -> Res + Send + Sync + 'static,
            $t1: FromRequest + Send + Sync + 'static,
            Res: IntoResponse,
        {
            fn call(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
                let resp = match $t1::from_request(req) {
                    Ok(t1) => (self.0)(t1).into_response(),
                    Err(e) => e.into_response(),
                };
                Box::pin(async move { resp })
            }
        }
    };
}

impl_sync_handler_1!(FnHandler1, T1);

// ── Macro: Async Handler (arity 1 — single FromRequest) ───────────────────

macro_rules! impl_async_handler_1 {
    ($name:ident, $t1:ident) => {
        pub struct $name<F, $t1>(pub F, std::marker::PhantomData<$t1>);

        impl<F, $t1> $name<F, $t1> {
            pub fn new(func: F) -> Self {
                Self(func, std::marker::PhantomData)
            }
        }

        impl<F, Fut, $t1, Res> Handler for $name<F, $t1>
        where
            F: Fn($t1) -> Fut + Send + Sync + 'static,
            Fut: Future<Output = Res> + Send + 'static,
            $t1: FromRequest + Send + Sync + 'static,
            Res: IntoResponse,
        {
            fn call(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
                match $t1::from_request(req) {
                    Ok(t1) => Box::pin(async move { (self.0)(t1).await.into_response() }),
                    Err(e) => Box::pin(async move { e.into_response() }),
                }
            }
        }
    };
}

impl_async_handler_1!(AsyncFnHandler1, T1);

// ── Macro: Sync Handler (arity N >= 2) ────────────────────────────────────
//
// For N extractors where N >= 2:
//   - T1..T(N-1) use FromRequestParts (non-consuming, borrow &req)
//   - TN uses FromRequest (consuming, takes req by value)

macro_rules! impl_sync_handler_n {
    ($name:ident, [$($parts:ident),+], $last:ident) => {
        pub struct $name<F, $($parts,)+ $last>(
            pub F,
            std::marker::PhantomData<($($parts,)+ $last)>,
        );

        impl<F, $($parts,)+ $last> $name<F, $($parts,)+ $last> {
            pub fn new(func: F) -> Self {
                Self(func, std::marker::PhantomData)
            }
        }

        impl<F, $($parts,)+ $last, Res> Handler for $name<F, $($parts,)+ $last>
        where
            F: Fn($($parts,)+ $last) -> Res + Send + Sync + 'static,
            $($parts: FromRequestParts + Send + Sync + 'static,)+
            $last: FromRequest + Send + Sync + 'static,
            Res: IntoResponse,
        {
            #[allow(non_snake_case)]
            fn call(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
                $(
                    let $parts = match $parts::from_request_parts(&req) {
                        Ok(v) => v,
                        Err(e) => return Box::pin(async move { e.into_response() }),
                    };
                )+
                let $last = match $last::from_request(req) {
                    Ok(v) => v,
                    Err(e) => return Box::pin(async move { e.into_response() }),
                };
                let resp = (self.0)($($parts,)+ $last).into_response();
                Box::pin(async move { resp })
            }
        }
    };
}

// ── Macro: Async Handler (arity N >= 2) ───────────────────────────────────

macro_rules! impl_async_handler_n {
    ($name:ident, [$($parts:ident),+], $last:ident) => {
        pub struct $name<F, $($parts,)+ $last>(
            pub F,
            std::marker::PhantomData<($($parts,)+ $last)>,
        );

        impl<F, $($parts,)+ $last> $name<F, $($parts,)+ $last> {
            pub fn new(func: F) -> Self {
                Self(func, std::marker::PhantomData)
            }
        }

        impl<F, Fut, $($parts,)+ $last, Res> Handler for $name<F, $($parts,)+ $last>
        where
            F: Fn($($parts,)+ $last) -> Fut + Send + Sync + 'static,
            Fut: Future<Output = Res> + Send + 'static,
            $($parts: FromRequestParts + Send + Sync + 'static,)+
            $last: FromRequest + Send + Sync + 'static,
            Res: IntoResponse,
        {
            #[allow(non_snake_case)]
            fn call(&self, req: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
                $(
                    let $parts = match $parts::from_request_parts(&req) {
                        Ok(v) => v,
                        Err(e) => return Box::pin(async move { e.into_response() }),
                    };
                )+
                let $last = match $last::from_request(req) {
                    Ok(v) => v,
                    Err(e) => return Box::pin(async move { e.into_response() }),
                };
                Box::pin(async move { (self.0)($($parts,)+ $last).await.into_response() })
            }
        }
    };
}

// ── Generate arities 2..8 ─────────────────────────────────────────────────

impl_sync_handler_n!(FnHandler2, [T1], T2);
impl_sync_handler_n!(FnHandler3, [T1, T2], T3);
impl_sync_handler_n!(FnHandler4, [T1, T2, T3], T4);
impl_sync_handler_n!(FnHandler5, [T1, T2, T3, T4], T5);
impl_sync_handler_n!(FnHandler6, [T1, T2, T3, T4, T5], T6);
impl_sync_handler_n!(FnHandler7, [T1, T2, T3, T4, T5, T6], T7);
impl_sync_handler_n!(FnHandler8, [T1, T2, T3, T4, T5, T6, T7], T8);

impl_async_handler_n!(AsyncFnHandler2, [T1], T2);
impl_async_handler_n!(AsyncFnHandler3, [T1, T2], T3);
impl_async_handler_n!(AsyncFnHandler4, [T1, T2, T3], T4);
impl_async_handler_n!(AsyncFnHandler5, [T1, T2, T3, T4], T5);
impl_async_handler_n!(AsyncFnHandler6, [T1, T2, T3, T4, T5], T6);
impl_async_handler_n!(AsyncFnHandler7, [T1, T2, T3, T4, T5, T6], T7);
impl_async_handler_n!(AsyncFnHandler8, [T1, T2, T3, T4, T5, T6, T7], T8);

// ── Convenience Free Functions ────────────────────────────────────────────

/// Wrap a sync function with 0 extractors into a [`Handler`].
pub fn handler<F, Res>(f: F) -> FnHandler<F>
where
    F: Fn() -> Res + Send + Sync + 'static,
    Res: IntoResponse,
{
    FnHandler::new(f)
}

/// Wrap an async function with 0 extractors into a [`Handler`].
pub fn async_handler<F, Fut, Res>(f: F) -> AsyncFnHandler<F>
where
    F: Fn() -> Fut + Send + Sync + 'static,
    Fut: Future<Output = Res> + Send + 'static,
    Res: IntoResponse,
{
    AsyncFnHandler::new(f)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::extractor::{Path, Query, State};
    use crate::response::StatusCode;
    use std::collections::HashMap;
    use std::future::Future;
    use std::pin::Pin;
    use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

    /// Minimal single-poll executor for futures that complete immediately.
    fn block_on<F: Future>(mut fut: F) -> F::Output {
        fn noop(_: *const ()) {}
        fn noop_clone(_: *const ()) -> RawWaker {
            RawWaker::new(std::ptr::null(), &VTABLE)
        }
        static VTABLE: RawWakerVTable =
            RawWakerVTable::new(noop_clone, noop, noop, noop);
        let waker = unsafe { Waker::from_raw(RawWaker::new(std::ptr::null(), &VTABLE)) };
        let mut cx = Context::from_waker(&waker);
        let pinned = unsafe { Pin::new_unchecked(&mut fut) };
        match pinned.poll(&mut cx) {
            Poll::Ready(val) => val,
            Poll::Pending => panic!("block_on: future returned Pending"),
        }
    }

    // ── Existing tests (must remain green) ────────────────────────────────

    #[test]
    fn sync_handler_no_extractors() {
        fn index() -> &'static str { "hello" }
        let handler = FnHandler::new(index);
        let req = Request::new("GET", "/");
        let resp = block_on(handler.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "hello");
    }

    #[test]
    fn sync_handler_one_extractor() {
        fn get_user(Path(id): Path<String>) -> String {
            format!("user:{id}")
        }
        let handler = FnHandler1::<_, Path<String>>::new(get_user);
        let mut params = HashMap::new();
        params.insert("id".to_string(), "42".to_string());
        let req = Request::new("GET", "/users/42").with_path_params(params);
        let resp = block_on(handler.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "user:42");
    }

    // ── Sync handler arities 2-8 ─────────────────────────────────────────

    #[test]
    fn sync_handler_two_extractors() {
        fn two_ext(Path(id): Path<String>, Query(q): Query<HashMap<String, String>>) -> String {
            format!("id={id},page={}", q.get("page").unwrap_or(&"?".into()))
        }
        let handler = FnHandler2::<_, Path<String>, Query<HashMap<String, String>>>::new(two_ext);
        let mut params = HashMap::new();
        params.insert("id".to_string(), "7".to_string());
        let req = Request::new("GET", "/items/7")
            .with_path_params(params)
            .with_query("page=3");
        let resp = block_on(handler.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "id=7,page=3");
    }

    #[test]
    fn sync_handler_three_extractors() {
        #[derive(Debug, Clone)]
        struct AppCfg { name: String }

        fn three_ext(
            Path(id): Path<String>,
            State(cfg): State<AppCfg>,
            Query(q): Query<HashMap<String, String>>,
        ) -> String {
            format!("app={},id={id},sort={}", cfg.name, q.get("sort").unwrap_or(&"?".into()))
        }
        let handler = FnHandler3::<_, Path<String>, State<AppCfg>, Query<HashMap<String, String>>>::new(three_ext);
        let mut params = HashMap::new();
        params.insert("id".to_string(), "99".to_string());
        let mut req = Request::new("GET", "/x/99").with_path_params(params).with_query("sort=name");
        req.extensions.insert(AppCfg { name: "test".into() });
        let resp = block_on(handler.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "app=test,id=99,sort=name");
    }

    #[test]
    fn sync_handler_four_extractors() {
        #[derive(Debug, Clone)]
        struct Ctx1(String);
        #[derive(Debug, Clone)]
        struct Ctx2(String);

        impl crate::extractor::FromRequestParts for Ctx1 {
            fn from_request_parts(req: &Request) -> Result<Self, crate::extractor::ExtractionError> {
                Ok(Ctx1(req.method.as_str().to_string()))
            }
        }
        impl crate::extractor::FromRequestParts for Ctx2 {
            fn from_request_parts(req: &Request) -> Result<Self, crate::extractor::ExtractionError> {
                Ok(Ctx2(req.path.clone()))
            }
        }

        fn four_ext(
            Path(id): Path<String>,
            c1: Ctx1,
            c2: Ctx2,
            Query(q): Query<HashMap<String, String>>,
        ) -> String {
            format!("{},{},{id},{}", c1.0, c2.0, q.get("k").unwrap_or(&"?".into()))
        }
        let handler = FnHandler4::<_, Path<String>, Ctx1, Ctx2, Query<HashMap<String, String>>>::new(four_ext);
        let mut params = HashMap::new();
        params.insert("id".to_string(), "4".to_string());
        let req = Request::new("POST", "/a/4").with_path_params(params).with_query("k=v");
        let resp = block_on(handler.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "POST,/a/4,4,v");
    }

    #[test]
    fn sync_handler_five_extractors() {
        // Use 5 extractors (4 FromRequestParts + 1 FromRequest)
        #[derive(Debug, Clone)]
        struct E1(String);
        #[derive(Debug, Clone)]
        struct E2(String);
        #[derive(Debug, Clone)]
        struct E3(String);

        impl crate::extractor::FromRequestParts for E1 {
            fn from_request_parts(_req: &Request) -> Result<Self, crate::extractor::ExtractionError> {
                Ok(E1("e1".into()))
            }
        }
        impl crate::extractor::FromRequestParts for E2 {
            fn from_request_parts(_req: &Request) -> Result<Self, crate::extractor::ExtractionError> {
                Ok(E2("e2".into()))
            }
        }
        impl crate::extractor::FromRequestParts for E3 {
            fn from_request_parts(_req: &Request) -> Result<Self, crate::extractor::ExtractionError> {
                Ok(E3("e3".into()))
            }
        }

        fn five_ext(
            Path(id): Path<String>,
            e1: E1,
            e2: E2,
            e3: E3,
            Query(q): Query<HashMap<String, String>>,
        ) -> String {
            format!("{id},{},{},{},{}", e1.0, e2.0, e3.0, q.get("x").unwrap_or(&"?".into()))
        }
        let handler = FnHandler5::<_, Path<String>, E1, E2, E3, Query<HashMap<String, String>>>::new(five_ext);
        let mut params = HashMap::new();
        params.insert("id".to_string(), "5".to_string());
        let req = Request::new("GET", "/b/5").with_path_params(params).with_query("x=y");
        let resp = block_on(handler.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "5,e1,e2,e3,y");
    }

    #[test]
    fn sync_handler_eight_extractors() {
        // The maximum arity: 7 FromRequestParts + 1 FromRequest
        #[derive(Debug, Clone)]
        struct A(String);
        #[derive(Debug, Clone)]
        struct B(String);
        #[derive(Debug, Clone)]
        struct C(String);
        #[derive(Debug, Clone)]
        struct D(String);
        #[derive(Debug, Clone)]
        struct E(String);
        #[derive(Debug, Clone)]
        struct G(String);

        impl crate::extractor::FromRequestParts for A {
            fn from_request_parts(_: &Request) -> Result<Self, crate::extractor::ExtractionError> { Ok(A("a".into())) }
        }
        impl crate::extractor::FromRequestParts for B {
            fn from_request_parts(_: &Request) -> Result<Self, crate::extractor::ExtractionError> { Ok(B("b".into())) }
        }
        impl crate::extractor::FromRequestParts for C {
            fn from_request_parts(_: &Request) -> Result<Self, crate::extractor::ExtractionError> { Ok(C("c".into())) }
        }
        impl crate::extractor::FromRequestParts for D {
            fn from_request_parts(_: &Request) -> Result<Self, crate::extractor::ExtractionError> { Ok(D("d".into())) }
        }
        impl crate::extractor::FromRequestParts for E {
            fn from_request_parts(_: &Request) -> Result<Self, crate::extractor::ExtractionError> { Ok(E("e".into())) }
        }
        impl crate::extractor::FromRequestParts for G {
            fn from_request_parts(_: &Request) -> Result<Self, crate::extractor::ExtractionError> { Ok(G("g".into())) }
        }

        fn eight_ext(
            Path(id): Path<String>,
            a: A, b: B, c: C, d: D, e: E, g: G,
            Query(q): Query<HashMap<String, String>>,
        ) -> String {
            format!("{id},{},{},{},{},{},{},{}", a.0, b.0, c.0, d.0, e.0, g.0,
                    q.get("z").unwrap_or(&"?".into()))
        }
        let handler = FnHandler8::<_, Path<String>, A, B, C, D, E, G, Query<HashMap<String, String>>>::new(eight_ext);
        let mut params = HashMap::new();
        params.insert("id".to_string(), "8".to_string());
        let req = Request::new("GET", "/z/8").with_path_params(params).with_query("z=max");
        let resp = block_on(handler.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "8,a,b,c,d,e,g,max");
    }

    // ── Async handler arities ─────────────────────────────────────────────

    #[test]
    fn async_handler_no_extractors() {
        async fn index() -> &'static str { "async-hello" }
        let handler = AsyncFnHandler::new(index);
        let req = Request::new("GET", "/");
        let resp = block_on(handler.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "async-hello");
    }

    #[test]
    fn async_handler_one_extractor() {
        async fn get_user(Path(id): Path<String>) -> String {
            format!("async-user:{id}")
        }
        let handler = AsyncFnHandler1::<_, Path<String>>::new(get_user);
        let mut params = HashMap::new();
        params.insert("id".to_string(), "7".to_string());
        let req = Request::new("GET", "/users/7").with_path_params(params);
        let resp = block_on(handler.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "async-user:7");
    }

    #[test]
    fn async_handler_two_extractors() {
        async fn two_ext(Path(id): Path<String>, Query(q): Query<HashMap<String, String>>) -> String {
            format!("async-{id},{}", q.get("p").unwrap_or(&"?".into()))
        }
        let handler = AsyncFnHandler2::<_, Path<String>, Query<HashMap<String, String>>>::new(two_ext);
        let mut params = HashMap::new();
        params.insert("id".to_string(), "2".to_string());
        let req = Request::new("GET", "/x/2").with_path_params(params).with_query("p=1");
        let resp = block_on(handler.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "async-2,1");
    }

    #[test]
    fn async_handler_four_extractors() {
        #[derive(Debug, Clone)]
        struct Cfg(String);

        impl crate::extractor::FromRequestParts for Cfg {
            fn from_request_parts(_: &Request) -> Result<Self, crate::extractor::ExtractionError> {
                Ok(Cfg("cfg".into()))
            }
        }

        async fn four_ext(
            Path(id): Path<String>,
            cfg: Cfg,
            headers: HashMap<String, String>,
            Query(q): Query<HashMap<String, String>>,
        ) -> String {
            let ua = headers.get("user-agent").cloned().unwrap_or_default();
            format!("{id},{},{ua},{}", cfg.0, q.get("k").unwrap_or(&"?".into()))
        }
        let handler = AsyncFnHandler4::<_, Path<String>, Cfg, HashMap<String, String>, Query<HashMap<String, String>>>::new(four_ext);
        let mut params = HashMap::new();
        params.insert("id".to_string(), "10".to_string());
        let req = Request::new("GET", "/y/10")
            .with_path_params(params)
            .with_query("k=val")
            .with_header("user-agent", "test-agent");
        let resp = block_on(handler.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "10,cfg,test-agent,val");
    }

    #[test]
    fn async_handler_eight_extractors() {
        #[derive(Debug, Clone)]
        struct X1(String);
        #[derive(Debug, Clone)]
        struct X2(String);
        #[derive(Debug, Clone)]
        struct X3(String);
        #[derive(Debug, Clone)]
        struct X4(String);
        #[derive(Debug, Clone)]
        struct X5(String);
        #[derive(Debug, Clone)]
        struct X6(String);

        impl crate::extractor::FromRequestParts for X1 {
            fn from_request_parts(_: &Request) -> Result<Self, crate::extractor::ExtractionError> { Ok(X1("1".into())) }
        }
        impl crate::extractor::FromRequestParts for X2 {
            fn from_request_parts(_: &Request) -> Result<Self, crate::extractor::ExtractionError> { Ok(X2("2".into())) }
        }
        impl crate::extractor::FromRequestParts for X3 {
            fn from_request_parts(_: &Request) -> Result<Self, crate::extractor::ExtractionError> { Ok(X3("3".into())) }
        }
        impl crate::extractor::FromRequestParts for X4 {
            fn from_request_parts(_: &Request) -> Result<Self, crate::extractor::ExtractionError> { Ok(X4("4".into())) }
        }
        impl crate::extractor::FromRequestParts for X5 {
            fn from_request_parts(_: &Request) -> Result<Self, crate::extractor::ExtractionError> { Ok(X5("5".into())) }
        }
        impl crate::extractor::FromRequestParts for X6 {
            fn from_request_parts(_: &Request) -> Result<Self, crate::extractor::ExtractionError> { Ok(X6("6".into())) }
        }

        async fn eight_ext(
            Path(id): Path<String>,
            x1: X1, x2: X2, x3: X3, x4: X4, x5: X5, x6: X6,
            Query(q): Query<HashMap<String, String>>,
        ) -> String {
            format!("{id},{},{},{},{},{},{},{}", x1.0, x2.0, x3.0, x4.0, x5.0, x6.0,
                    q.get("v").unwrap_or(&"?".into()))
        }
        let handler = AsyncFnHandler8::<_, Path<String>, X1, X2, X3, X4, X5, X6, Query<HashMap<String, String>>>::new(eight_ext);
        let mut params = HashMap::new();
        params.insert("id".to_string(), "88".to_string());
        let req = Request::new("GET", "/z/88").with_path_params(params).with_query("v=ok");
        let resp = block_on(handler.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "88,1,2,3,4,5,6,ok");
    }

    // ── Extraction error propagation ──────────────────────────────────────

    #[test]
    fn sync_handler_extraction_error_propagates() {
        // FnHandler1 with a missing path param should return error response
        fn get_user(Path(id): Path<String>) -> String {
            format!("user:{id}")
        }
        let handler = FnHandler1::<_, Path<String>>::new(get_user);
        // No path params set — extraction should fail
        let req = Request::new("GET", "/users/42");
        let resp = block_on(handler.call(req));
        assert_eq!(resp.status, StatusCode::BAD_REQUEST);
    }

    #[test]
    fn sync_handler_mid_extraction_error() {
        // FnHandler2: first extractor succeeds, second fails
        #[derive(Debug, Clone)]
        struct AlwaysFail;

        impl crate::extractor::FromRequest for AlwaysFail {
            fn from_request(_: Request) -> Result<Self, crate::extractor::ExtractionError> {
                Err(crate::extractor::ExtractionError::bad_request("intentional failure"))
            }
        }

        fn two_ext(Path(_id): Path<String>, _fail: AlwaysFail) -> String {
            "should not reach".into()
        }
        let handler = FnHandler2::<_, Path<String>, AlwaysFail>::new(two_ext);
        let mut params = HashMap::new();
        params.insert("id".to_string(), "1".to_string());
        let req = Request::new("GET", "/x/1").with_path_params(params);
        let resp = block_on(handler.call(req));
        assert_eq!(resp.status, StatusCode::BAD_REQUEST);
        assert!(String::from_utf8_lossy(&resp.body).contains("intentional failure"));
    }

    // ── Convenience free functions ────────────────────────────────────────

    #[test]
    fn convenience_handler_fn() {
        fn index() -> &'static str { "convenience" }
        let h = handler(index);
        let req = Request::new("GET", "/");
        let resp = block_on(h.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "convenience");
    }

    #[test]
    fn convenience_async_handler_fn() {
        async fn index() -> &'static str { "async-convenience" }
        let h = async_handler(index);
        let req = Request::new("GET", "/");
        let resp = block_on(h.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "async-convenience");
    }

    // ── Handler trait object compatibility ────────────────────────────────

    #[test]
    fn handler_is_object_safe() {
        fn index() -> &'static str { "boxed" }
        let h: Box<dyn Handler> = Box::new(FnHandler::new(index));
        let req = Request::new("GET", "/");
        let resp = block_on(h.call(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "boxed");
    }

    #[test]
    fn erased_handler_works_for_macro_generated() {
        fn two_ext(Path(id): Path<String>, Query(q): Query<HashMap<String, String>>) -> String {
            format!("{id},{}", q.get("a").unwrap_or(&"?".into()))
        }
        let h = FnHandler2::<_, Path<String>, Query<HashMap<String, String>>>::new(two_ext);
        let erased: Box<dyn ErasedHandler> = Box::new(h);
        let mut params = HashMap::new();
        params.insert("id".to_string(), "e".to_string());
        let req = Request::new("GET", "/e").with_path_params(params).with_query("a=b");
        let resp = block_on(erased.call_erased(req));
        assert_eq!(String::from_utf8_lossy(&resp.body), "e,b");
    }
}
