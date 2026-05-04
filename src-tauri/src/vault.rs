use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};

use crate::crypto::{
    check_verifier, derive_key, make_verifier, open as aead_open, random_bytes, seal,
    KdfParams, DEFAULT_KDF_PARAMS, KEY_LEN, SALT_LEN,
};
use crate::db::{self, Item};
use crate::error::{Result, VaultError};

const DB_FILENAME: &str = "vault.db";

#[derive(Serialize, Deserialize)]
struct ExportFile {
    version: u32,
    kdf: KdfParams,
    salt: String,
    ciphertext: String,
}

#[derive(Serialize, Deserialize)]
struct ExportPayload {
    items: Vec<ExportItem>,
}

#[derive(Serialize, Deserialize)]
struct ExportItem {
    title: String,
    kind: String,
    value: String,
    notes: Option<String>,
    tags: Vec<String>,
}

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

    fn with_conn<T, F>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Connection, &[u8; KEY_LEN]) -> Result<T>,
    {
        let inner = self.inner.lock().map_err(|_| VaultError::Locked)?;
        let conn = inner.conn.as_ref().ok_or(VaultError::Locked)?;
        let key = inner.key.as_ref().ok_or(VaultError::Locked)?;
        f(conn, key)
    }

    fn with_conn_mut<T, F>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&mut Connection, &[u8; KEY_LEN]) -> Result<T>,
    {
        let mut inner = self.inner.lock().map_err(|_| VaultError::Locked)?;
        let Inner { conn, key } = &mut *inner;
        let conn = conn.as_mut().ok_or(VaultError::Locked)?;
        let key: &[u8; KEY_LEN] = key.as_deref().ok_or(VaultError::Locked)?;
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
        let mut conn = Connection::open(self.db_path())?;

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

        let version = db::get_meta(&conn, db::META_SCHEMA_VERSION)?
            .map(|b| String::from_utf8_lossy(&b).into_owned())
            .unwrap_or_default();
        if version == "1" {
            db::migrate_v1_to_v2(&mut conn, &key)?;
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

    pub fn create_item(
        &self,
        title: &str,
        kind: &str,
        value: &str,
        notes: Option<&str>,
        tags: &[String],
    ) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        self.with_conn(|conn, key| db::insert_item(conn, key, &id, title, kind, value, notes, tags))?;
        Ok(id)
    }

    pub fn update_item(
        &self,
        id: &str,
        title: &str,
        kind: &str,
        value: &str,
        notes: Option<&str>,
        tags: &[String],
    ) -> Result<()> {
        self.with_conn(|conn, key| db::update_item(conn, key, id, title, kind, value, notes, tags))
    }

    pub fn delete_item(&self, id: &str) -> Result<()> {
        self.with_conn(|conn, _key| db::delete_item(conn, id))
    }

    pub fn set_favorite(&self, id: &str, favorite: bool) -> Result<()> {
        self.with_conn(|conn, _key| db::set_favorite(conn, id, favorite))
    }

    pub fn mark_used(&self, id: &str) -> Result<()> {
        self.with_conn(|conn, _key| db::mark_used(conn, id))
    }

    pub fn export_vault(&self, path: &str, passphrase: &str) -> Result<usize> {
        let items = self.list_items()?;
        let export_items: Vec<ExportItem> = items
            .into_iter()
            .map(|it| ExportItem {
                title: it.title,
                kind: it.kind,
                value: it.value,
                notes: it.notes,
                tags: it.tags,
            })
            .collect();
        let count = export_items.len();
        let payload_json = serde_json::to_vec(&ExportPayload { items: export_items })?;
        let salt: [u8; SALT_LEN] = random_bytes();
        let export_key = derive_key(passphrase, &salt, &DEFAULT_KDF_PARAMS)?;
        let ciphertext = seal(&export_key, &payload_json)?;
        let export_file = ExportFile {
            version: 1,
            kdf: DEFAULT_KDF_PARAMS,
            salt: BASE64.encode(salt),
            ciphertext: BASE64.encode(&ciphertext),
        };
        fs::write(path, serde_json::to_string_pretty(&export_file)?)?;
        Ok(count)
    }

    pub fn import_vault(&self, path: &str, passphrase: &str) -> Result<usize> {
        let data = fs::read_to_string(path)?;
        let export_file: ExportFile =
            serde_json::from_str(&data).map_err(|_| VaultError::CorruptData)?;
        if export_file.version != 1 {
            return Err(VaultError::UnsupportedVersion);
        }
        let salt_bytes = BASE64.decode(&export_file.salt).map_err(|_| VaultError::CorruptData)?;
        let ct_bytes =
            BASE64.decode(&export_file.ciphertext).map_err(|_| VaultError::CorruptData)?;
        let export_key = derive_key(passphrase, &salt_bytes, &export_file.kdf)?;
        let plaintext =
            aead_open(&export_key, &ct_bytes).map_err(|_| VaultError::BadPassword)?;
        let payload: ExportPayload =
            serde_json::from_slice(&plaintext).map_err(|_| VaultError::CorruptData)?;
        let count = payload.items.len();
        self.with_conn_mut(|conn, key| {
            let tx = conn.transaction()?;
            for item in &payload.items {
                let id = uuid::Uuid::new_v4().to_string();
                db::insert_item(
                    &tx, key, &id, &item.title, &item.kind, &item.value,
                    item.notes.as_deref(), &item.tags,
                )?;
            }
            tx.commit()?;
            Ok(())
        })?;
        Ok(count)
    }
}
