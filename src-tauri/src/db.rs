use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::crypto::{open as aead_open, seal, KEY_LEN};
use crate::error::Result;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub title: String,
    pub value: String,
    pub kind: String,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub is_favorite: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_used_at: Option<i64>,
    pub copy_count: i64,
}

#[derive(Serialize, Deserialize)]
struct EncryptedPayload {
    title: String,
    value: String,
    notes: Option<String>,
    tags: Vec<String>,
}

#[derive(Deserialize)]
struct LegacyEncryptedPayload {
    value: String,
    notes: Option<String>,
}

pub(crate) const META_SALT: &str = "salt";
pub(crate) const META_VERIFIER: &str = "verifier";
pub(crate) const META_KDF_PARAMS: &str = "kdf_params";
pub(crate) const META_SCHEMA_VERSION: &str = "schema_version";

pub fn init_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS meta (
            key   TEXT PRIMARY KEY,
            value BLOB NOT NULL
        );

        CREATE TABLE IF NOT EXISTS items (
            id           TEXT PRIMARY KEY,
            kind         TEXT NOT NULL CHECK (kind IN ('api_key','snippet','command','note')),
            payload      BLOB NOT NULL,
            is_favorite  INTEGER NOT NULL DEFAULT 0,
            created_at   INTEGER NOT NULL,
            updated_at   INTEGER NOT NULL,
            last_used_at INTEGER,
            copy_count   INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_items_favorite ON items(is_favorite);
        "#,
    )?;
    set_meta_text(conn, META_SCHEMA_VERSION, "2")?;
    Ok(())
}

pub fn get_meta(conn: &Connection, key: &str) -> Result<Option<Vec<u8>>> {
    let row = conn
        .query_row("SELECT value FROM meta WHERE key = ?1", params![key], |r| {
            r.get::<_, Vec<u8>>(0)
        })
        .optional()?;
    Ok(row)
}

pub fn set_meta(conn: &Connection, key: &str, value: &[u8]) -> Result<()> {
    conn.execute(
        "INSERT INTO meta(key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

fn set_meta_text(conn: &Connection, key: &str, value: &str) -> Result<()> {
    set_meta(conn, key, value.as_bytes())
}

pub fn list_items(conn: &Connection, key: &[u8; KEY_LEN]) -> Result<Vec<Item>> {
    let mut stmt = conn.prepare(
        "SELECT id, kind, payload, is_favorite, created_at, updated_at, last_used_at, copy_count
         FROM items",
    )?;
    let rows: Vec<(String, String, Vec<u8>, i64, i64, i64, Option<i64>, i64)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut items = Vec::with_capacity(rows.len());
    for (id, kind, payload, fav, created, updated, last_used, copies) in rows {
        let payload_bytes = aead_open(key, &payload)?;
        let p: EncryptedPayload = serde_json::from_slice(&payload_bytes)?;
        items.push(Item {
            id,
            title: p.title,
            value: p.value,
            kind,
            notes: p.notes,
            tags: p.tags,
            is_favorite: fav != 0,
            created_at: created,
            updated_at: updated,
            last_used_at: last_used,
            copy_count: copies,
        });
    }
    items.sort_by_cached_key(|it| it.title.to_lowercase());
    Ok(items)
}

pub fn set_favorite(conn: &Connection, id: &str, favorite: bool) -> Result<()> {
    let now = unix_millis();
    conn.execute(
        "UPDATE items SET is_favorite = ?1, updated_at = ?2 WHERE id = ?3",
        params![if favorite { 1 } else { 0 }, now, id],
    )?;
    Ok(())
}

pub fn mark_used(conn: &Connection, id: &str) -> Result<()> {
    let now = unix_millis();
    conn.execute(
        "UPDATE items SET last_used_at = ?1, copy_count = copy_count + 1 WHERE id = ?2",
        params![now, id],
    )?;
    Ok(())
}

pub fn insert_item(
    conn: &Connection,
    key: &[u8; KEY_LEN],
    id: &str,
    title: &str,
    kind: &str,
    value: &str,
    notes: Option<&str>,
    tags: &[String],
) -> Result<()> {
    let payload = EncryptedPayload {
        title: title.to_string(),
        value: value.to_string(),
        notes: notes.map(|s| s.to_string()),
        tags: tags.to_vec(),
    };
    let payload_json = serde_json::to_vec(&payload)?;
    let sealed = seal(key, &payload_json)?;
    let now = unix_millis();
    conn.execute(
        "INSERT INTO items(id, kind, payload, is_favorite, created_at, updated_at, last_used_at, copy_count)
         VALUES (?1, ?2, ?3, 0, ?4, ?4, NULL, 0)",
        params![id, kind, sealed, now],
    )?;
    Ok(())
}

pub fn update_item(
    conn: &Connection,
    key: &[u8; KEY_LEN],
    id: &str,
    title: &str,
    kind: &str,
    value: &str,
    notes: Option<&str>,
    tags: &[String],
) -> Result<()> {
    let payload = EncryptedPayload {
        title: title.to_string(),
        value: value.to_string(),
        notes: notes.map(|s| s.to_string()),
        tags: tags.to_vec(),
    };
    let payload_json = serde_json::to_vec(&payload)?;
    let sealed = seal(key, &payload_json)?;
    let now = unix_millis();
    conn.execute(
        "UPDATE items SET kind = ?1, payload = ?2, updated_at = ?3 WHERE id = ?4",
        params![kind, sealed, now, id],
    )?;
    Ok(())
}

pub fn delete_item(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM items WHERE id = ?1", params![id])?;
    Ok(())
}

/// Migrate from schema v1 (plaintext title column + tags table) to v2 (title and tags
/// folded into the encrypted payload).
pub fn migrate_v1_to_v2(conn: &mut Connection, key: &[u8; KEY_LEN]) -> Result<()> {
    let old_items: Vec<(String, String, Vec<u8>)> = {
        let mut stmt = conn.prepare("SELECT id, title, payload FROM items")?;
        let rows: Vec<_> = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Vec<u8>>(2)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows
    };

    let mut tags_by_item: HashMap<String, Vec<String>> = HashMap::new();
    {
        let mut stmt = conn.prepare("SELECT item_id, tag FROM tags ORDER BY tag")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        for row in rows {
            let (item_id, tag) = row?;
            tags_by_item.entry(item_id).or_default().push(tag);
        }
    }

    let tx = conn.transaction()?;
    for (id, title, payload) in &old_items {
        let pt = aead_open(key, payload)?;
        let old: LegacyEncryptedPayload = serde_json::from_slice(&pt)?;
        let new = EncryptedPayload {
            title: title.clone(),
            value: old.value,
            notes: old.notes,
            tags: tags_by_item.get(id).cloned().unwrap_or_default(),
        };
        let new_pt = serde_json::to_vec(&new)?;
        let new_sealed = seal(key, &new_pt)?;
        tx.execute(
            "UPDATE items SET payload = ?1 WHERE id = ?2",
            params![new_sealed, id],
        )?;
    }

    tx.execute_batch(
        r#"
        DROP INDEX IF EXISTS idx_items_title;
        DROP INDEX IF EXISTS idx_tags_tag;
        DROP TABLE IF EXISTS tags;

        CREATE TABLE items_new (
            id           TEXT PRIMARY KEY,
            kind         TEXT NOT NULL CHECK (kind IN ('api_key','snippet','command','note')),
            payload      BLOB NOT NULL,
            is_favorite  INTEGER NOT NULL DEFAULT 0,
            created_at   INTEGER NOT NULL,
            updated_at   INTEGER NOT NULL,
            last_used_at INTEGER,
            copy_count   INTEGER NOT NULL DEFAULT 0
        );
        INSERT INTO items_new
            SELECT id, kind, payload, is_favorite, created_at, updated_at, last_used_at, copy_count
            FROM items;
        DROP TABLE items;
        ALTER TABLE items_new RENAME TO items;
        CREATE INDEX IF NOT EXISTS idx_items_favorite ON items(is_favorite);
        "#,
    )?;

    set_meta_text(&tx, META_SCHEMA_VERSION, "2")?;
    tx.commit()?;
    Ok(())
}

fn unix_millis() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
