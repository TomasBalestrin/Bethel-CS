-- Reassign todos os mentorados que tinham o Tomás como "responsável" (nome
-- exibido no card) para a Carla. O nome mostrado vem de profiles.full_name
-- via mentees.created_by — independentemente do role. Tomás não está
-- cadastrado com role='especialista', então não filtramos por role aqui.
DO $$
DECLARE
  tomas_id uuid;
  carla_id uuid;
BEGIN
  SELECT id INTO tomas_id
  FROM public.profiles
  WHERE lower(full_name) LIKE 'tomás%' OR lower(full_name) LIKE 'tomas%'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO carla_id
  FROM public.profiles
  WHERE lower(full_name) LIKE 'carla%'
  ORDER BY created_at
  LIMIT 1;

  IF tomas_id IS NULL THEN
    RAISE EXCEPTION 'Tomás não encontrado em profiles';
  END IF;

  IF carla_id IS NULL THEN
    RAISE EXCEPTION 'Carla não encontrada em profiles';
  END IF;

  UPDATE public.mentees
  SET created_by = carla_id,
      updated_at = now()
  WHERE created_by = tomas_id;
END $$;
