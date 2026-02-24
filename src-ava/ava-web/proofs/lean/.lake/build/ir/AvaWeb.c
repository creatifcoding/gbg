// Lean compiler output
// Module: AvaWeb
// Imports: Init AvaWeb.Types AvaWeb.Middleware.Monoid AvaWeb.Router.Trie AvaWeb.Extractors.Safety AvaWeb.Session.Duality AvaWeb.Auth.Macaroon
#include <lean/lean.h>
#if defined(__clang__)
#pragma clang diagnostic ignored "-Wunused-parameter"
#pragma clang diagnostic ignored "-Wunused-label"
#elif defined(__GNUC__) && !defined(__CLANG__)
#pragma GCC diagnostic ignored "-Wunused-parameter"
#pragma GCC diagnostic ignored "-Wunused-label"
#pragma GCC diagnostic ignored "-Wunused-but-set-variable"
#endif
#ifdef __cplusplus
extern "C" {
#endif
lean_object* initialize_Init(uint8_t builtin, lean_object*);
lean_object* initialize_AvaWeb_Types(uint8_t builtin, lean_object*);
lean_object* initialize_AvaWeb_Middleware_Monoid(uint8_t builtin, lean_object*);
lean_object* initialize_AvaWeb_Router_Trie(uint8_t builtin, lean_object*);
lean_object* initialize_AvaWeb_Extractors_Safety(uint8_t builtin, lean_object*);
lean_object* initialize_AvaWeb_Session_Duality(uint8_t builtin, lean_object*);
lean_object* initialize_AvaWeb_Auth_Macaroon(uint8_t builtin, lean_object*);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_AvaWeb(uint8_t builtin, lean_object* w) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin, lean_io_mk_world());
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_AvaWeb_Types(builtin, lean_io_mk_world());
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_AvaWeb_Middleware_Monoid(builtin, lean_io_mk_world());
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_AvaWeb_Router_Trie(builtin, lean_io_mk_world());
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_AvaWeb_Extractors_Safety(builtin, lean_io_mk_world());
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_AvaWeb_Session_Duality(builtin, lean_io_mk_world());
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_AvaWeb_Auth_Macaroon(builtin, lean_io_mk_world());
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif
