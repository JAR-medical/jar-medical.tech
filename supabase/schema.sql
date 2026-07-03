-- TriARge — optional Supabase (hybrid cloud) schema.
-- Apply in the Supabase SQL editor. The hub pushes via PostgREST upserts;
-- the local SQLite DB remains the source of truth at the incident site.

create table if not exists patients (
    incident_id  text not null,
    marker_id    integer not null,
    category     text not null default 'UNSIGHTED',
    sex          text,
    age_estimate integer,
    ambulatory   boolean,
    conscious    boolean,
    airway_clear boolean,
    location     text,
    vitals       jsonb not null default '{}',
    injuries     jsonb not null default '[]',
    treatments   jsonb not null default '[]',
    notes        jsonb not null default '[]',
    version      integer not null default 0,
    created_at   timestamptz,
    updated_at   timestamptz,
    primary key (incident_id, marker_id)
);

create table if not exists protocol_entries (
    incident_id text not null,
    local_id    integer not null,
    marker_id   integer not null,
    timestamp   timestamptz,
    source      text not null default '',
    author      text not null default '',
    transcript  text not null default '',
    structured  jsonb not null default '{}',
    primary key (incident_id, local_id)
);

create table if not exists radio_log (
    incident_id  text not null,
    local_id     integer not null,
    timestamp    timestamptz,
    transcript   text not null default '',
    patient_refs jsonb not null default '[]',
    structured   jsonb not null default '{}',
    primary key (incident_id, local_id)
);

-- Patient data: lock the tables down; the hub authenticates with the
-- service-role key which bypasses RLS. No anonymous access.
alter table patients enable row level security;
alter table protocol_entries enable row level security;
alter table radio_log enable row level security;
