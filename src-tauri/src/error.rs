use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum VaultError {
    #[error("vault is already initialized")]
    AlreadyInitialized,
    #[error("vault is not initialized")]
    NotInitialized,
    #[error("vault is locked")]
    Locked,
    #[error("incorrect master password")]
    BadPassword,
    #[error("password must be at least 8 characters")]
    PasswordTooShort,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("key derivation error: {0}")]
    Kdf(String),
    #[error("crypto error: {0}")]
    Crypto(String),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

impl Serialize for VaultError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, VaultError>;
