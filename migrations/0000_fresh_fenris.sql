CREATE TABLE `ads` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`position` integer NOT NULL,
	`original_key` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`claimed_by` text,
	`claimed_at` integer,
	`result_key` text,
	`copy` text,
	`extra_note` text DEFAULT '' NOT NULL,
	`failure_reason` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`claimed_by`) REFERENCES `runners`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ad_range" CHECK("ads"."position" BETWEEN 0 AND 9 AND "ads"."width">0 AND "ads"."height">0 AND "ads"."width"*"ads"."height"<=40000000 AND "ads"."attempt">=0 AND "ads"."updated_at">=0),
	CONSTRAINT "ad_state" CHECK("ads"."state" IN ('queued','running','done','failed')),
	CONSTRAINT "ad_claim" CHECK(("ads"."state"='running' AND "ads"."claimed_by" IS NOT NULL AND "ads"."claimed_at" IS NOT NULL) OR ("ads"."state"<>'running' AND "ads"."claimed_by" IS NULL AND "ads"."claimed_at" IS NULL)),
	CONSTRAINT "ad_result" CHECK(("ads"."state"='done' AND "ads"."result_key" IS NOT NULL AND "ads"."copy" IS NOT NULL AND json_valid("ads"."copy")) OR ("ads"."state"<>'done' AND "ads"."result_key" IS NULL AND "ads"."copy" IS NULL)),
	CONSTRAINT "ad_failure" CHECK(("ads"."state"='failed' AND length("ads"."failure_reason") BETWEEN 1 AND 1000) OR ("ads"."state"<>'failed' AND "ads"."failure_reason" IS NULL)),
	CONSTRAINT "ad_note" CHECK(length("ads"."extra_note")<=2000),
	CONSTRAINT "ad_keys" CHECK("ads"."original_key" LIKE 'batches/' || "ads"."batch_id" || '/original/%' AND ("ads"."result_key" IS NULL OR "ads"."result_key" LIKE 'batches/' || "ads"."batch_id" || '/result/%'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ad_position` ON `ads` (`batch_id`,`position`);--> statement-breakpoint
CREATE INDEX `ad_queue` ON `ads` (`state`,`updated_at`);--> statement-breakpoint
CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`brand_name` text NOT NULL,
	`problem` text NOT NULL,
	`audience` text NOT NULL,
	`solution` text NOT NULL,
	`colours` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`started_at` integer,
	CONSTRAINT "batch_text" CHECK(length(trim("batches"."brand_name")) BETWEEN 1 AND 80 AND length(trim("batches"."problem")) BETWEEN 1 AND 2000 AND length(trim("batches"."audience")) BETWEEN 1 AND 2000 AND length(trim("batches"."solution")) BETWEEN 1 AND 2000 AND length("batches"."notes") <= 4000),
	CONSTRAINT "batch_colours" CHECK(json_valid("batches"."colours") AND json_type("batches"."colours") = 'array' AND json_array_length("batches"."colours") <= 8),
	CONSTRAINT "batch_dates" CHECK("batches"."created_at" >= 0 AND ("batches"."started_at" IS NULL OR "batches"."started_at" >= "batches"."created_at"))
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`address_hash` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`attempts` integer NOT NULL,
	CONSTRAINT "login_range" CHECK("login_attempts"."attempts">=1 AND "login_attempts"."window_start">=0)
);
--> statement-breakpoint
CREATE TABLE `product_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`position` integer NOT NULL,
	`file_key` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "product_range" CHECK("product_photos"."position" BETWEEN 0 AND 9),
	CONSTRAINT "product_key" CHECK("product_photos"."file_key" LIKE 'batches/' || "product_photos"."batch_id" || '/product/%')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_position` ON `product_photos` (`batch_id`,`position`);--> statement-breakpoint
CREATE TABLE `runners` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`last_seen` integer NOT NULL,
	`codex_version` text NOT NULL,
	`signed_in` integer NOT NULL,
	CONSTRAINT "runner_values" CHECK(length("runners"."name") BETWEEN 1 AND 80 AND length("runners"."codex_version") BETWEEN 1 AND 100 AND "runners"."last_seen" >= 0 AND "runners"."signed_in" IN (0,1))
);
