-- Segundo factor del admin por app de autenticación (TOTP) en vez de teléfono (decisión 2026-10-23: el MFA por teléfono
-- de Supabase es solo del plan Pro). GoTrue rotula el factor TOTP con el correo del usuario de auth y, si no tiene, la
-- inscripción falla («AccountName must be set»). Las cuentas de bnbtico solo tienen teléfono, así que seed_admin le pone
-- al admin un correo que no recibe nada (dominio reservado .invalid, sin confirmar: no abre ningún otro ingreso) y que
-- solo sirve de rótulo en la app de autenticación. La exigencia aal2 de is_admin() no cambia.
create or replace function seed_admin(p_phone text) returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set is_admin = true where phone = p_phone;
  update auth.users u set email = regexp_replace(p_phone, '\D', '', 'g') || '@admin.bnbtico.invalid'
  from profiles p
  where p.id = u.id and p.phone = p_phone and coalesce(u.email, '') = '';
end $$;
revoke execute on function seed_admin(text) from public, anon, authenticated;
