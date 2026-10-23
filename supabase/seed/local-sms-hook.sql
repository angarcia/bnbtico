-- Solo local y CI (lo carga `supabase start` / `db reset` por [db.seed] en config.toml; nunca va al proyecto alojado).
-- El reto MFA por teléfono no admite los números de prueba de [auth.sms.test_otp]: GoTrue genera un código propio y lo
-- envía. En local no hay Twilio, así que el envío pasa por este hook, que guarda el mensaje en una tabla fuera de la API
-- (esquema local_test, no expuesto ni incluido en los tipos). Las pruebas leen ahí el código del segundo factor.
create schema if not exists local_test;

create table if not exists local_test.sms (
  id bigserial primary key,
  phone text not null,
  otp text not null,
  sms_type text,
  created_at timestamptz not null default now()
);

create or replace function local_test.send_sms(event jsonb) returns jsonb language plpgsql as $$
begin
  insert into local_test.sms (phone, otp, sms_type)
  values (event -> 'user' ->> 'phone', event -> 'sms' ->> 'otp', event -> 'sms' ->> 'sms_type');
  return '{}'::jsonb;
end $$;

grant usage on schema local_test to supabase_auth_admin;
grant insert, select on local_test.sms to supabase_auth_admin;
grant usage on sequence local_test.sms_id_seq to supabase_auth_admin;
grant execute on function local_test.send_sms(jsonb) to supabase_auth_admin;
revoke execute on function local_test.send_sms(jsonb) from public, anon, authenticated;
