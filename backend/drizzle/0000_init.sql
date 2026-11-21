CREATE TABLE `adaptive_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`kind` text NOT NULL,
	`reason_hi` text NOT NULL,
	`reason_en` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `adaptive_recommendations_student_status_idx` ON `adaptive_recommendations` (`student_id`,`status`);--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`lang` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_events_created_at_idx` ON `analytics_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `assessment_questions` (
	`assessment_id` text NOT NULL,
	`question_id` text NOT NULL,
	`order` integer NOT NULL,
	PRIMARY KEY(`assessment_id`, `question_id`),
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`slug` text NOT NULL,
	`title_hi` text NOT NULL,
	`title_en` text NOT NULL,
	`duration_minutes` integer DEFAULT 15 NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessments_slug_unique` ON `assessments` (`slug`);--> statement-breakpoint
CREATE INDEX `assessments_chapter_id_idx` ON `assessments` (`chapter_id`);--> statement-breakpoint
CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`slug` text NOT NULL,
	`number` integer NOT NULL,
	`name_hi` text NOT NULL,
	`name_en` text NOT NULL,
	`summary_hi` text NOT NULL,
	`summary_en` text NOT NULL,
	`source` text DEFAULT 'ORIGINAL_SAMPLE' NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_slug_unique` ON `chapters` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_subject_number_uq` ON `chapters` (`subject_id`,`number`);--> statement-breakpoint
CREATE TABLE `learning_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`mastery` real DEFAULT 0 NOT NULL,
	`current_difficulty` integer DEFAULT 1 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`lesson_completed_at` integer,
	`last_activity_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_progress_student_topic_uq` ON `learning_progress` (`student_id`,`topic_id`);--> statement-breakpoint
CREATE INDEX `learning_progress_student_mastery_idx` ON `learning_progress` (`student_id`,`mastery`);--> statement-breakpoint
CREATE TABLE `learning_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`type` text NOT NULL,
	`chapter_id` text,
	`topic_id` text,
	`assessment_id` text,
	`score` integer,
	`total` integer,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `learning_sessions_student_started_idx` ON `learning_sessions` (`student_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`slug` text NOT NULL,
	`title_hi` text NOT NULL,
	`title_en` text NOT NULL,
	`content` text NOT NULL,
	`est_minutes` integer DEFAULT 8 NOT NULL,
	`source` text DEFAULT 'ORIGINAL_SAMPLE' NOT NULL,
	`is_published` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lessons_slug_unique` ON `lessons` (`slug`);--> statement-breakpoint
CREATE INDEX `lessons_topic_id_idx` ON `lessons` (`topic_id`);--> statement-breakpoint
CREATE TABLE `parent_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parent_profiles_userId_unique` ON `parent_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`slug` text NOT NULL,
	`type` text NOT NULL,
	`difficulty` integer DEFAULT 1 NOT NULL,
	`prompt_hi` text NOT NULL,
	`prompt_en` text NOT NULL,
	`options` text,
	`correct_answer` text NOT NULL,
	`hint_hi` text NOT NULL,
	`hint_en` text NOT NULL,
	`explanation_hi` text NOT NULL,
	`explanation_en` text NOT NULL,
	`source` text DEFAULT 'ORIGINAL_SAMPLE' NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_slug_unique` ON `questions` (`slug`);--> statement-breakpoint
CREATE INDEX `questions_topic_difficulty_idx` ON `questions` (`topic_id`,`difficulty`);--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_tokens_tokenHash_unique` ON `refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_user_id_idx` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `student_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`question_id` text NOT NULL,
	`session_id` text,
	`answer` text NOT NULL,
	`is_correct` integer NOT NULL,
	`difficulty` integer NOT NULL,
	`time_taken_sec` integer,
	`origin` text DEFAULT 'ONLINE' NOT NULL,
	`answered_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `learning_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `student_answers_student_answered_idx` ON `student_answers` (`student_id`,`answered_at`);--> statement-breakpoint
CREATE INDEX `student_answers_question_id_idx` ON `student_answers` (`question_id`);--> statement-breakpoint
CREATE TABLE `student_parents` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`parent_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `parent_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_parents_student_parent_uq` ON `student_parents` (`student_id`,`parent_id`);--> statement-breakpoint
CREATE INDEX `student_parents_parent_id_idx` ON `student_parents` (`parent_id`);--> statement-breakpoint
CREATE TABLE `student_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`class_level` integer DEFAULT 9 NOT NULL,
	`board` text DEFAULT 'JAC' NOT NULL,
	`state` text DEFAULT 'Jharkhand' NOT NULL,
	`district` text,
	`teaching_level` text DEFAULT 'STANDARD' NOT NULL,
	`daily_goal_minutes` integer DEFAULT 20 NOT NULL,
	`onboarding_done` integer DEFAULT false NOT NULL,
	`link_code` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_profiles_userId_unique` ON `student_profiles` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `student_profiles_linkCode_unique` ON `student_profiles` (`link_code`);--> statement-breakpoint
CREATE TABLE `student_teachers` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teacher_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_teachers_student_teacher_uq` ON `student_teachers` (`student_id`,`teacher_id`);--> statement-breakpoint
CREATE INDEX `student_teachers_teacher_id_idx` ON `student_teachers` (`teacher_id`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_hi` text NOT NULL,
	`name_en` text NOT NULL,
	`class_level` integer NOT NULL,
	`board` text NOT NULL,
	`source_note` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_slug_unique` ON `subjects` (`slug`);--> statement-breakpoint
CREATE TABLE `sync_records` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`client_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`client_created_at` integer NOT NULL,
	`processed_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_records_student_client_uq` ON `sync_records` (`student_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `teacher_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`school_name` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teacher_profiles_userId_unique` ON `teacher_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`slug` text NOT NULL,
	`order` integer NOT NULL,
	`title_hi` text NOT NULL,
	`title_en` text NOT NULL,
	`summary_hi` text NOT NULL,
	`summary_en` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_slug_unique` ON `topics` (`slug`);--> statement-breakpoint
CREATE INDEX `topics_chapter_order_idx` ON `topics` (`chapter_id`,`order`);--> statement-breakpoint
CREATE TABLE `tutor_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`title` text NOT NULL,
	`mode` text DEFAULT 'TEXT' NOT NULL,
	`topic_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tutor_conversations_student_updated_idx` ON `tutor_conversations` (`student_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `tutor_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`structured` text,
	`provider` text,
	`model` text,
	`verification` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `tutor_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tutor_messages_conversation_created_idx` ON `tutor_messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`display_name` text NOT NULL,
	`preferred_language` text DEFAULT 'HI' NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);