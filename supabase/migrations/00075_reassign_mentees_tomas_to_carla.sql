-- Reassign todos os mentorados que estavam sob responsabilidade do especialista
-- Tomás para a especialista Carla. O "responsável" pelo mentorado é rastreado
-- pela coluna mentees.created_by, que referencia profiles(id).
DO $$
DECLARE
  tomas_id uuid;
  carla_id uuid;
BEGIN
  SELECT id INTO tomas_id
  FROM public.profiles
  WHERE role = 'especialista'
    AND (lower(full_name) LIKE 'tomás%' OR lower(full_name) LIKE 'tomas%')
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO carla_id
  FROM public.profiles
  WHERE role = 'especialista'
    AND lower(full_name) LIKE 'carla%'
  ORDER BY created_at
  LIMIT 1;

  IF tomas_id IS NULL THEN
    RAISE EXCEPTION 'Especialista Tomás não encontrado em profiles';
  END IF;

  IF carla_id IS NULL THEN
    RAISE EXCEPTION 'Especialista Carla não encontrada em profiles';
  END IF;

  UPDATE public.mentees
  SET created_by = carla_id,
      updated_at = now()
  WHERE created_by = tomas_id;
END $$;
