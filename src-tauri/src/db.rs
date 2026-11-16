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
    pub is_sensitive: bool,
    pub collection_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_used_at: Option<i64>,
    pub copy_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub created_at: i64,
}

#[derive(Serialize, Deserialize)]
struct EncryptedPayload {
    title: String,
    value: String,
    notes: Option<String>,
    tags: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct EncryptedCollectionPayload {
    name: String,
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

        CREATE TABLE IF NOT EXISTS collections (
            id         TEXT PRIMARY KEY,
            payload    BLOB NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS items (
            id            TEXT PRIMARY KEY,
            kind          TEXT NOT NULL,
            payload       BLOB NOT NULL,
            is_favorite   INTEGER NOT NULL DEFAULT 0,
            is_sensitive  INTEGER NOT NULL DEFAULT 0,
            collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
            created_at    INTEGER NOT NULL,
            updated_at    INTEGER NOT NULL,
            last_used_at  INTEGER,
            copy_count    INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_items_favorite ON items(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_items_collection ON items(collection_id);
        "#,
    )?;
    set_meta_text(conn, META_SCHEMA_VERSION, "5")?;
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
        "SELECT id, kind, payload, is_favorite, is_sensitive, collection_id, created_at, updated_at, last_used_at, copy_count
         FROM items",
    )?;
    let rows: Vec<(
        String,
        String,
        Vec<u8>,
        i64,
        i64,
        Option<String>,
        i64,
        i64,
        Option<i64>,
        i64,
    )> = stmt
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
                row.get(9)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut items = Vec::with_capacity(rows.len());
    for (id, kind, payload, fav, sens, collection_id, created, updated, last_used, copies) in rows {
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
            is_sensitive: sens != 0,
            collection_id,
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
    collection_id: Option<&str>,
    is_sensitive: bool,
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
        "INSERT INTO items(id, kind, payload, is_favorite, is_sensitive, collection_id, created_at, updated_at, last_used_at, copy_count)
         VALUES (?1, ?2, ?3, 0, ?4, ?5, ?6, ?6, NULL, 0)",
        params![id, kind, sealed, if is_sensitive { 1 } else { 0 }, collection_id, now],
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
    collection_id: Option<&str>,
    is_sensitive: bool,
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
        "UPDATE items SET kind = ?1, payload = ?2, collection_id = ?3, is_sensitive = ?4, updated_at = ?5 WHERE id = ?6",
        params![kind, sealed, collection_id, if is_sensitive { 1 } else { 0 }, now, id],
    )?;
    Ok(())
}

pub fn delete_item(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM items WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn list_collections(conn: &Connection, key: &[u8; KEY_LEN]) -> Result<Vec<Collection>> {
    let mut stmt = conn.prepare("SELECT id, payload, created_at FROM collections")?;
    let rows: Vec<(String, Vec<u8>, i64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut out = Vec::with_capacity(rows.len());
    for (id, payload, created) in rows {
        let payload_bytes = aead_open(key, &payload)?;
        let p: EncryptedCollectionPayload = serde_json::from_slice(&payload_bytes)?;
        out.push(Collection {
            id,
            name: p.name,
            created_at: created,
        });
    }
    out.sort_by_cached_key(|c| c.name.to_lowercase());
    Ok(out)
}

pub fn insert_collection(
    conn: &Connection,
    key: &[u8; KEY_LEN],
    id: &str,
    name: &str,
) -> Result<()> {
    let payload = EncryptedCollectionPayload {
        name: name.to_string(),
    };
    let sealed = seal(key, &serde_json::to_vec(&payload)?)?;
    conn.execute(
        "INSERT INTO collections(id, payload, created_at) VALUES (?1, ?2, ?3)",
        params![id, sealed, unix_millis()],
    )?;
    Ok(())
}

pub fn update_collection(
    conn: &Connection,
    key: &[u8; KEY_LEN],
    id: &str,
    name: &str,
) -> Result<()> {
    let payload = EncryptedCollectionPayload {
        name: name.to_string(),
    };
    let sealed = seal(key, &serde_json::to_vec(&payload)?)?;
    conn.execute(
        "UPDATE collections SET payload = ?1 WHERE id = ?2",
        params![sealed, id],
    )?;
    Ok(())
}

pub fn delete_collection(conn: &Connection, id: &str) -> Result<()> {
    conn.execute(
        "UPDATE items SET collection_id = NULL WHERE collection_id = ?1",
        params![id],
    )?;
    conn.execute("DELETE FROM collections WHERE id = ?1", params![id])?;
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

pub fn migrate_v2_to_v3(conn: &mut Connection) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS collections (
            id         TEXT PRIMARY KEY,
            payload    BLOB NOT NULL,
            created_at INTEGER NOT NULL
        );

        ALTER TABLE items ADD COLUMN collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_items_collection ON items(collection_id);
        "#,
    )?;
    set_meta_text(&tx, META_SCHEMA_VERSION, "3")?;
    tx.commit()?;
    Ok(())
}

pub fn migrate_v3_to_v4(conn: &mut Connection) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute_batch(
        r#"
        ALTER TABLE items ADD COLUMN is_sensitive INTEGER NOT NULL DEFAULT 0;
        UPDATE items SET is_sensitive = 1 WHERE kind = 'api_key';
        "#,
    )?;
    set_meta_text(&tx, META_SCHEMA_VERSION, "4")?;
    tx.commit()?;
    Ok(())
}

pub fn migrate_v4_to_v5(conn: &mut Connection) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute_batch(
        r#"
        CREATE TABLE items_new (
            id            TEXT PRIMARY KEY,
            kind          TEXT NOT NULL,
            payload       BLOB NOT NULL,
            is_favorite   INTEGER NOT NULL DEFAULT 0,
            is_sensitive  INTEGER NOT NULL DEFAULT 0,
            collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
            created_at    INTEGER NOT NULL,
            updated_at    INTEGER NOT NULL,
            last_used_at  INTEGER,
            copy_count    INTEGER NOT NULL DEFAULT 0
        );

        INSERT INTO items_new (id, kind, payload, is_favorite, is_sensitive, collection_id, created_at, updated_at, last_used_at, copy_count)
        SELECT id, kind, payload, is_favorite, is_sensitive, collection_id, created_at, updated_at, last_used_at, copy_count
        FROM items;

        DROP TABLE items;
        ALTER TABLE items_new RENAME TO items;

        CREATE INDEX IF NOT EXISTS idx_items_favorite ON items(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_items_collection ON items(collection_id);
        "#,
    )?;
    set_meta_text(&tx, META_SCHEMA_VERSION, "5")?;
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

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a v4-shape items table (with the old kind CHECK constraint) and
    /// some rows, then run the v4→v5 migration and assert nothing was lost.
    #[test]
    fn migrate_v4_to_v5_preserves_data_and_drops_check() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE meta (key TEXT PRIMARY KEY, value BLOB NOT NULL);
            CREATE TABLE collections (id TEXT PRIMARY KEY, payload BLOB NOT NULL, created_at INTEGER NOT NULL);
            CREATE TABLE items (
                id            TEXT PRIMARY KEY,
                kind          TEXT NOT NULL CHECK (kind IN ('api_key','snippet','command','note')),
                payload       BLOB NOT NULL,
                is_favorite   INTEGER NOT NULL DEFAULT 0,
                is_sensitive  INTEGER NOT NULL DEFAULT 0,
                collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
                created_at    INTEGER NOT NULL,
                updated_at    INTEGER NOT NULL,
                last_used_at  INTEGER,
                copy_count    INTEGER NOT NULL DEFAULT 0
            );
            INSERT INTO meta(key, value) VALUES ('schema_version', '4');
            INSERT INTO collections(id, payload, created_at) VALUES ('c1', x'00', 1);
            INSERT INTO items(id, kind, payload, is_favorite, is_sensitive, collection_id, created_at, updated_at, last_used_at, copy_count)
                VALUES ('i1', 'api_key', x'01', 1, 1, 'c1', 10, 20, 99, 5);
            INSERT INTO items(id, kind, payload, is_favorite, is_sensitive, collection_id, created_at, updated_at, last_used_at, copy_count)
                VALUES ('i2', 'note', x'02', 0, 0, NULL, 11, 21, NULL, 0);
            "#,
        )
        .unwrap();

        migrate_v4_to_v5(&mut conn).unwrap();

        let version: Vec<u8> = conn
            .query_row("SELECT value FROM meta WHERE key='schema_version'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, b"5");

        let count: i64 = conn.query_row("SELECT COUNT(*) FROM items", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 2);

        let (kind, fav, sens, coll, last_used, copies): (String, i64, i64, Option<String>, Option<i64>, i64) = conn
            .query_row(
                "SELECT kind, is_favorite, is_sensitive, collection_id, last_used_at, copy_count FROM items WHERE id='i1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
            )
            .unwrap();
        assert_eq!(kind, "api_key");
        assert_eq!(fav, 1);
        assert_eq!(sens, 1);
        assert_eq!(coll, Some("c1".to_string()));
        assert_eq!(last_used, Some(99));
        assert_eq!(copies, 5);

        // The CHECK constraint should be gone — a new kind must insert cleanly.
        conn.execute(
            "INSERT INTO items(id, kind, payload, is_favorite, is_sensitive, created_at, updated_at, copy_count)
             VALUES ('i3', 'env_file', x'03', 0, 1, 12, 22, 0)",
            [],
        )
        .unwrap();

        // ON DELETE SET NULL must still fire after the rebuild.
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute("DELETE FROM collections WHERE id='c1'", []).unwrap();
        let orphan: Option<String> = conn
            .query_row("SELECT collection_id FROM items WHERE id='i1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(orphan, None);
    }
}
