//! ava_channel attribute macro implementation

use darling::{ast::NestedMeta, FromMeta};
use proc_macro2::TokenStream;
use quote::quote;
use syn::{parse2, ItemFn};

#[derive(Debug, FromMeta)]
struct ChannelAttrArgs {
    /// Channel role: STATE, EVENT, METRIC, COMMAND, LOG
    role: String,
    /// Materialization tier: onDemand, cached, continuous
    #[darling(default)]
    materialization: Option<String>,
    /// Refresh interval in milliseconds
    #[darling(default)]
    refresh_ms: Option<u64>,
}

pub fn expand(attr: TokenStream, item: TokenStream) -> syn::Result<TokenStream> {
    // Parse the function
    let func: ItemFn = parse2(item)?;
    let func_name = &func.sig.ident;

    // Parse attributes using darling's syn 2.0 compatible API
    let attr_list = NestedMeta::parse_meta_list(attr)?;
    let args = ChannelAttrArgs::from_list(&attr_list)
        .map_err(|e| syn::Error::new_spanned(&func, e.to_string()))?;

    // Validate role
    let role_variant = match args.role.to_uppercase().as_str() {
        "STATE" => quote! { crate::channels::ChannelRole::State },
        "EVENT" => quote! { crate::channels::ChannelRole::Event },
        "METRIC" => quote! { crate::channels::ChannelRole::Metric },
        "COMMAND" => quote! { crate::channels::ChannelRole::Command },
        "LOG" => quote! { crate::channels::ChannelRole::Log },
        other => {
            return Err(syn::Error::new_spanned(
                &func,
                format!("Invalid channel role: {}. Expected STATE, EVENT, METRIC, COMMAND, or LOG", other)
            ));
        }
    };

    // Materialization tier
    let materialization = args.materialization.as_deref().unwrap_or("onDemand");
    let mat_variant = match materialization {
        "onDemand" => quote! { crate::channels::MaterializationTier::OnDemand },
        "cached" => quote! { crate::channels::MaterializationTier::Cached },
        "continuous" => quote! { crate::channels::MaterializationTier::Continuous },
        other => {
            return Err(syn::Error::new_spanned(
                &func,
                format!("Invalid materialization: {}. Expected onDemand, cached, or continuous", other)
            ));
        }
    };

    let refresh_ms = args.refresh_ms.map(|ms| quote! { Some(#ms) }).unwrap_or(quote! { None });

    // Generate wrapper that adds metadata
    let expanded = quote! {
        #func

        impl #func_name {
            /// Channel role defined by #[ava_channel] attribute
            pub const ROLE: crate::channels::ChannelRole = #role_variant;

            /// Materialization tier defined by #[ava_channel] attribute
            pub const MATERIALIZATION: crate::channels::MaterializationTier = #mat_variant;

            /// Refresh interval in milliseconds (if any)
            pub const REFRESH_MS: Option<u64> = #refresh_ms;
        }
    };

    Ok(expanded)
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_parse_works() {
        // Compile-time test
    }
}
