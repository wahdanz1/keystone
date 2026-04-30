use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{ChaCha20Poly1305, Nonce};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

use crate::error::{Result, VaultError};

pub const SALT_LEN: usize = 16;
pub const KEY_LEN: usize = 32;
pub const NONCE_LEN: usize = 12;

// Parallelism is always 1 — single-user desktop unlock.
const ARGON2_PARALLELISM: u32 = 1;

const VERIFIER_PLAINTEXT: &[u8] = b"keystone:v1";

/// KDF parameters stored in the vault DB so future versions can re-derive the key
/// even if the defaults change.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct KdfParams {
    /// Memory cost in KiB (e.g. 32768 = 32 MiB).
    pub m_cost: u32,
    /// Number of iterations.
    pub t_cost: u32,
}

/// Tuned for ~1s desktop unlock. Above OWASP minimum (19 MiB / 2 iter).
pub const DEFAULT_KDF_PARAMS: KdfParams = KdfParams {
    m_cost: 32 * 1024,
    t_cost: 2,
};

pub fn random_bytes<const N: usize>() -> [u8; N] {
    let mut buf = [0u8; N];
    rand::thread_rng().fill_bytes(&mut buf);
    buf
}

pub fn derive_key(password: &str, salt: &[u8], params: &KdfParams) -> Result<Zeroizing<[u8; KEY_LEN]>> {
    let argon_params =
        Params::new(params.m_cost, params.t_cost, ARGON2_PARALLELISM, Some(KEY_LEN))
            .map_err(|e| VaultError::Kdf(e.to_string()))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon_params);

    let mut out = Zeroizing::new([0u8; KEY_LEN]);
    argon2
        .hash_password_into(password.as_bytes(), salt, out.as_mut_slice())
        .map_err(|e| VaultError::Kdf(e.to_string()))?;
    Ok(out)
}

/// Sealed bytes layout: [12-byte nonce | ciphertext | 16-byte tag].
pub fn seal(key: &[u8; KEY_LEN], plaintext: &[u8]) -> Result<Vec<u8>> {
    let cipher = ChaCha20Poly1305::new(key.into());
    let nonce_bytes: [u8; NONCE_LEN] = random_bytes();
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ct = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| VaultError::Crypto(e.to_string()))?;
    let mut out = Vec::with_capacity(NONCE_LEN + ct.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ct);
    Ok(out)
}

pub fn open(key: &[u8; KEY_LEN], sealed: &[u8]) -> Result<Vec<u8>> {
    if sealed.len() < NONCE_LEN {
        return Err(VaultError::Crypto("sealed payload too short".into()));
    }
    let cipher = ChaCha20Poly1305::new(key.into());
    let nonce = Nonce::from_slice(&sealed[..NONCE_LEN]);
    cipher
        .decrypt(nonce, &sealed[NONCE_LEN..])
        .map_err(|e| VaultError::Crypto(e.to_string()))
}

pub fn make_verifier(key: &[u8; KEY_LEN]) -> Result<Vec<u8>> {
    seal(key, VERIFIER_PLAINTEXT)
}

pub fn check_verifier(key: &[u8; KEY_LEN], sealed: &[u8]) -> bool {
    match open(key, sealed) {
        Ok(plaintext) => plaintext == VERIFIER_PLAINTEXT,
        Err(_) => false,
    }
}
