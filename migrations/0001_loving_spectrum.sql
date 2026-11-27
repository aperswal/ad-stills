PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ads` (
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
	CONSTRAINT "ad_range" CHECK("__new_ads"."position" BETWEEN 0 AND 9 AND "__new_ads"."width">0 AND "__new_ads"."height">0 AND "__new_ads"."width"*"__new_ads"."height"<=40000000 AND "__new_ads"."attempt">=0 AND "__new_ads"."updated_at">=0),
	CONSTRAINT "ad_state" CHECK("__new_ads"."state" IN ('queued','running','done','failed')),
	CONSTRAINT "ad_claim" CHECK(("__new_ads"."state"='running' AND "__new_ads"."claimed_by" IS NOT NULL AND "__new_ads"."claimed_at" IS NOT NULL) OR ("__new_ads"."state"<>'running' AND "__new_ads"."claimed_by" IS NULL AND "__new_ads"."claimed_at" IS NULL)),
	CONSTRAINT "ad_result" CHECK(("__new_ads"."state"='done' AND "__new_ads"."result_key" IS NOT NULL AND "__new_ads"."copy" IS NOT NULL AND json_valid("__new_ads"."copy")) OR ("__new_ads"."state"<>'done' AND "__new_ads"."result_key" IS NULL AND "__new_ads"."copy" IS NULL)),
	CONSTRAINT "ad_failure" CHECK(("__new_ads"."state"='failed' AND length("__new_ads"."failure_reason") BETWEEN 1 AND 1000) OR ("__new_ads"."state"<>'failed' AND "__new_ads"."failure_reason" IS NULL)),
	CONSTRAINT "ad_note" CHECK(length("__new_ads"."extra_note")<=2000),
	CONSTRAINT "ad_keys" CHECK(substr("__new_ads"."original_key",1,54) = 'batches/' || "__new_ads"."batch_id" || '/original/' AND ("__new_ads"."result_key" IS NULL OR substr("__new_ads"."result_key",1,52) = 'batches/' || "__new_ads"."batch_id" || '/result/'))
);
--> statement-breakpoint
INSERT INTO `__new_ads`("id", "batch_id", "position", "original_key", "width", "height", "state", "attempt", "claimed_by", "claimed_at", "result_key", "copy", "extra_note", "failure_reason", "updated_at") SELECT "id", "batch_id", "position", "original_key", "width", "height", "state", "attempt", "claimed_by", "claimed_at", "result_key", "copy", "extra_note", "failure_reason", "updated_at" FROM `ads`;--> statement-breakpoint
DROP TABLE `ads`;--> statement-breakpoint
ALTER TABLE `__new_ads` RENAME TO `ads`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `ad_position` ON `ads` (`batch_id`,`position`);--> statement-breakpoint
CREATE INDEX `ad_queue` ON `ads` (`state`,`updated_at`);--> statement-breakpoint
CREATE TABLE `__new_product_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`position` integer NOT NULL,
	`file_key` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "product_range" CHECK("__new_product_photos"."position" BETWEEN 0 AND 9),
	CONSTRAINT "product_key" CHECK(substr("__new_product_photos"."file_key",1,53) = 'batches/' || "__new_product_photos"."batch_id" || '/product/')
);
--> statement-breakpoint
INSERT INTO `__new_product_photos`("id", "batch_id", "position", "file_key") SELECT "id", "batch_id", "position", "file_key" FROM `product_photos`;--> statement-breakpoint
DROP TABLE `product_photos`;--> statement-breakpoint
ALTER TABLE `__new_product_photos` RENAME TO `product_photos`;--> statement-breakpoint
CREATE UNIQUE INDEX `product_position` ON `product_photos` (`batch_id`,`position`);