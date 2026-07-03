//! Catalog embedding cache and cosine similarity ranking.
//!
//! Pre-computes embeddings for all catalog component descriptions,
//! caches to disk, and provides ranked retrieval by prompt similarity.

use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;

use crate::encoder::{BertEncoder, Embedding, EncoderError};
use crate::models;

/// A catalog component with its description and pre-computed embedding.
#[derive(Debug, Clone)]
pub struct CatalogEntry {
    /// Component name (e.g., "Button", "DataGrid", "AlertBanner").
    pub name: String,
    /// Description text that was embedded.
    pub description: String,
    /// Pre-computed embedding vector.
    pub embedding: Embedding,
}

/// Result of a similarity search.
#[derive(Debug, Clone)]
pub struct RankedMatch {
    /// Component name.
    pub name: String,
    /// Original description.
    pub description: String,
    /// Cosine similarity to query (higher = more relevant).
    pub similarity: f32,
    /// Rank (0 = best match).
    pub rank: usize,
}

/// Catalog embedding cache.
///
/// Stores pre-computed embeddings for all component descriptions,
/// with serialization to/from a binary cache file.
pub struct CatalogEmbeddings {
    entries: Vec<CatalogEntry>,
}

impl CatalogEmbeddings {
    /// Create an empty catalog.
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
        }
    }

    /// Create a catalog from pre-built entries (for testing/integration).
    pub fn from_entries(entries: Vec<CatalogEntry>) -> Self {
        Self { entries }
    }

    /// Compute embeddings for all component descriptions.
    pub fn compute(
        encoder: &BertEncoder,
        components: &[(&str, &str)], // (name, description) pairs
    ) -> Result<Self, EncoderError> {
        let mut entries = Vec::with_capacity(components.len());

        for (name, description) in components {
            let embedding = encoder.encode(description)?;
            entries.push(CatalogEntry {
                name: name.to_string(),
                description: description.to_string(),
                embedding,
            });
        }

        log::info!(
            "CatalogEmbeddings: computed {} embeddings (dim={})",
            entries.len(),
            encoder.embedding_dim()
        );

        Ok(Self { entries })
    }

    /// Rank catalog entries by similarity to a query embedding.
    ///
    /// Returns entries sorted by descending cosine similarity.
    pub fn rank(&self, query: &Embedding) -> Vec<RankedMatch> {
        let mut scored: Vec<RankedMatch> = self
            .entries
            .iter()
            .map(|entry| RankedMatch {
                name: entry.name.clone(),
                description: entry.description.clone(),
                similarity: query.cosine_similarity(&entry.embedding),
                rank: 0, // assigned after sort
            })
            .collect();

        // Sort descending by similarity
        scored.sort_by(|a, b| {
            b.similarity
                .partial_cmp(&a.similarity)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Assign ranks
        for (i, m) in scored.iter_mut().enumerate() {
            m.rank = i;
        }

        scored
    }

    /// Rank and return top-k matches.
    pub fn top_k(&self, query: &Embedding, k: usize) -> Vec<RankedMatch> {
        let ranked = self.rank(query);
        ranked.into_iter().take(k).collect()
    }

    /// Get all catalog embeddings (for tiered encoder confidence estimation).
    pub fn embeddings(&self) -> Vec<Embedding> {
        self.entries.iter().map(|e| e.embedding.clone()).collect()
    }

    /// Number of catalog entries.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Whether the catalog is empty.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Save embeddings to binary cache file.
    ///
    /// Format: [u32 count] [entries...]
    /// Each entry: [u32 name_len] [name_bytes] [u32 desc_len] [desc_bytes] [u32 dim] [f32 * dim]
    pub fn save(&self, path: &Path) -> Result<(), CatalogError> {
        let file = std::fs::File::create(path).map_err(|e| CatalogError::IoError(e.to_string()))?;
        let mut w = BufWriter::new(file);

        // Header: count
        w.write_all(&(self.entries.len() as u32).to_le_bytes())
            .map_err(|e| CatalogError::IoError(e.to_string()))?;

        for entry in &self.entries {
            // Name
            let name_bytes = entry.name.as_bytes();
            w.write_all(&(name_bytes.len() as u32).to_le_bytes())
                .map_err(|e| CatalogError::IoError(e.to_string()))?;
            w.write_all(name_bytes)
                .map_err(|e| CatalogError::IoError(e.to_string()))?;

            // Description
            let desc_bytes = entry.description.as_bytes();
            w.write_all(&(desc_bytes.len() as u32).to_le_bytes())
                .map_err(|e| CatalogError::IoError(e.to_string()))?;
            w.write_all(desc_bytes)
                .map_err(|e| CatalogError::IoError(e.to_string()))?;

            // Embedding
            w.write_all(&(entry.embedding.dim as u32).to_le_bytes())
                .map_err(|e| CatalogError::IoError(e.to_string()))?;
            for &v in &entry.embedding.values {
                w.write_all(&v.to_le_bytes())
                    .map_err(|e| CatalogError::IoError(e.to_string()))?;
            }
        }

        w.flush()
            .map_err(|e| CatalogError::IoError(e.to_string()))?;
        log::info!(
            "CatalogEmbeddings: saved {} entries to {:?}",
            self.entries.len(),
            path
        );
        Ok(())
    }

    /// Load embeddings from binary cache file.
    pub fn load(path: &Path) -> Result<Self, CatalogError> {
        let file = std::fs::File::open(path).map_err(|e| CatalogError::IoError(e.to_string()))?;
        let mut r = BufReader::new(file);

        let count = read_u32(&mut r)? as usize;
        if count > 100_000 {
            return Err(CatalogError::CorruptCache(format!(
                "Entry count {count} exceeds 100k safety limit"
            )));
        }
        let mut entries = Vec::with_capacity(count);

        for _ in 0..count {
            let name = read_string(&mut r)?;
            let description = read_string(&mut r)?;
            let dim = read_u32(&mut r)? as usize;

            let mut values = Vec::with_capacity(dim);
            for _ in 0..dim {
                values.push(read_f32(&mut r)?);
            }

            entries.push(CatalogEntry {
                name,
                description,
                embedding: Embedding {
                    values,
                    dim,
                    inference_ms: 0.0, // cached, no inference
                },
            });
        }

        log::info!(
            "CatalogEmbeddings: loaded {} entries from {:?}",
            entries.len(),
            path
        );
        Ok(Self { entries })
    }

    /// Load from default path (models_dir/catalog-embeddings.bin).
    pub fn load_default() -> Result<Self, CatalogError> {
        let path = models::catalog_embeddings_path();
        Self::load(&path)
    }

    /// Save to default path.
    pub fn save_default(&self) -> Result<(), CatalogError> {
        let path = models::catalog_embeddings_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| CatalogError::IoError(e.to_string()))?;
        }
        self.save(&path)
    }
}

impl Default for CatalogEmbeddings {
    fn default() -> Self {
        Self::new()
    }
}

/// Catalog-specific errors.
#[derive(Debug, thiserror::Error)]
pub enum CatalogError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Corrupt cache file: {0}")]
    CorruptCache(String),

    #[error("Encoder error: {0}")]
    EncoderError(#[from] EncoderError),
}

// ─── Binary reader helpers ──────────────────────────────────────────

fn read_u32(r: &mut impl Read) -> Result<u32, CatalogError> {
    let mut buf = [0u8; 4];
    r.read_exact(&mut buf)
        .map_err(|e| CatalogError::CorruptCache(e.to_string()))?;
    Ok(u32::from_le_bytes(buf))
}

fn read_f32(r: &mut impl Read) -> Result<f32, CatalogError> {
    let mut buf = [0u8; 4];
    r.read_exact(&mut buf)
        .map_err(|e| CatalogError::CorruptCache(e.to_string()))?;
    Ok(f32::from_le_bytes(buf))
}

fn read_string(r: &mut impl Read) -> Result<String, CatalogError> {
    let len = read_u32(r)? as usize;
    if len > 1_000_000 {
        return Err(CatalogError::CorruptCache(format!(
            "String length {len} exceeds 1MB safety limit"
        )));
    }
    let mut buf = vec![0u8; len];
    r.read_exact(&mut buf)
        .map_err(|e| CatalogError::CorruptCache(e.to_string()))?;
    String::from_utf8(buf).map_err(|e| CatalogError::CorruptCache(e.to_string()))
}

// ─── Tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_entry(name: &str, values: Vec<f32>) -> CatalogEntry {
        let dim = values.len();
        CatalogEntry {
            name: name.to_string(),
            description: format!("{name} component"),
            embedding: Embedding {
                values,
                dim,
                inference_ms: 0.0,
            },
        }
    }

    #[test]
    fn rank_returns_sorted_by_similarity() {
        let catalog = CatalogEmbeddings {
            entries: vec![
                mock_entry("Button", vec![0.0, 1.0, 0.0]),
                mock_entry("Alert", vec![1.0, 0.0, 0.0]),
                mock_entry("Card", vec![0.7, 0.7, 0.0]),
            ],
        };

        let query = Embedding {
            values: vec![1.0, 0.0, 0.0],
            dim: 3,
            inference_ms: 0.0,
        };

        let ranked = catalog.rank(&query);
        assert_eq!(ranked[0].name, "Alert"); // exact match
        assert_eq!(ranked[0].rank, 0);
        assert!(ranked[0].similarity > 0.99);
        assert_eq!(ranked[1].name, "Card"); // partial match
        assert_eq!(ranked[1].rank, 1);
    }

    #[test]
    fn top_k_limits_results() {
        let catalog = CatalogEmbeddings {
            entries: vec![
                mock_entry("A", vec![1.0, 0.0]),
                mock_entry("B", vec![0.0, 1.0]),
                mock_entry("C", vec![0.5, 0.5]),
            ],
        };

        let query = Embedding {
            values: vec![1.0, 0.0],
            dim: 2,
            inference_ms: 0.0,
        };

        let top2 = catalog.top_k(&query, 2);
        assert_eq!(top2.len(), 2);
        assert_eq!(top2[0].name, "A");
    }

    #[test]
    fn save_and_load_round_trip() {
        let catalog = CatalogEmbeddings {
            entries: vec![
                mock_entry("Button", vec![1.0, 2.0, 3.0]),
                mock_entry("Alert", vec![4.0, 5.0, 6.0]),
            ],
        };

        let tmpfile = std::env::temp_dir().join("pragma-test-catalog.bin");
        catalog.save(&tmpfile).unwrap();

        let loaded = CatalogEmbeddings::load(&tmpfile).unwrap();
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded.entries[0].name, "Button");
        assert_eq!(loaded.entries[0].embedding.values, vec![1.0, 2.0, 3.0]);
        assert_eq!(loaded.entries[1].name, "Alert");
        assert_eq!(loaded.entries[1].embedding.dim, 3);

        // Cleanup
        let _ = std::fs::remove_file(&tmpfile);
    }

    #[test]
    fn empty_catalog() {
        let catalog = CatalogEmbeddings::new();
        assert!(catalog.is_empty());
        assert_eq!(catalog.len(), 0);

        let query = Embedding {
            values: vec![1.0, 0.0],
            dim: 2,
            inference_ms: 0.0,
        };
        let ranked = catalog.rank(&query);
        assert!(ranked.is_empty());
    }

    #[test]
    fn embeddings_returns_all() {
        let catalog = CatalogEmbeddings {
            entries: vec![mock_entry("A", vec![1.0]), mock_entry("B", vec![2.0])],
        };
        let embs = catalog.embeddings();
        assert_eq!(embs.len(), 2);
    }

    #[test]
    fn corrupt_cache_detected() {
        let tmpfile = std::env::temp_dir().join("pragma-test-corrupt.bin");
        std::fs::write(&tmpfile, &[0xFF, 0xFF, 0xFF, 0xFF]).unwrap(); // 4 billion entries
        let result = CatalogEmbeddings::load(&tmpfile);
        // Should fail: either OOM safety or read error on missing data
        assert!(result.is_err());
        let _ = std::fs::remove_file(&tmpfile);
    }
}
