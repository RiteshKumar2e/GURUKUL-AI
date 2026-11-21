CREATE TABLE `academic_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`is_current` integer DEFAULT false NOT NULL,
	`note_hi` text,
	`note_en` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `academic_sessions_code_unique` ON `academic_sessions` (`code`);--> statement-breakpoint
CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name_hi` text NOT NULL,
	`name_en` text NOT NULL,
	`state` text,
	`basis` text,
	`status` text NOT NULL,
	`note_hi` text,
	`note_en` text,
	`source_url` text,
	`order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boards_code_unique` ON `boards` (`code`);--> statement-breakpoint
CREATE TABLE `class_levels` (
	`level` integer PRIMARY KEY NOT NULL,
	`stage` text NOT NULL,
	`name_hi` text NOT NULL,
	`name_en` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `student_curricula` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`board_id` text NOT NULL,
	`session_id` text NOT NULL,
	`class_level` integer NOT NULL,
	`medium` text DEFAULT 'HI' NOT NULL,
	`stream` text,
	`is_active` integer DEFAULT true NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `academic_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_level`) REFERENCES `class_levels`(`level`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `student_curricula_student_active_idx` ON `student_curricula` (`student_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `student_subjects` (
	`curriculum_id` text NOT NULL,
	`subject_id` text NOT NULL,
	PRIMARY KEY(`curriculum_id`, `subject_id`),
	FOREIGN KEY (`curriculum_id`) REFERENCES `student_curricula`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `student_subjects_subject_idx` ON `student_subjects` (`subject_id`);--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `guardian_consent_declared_at` integer;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD `guardian_consent_confirmed_at` integer;--> statement-breakpoint
ALTER TABLE `subjects` ADD `board_id` text REFERENCES boards(id);--> statement-breakpoint
ALTER TABLE `subjects` ADD `session_id` text REFERENCES academic_sessions(id);--> statement-breakpoint
ALTER TABLE `subjects` ADD `subject_key` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `verification` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `books` text;--> statement-breakpoint
ALTER TABLE `subjects` ADD `chapter_count` integer;--> statement-breakpoint
ALTER TABLE `subjects` ADD `order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `subjects_board_session_class_idx` ON `subjects` (`board_id`,`session_id`,`class_level`);--> statement-breakpoint
ALTER TABLE `tutor_conversations` ADD `subject_id` text REFERENCES subjects(id);--> statement-breakpoint
-- Reference data. Board status is honest about verification; see backend/content/curriculum-catalog.json.
INSERT OR IGNORE INTO `boards` (`id`,`code`,`name_hi`,`name_en`,`state`,`basis`,`status`,`note_hi`,`note_en`,`source_url`,`order`) VALUES
('board_jac','JAC','झारखंड अधिविद्य परिषद (JAC)','Jharkhand Academic Council (JAC)','Jharkhand','NCERT','UNVERIFIED','विषय सूची NCERT की आधिकारिक पुस्तक सूची से है। JAC के चालू सत्र का आधिकारिक पाठ्यक्रम जाँचा नहीं जा सका।','Subjects come from NCERT''s official textbook list. The current JAC syllabus could not be checked against an official document.','https://jac.jharkhand.gov.in',0),
('board_cbse','CBSE','केंद्रीय माध्यमिक शिक्षा बोर्ड (CBSE)','Central Board of Secondary Education (CBSE)',NULL,'NCERT','PARTIAL','विषय और पुस्तकें NCERT की आधिकारिक पुस्तक सूची (सत्र 2026-27) से हैं। CBSE की अपनी विषय-योजना अलग से नहीं जाँची गई।','Subjects and books come from NCERT''s official textbook list (2026-27). CBSE''s own scheme of studies was not checked separately.','https://ncert.nic.in/textbook.php',1),
('board_icse','ICSE','ICSE (CISCE)','ICSE (CISCE)',NULL,NULL,'NOT_AVAILABLE','इस बोर्ड का पाठ्यक्रम अभी उपलब्ध नहीं है।','This board''s curriculum is not available yet.',NULL,2);
--> statement-breakpoint
INSERT OR IGNORE INTO `academic_sessions` (`id`,`code`,`is_current`,`note_hi`,`note_en`) VALUES
('session_2026_27','2026-27',1,'चालू सत्र। NCERT की 2026-27 पुस्तक सूची।','Current session. NCERT 2026-27 textbook list.'),
('session_2025_26','2025-26',0,'पिछला सत्र। केवल कक्षा 9 गणित के नमूना पाठ (पुरानी NCERT पुस्तक पर आधारित)।','Previous session. Only the Class 9 maths sample lessons (based on the earlier NCERT book).');
--> statement-breakpoint
INSERT OR IGNORE INTO `class_levels` (`level`,`stage`,`name_hi`,`name_en`) VALUES
(1,'PRIMARY','कक्षा 1','Class 1'),(2,'PRIMARY','कक्षा 2','Class 2'),(3,'PRIMARY','कक्षा 3','Class 3'),(4,'PRIMARY','कक्षा 4','Class 4'),(5,'PRIMARY','कक्षा 5','Class 5'),
(6,'MIDDLE','कक्षा 6','Class 6'),(7,'MIDDLE','कक्षा 7','Class 7'),(8,'MIDDLE','कक्षा 8','Class 8'),
(9,'SECONDARY','कक्षा 9','Class 9'),(10,'SECONDARY','कक्षा 10','Class 10'),
(11,'SENIOR_SECONDARY','कक्षा 11','Class 11'),(12,'SENIOR_SECONDARY','कक्षा 12','Class 12');
--> statement-breakpoint
-- The existing Class 9 maths content (earlier NCERT book) becomes JAC, session 2025-26.
UPDATE `subjects` SET `board_id`='board_jac', `session_id`='session_2025_26', `subject_key`='mathematics', `verification`='PARTIAL', `chapter_count`=12 WHERE `slug`='class-9-maths' AND `board_id` IS NULL;
--> statement-breakpoint
-- Every existing student keeps learning what they learn today: an active Class 9 JAC 2025-26 selection.
INSERT INTO `student_curricula` (`id`,`student_id`,`board_id`,`session_id`,`class_level`,`medium`,`is_active`,`started_at`)
SELECT lower(hex(randomblob(16))), sp.`id`, CASE WHEN sp.`board`='CBSE' THEN 'board_cbse' ELSE 'board_jac' END, 'session_2025_26',
       CASE WHEN sp.`class_level` BETWEEN 1 AND 12 THEN sp.`class_level` ELSE 9 END, CASE WHEN u.`preferred_language`='EN' THEN 'EN' ELSE 'HI' END, 1, sp.`created_at`
FROM `student_profiles` sp JOIN `users` u ON u.`id` = sp.`user_id`
WHERE NOT EXISTS (SELECT 1 FROM `student_curricula` c WHERE c.`student_id` = sp.`id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `student_subjects` (`curriculum_id`,`subject_id`)
SELECT c.`id`, s.`id` FROM `student_curricula` c JOIN `subjects` s ON s.`slug`='class-9-maths'
WHERE c.`session_id`='session_2025_26' AND c.`class_level`=9;
