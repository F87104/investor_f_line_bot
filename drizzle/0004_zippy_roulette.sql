CREATE TABLE `analysis_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memoId` int NOT NULL,
	`maedaAbstraction` text,
	`maedaConcrete` text,
	`maedaTransfer` text,
	`maedaInsight` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysis_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categorizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memoId` int NOT NULL,
	`abstractionInput` text,
	`concreteInput` text,
	`transferInput` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categorizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` varchar(64) NOT NULL,
	`factContent` text NOT NULL,
	`status` enum('draft','categorizing','completed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `memos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `messages` ADD `messageType` enum('memo_input','workflow_step','analysis_result','notification') DEFAULT 'memo_input';--> statement-breakpoint
ALTER TABLE `messages` DROP COLUMN `category`;