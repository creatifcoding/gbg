import Lake
open Lake DSL

package «ava-web-proofs» where
  leanOptions := #[⟨`autoImplicit, false⟩]

@[default_target]
lean_lib «AvaWeb» where
  srcDir := "."
