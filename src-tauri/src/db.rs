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
    value: String,
    notes: Option<String>,
}

pub(crate) const META_SALT: &str = "salt";
pub(crate) const META_VERIFIER: &str = "verifier";
pub(crate) const META_KDF_PARAMS: &str = "kdf_params";
const META_SCHEMA_VERSION: &str = "schema_version";

pub fn init_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS meta (
            key   TEXT PRIMARY KEY,
            value BLOB NOT NULL
        );

        CREATE TABLE IF NOT EXISTS items (
            id           TEXT PRIMARY KEY,
            title        TEXT NOT NULL,
            kind         TEXT NOT NULL CHECK (kind IN ('api_key','snippet','command','note')),
            payload      BLOB NOT NULL,
            is_favorite  INTEGER NOT NULL DEFAULT 0,
            created_at   INTEGER NOT NULL,
            updated_at   INTEGER NOT NULL,
            last_used_at INTEGER,
            copy_count   INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS tags (
            item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
            tag     TEXT NOT NULL,
            PRIMARY KEY (item_id, tag)
        );

        CREATE INDEX IF NOT EXISTS idx_items_title ON items(title COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_items_favorite ON items(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag COLLATE NOCASE);
        "#,
    )?;
    set_meta_text(conn, META_SCHEMA_VERSION, "1")?;
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
        "SELECT id, title, kind, payload, is_favorite, created_at, updated_at, last_used_at, copy_count
         FROM items ORDER BY title COLLATE NOCASE",
    )?;
    let rows: Vec<(String, String, String, Vec<u8>, i64, i64, i64, Option<i64>, i64)> = stmt
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
                row.get(8)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut tag_stmt = conn.prepare("SELECT tag FROM tags WHERE item_id = ?1 ORDER BY tag")?;
    let mut items = Vec::with_capacity(rows.len());
    for (id, title, kind, payload, fav, created, updated, last_used, copies) in rows {
        let payload_bytes = aead_open(key, &payload)?;
        let payload: EncryptedPayload = serde_json::from_slice(&payload_bytes)?;
        let tags = tag_stmt
            .query_map(params![id], |row| row.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        items.push(Item {
            id,
            title,
            value: payload.value,
            kind,
            notes: payload.notes,
            tags,
            is_favorite: fav != 0,
            created_at: created,
            updated_at: updated,
            last_used_at: last_used,
            copy_count: copies,
        });
    }
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
    conn: &mut Connection,
    key: &[u8; KEY_LEN],
    id: &str,
    title: &str,
    kind: &str,
    value: &str,
    notes: Option<&str>,
    tags: &[String],
) -> Result<()> {
    let payload = EncryptedPayload {
        value: value.to_string(),
        notes: notes.map(|s| s.to_string()),
    };
    let payload_json = serde_json::to_vec(&payload)?;
    let sealed = seal(key, &payload_json)?;
    let now = unix_millis();

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO items(id, title, kind, payload, is_favorite, created_at, updated_at, last_used_at, copy_count)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?5, NULL, 0)",
        params![id, title, kind, sealed, now],
    )?;
    for tag in tags {
        tx.execute(
            "INSERT OR IGNORE INTO tags(item_id, tag) VALUES (?1, ?2)",
            params![id, tag],
        )?;
    }
    tx.commit()?;
    Ok(())
}

pub fn update_item(
    conn: &mut Connection,
    key: &[u8; KEY_LEN],
    id: &str,
    title: &str,
    kind: &str,
    value: &str,
    notes: Option<&str>,
    tags: &[String],
) -> Result<()> {
    let payload = EncryptedPayload {
        value: value.to_string(),
        notes: notes.map(|s| s.to_string()),
    };
    let payload_json = serde_json::to_vec(&payload)?;
    let sealed = seal(key, &payload_json)?;
    let now = unix_millis();

    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE items SET title = ?1, kind = ?2, payload = ?3, updated_at = ?4 WHERE id = ?5",
        params![title, kind, sealed, now, id],
    )?;
    tx.execute("DELETE FROM tags WHERE item_id = ?1", params![id])?;
    for tag in tags {
        tx.execute(
            "INSERT OR IGNORE INTO tags(item_id, tag) VALUES (?1, ?2)",
            params![id, tag],
        )?;
    }
    tx.commit()?;
    Ok(())
}

pub fn delete_item(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM items WHERE id = ?1", params![id])?;
    Ok(())
}

fn unix_millis() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
