-- Marca 3bstays (decisión 2026-11-11): los identificadores internos que todavía decían bnbtico.
-- Se hace antes del lanzamiento porque ahora solo hay datos de prueba.

-- 1. Consultas creadas por el equipo: source 'bnbtico' pasa a 'support'.
alter table public.inquiries drop constraint inquiries_source_check;
update public.inquiries set source = 'support' where source = 'bnbtico';
alter table public.inquiries add constraint inquiries_source_check check (source in ('listing', 'support'));

-- 2. Correo de relleno de los admins (GoTrue lo usa como etiqueta del segundo factor).
update auth.users set email = replace(email, '@admin.bnbtico.invalid', '@admin.3bstays.invalid')
where email like '%@admin.bnbtico.invalid';

CREATE OR REPLACE FUNCTION public.seed_admin(p_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update profiles set is_admin = true where phone = p_phone;
  update auth.users u set email = regexp_replace(p_phone, '\D', '', 'g') || '@admin.3bstays.invalid'
  from profiles p
  where p.id = u.id and p.phone = p_phone and coalesce(u.email, '') = '';
end $function$;

-- 3. Trabajos de pg_cron con el nombre nuevo (mismo horario y misma orden).
select cron.unschedule('bnbtico-reabrir-casas') where exists (select 1 from cron.job where jobname = 'bnbtico-reabrir-casas');
select cron.unschedule('bnbtico-suscripciones') where exists (select 1 from cron.job where jobname = 'bnbtico-suscripciones');
select cron.schedule('3bstays-reabrir-casas', '0 6 * * *', 'select public.reopen_due_listings()');
select cron.schedule('3bstays-suscripciones', '5 6 * * *', 'select public.run_subscription_day()');
