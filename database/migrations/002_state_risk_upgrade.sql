-- SurakshaSetu state-scoped, auditable risk and operations upgrade.
ALTER TABLE village_hazard_scores
  ADD COLUMN IF NOT EXISTS human_exposure_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS evacuation_vulnerability_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS critical_infrastructure_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS economic_assets_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS confidence_components jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weights_version text,
  ADD COLUMN IF NOT EXISTS last_field_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS risk_weight_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), state_id bigint REFERENCES states,
  hazard numeric(6,5) NOT NULL, human_exposure numeric(6,5) NOT NULL,
  evacuation_vulnerability numeric(6,5) NOT NULL, critical_infrastructure numeric(6,5) NOT NULL,
  economic_assets numeric(6,5) NOT NULL, version text NOT NULL, is_active boolean DEFAULT false,
  created_by text NOT NULL, created_at timestamptz DEFAULT now(),
  CHECK (abs(hazard + human_exposure + evacuation_vulnerability + critical_infrastructure + economic_assets - 1.0) < 0.0001)
);

ALTER TABLE shelters
  ADD COLUMN IF NOT EXISTS maximum_capacity integer CHECK (maximum_capacity >= 0),
  ADD COLUMN IF NOT EXISTS operating_status text DEFAULT 'closed',
  ADD COLUMN IF NOT EXISTS road_access_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS state_id bigint REFERENCES states;

ALTER TABLE household_surveys
  ADD COLUMN IF NOT EXISTS shelter_condition text,
  ADD COLUMN IF NOT EXISTS affected_population integer CHECK (affected_population >= 0),
  ADD COLUMN IF NOT EXISTS photo_consent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS last_field_verified_at timestamptz;

ALTER TABLE relocation_priority_results
  ADD COLUMN IF NOT EXISTS state_id bigint REFERENCES states,
  ADD COLUMN IF NOT EXISTS rank_reason text,
  ADD COLUMN IF NOT EXISTS people_at_risk integer CHECK (people_at_risk >= 0),
  ADD COLUMN IF NOT EXISTS confidence numeric(5,2),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_surveyor text;

ALTER TABLE data_import_jobs
  ADD COLUMN IF NOT EXISTS state_id bigint REFERENCES states,
  ADD COLUMN IF NOT EXISTS dataset_name text,
  ADD COLUMN IF NOT EXISTS records_imported integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS records_updated integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS records_failed integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS human_error text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS route_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), state_id bigint REFERENCES states,
  origin geometry(Point,4326) NOT NULL, destination geometry(Point,4326) NOT NULL,
  provider text NOT NULL, distance_meters integer, duration_seconds integer,
  route_safety text NOT NULL, field_verification_required boolean DEFAULT true,
  response_excerpt jsonb, calculated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS priority_active_case_unique
  ON relocation_priority_results(household_id, habitation_id)
  WHERE reviewed_at IS NULL;
CREATE INDEX IF NOT EXISTS shelters_state_idx ON shelters(state_id);
CREATE INDEX IF NOT EXISTS priority_state_score_idx ON relocation_priority_results(state_id, priority_score DESC);
CREATE INDEX IF NOT EXISTS import_jobs_state_started_idx ON data_import_jobs(state_id, started_at DESC);
CREATE INDEX IF NOT EXISTS route_origin_gix ON route_evaluations USING gist(origin);

