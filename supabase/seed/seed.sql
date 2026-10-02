-- Seed de ejemplo (mismas casas que el prototipo). Solo para desarrollo local.
-- Requiere usuarios en auth.users; en local crearlos con supabase CLI o sustituir los uuid.
insert into profiles (id, role, full_name, phone, phone_verified_at) values
 ('00000000-0000-0000-0000-000000000001','owner','Marcela Rodríguez','+50688880001',now()),
 ('00000000-0000-0000-0000-000000000002','owner','Gerardo Mora','+50688880002',now()),
 ('00000000-0000-0000-0000-000000000003','owner','Familia Solano','+50688880003',now()),
 ('00000000-0000-0000-0000-000000000010','client','Andrea Castro','+50687123344',now())
on conflict do nothing;

insert into owner_profiles (user_id, id_number, verification_status, business_whatsapp, verified_at) values
 ('00000000-0000-0000-0000-000000000001','5-0xxx-0xxx','approved','+50688880001',now()),
 ('00000000-0000-0000-0000-000000000002','2-0xxx-0xxx','approved','+50688880002',now()),
 ('00000000-0000-0000-0000-000000000003','6-0xxx-0xxx','approved','+50688880003',now())
on conflict do nothing;

insert into listings (owner_id, mode, kind, title, description, province, canton, zone, capacity, bedrooms, bathrooms, amenities, currency, base_price, min_nights, status) values
 ('00000000-0000-0000-0000-000000000001','vac','casa','Villa Brisa frente al mar','Casa de dos plantas a 150 m de Playa Tamarindo. Rancho con hamacas, piscina privada y parrilla.','Guanacaste','Santa Cruz','Tamarindo',6,3,2,'{pool,pets,ac,wifi,ev_charger,parking}','CRC',95000,2,'active'),
 ('00000000-0000-0000-0000-000000000002','vac','quinta','Quinta Los Robles','Quinta para grupos grandes con vista al volcán Arenal, piscina temperada y salón de juegos.','Alajuela','San Carlos','La Fortuna',12,5,4,'{pool,pets,ac,wifi,ev_charger,bbq,parking}','CRC',150000,2,'active'),
 ('00000000-0000-0000-0000-000000000003','vac','casa','Casa Tucán con piscina','Casa amplia en condominio con seguridad 24 h, a 5 min de la playa.','Puntarenas','Garabito','Jacó',8,4,3,'{pool,ac,wifi,ev_charger,bbq,parking}','USD',120,2,'active'),
 ('00000000-0000-0000-0000-000000000001','largo','apto','Apartamento amueblado Escazú','Apartamento de 2 habitaciones en torre con gimnasio y piscina. Depósito: 1 mes.','San José','Escazú','San Rafael',2,2,2,'{pool,wifi,furnished,garage,ev_charger}','USD',650,1,'active');
