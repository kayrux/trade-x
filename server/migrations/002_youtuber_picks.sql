CREATE TABLE tracked_channels (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_channel_id  VARCHAR UNIQUE NOT NULL,
    uploads_playlist_id VARCHAR NOT NULL,
    name                VARCHAR NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE,
    last_checked_at     TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE videos (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id        UUID NOT NULL REFERENCES tracked_channels(id),
    youtube_video_id  VARCHAR UNIQUE NOT NULL,
    title             VARCHAR,
    published_at      TIMESTAMP NOT NULL,
    duration_seconds  INT,
    -- pipeline state: discovered -> done / failed
    status            VARCHAR NOT NULL DEFAULT 'discovered',
    transcript_status VARCHAR,  -- ok / no_captions / error
    error_detail      TEXT,
    processed_at      TIMESTAMP,
    created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE picks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id                UUID NOT NULL REFERENCES videos(id),
    symbol_id               VARCHAR REFERENCES symbols(id),
    raw_ticker              VARCHAR,
    raw_company_name        VARCHAR,
    sentiment               VARCHAR,   -- bullish / bearish / neutral
    conviction              VARCHAR,   -- low / medium / high
    price_target            DECIMAL,
    price_target_currency   VARCHAR DEFAULT 'USD',
    notes                   TEXT,
    video_timestamp_seconds INT,
    price_at_mention        DECIMAL,
    price_at_mention_source VARCHAR,   -- quote_at_sync / candle_backfill / unavailable
    resolution_status       VARCHAR DEFAULT 'pending',  -- pending / resolved / needs_review / unmatched
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_picks_symbol   ON picks(symbol_id);
CREATE INDEX idx_videos_published ON videos(published_at);
