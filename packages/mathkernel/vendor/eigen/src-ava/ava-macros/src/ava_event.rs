//! AvaEvent derive macro implementation

use darling::{FromDeriveInput, FromVariant};
use proc_macro2::TokenStream;
use quote::quote;
use syn::{DeriveInput, Data, DataEnum, Fields, Ident};

#[derive(Debug, FromDeriveInput)]
#[darling(attributes(ava_event), supports(enum_any))]
struct AvaEventArgs {
    ident: Ident,
    data: darling::ast::Data<AvaEventVariant, ()>,
}

#[derive(Debug, FromVariant)]
#[darling(attributes(ava_event))]
struct AvaEventVariant {
    ident: Ident,
    fields: darling::ast::Fields<syn::Field>,
    /// Override the tag name (defaults to variant name)
    #[darling(default)]
    tag: Option<String>,
}

pub fn expand(input: DeriveInput) -> syn::Result<TokenStream> {
    let args = AvaEventArgs::from_derive_input(&input)
        .map_err(|e| syn::Error::new_spanned(&input, e.to_string()))?;

    let name = &args.ident;

    let Data::Enum(DataEnum { variants, .. }) = &input.data else {
        return Err(syn::Error::new_spanned(
            &input,
            "AvaEvent can only be derived for enums"
        ));
    };

    // Generate tag() match arms
    let tag_arms = variants.iter().map(|v| {
        let variant_name = &v.ident;
        let tag_str = variant_name.to_string();
        match &v.fields {
            Fields::Named(_) => quote! {
                #name::#variant_name { .. } => #tag_str,
            },
            Fields::Unnamed(_) => quote! {
                #name::#variant_name(..) => #tag_str,
            },
            Fields::Unit => quote! {
                #name::#variant_name => #tag_str,
            },
        }
    });

    // Generate timestamp_ms() match arms - look for timestamp_ms field
    let timestamp_arms = variants.iter().map(|v| {
        let variant_name = &v.ident;
        let has_timestamp = v.fields.iter().any(|f| {
            f.ident.as_ref().map(|i| i == "timestamp_ms").unwrap_or(false)
        });

        if has_timestamp {
            quote! {
                #name::#variant_name { timestamp_ms, .. } => *timestamp_ms,
            }
        } else {
            quote! {
                #name::#variant_name { .. } => 0.0,
            }
        }
    });

    // Generate view_id() match arms - look for view_id field
    let view_id_arms = variants.iter().map(|v| {
        let variant_name = &v.ident;
        let has_view_id = v.fields.iter().any(|f| {
            f.ident.as_ref().map(|i| i == "view_id").unwrap_or(false)
        });

        if has_view_id {
            quote! {
                #name::#variant_name { view_id, .. } => Some(view_id),
            }
        } else {
            quote! {
                #name::#variant_name { .. } => None,
            }
        }
    });

    let expanded = quote! {
        impl #name {
            /// Returns the event's discriminant tag as a static string
            pub fn tag(&self) -> &'static str {
                match self {
                    #(#tag_arms)*
                }
            }

            /// Returns the event timestamp in milliseconds
            pub fn timestamp_ms(&self) -> f64 {
                match self {
                    #(#timestamp_arms)*
                }
            }

            /// Returns the associated view ID, if any
            pub fn view_id(&self) -> Option<&ava_domain::ids::ViewId> {
                match self {
                    #(#view_id_arms)*
                }
            }
        }
    };

    Ok(expanded)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_works() {
        // Compile-time test - if this module compiles, parsing works
    }
}
