//! SourceAdapter derive macro implementation

use darling::FromDeriveInput;
use proc_macro2::TokenStream;
use quote::quote;
use syn::{DeriveInput, Ident};

#[derive(Debug, FromDeriveInput)]
#[darling(attributes(source_adapter), supports(struct_named))]
struct SourceAdapterArgs {
    ident: Ident,
    /// The source kind (sql, stream, api, graph, lake, cache, custom)
    kind: String,
    /// Default connection string (optional)
    #[darling(default)]
    connection: Option<String>,
}

pub fn expand(input: DeriveInput) -> syn::Result<TokenStream> {
    let args = SourceAdapterArgs::from_derive_input(&input)
        .map_err(|e| syn::Error::new_spanned(&input, e.to_string()))?;

    let name = &args.ident;
    let kind = &args.kind;

    // Generate SourceKind variant
    let source_kind = match kind.as_str() {
        "sql" => quote! { crate::channels::SourceKind::Sql },
        "stream" => quote! { crate::channels::SourceKind::Stream },
        "api" => quote! { crate::channels::SourceKind::Api },
        "graph" => quote! { crate::channels::SourceKind::Graph },
        "lake" => quote! { crate::channels::SourceKind::Lake },
        "cache" => quote! { crate::channels::SourceKind::Cache },
        other => {
            let custom = other.to_string();
            quote! { crate::channels::SourceKind::Custom(#custom.into()) }
        }
    };

    let expanded = quote! {
        #[async_trait::async_trait]
        impl crate::traits::SourceAdapter for #name {
            fn kind(&self) -> crate::channels::SourceKind {
                #source_kind
            }

            fn id(&self) -> &crate::ids::SourceId {
                &self.id
            }

            async fn connect(&mut self) -> Result<(), crate::errors::SourceError> {
                // Default: no-op connection
                // Override in impl block if needed
                Ok(())
            }

            async fn disconnect(&mut self) -> Result<(), crate::errors::SourceError> {
                // Default: no-op disconnection
                Ok(())
            }

            async fn query(
                &self,
                _query: &str,
            ) -> Result<arrow::array::RecordBatch, crate::errors::SourceError> {
                Err(crate::errors::SourceError::UnsupportedOperation {
                    source_id: self.id.clone(),
                    operation: "query".into(),
                })
            }

            async fn schema(&self) -> Result<arrow::datatypes::SchemaRef, crate::errors::SourceError> {
                Err(crate::errors::SourceError::UnsupportedOperation {
                    source_id: self.id.clone(),
                    operation: "schema".into(),
                })
            }
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
