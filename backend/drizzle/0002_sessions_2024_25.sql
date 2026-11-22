-- Adds academic session 2024-25 and updates the 2025-26 note: both now carry the full NCERT
-- subject and book list for Classes 1-12 (from archived copies of ncert.nic.in/textbook.php).
-- Additive only: no table or column is dropped or renamed.
INSERT OR IGNORE INTO `academic_sessions` (`id`,`code`,`is_current`,`note_hi`,`note_en`) VALUES
('session_2024_25','2024-25',0,'पुराना सत्र। NCERT की 2024-25 पुस्तक सूची (कक्षा 1-12)।','Earlier session. NCERT 2024-25 textbook list (Classes 1-12).');
--> statement-breakpoint
UPDATE `academic_sessions` SET `note_hi` = 'पिछला सत्र। NCERT की 2025-26 पुस्तक सूची (कक्षा 1-12); कक्षा 9 गणित के नमूना पाठ भी।', `note_en` = 'Previous session. NCERT 2025-26 textbook list (Classes 1-12), plus the Class 9 maths sample lessons.' WHERE `id` = 'session_2025_26';
