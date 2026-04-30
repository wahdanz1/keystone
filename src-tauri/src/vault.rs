use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::Serialize;
use zeroize::Zeroizing;

use crate::crypto::{
    check_verifier, derive_key, make_verifier, random_bytes, KdfParams, DEFAULT_KDF_PARAMS,
    KEY_LEN, SALT_LEN,
};
use crate::db::{self, Item};
use crate::error::{Result, VaultError};

const DB_FILENAME: &str = "vault.db";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum VaultStatus {
    Uninitialized,
    Locked,
    Unlocked,
}

pub struct VaultState {
    data_dir: PathBuf,
    inner: Mutex<Inner>,
    /// Cached result of the DB initialization probe. None = not yet checked.
    initialized: Mutex<Option<bool>>,
}

struct Inner {
    conn: Option<Connection>,
    key: Option<Zeroizing<[u8; KEY_LEN]>>,
}

impl VaultState {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            data_dir,
            inner: Mutex::new(Inner { conn: None, key: None }),
            initialized: Mutex::new(None),
        }
    }

    fn db_path(&self) -> PathBuf {
        self.data_dir.join(DB_FILENAME)
    }

    /// Runs `f` with a reference to the open connection and key. Returns
    /// `VaultError::Locked` if the vault is not unlocked or the mutex is poisoned.
    fn with_conn<T, F>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Connection, &[u8; KEY_LEN]) -> Result<T>,
    {
        let inner = self.inner.lock().map_err(|_| VaultError::Locked)?;
        let conn = inner.conn.as_ref().ok_or(VaultError::Locked)?;
        let key = inner.key.as_ref().ok_or(VaultError::Locked)?;
        f(conn, key)
    }

    pub fn status(&self) -> Result<VaultStatus> {
        // Fast path: already unlocked.
        let inner = self.inner.lock().map_err(|_| VaultError::Locked)?;
        if inner.conn.is_some() && inner.key.is_some() {
            return Ok(VaultStatus::Unlocked);
        }
        drop(inner);

        // Check the initialized cache before touching disk.
        let mut init_cache = self.initialized.lock().map_err(|_| VaultError::Locked)?;
        if let Some(is_init) = *init_cache {
            return Ok(if is_init { VaultStatus::Locked } else { VaultStatus::Uninitialized });
        }

        // First call: probe the DB file.
        if !self.db_path().exists() {
            *init_cache = Some(false);
            return Ok(VaultStatus::Uninitialized);
        }
        let conn = Connection::open(self.db_path())?;
        let is_init = db::get_meta(&conn, db::META_SALT)?.is_some()
            && db::get_meta(&conn, db::META_VERIFIER)?.is_some();
        *init_cache = Some(is_init);
        Ok(if is_init { VaultStatus::Locked } else { VaultStatus::Uninitialized })
    }

    pub fn create(&self, password: &str) -> Result<()> {
        if password.len() < 8 {
            return Err(VaultError::PasswordTooShort);
        }
        if self.db_path().exists() {
            let probe = Connection::open(self.db_path())?;
            if db::get_meta(&probe, db::META_SALT).ok().flatten().is_some() {
                return Err(VaultError::AlreadyInitialized);
            }
        }
        fs::create_dir_all(&self.data_dir)?;

        let conn = Connection::open(self.db_path())?;
        db::init_schema(&conn)?;

        let salt: [u8; SALT_LEN] = random_bytes();
        let kdf = DEFAULT_KDF_PARAMS;
        let key = derive_key(password, &salt, &kdf)?;
        let verifier = make_verifier(&key)?;

        db::set_meta(&conn, db::META_SALT, &salt)?;
        db::set_meta(&conn, db::META_VERIFIER, &verifier)?;
        db::set_meta(&conn, db::META_KDF_PARAMS, &serde_json::to_vec(&kdf)?)?;

        let mut init_cache = self.initialized.lock().map_err(|_| VaultError::Locked)?;
        *init_cache = Some(true);

        let mut inner = self.inner.lock().map_err(|_| VaultError::Locked)?;
        inner.conn = Some(conn);
        inner.key = Some(key);
        Ok(())
    }

    pub fn unlock(&self, password: &str) -> Result<()> {
        if !self.db_path().exists() {
            return Err(VaultError::NotInitialized);
        }
        let conn = Connection::open(self.db_path())?;

        let salt = db::get_meta(&conn, db::META_SALT)?.ok_or(VaultError::NotInitialized)?;
        let verifier = db::get_meta(&conn, db::META_VERIFIER)?.ok_or(VaultError::NotInitialized)?;
        let kdf: KdfParams = db::get_meta(&conn, db::META_KDF_PARAMS)?
            .map(|b| serde_json::from_slice::<KdfParams>(&b))
            .transpose()?
            .unwrap_or(DEFAULT_KDF_PARAMS);

        let key = derive_key(password, &salt, &kdf)?;
        if !check_verifier(&key, &verifier) {
            return Err(VaultError::BadPassword);
        }

        let mut init_cache = self.initialized.lock().map_err(|_| VaultError::Locked)?;
        *init_cache = Some(true);

        let mut inner = self.inner.lock().map_err(|_| VaultError::Locked)?;
        inner.conn = Some(conn);
        inner.key = Some(key);
        Ok(())
    }

    pub fn lock(&self) -> Result<()> {
        let mut inner = self.inner.lock().map_err(|_| VaultError::Locked)?;
        inner.conn = None;
        inner.key = None;
        Ok(())
    }

    pub fn list_items(&self) -> Result<Vec<Item>> {
        self.with_conn(|conn, key| db::list_items(conn, key))
    }

    pub fn set_favorite(&self, id: &str, favorite: bool) -> Result<()> {
        self.with_conn(|conn, _key| db::set_favorite(conn, id, favorite))
    }

    pub fn mark_used(&self, id: &str) -> Result<()> {
        self.with_conn(|conn, _key| db::mark_used(conn, id))
    }
}
