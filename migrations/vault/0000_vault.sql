CREATE TABLE vaults (
 id text PRIMARY KEY,
 auth_verifier_hash text NOT NULL CHECK (length(auth_verifier_hash)=64),
 encrypted_blob text NOT NULL CHECK (octet_length(encrypted_blob)<=9437184),
 version integer NOT NULL DEFAULT 1 CHECK (version>0),
 schema_version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE services (id text PRIMARY KEY, name text NOT NULL, category text NOT NULL, metadata text NOT NULL);
CREATE TABLE service_aliases (id text PRIMARY KEY, service_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE, alias text NOT NULL);
