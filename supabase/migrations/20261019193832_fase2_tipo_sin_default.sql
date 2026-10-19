-- bnbtico · fase 2 · el tipo de alojamiento no se elige por el propietario · 2026-10-19
-- 0001 ponía `kind` con default 'casa'; el borrador nacía con «Casa» preseleccionado y el formulario debe obligar a elegir
-- («no elegimos por vos», prototipo publication.js). submit_listing ya rechaza un anuncio sin tipo.
alter table listings alter column kind drop default, alter column kind drop not null;
