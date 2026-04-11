-- Fix double-encoded UTF-8 characters in mentee text fields
-- Pattern: UTF-8 bytes were interpreted as Latin1, e.g. "São" → "SÃ£o"

-- Common Portuguese double-encoding replacements
UPDATE public.mentees SET
  city = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    city,
    'Ã£', 'ã'), 'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'),
    'Ã§', 'ç'), 'Ãª', 'ê'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã', 'À'),
    'Ã‰', 'É'), 'Ã"', 'Ó'), 'Ãœ', 'Ü'), 'Ã±', 'ñ')
WHERE city ~ 'Ã';

UPDATE public.mentees SET
  full_name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    full_name,
    'Ã£', 'ã'), 'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'),
    'Ã§', 'ç'), 'Ãª', 'ê'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã', 'À'),
    'Ã‰', 'É'), 'Ã"', 'Ó'), 'Ãœ', 'Ü'), 'Ã±', 'ñ')
WHERE full_name ~ 'Ã';

UPDATE public.mentees SET
  niche = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    niche,
    'Ã£', 'ã'), 'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'),
    'Ã§', 'ç'), 'Ãª', 'ê'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã', 'À'),
    'Ã‰', 'É'), 'Ã"', 'Ó'), 'Ãœ', 'Ü'), 'Ã±', 'ñ')
WHERE niche ~ 'Ã';

UPDATE public.mentees SET
  closer_name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    closer_name,
    'Ã£', 'ã'), 'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'),
    'Ã§', 'ç'), 'Ãª', 'ê'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã', 'À'),
    'Ã‰', 'É'), 'Ã"', 'Ó'), 'Ãœ', 'Ü'), 'Ã±', 'ñ')
WHERE closer_name ~ 'Ã';

UPDATE public.mentees SET
  notes = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    notes,
    'Ã£', 'ã'), 'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'),
    'Ã§', 'ç'), 'Ãª', 'ê'), 'Ã´', 'ô'), 'Ã¢', 'â'), 'Ã', 'À'),
    'Ã‰', 'É'), 'Ã"', 'Ó'), 'Ãœ', 'Ü'), 'Ã±', 'ñ')
WHERE notes ~ 'Ã';
