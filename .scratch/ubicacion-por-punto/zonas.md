# Zonas del Caribe (borrador de OpenStreetMap)

> **Status: borrador cargado sin revisar (Daniel no disponible el 2026-10-27). Revisar antes del lanzamiento; los cambios van en una migración nueva.**

**Borrador sin revisar por Daniel.** Se carga entero en `public.zones` (migración `*_zonas.sql`), también las filas «revisar»: la marca vive aquí, no en la base.

Generado con `node scripts/osm-zonas/borrador.mjs` a partir de OpenStreetMap (Overpass, 2026-10-28; © colaboradores de OpenStreetMap, ODbL 1.0).

## Origen y limpieza

- Consulta: nodos `place=city|town|village|hamlet|suburb|neighbourhood` y `natural=beach` (nodo, vía o relación; el centro) con nombre dentro de `ISO3166-2=CR-L`. **`city` y `town` se añaden a la lista de la spec** para que entren Limón, Guápiles, Siquirres y Bribrí.
- Cada punto se ubica con `place_at` de la base local; solo quedan los cantones 701–706 (Limón, Pococí, Siquirres, Talamanca, Matina, Guácimo). Lo que cae en el mar a más de 500 m (islas, arrecifes) o fuera de Limón no entra.
- Fuera los elementos sin nombre.
- Fuera las playas «Playa X» (o «Playa de X») a 1,5 km o menos de un lugar «X».
- Mismo nombre normalizado (sin tildes ni mayúsculas) a 1 km o menos: uno solo, el `place` antes que la playa. Entre dos playas con el mismo nombre, 2 km (el nodo y la vía de una misma playa).
- El nodo `place=city` «Limón» pasa a llamarse «Limón centro».
- Obligatorias: Puerto Viejo, Playa Negra, Cocles, Playa Chiquita, Punta Uva, Manzanillo, Cahuita, Hone Creek, Bribrí y Limón centro. Si OSM no trae alguna, entra a mano (`OSM` = `manual`) con el punto de `FREQUENT_ZONES`, comprobado con `place_at`. Entre varias con su nombre, el id base es para la más cercana a ese punto.
- Id: `<cantón>-<nombre sin tildes>`; si se repite en el cantón, `-2`, `-3`…
- **Incluir:** «sí» para city, town, village, suburb, playas y las obligatorias; «revisar» para hamlet y neighbourhood (caseríos, fincas y barrios: muchos sobran o se repiten).

Resultado: **1092 zonas (1037 para revisar)**. Descartados: 0 fuera de los cantones de Limón, 9 playas junto a su pueblo, 4 repetidos.

Por cantón: Guácimo 137, Limón 214, Matina 120, Pococí 298, Siquirres 164, Talamanca 159.

| id | Zona | Cantón | Distrito | lat | lng | OSM | Incluir |
|---|---|---|---|---|---|---|---|
| 701-aguas-zarcas | Aguas Zarcas | Limón | Matama | 9.894951 | -83.11342 | node/5172275627 (hamlet) | revisar |
| 701-alsacia | Alsacia | Limón | Valle La Estrella | 9.722989 | -82.963492 | node/5173837021 (neighbourhood) | revisar |
| 701-alto-almirante | Alto Almirante | Limón | Valle La Estrella | 9.769871 | -83.332104 | node/5173557877 (hamlet) | revisar |
| 701-alto-coen | Alto Coen | Limón | Valle La Estrella | 9.68034 | -83.140019 | node/5035262416 (hamlet) | revisar |
| 701-alto-shikiari | Alto Shikiari | Limón | Valle La Estrella | 9.77198 | -83.35193 | node/5173553620 (hamlet) | revisar |
| 701-armenia | Armenia | Limón | Valle La Estrella | 9.745209 | -82.989088 | node/5033614682 (neighbourhood) | revisar |
| 701-arrocera | Arrocera | Limón | Valle La Estrella | 9.67991 | -83.148966 | node/5035262417 (neighbourhood) | revisar |
| 701-asuncion | Asunción | Limón | Matama | 9.894453 | -83.15243 | node/1342971871 (hamlet) | revisar |
| 701-atalanta | Atalanta | Limón | Valle La Estrella | 9.707217 | -82.991014 | node/8716059302 (neighbourhood) | revisar |
| 701-bajo-coen | Bajo Coen | Limón | Valle La Estrella | 9.71532 | -83.117482 | node/9885953002 (neighbourhood) | revisar |
| 701-bakche | Bakche | Limón | Valle La Estrella | 9.657486 | -83.39727 | node/9490617096 (neighbourhood) | revisar |
| 701-bananito-norte | Bananito Norte | Limón | Matama | 9.885749 | -83.014879 | node/3609366794 (hamlet) | revisar |
| 701-bananito-sur | Bananito Sur | Limón | Valle La Estrella | 9.872395 | -83.002598 | node/3609366795 (hamlet) | revisar |
| 701-bayei | Bäyeï | Limón | Valle La Estrella | 9.792111 | -83.323251 | node/5173553655 (hamlet) | revisar |
| 701-bayeinak | Bayeiñak | Limón | Valle La Estrella | 9.813566 | -83.324748 | node/8715719004 (hamlet) | revisar |
| 701-bella-vista | Bella Vista | Limón | Valle La Estrella | 9.699831 | -83.122079 | node/5035262413 (hamlet) | revisar |
| 701-bella-vista-2 | Bella Vista | Limón | Limón | 9.995 | -83.035308 | node/5174155195 (neighbourhood) | revisar |
| 701-beverly | Beverly | Limón | Matama | 9.92501 | -83.038293 | node/1459463736 (hamlet) | revisar |
| 701-blorinak | Blöriñak | Limón | Valle La Estrella | 9.770518 | -83.376099 | node/5173549189 (hamlet) | revisar |
| 701-boca-coen | Boca Coen | Limón | Valle La Estrella | 9.722143 | -83.099823 | node/5035262411 (hamlet) | revisar |
| 701-boca-estrella | Boca Estrella | Limón | Valle La Estrella | 9.80142 | -82.899505 | node/5173921270 (hamlet) | revisar |
| 701-bocuare | Bocuare | Limón | Valle La Estrella | 9.698771 | -82.936739 | node/943900989 (hamlet) | revisar |
| 701-bohio | Bohío | Limón | Limón | 10.000986 | -83.029925 | node/5174142364 (neighbourhood) | revisar |
| 701-bonifacio | Bonifacio | Limón | Valle La Estrella | 9.782314 | -82.917149 | node/3609338248 (hamlet) | revisar |
| 701-brisas | Brisas | Limón | Río Blanco | 9.971013 | -83.17787 | node/8707176440 (hamlet) | revisar |
| 701-brisas-de-veragua | Brisas de Veragua | Limón | Río Blanco | 9.959189 | -83.197129 | node/5172562065 (hamlet) | revisar |
| 701-buena-vista | Buena Vista | Limón | Valle La Estrella | 9.810063 | -82.961126 | node/5173898532 (neighbourhood) | revisar |
| 701-buenos-aires | Buenos Aires | Limón | Limón | 9.985704 | -83.087962 | node/13304892207 (neighbourhood) | revisar |
| 701-buenos-aires-2 | Buenos Aires | Limón | Valle La Estrella | 9.820449 | -82.971416 | node/5173902291 (hamlet) | revisar |
| 701-bufalo | Búfalo | Limón | Río Blanco | 10.003139 | -83.169251 | node/1080689531 (hamlet) | revisar |
| 701-burrico | Burrico | Limón | Valle La Estrella | 9.857031 | -82.999495 | node/5035263222 (hamlet) | revisar |
| 701-cano-negro | Caño Negro | Limón | Valle La Estrella | 9.808224 | -83.034986 | node/5035262420 (hamlet) | revisar |
| 701-caribe | Caribe | Limón | Río Blanco | 9.992935 | -83.145494 | node/8706958854 (neighbourhood) | revisar |
| 701-cartagena | Cartagena | Limón | Valle La Estrella | 9.712865 | -83.02247 | node/5034845412 (hamlet) | revisar |
| 701-casa-amarilla | Casa Amarilla | Limón | Valle La Estrella | 9.867116 | -82.991887 | node/13305511093 (neighbourhood) | revisar |
| 701-casa-amarilla-2 | Casa Amarilla | Limón | Valle La Estrella | 9.730278 | -83.032658 | node/5173663395 (neighbourhood) | revisar |
| 701-castillo-nuevo | Castillo Nuevo | Limón | Matama | 9.927519 | -83.0571 | node/3609367877 (neighbourhood) | revisar |
| 701-cedar-creek | Cedar Creek | Limón | Río Blanco | 10.008725 | -83.196539 | node/1215742949 (hamlet) | revisar |
| 701-ceibon | Ceibón | Limón | Limón | 9.975914 | -83.050426 | node/3607798428 (neighbourhood) | revisar |
| 701-centro | Centro | Limón | Limón | 9.994236 | -83.030084 | node/13311220529 (neighbourhood) | revisar |
| 701-cerere | Cerere | Limón | Valle La Estrella | 9.701549 | -83.041535 | node/5034845413 (hamlet) | revisar |
| 701-cerro-mocho | Cerro Mocho | Limón | Limón | 9.997884 | -83.037806 | node/13315414738 (neighbourhood) | revisar |
| 701-cerro-uatsi | Cerro Uatsi | Limón | Valle La Estrella | 9.623079 | -82.939464 | node/5034845405 (hamlet) | revisar |
| 701-cielo-amarillo | Cielo Amarillo | Limón | Limón | 9.991234 | -83.059069 | node/5987527418 (neighbourhood) | revisar |
| 701-cieneguita | Cieneguita | Limón | Limón | 9.970575 | -83.031099 | node/9885803459 (neighbourhood) | revisar |
| 701-cocal | Cocal | Limón | Limón | 10.016856 | -83.116254 | node/5174098925 (neighbourhood) | revisar |
| 701-coco-de-rasta-beach | Coco de Rasta Beach | Limón | Valle La Estrella | 9.85134 | -82.93912 | way/1419720493 (beach) | sí |
| 701-colonia-santa-rita | Colonia Santa Rita | Limón | Río Blanco | 9.971072 | -83.126937 | node/2084940651 (hamlet) | revisar |
| 701-corales-1 | Corales 1 | Limón | Limón | 9.994197 | -83.044103 | node/3607868015 (neighbourhood) | revisar |
| 701-corales-2 | Corales 2 | Limón | Limón | 9.998919 | -83.042127 | node/2331053338 (neighbourhood) | revisar |
| 701-corales-3 | Corales 3 | Limón | Limón | 9.998554 | -83.04544 | node/3607868699 (neighbourhood) | revisar |
| 701-cristobal-colon | Cristobal Colón | Limón | Limón | 9.980192 | -83.032338 | node/697106094 (neighbourhood) | revisar |
| 701-doknari | Dokñari | Limón | Valle La Estrella | 9.61438 | -83.487876 | node/5173440363 (neighbourhood) | revisar |
| 701-dondonia-dos | Dondonia Dos | Limón | Matama | 9.904859 | -83.048662 | node/5172239175 (hamlet) | revisar |
| 701-dondonia-uno | Dondonia Uno | Limón | Matama | 9.891465 | -83.059255 | node/5172255125 (hamlet) | revisar |
| 701-dos-bocas | Dos Bocas | Limón | Valle La Estrella | 9.64309 | -82.969704 | node/1467795526 (hamlet) | revisar |
| 701-dos-bocas-2 | Dos Bocas | Limón | Limón | 10.066808 | -83.154188 | node/5174083013 (neighbourhood) | revisar |
| 701-duruy | Duruy | Limón | Valle La Estrella | 9.66146 | -82.964966 | node/5034845402 (hamlet) | revisar |
| 701-dusirinak | Dusiriñak | Limón | Valle La Estrella | 9.800353 | -83.313226 | node/8715719014 (hamlet) | revisar |
| 701-el-bambu-1 | El Bambú 1 | Limón | Limón | 9.991869 | -83.043279 | node/13314589385 (neighbourhood) | revisar |
| 701-el-bambu-2 | El Bambú 2 | Limón | Limón | 9.993411 | -83.04765 | node/6589962709 (neighbourhood) | revisar |
| 701-el-bosque | El Bosque | Limón | Limón | 10.004955 | -83.053571 | node/5174131774 (neighbourhood) | revisar |
| 701-el-fortin | El Fortín | Limón | Limón | 9.990189 | -83.03492 | node/13315426998 (neighbourhood) | revisar |
| 701-el-hueco | El Hueco | Limón | Valle La Estrella | 9.877471 | -82.998911 | node/13306543668 (neighbourhood) | revisar |
| 701-el-progreso | El Progreso | Limón | Valle La Estrella | 9.761432 | -83.047665 | node/5034845415 (hamlet) | revisar |
| 701-el-progreso-2 | El Progreso | Limón | Valle La Estrella | 9.746411 | -82.948874 | node/5173911558 (neighbourhood) | revisar |
| 701-el-tigre | El Tigre | Limón | Matama | 9.922745 | -83.119067 | node/5172177131 (hamlet) | revisar |
| 701-empalme-moin | Empalme Moín | Limón | Limón | 9.999621 | -83.071716 | node/5174098927 (neighbourhood) | revisar |
| 701-envaco | Envaco | Limón | Limón | 9.979608 | -83.04742 | node/5175680078 (neighbourhood) | revisar |
| 701-escuela-jamari-tawa | Escuela Jamari Täwä | Limón | Valle La Estrella | 9.764954 | -83.361543 | node/5173550062 (neighbourhood) | revisar |
| 701-estero-negro | Estero Negro | Limón | Valle La Estrella | 9.850911 | -82.940792 | node/5174018536 (neighbourhood) | revisar |
| 701-filadelfia-norte | Filadelfia Norte | Limón | Matama | 9.936433 | -83.045324 | node/5172144261 (neighbourhood) | revisar |
| 701-filadelfia-sur | Filadelfia Sur | Limón | Matama | 9.926743 | -83.037824 | node/5172144260 (neighbourhood) | revisar |
| 701-finca-8 | Finca 8 | Limón | Valle La Estrella | 9.734575 | -82.976357 | node/5173869776 (neighbourhood) | revisar |
| 701-finca-luna | Finca Luna | Limón | Limón | 9.956976 | -83.062175 | node/13294835386 (neighbourhood) | revisar |
| 701-gavilan | Gavilán | Limón | Valle La Estrella | 9.726527 | -83.07015 | node/5035262408 (village) | sí |
| 701-hospital | Hospital | Limón | Limón | 10.001365 | -83.027623 | node/3607868686 (neighbourhood) | revisar |
| 701-i-griega | I Griega | Limón | Valle La Estrella | 9.796682 | -82.920671 | node/5173921667 (hamlet) | revisar |
| 701-isaias-marchena | Isaías Marchena | Limón | Limón | 9.980458 | -83.078387 | node/3607855734 (neighbourhood) | revisar |
| 701-isla-cariey | Isla Cariey | Limón | Valle La Estrella | 9.730201 | -83.117655 | node/5173754952 (neighbourhood) | revisar |
| 701-isla-cohen | Isla Cohén | Limón | Valle La Estrella | 9.722413 | -83.116161 | node/5173754953 (neighbourhood) | revisar |
| 701-jabuy-kekoldy | Jabuy Kekoldy | Limón | Valle La Estrella | 9.704871 | -83.094431 | node/5035262412 (hamlet) | revisar |
| 701-jamari-tawa | Jamari Täwä | Limón | Valle La Estrella | 9.765351 | -83.361667 | node/5173550061 (hamlet) | revisar |
| 701-juan-goban | Juan Gobán | Limón | Limón | 9.981554 | -83.043941 | node/3607801063 (neighbourhood) | revisar |
| 701-juan-pablo-ii | Juan Pablo II | Limón | Limón | 9.986805 | -83.057898 | node/3607856650 (neighbourhood) | revisar |
| 701-kalvery | Kalvery | Limón | Valle La Estrella | 9.732719 | -83.094996 | node/5035262410 (neighbourhood) | revisar |
| 701-kent | Kent | Limón | Matama | 9.904386 | -83.028555 | node/3746583325 (hamlet) | revisar |
| 701-koiyawari | Köiyawari | Limón | Valle La Estrella | 9.762859 | -83.34659 | node/5173553922 (hamlet) | revisar |
| 701-konobata | Konobata | Limón | Valle La Estrella | 9.66496 | -83.41231 | node/5173501523 (hamlet) | revisar |
| 701-ksarabata | Ksarabata | Limón | Valle La Estrella | 9.662907 | -83.40558 | node/8715680643 (hamlet) | revisar |
| 701-kunabri | Kunabri | Limón | Valle La Estrella | 9.671572 | -83.153901 | node/5035262418 (neighbourhood) | revisar |
| 701-kushei | Kushei | Limón | Valle La Estrella | 9.736318 | -83.086286 | node/5035262409 (neighbourhood) | revisar |
| 701-la-bomba | La Bomba | Limón | Matama | 9.922468 | -83.058499 | node/1459465286 (village) | sí |
| 701-la-cabana | La Cabaña | Limón | Valle La Estrella | 9.741865 | -82.959435 | node/5034810796 (neighbourhood) | revisar |
| 701-la-colina | La Colina | Limón | Limón | 9.983507 | -83.051453 | node/3607856649 (neighbourhood) | revisar |
| 701-la-colonia | La Colonia | Limón | Valle La Estrella | 9.738523 | -82.988167 | node/5033541679 (neighbourhood) | revisar |
| 701-la-colonia-2 | La Colonia | Limón | Valle La Estrella | 9.750955 | -83.388956 | node/5173514873 (neighbourhood) | revisar |
| 701-la-guaria | La Guaria | Limón | Valle La Estrella | 9.742571 | -82.951567 | node/3248681806 (neighbourhood) | revisar |
| 701-la-union | La Unión | Limón | Valle La Estrella | 9.688203 | -82.985875 | node/5033586023 (neighbourhood) | revisar |
| 701-las-brisas | Las Brisas | Limón | Limón | 9.995256 | -83.054969 | node/3607857501 (neighbourhood) | revisar |
| 701-las-brisas-2 | Las Brisas | Limón | Valle La Estrella | 9.692524 | -82.993606 | node/5033584679 (hamlet) | revisar |
| 701-las-brisas-de-kent | Las Brisas de Kent | Limón | Matama | 9.913482 | -83.020899 | node/3608078162 (neighbourhood) | revisar |
| 701-las-loras | Las Loras | Limón | Valle La Estrella | 9.735046 | -82.980868 | node/5033541678 (neighbourhood) | revisar |
| 701-las-nubes | Las Nubes | Limón | Valle La Estrella | 9.749085 | -82.962284 | node/5033541647 (neighbourhood) | revisar |
| 701-las-palmas | Las Palmas | Limón | Matama | 9.865093 | -83.019553 | node/5035263221 (neighbourhood) | revisar |
| 701-las-palmeras | Las Palmeras | Limón | Limón | 9.987053 | -83.045757 | node/3607864093 (neighbourhood) | revisar |
| 701-las-palmeras-2 | Las Palmeras | Limón | Matama | 9.918541 | -83.011157 | node/5172134331 (neighbourhood) | revisar |
| 701-limon-2000 | Limón 2000 | Limón | Río Blanco | 9.986742 | -83.141548 | node/1124091858 (neighbourhood) | revisar |
| 701-limon-centro | Limón centro | Limón | Limón | 9.993161 | -83.029761 | node/185489267 (city) | sí |
| 701-limoncito | Limoncito | Limón | Limón | 9.979483 | -83.040842 | node/3607798403 (neighbourhood) | revisar |
| 701-liverpool | Liverpool | Limón | Río Blanco | 9.988516 | -83.131049 | node/1143358518 (village) | sí |
| 701-llano-grande | Llano Grande | Limón | Valle La Estrella | 9.741609 | -83.037276 | node/5033612384 (hamlet) | revisar |
| 701-loma-de-moin | Loma de Moín | Limón | Limón | 10.002858 | -83.073865 | node/3607855795 (neighbourhood) | revisar |
| 701-loma-linda | Loma Linda | Limón | Río Blanco | 9.981222 | -83.101866 | node/5172592354 (neighbourhood) | revisar |
| 701-los-angeles | Los Ángeles | Limón | Matama | 9.925662 | -83.035809 | node/13305186742 (neighbourhood) | revisar |
| 701-los-angeles-2 | Los Ángeles | Limón | Valle La Estrella | 9.63843 | -82.946501 | node/5034845404 (hamlet) | revisar |
| 701-los-cangrejos | Los Cangrejos | Limón | Limón | 10.006097 | -83.05855 | node/3607857563 (neighbourhood) | revisar |
| 701-los-cocos | Los Cocos | Limón | Limón | 9.982358 | -83.036666 | node/1752004488 (neighbourhood) | revisar |
| 701-los-laureles | Los Laureles | Limón | Limón | 10.001356 | -83.042834 | node/701330915 (neighbourhood) | revisar |
| 701-los-lirios | Los Lirios | Limón | Limón | 9.976038 | -83.037228 | node/3607815425 (neighbourhood) | revisar |
| 701-los-solorzano | Los Solórzano | Limón | Matama | 9.92229 | -83.049612 | node/5172231440 (neighbourhood) | revisar |
| 701-maderas | Maderas | Limón | Río Blanco | 9.943144 | -83.204298 | node/5172577458 (neighbourhood) | revisar |
| 701-manu | Manú | Limón | Valle La Estrella | 9.818684 | -82.933664 | node/5173975964 (hamlet) | revisar |
| 701-manzanillo-siapanei | Manzanillo (Siãpãnei) | Limón | Valle La Estrella | 9.646621 | -83.45039 | node/5173440366 (hamlet) | revisar |
| 701-maria-luisa | María Luisa | Limón | Matama | 9.899471 | -83.092 | node/5172243333 (hamlet) | revisar |
| 701-mexico | México | Limón | Río Blanco | 9.981408 | -83.142456 | node/5172509326 (neighbourhood) | revisar |
| 701-miramar | Miramar | Limón | Valle La Estrella | 9.647478 | -82.991933 | node/5034845403 (neighbourhood) | revisar |
| 701-miramar-2 | Miramar | Limón | Valle La Estrella | 9.834465 | -82.947737 | node/5173995225 (hamlet) | revisar |
| 701-miravalles | Miravalles | Limón | Río Blanco | 9.966581 | -83.113388 | node/5172575621 (hamlet) | revisar |
| 701-moi | Moi | Limón | Valle La Estrella | 9.684644 | -83.120535 | node/5035262414 (hamlet) | revisar |
| 701-moin | Moín | Limón | Limón | 9.999318 | -83.084182 | node/791764386 (hamlet) | revisar |
| 701-mountain-cow | Mountain Cow | Limón | Matama | 9.908768 | -83.054277 | node/5172233089 (neighbourhood) | revisar |
| 701-nanabre | Nanabre | Limón | Valle La Estrella | 9.762366 | -82.925472 | node/5173911600 (neighbourhood) | revisar |
| 701-narinak | Ñariñak | Limón | Valle La Estrella | 9.766765 | -83.372757 | node/5173550059 (hamlet) | revisar |
| 701-nimari | Nimarí | Limón | Valle La Estrella | 9.690799 | -83.141584 | node/5035262415 (neighbourhood) | revisar |
| 701-nueve-millas | Nueve Millas | Limón | Río Blanco | 9.99251 | -83.141959 | node/5172472445 (neighbourhood) | revisar |
| 701-nueve-millas-de-moin | Nueve Millas de Moín | Limón | Limón | 10.028936 | -83.126853 | node/5174098926 (hamlet) | revisar |
| 701-ojo-de-agua | Ojo de Agua | Limón | Limón | 9.999703 | -83.060567 | node/9390985497 (neighbourhood) | revisar |
| 701-ojo-de-agua-arriba | Ojo de Agua Arriba | Limón | Limón | 10.000657 | -83.055196 | node/3607857531 (neighbourhood) | revisar |
| 701-pacuare-nuevo | Pacuare Nuevo | Limón | Limón | 9.996183 | -83.049243 | node/3607862298 (neighbourhood) | revisar |
| 701-pacuare-viejo | Pacuare Viejo | Limón | Limón | 9.999976 | -83.048326 | node/3607862297 (neighbourhood) | revisar |
| 701-pandora | Pandora | Limón | Valle La Estrella | 9.742346 | -82.95553 | node/2986981477 (village) | sí |
| 701-pandora-este | Pandora Este | Limón | Valle La Estrella | 9.737099 | -82.959983 | node/8715476560 (neighbourhood) | revisar |
| 701-pandora-oeste | Pandora Oeste | Limón | Valle La Estrella | 9.743283 | -82.964157 | node/5034806033 (neighbourhood) | revisar |
| 701-paraiso | Paraíso | Limón | Matama | 9.892823 | -82.994162 | node/2522601575 (hamlet) | revisar |
| 701-penshurt | Penshurt | Limón | Valle La Estrella | 9.77634 | -82.909188 | node/1095996193 (hamlet) | revisar |
| 701-piuta | Piuta | Limón | Limón | 10.007216 | -83.041359 | node/5174137721 (neighbourhood) | revisar |
| 701-plantel-bufalo | Plantel Búfalo | Limón | Río Blanco | 10.000608 | -83.179397 | node/8706894153 (neighbourhood) | revisar |
| 701-playa-bananito | Playa Bananito | Limón | Matama | 9.891059 | -82.970601 | way/533212860 (beach) | sí |
| 701-playa-bonita | Playa Bonita | Limón | Limón | 10.009968 | -83.061465 | way/132685404 (village) | sí |
| 701-playa-los-banos | Playa Los Baños | Limón | Limón | 9.996011 | -83.02775 | way/370779760 (beach) | sí |
| 701-playa-san-clamente | Playa San Clamente | Limón | Valle La Estrella | 9.833062 | -82.925168 | way/1389965770 (beach) | sí |
| 701-playa-san-clamente-2 | Playa San Clamente | Limón | Valle La Estrella | 9.816671 | -82.911412 | way/1390213337 (beach) | sí |
| 701-playa-vizcaya | Playa Vizcaya | Limón | Matama | 9.916633 | -82.990202 | way/533212859 (beach) | sí |
| 701-pleyades | Pléyades | Limón | Valle La Estrella | 9.753367 | -82.953342 | node/5173871321 (neighbourhood) | revisar |
| 701-polonia | Polonia | Limón | Matama | 9.914867 | -83.042338 | node/5172236617 (neighbourhood) | revisar |
| 701-portete | Portete | Limón | Limón | 10.009087 | -83.065849 | node/1459455597 (neighbourhood) | revisar |
| 701-porvenir | Porvenir | Limón | Valle La Estrella | 9.765107 | -82.944614 | node/5034847848 (neighbourhood) | revisar |
| 701-pueblo-nuevo | Pueblo Nuevo | Limón | Limón | 9.988155 | -83.052582 | node/3608093022 (neighbourhood) | revisar |
| 701-pueblo-nuevo-2 | Pueblo Nuevo | Limón | Valle La Estrella | 9.674523 | -82.983423 | node/5033584636 (neighbourhood) | revisar |
| 701-quinto | Quinto | Limón | Limón | 9.985583 | -83.041569 | node/3607844313 (neighbourhood) | revisar |
| 701-quitaria | Quitaría | Limón | Matama | 9.909546 | -83.086074 | node/1459465341 (neighbourhood) | revisar |
| 701-rio-banano | Río Banano | Limón | Matama | 9.919366 | -83.018023 | node/3608078161 (hamlet) | revisar |
| 701-rio-blanco | Rio Blanco | Limón | Río Blanco | 9.973319 | -83.154292 | node/1633553296 (hamlet) | revisar |
| 701-rio-ley | Río Ley | Limón | Valle La Estrella | 9.73297 | -82.986983 | node/5173713012 (neighbourhood) | revisar |
| 701-rio-madre | Río Madre | Limón | Río Blanco | 9.99797 | -83.154025 | node/5172472444 (neighbourhood) | revisar |
| 701-rio-quito | Río Quito | Limón | Río Blanco | 9.95855 | -83.166544 | node/5172561996 (hamlet) | revisar |
| 701-rio-seco | Río Seco | Limón | Valle La Estrella | 9.802942 | -82.926422 | node/5173966443 (neighbourhood) | revisar |
| 701-rio-victoria | Río Victoria | Limón | Río Blanco | 9.952509 | -83.160727 | node/5172561995 (hamlet) | revisar |
| 701-roosevelt | Roosevelt | Limón | Limón | 9.998448 | -83.030657 | node/2331048758 (neighbourhood) | revisar |
| 701-san-andres | San Andrés | Limón | Valle La Estrella | 9.847958 | -82.964554 | node/1129529125 (hamlet) | revisar |
| 701-san-antonio | San Antonio | Limón | Río Blanco | 9.992657 | -83.132457 | node/8706999821 (neighbourhood) | revisar |
| 701-san-carlos | San Carlos | Limón | Valle La Estrella | 9.767837 | -83.022607 | node/5034845416 (hamlet) | revisar |
| 701-san-cecilio | San Cecilio | Limón | Matama | 9.851906 | -83.043849 | node/5035262419 (hamlet) | revisar |
| 701-san-clemente | San Clemente | Limón | Valle La Estrella | 9.827854 | -82.939498 | node/5173898940 (hamlet) | revisar |
| 701-san-juan | San Juan | Limón | Limón | 9.98774 | -83.036524 | node/1215746575 (neighbourhood) | revisar |
| 701-san-miguel-de-duruy | San Miguel de Duruy | Limón | Valle La Estrella | 9.624238 | -82.97251 | node/5154238487 (hamlet) | revisar |
| 701-san-rafael | San Rafael | Limón | Valle La Estrella | 9.762394 | -82.971325 | node/5034847847 (hamlet) | revisar |
| 701-san-vicente-de-sibuju | San Vicente de Sibujú | Limón | Valle La Estrella | 9.617469 | -83.000985 | node/5154205276 (neighbourhood) | revisar |
| 701-sandoval | Sandoval | Limón | Río Blanco | 9.992775 | -83.103686 | node/1215743723 (neighbourhood) | revisar |
| 701-santa-eduviges | Santa Eduviges | Limón | Limón | 10.001775 | -83.035999 | node/701330913 (neighbourhood) | revisar |
| 701-santa-fe | Santa Fe | Limón | Limón | 9.970508 | -83.055094 | node/13311196844 (neighbourhood) | revisar |
| 701-santa-maria | Santa María | Limón | Valle La Estrella | 9.626989 | -83.467856 | node/5173440365 (neighbourhood) | revisar |
| 701-santa-rosa | Santa Rosa | Limón | Limón | 9.955258 | -83.067152 | node/3591064309 (hamlet) | revisar |
| 701-santa-teresita | Santa Teresita | Limón | Valle La Estrella | 9.741312 | -82.998622 | node/5034845411 (neighbourhood) | revisar |
| 701-sarer | Sarer | Limón | Valle La Estrella | 9.706041 | -83.034167 | node/5034845414 (neighbourhood) | revisar |
| 701-sector-10 | Sector 10 | Limón | Limón | 9.976523 | -83.052834 | node/6591628490 (neighbourhood) | revisar |
| 701-sector-9 | Sector 9 | Limón | Limón | 9.981019 | -83.054344 | node/3607856648 (neighbourhood) | revisar |
| 701-shinabla | Shinabla | Limón | Valle La Estrella | 9.762834 | -83.295084 | node/8715678833 (hamlet) | revisar |
| 701-shordi | Shordi | Limón | Valle La Estrella | 9.777128 | -83.323765 | node/5173557882 (hamlet) | revisar |
| 701-siberia | Siberia | Limón | Valle La Estrella | 9.754748 | -82.93217 | node/5034847849 (neighbourhood) | revisar |
| 701-siglo-xxi | Siglo XXI | Limón | Limón | 9.99394 | -83.039592 | node/13315426999 (neighbourhood) | revisar |
| 701-sinoli | Sinoli | Limón | Valle La Estrella | 9.71557 | -83.417189 | node/5173501526 (hamlet) | revisar |
| 701-sitio-hilda-jakue | Sitio Hilda (Jakue) | Limón | Valle La Estrella | 9.62808 | -83.475813 | node/5173440362 (hamlet) | revisar |
| 701-suruy | Suruy | Limón | Valle La Estrella | 9.75883 | -83.061317 | node/5035262406 (neighbourhood) | revisar |
| 701-tabruk | Tabruk | Limón | Valle La Estrella | 9.775441 | -82.927102 | node/5173921666 (neighbourhood) | revisar |
| 701-tkank-ri | Tkank-ri | Limón | Valle La Estrella | 9.73335 | -83.355563 | node/5173531763 (neighbourhood) | revisar |
| 701-tolok-kicha | Tolok Kichá | Limón | Valle La Estrella | 9.675987 | -83.429014 | node/5173471087 (hamlet) | revisar |
| 701-trebol | Trébol | Limón | Matama | 9.935019 | -83.088695 | node/5172161516 (hamlet) | revisar |
| 701-tsuebata | Tsuëbata | Limón | Valle La Estrella | 9.730512 | -83.378401 | node/5173514889 (neighbourhood) | revisar |
| 701-tuba-creek | Tuba Creek | Limón | Valle La Estrella | 9.767473 | -82.897771 | node/1215754647 (neighbourhood) | revisar |
| 701-uka-tipey | Uka Tipëy | Limón | Valle La Estrella | 9.722653 | -83.343346 | node/5173531764 (neighbourhood) | revisar |
| 701-uluferi-nak | Uluferi Ñak | Limón | Valle La Estrella | 9.683836 | -83.426545 | node/5173486552 (hamlet) | revisar |
| 701-valle-la-aurora | Valle La Aurora | Limón | Limón | 9.947432 | -83.095656 | node/3865994796 (hamlet) | revisar |
| 701-valle-las-rosas | Valle Las Rosas | Limón | Valle La Estrella | 9.680681 | -82.986964 | node/5033579035 (hamlet) | revisar |
| 701-veracruz | Veracruz | Limón | Limón | 10.003287 | -83.035738 | node/5174137722 (neighbourhood) | revisar |
| 701-vesta | Vesta | Limón | Valle La Estrella | 9.726548 | -83.054658 | node/5035262407 (neighbourhood) | revisar |
| 701-victoria | Victoria | Limón | Río Blanco | 9.963884 | -83.155757 | node/5172561417 (neighbourhood) | revisar |
| 701-villa-de-plata | Villa de Plata | Limón | Limón | 9.99562 | -83.064911 | node/9391037981 (neighbourhood) | revisar |
| 701-villa-del-mar | Villa del Mar | Limón | Limón | 9.99361 | -83.072366 | node/3607857503 (neighbourhood) | revisar |
| 701-villa-del-mar-2 | Villa del Mar 2 | Limón | Limón | 9.987545 | -83.078892 | node/3607857502 (neighbourhood) | revisar |
| 701-villa-hermosa | Villa Hermosa | Limón | Limón | 9.97607 | -83.067302 | node/5987623524 (neighbourhood) | revisar |
| 701-waghope | Waghope | Limón | Limón | 9.942855 | -83.084162 | node/13304863030 (neighbourhood) | revisar |
| 701-westfalia | Westfalia | Limón | Matama | 9.933915 | -83.003767 | node/1215749850 (hamlet) | revisar |
| 702-agroportica | Agroportica | Pococí | Rita | 10.418349 | -83.793931 | node/5033164718 (hamlet) | revisar |
| 702-agua-dulce | Agua Dulce | Pococí | Colorado | 10.866129 | -83.621746 | node/5181340796 (hamlet) | revisar |
| 702-aguas-frias | Aguas Frías | Pococí | Roxana | 10.376938 | -83.650888 | node/3888168000 (hamlet) | revisar |
| 702-aguas-mansas | Aguas Mansas | Pococí | Guápiles | 10.181168 | -83.88567 | node/5323088061 (neighbourhood) | revisar |
| 702-algarba | Algarba | Pococí | Cariari | 10.383028 | -83.760795 | node/4950355874 (neighbourhood) | revisar |
| 702-anaban | Anabán | Pococí | Roxana | 10.332277 | -83.704471 | node/3891871809 (hamlet) | revisar |
| 702-anita-grande | Anita Grande | Pococí | Jiménez | 10.241648 | -83.730051 | node/1079123697 (hamlet) | revisar |
| 702-anturias | Anturias | Pococí | Guápiles | 10.168352 | -83.884171 | node/5323088062 (hamlet) | revisar |
| 702-aragon | Aragón | Pococí | Colorado | 10.927996 | -83.685513 | node/3611940853 (hamlet) | revisar |
| 702-asentamiento-camuro | Asentamiento Camuro | Pococí | Rita | 10.497068 | -83.692519 | node/8758457719 (hamlet) | revisar |
| 702-asentamiento-el-paraiso | Asentamiento El Paraíso | Pococí | Rita | 10.518207 | -83.650486 | node/8758379667 (hamlet) | revisar |
| 702-asentamiento-el-zota-1 | Asentamiento El Zota 1 | Pococí | Rita | 10.464732 | -83.800475 | node/8758775063 (hamlet) | revisar |
| 702-asentamiento-el-zota-2 | Asentamiento El Zota 2 | Pococí | Rita | 10.477423 | -83.793643 | node/5180532776 (hamlet) | revisar |
| 702-asentamiento-ida-bellavista | Asentamiento IDA Bellavista | Pococí | Guápiles | 10.133977 | -83.812265 | node/8762581438 (hamlet) | revisar |
| 702-astua-pirie | Astúa Pirie | Pococí | Cariari | 10.341633 | -83.736997 | node/1215790309 (neighbourhood) | revisar |
| 702-astutica | Astutica | Pococí | Cariari | 10.337901 | -83.732836 | node/5266116661 (neighbourhood) | revisar |
| 702-balastre | Balastre | Pococí | Rita | 10.3236 | -83.824766 | node/1367301360 (hamlet) | revisar |
| 702-banamola | Banamola | Pococí | Cariari | 10.343291 | -83.774482 | node/1100486965 (hamlet) | revisar |
| 702-barra-del-colorado | Barra del Colorado | Pococí | Colorado | 10.771313 | -83.596366 | node/3076787726 (village) | sí |
| 702-barra-del-colorado-sur | Barra del Colorado Sur | Pococí | Colorado | 10.770406 | -83.585397 | node/3744961732 (neighbourhood) | revisar |
| 702-barrio-cristina | Barrio Cristina | Pococí | Jiménez | 10.209808 | -83.774907 | node/8746937986 (neighbourhood) | revisar |
| 702-barrio-las-gaviotas | Barrio Las Gaviotas | Pococí | Cariari | 10.331154 | -83.744603 | node/5266131906 (neighbourhood) | revisar |
| 702-belen | Belén | Pococí | Guápiles | 10.214729 | -83.785286 | node/3722386268 (neighbourhood) | revisar |
| 702-bella-vista | Bella Vista | Pococí | Roxana | 10.323503 | -83.727402 | node/5266142701 (neighbourhood) | revisar |
| 702-bella-vista-2 | Bella Vista | Pococí | Guápiles | 10.167337 | -83.81457 | node/5323101823 (hamlet) | revisar |
| 702-bella-vista-3 | Bella Vista | Pococí | Cariari | 10.367862 | -83.729262 | node/8751133909 (neighbourhood) | revisar |
| 702-blanco | Blanco | Pococí | Guápiles | 10.210927 | -83.834964 | node/3874209501 (hamlet) | revisar |
| 702-boca-de-san-juanillo | Boca de San Juanillo | Pococí | Colorado | 10.897673 | -83.682794 | node/10237777212 (hamlet) | revisar |
| 702-boca-guapiles | Boca Guápiles | Pococí | Cariari | 10.378703 | -83.695437 | node/3874960867 (neighbourhood) | revisar |
| 702-bocas-del-colorado | Bocas del Colorado | Pococí | Colorado | 10.720278 | -83.669964 | node/5326006720 (neighbourhood) | revisar |
| 702-boreal | Boreal | Pococí | Cariari | 10.37285 | -83.737538 | node/5266153364 (neighbourhood) | revisar |
| 702-brisas | Brisas | Pococí | Guápiles | 10.17772 | -83.836831 | node/5323094016 (hamlet) | revisar |
| 702-brisas-2 | Brisas | Pococí | Guápiles | 10.207101 | -83.811278 | node/8762847854 (neighbourhood) | revisar |
| 702-brisas-de-toro-amarillo | Brisas de Toro Amarillo | Pococí | La Colonia | 10.299594 | -83.834812 | node/5323125909 (hamlet) | revisar |
| 702-broncon | Broncón | Pococí | Roxana | 10.275781 | -83.749175 | node/8769518729 (neighbourhood) | revisar |
| 702-buenavista | Buenavista | Pococí | Colorado | 10.685457 | -83.668647 | node/8740603588 (neighbourhood) | revisar |
| 702-buenos-aires | Buenos Aires | Pococí | Jiménez | 10.172739 | -83.782343 | node/1713132164 (hamlet) | revisar |
| 702-cacique | Cacique | Pococí | Guápiles | 10.22476 | -83.796908 | node/5019162770 (neighbourhood) | revisar |
| 702-calle-1 | Calle 1 | Pococí | Jiménez | 10.221142 | -83.765383 | node/8746989302 (neighbourhood) | revisar |
| 702-calle-uno-pista | Calle Uno Pista | Pococí | Jiménez | 10.202506 | -83.768333 | node/3722382224 (neighbourhood) | revisar |
| 702-campo-1 | Campo 1 | Pococí | Cariari | 10.368416 | -83.713533 | node/5266203140 (hamlet) | revisar |
| 702-campo-2 | Campo 2 | Pococí | Cariari | 10.404768 | -83.693438 | node/1215767087 (hamlet) | revisar |
| 702-campo-3 | Campo 3 | Pococí | Cariari | 10.372606 | -83.708645 | node/2766211253 (hamlet) | revisar |
| 702-campo-3-oeste | Campo 3 Oeste | Pococí | Cariari | 10.383744 | -83.737495 | node/5266203138 (neighbourhood) | revisar |
| 702-campo-5 | Campo 5 | Pococí | Cariari | 10.385617 | -83.71871 | node/4950355879 (hamlet) | revisar |
| 702-campo-cuatro | Campo Cuatro | Pococí | Cariari | 10.389995 | -83.690148 | node/3874960868 (hamlet) | revisar |
| 702-cano-bravo | Caño Bravo | Pococí | Colorado | 10.735195 | -83.6854 | node/5181353388 (neighbourhood) | revisar |
| 702-cano-seco | Caño Seco | Pococí | Rita | 10.50646 | -83.80852 | node/5179146964 (hamlet) | revisar |
| 702-cano-zapota | Caño Zapota | Pococí | Colorado | 10.646528 | -83.693918 | node/5326293809 (neighbourhood) | revisar |
| 702-canta-gallo | Canta Gallo | Pococí | Rita | 10.498805 | -83.673286 | node/3875482751 (hamlet) | revisar |
| 702-canta-gallo-2 | Canta Gallo | Pococí | Cariari | 10.495595 | -83.648815 | node/8747558534 (neighbourhood) | revisar |
| 702-caracol | Caracol | Pococí | Guápiles | 10.22691 | -83.794703 | node/3722396015 (neighbourhood) | revisar |
| 702-cariari | Cariari | Pococí | Cariari | 10.36288 | -83.735442 | node/440365966 (village) | sí |
| 702-caribbean | Caribbean | Pococí | Guápiles | 10.229267 | -83.792588 | node/5323135749 (neighbourhood) | revisar |
| 702-carolina-tica | Carolina Tica | Pococí | Cariari | 10.427111 | -83.724836 | node/1215766037 (hamlet) | revisar |
| 702-cartagena | Cartagena | Pococí | Rita | 10.370195 | -83.812437 | node/8758905756 (hamlet) | revisar |
| 702-casas-verdes | Casas Verdes | Pococí | Cariari | 10.517422 | -83.630368 | node/2531405785 (hamlet) | revisar |
| 702-castanal | Castañal | Pococí | Roxana | 10.430673 | -83.629216 | node/5325722364 (neighbourhood) | revisar |
| 702-cayuga | Cayuga | Pococí | Rita | 10.298415 | -83.782167 | node/5266042992 (hamlet) | revisar |
| 702-cedral | Cedral | Pococí | Rita | 10.525671 | -83.700582 | node/1215763434 (hamlet) | revisar |
| 702-ceibo | Ceibo | Pococí | Cariari | 10.4651 | -83.610856 | node/3874998647 (hamlet) | revisar |
| 702-chirbalo | Chirbalo | Pococí | Rita | 10.372819 | -83.776317 | node/3875447551 (hamlet) | revisar |
| 702-ciudadela-san-jose | Ciudadela San José | Pococí | Rita | 10.415581 | -83.75175 | node/8758656453 (neighbourhood) | revisar |
| 702-cocori | Cocorí | Pococí | Colorado | 10.591917 | -83.739315 | node/12195610864 (hamlet) | revisar |
| 702-cocori-2 | Cocorí | Pococí | Rita | 10.411478 | -83.75316 | node/1331895595 (hamlet) | revisar |
| 702-cocotales | Cocotales | Pococí | Rita | 10.450902 | -83.765427 | node/8758604125 (hamlet) | revisar |
| 702-colonia-zeledon | Colonia Zeledón | Pococí | Cariari | 10.326407 | -83.743838 | node/5266131915 (hamlet) | revisar |
| 702-condado-del-rio | Condado del Río | Pococí | Jiménez | 10.183687 | -83.782352 | node/3722384025 (hamlet) | revisar |
| 702-coopecariari | Coopecariari | Pococí | Cariari | 10.401986 | -83.711563 | node/1096008617 (neighbourhood) | revisar |
| 702-coopelibertad | Coopelibertad | Pococí | Guápiles | 10.294147 | -83.84371 | node/5323119509 (neighbourhood) | revisar |
| 702-coopevigua-1 | Coopevigua 1 | Pococí | Guápiles | 10.217739 | -83.793145 | node/3722387056 (neighbourhood) | revisar |
| 702-coopevigua-2 | Coopevigua 2 | Pococí | Guápiles | 10.222238 | -83.78632 | node/3722396008 (neighbourhood) | revisar |
| 702-coopevigua-3 | Coopevigua 3 | Pococí | Guápiles | 10.22563 | -83.786026 | node/3722396006 (neighbourhood) | revisar |
| 702-corinto | Corinto | Pococí | Guápiles | 10.212979 | -83.888891 | node/1215715965 (hamlet) | revisar |
| 702-cristo-rey | Cristo Rey | Pococí | Cariari | 10.372915 | -83.734735 | node/4950355878 (neighbourhood) | revisar |
| 702-cristo-rey-2 | Cristo Rey | Pococí | Rita | 10.276031 | -83.776812 | node/5324873256 (neighbourhood) | revisar |
| 702-cuatro-esquinas | Cuatro Esquinas | Pococí | Cariari | 10.457626 | -83.671109 | node/440384895 (hamlet) | revisar |
| 702-curia | Curia | Pococí | Roxana | 10.350574 | -83.684963 | node/5325001290 (hamlet) | revisar |
| 702-curva-del-humo | Curva del Humo | Pococí | Roxana | 10.269286 | -83.743202 | node/3875083889 (neighbourhood) | revisar |
| 702-daisy | Daisy | Pococí | Roxana | 10.27767 | -83.738782 | node/8753894719 (neighbourhood) | revisar |
| 702-dona-luz | Doña Luz | Pococí | Jiménez | 10.208092 | -83.750535 | node/3722385423 (neighbourhood) | revisar |
| 702-dos-bocas-del-colorado | Dos Bocas del Colorado | Pococí | Colorado | 10.723295 | -83.639029 | node/5181353389 (neighbourhood) | revisar |
| 702-duacari-uno | Duacarí Uno | Pococí | Roxana | 10.360625 | -83.627593 | node/1100521129 (hamlet) | revisar |
| 702-el-carmen | El Carmen | Pococí | Cariari | 10.35044 | -83.735854 | node/4950302727 (neighbourhood) | revisar |
| 702-el-cruce | El Cruce | Pococí | Guápiles | 10.211538 | -83.900272 | node/440270764 (neighbourhood) | revisar |
| 702-el-cruce-2 | El Cruce | Pococí | Roxana | 10.311131 | -83.729315 | node/5324916997 (hamlet) | revisar |
| 702-el-cruce-3 | El Cruce | Pococí | Roxana | 10.258509 | -83.752037 | node/8753894720 (neighbourhood) | revisar |
| 702-el-encanto | El Encanto | Pococí | Cariari | 10.392942 | -83.722695 | node/4950355880 (neighbourhood) | revisar |
| 702-el-jardin | El Jardín | Pococí | Rita | 10.394084 | -83.786413 | node/1331892725 (hamlet) | revisar |
| 702-el-jardin-2 | El Jardín | Pococí | Roxana | 10.270084 | -83.753758 | node/8753894724 (neighbourhood) | revisar |
| 702-el-llano | El Llano | Pococí | Cariari | 10.357447 | -83.736719 | node/4950302728 (neighbourhood) | revisar |
| 702-el-mana | El Maná | Pococí | Cariari | 10.472992 | -83.666722 | node/3888415710 (hamlet) | revisar |
| 702-el-molino | El Molino | Pococí | Jiménez | 10.210576 | -83.755281 | node/5031129657 (neighbourhood) | revisar |
| 702-el-peligro | El Peligro | Pococí | Rita | 10.28986 | -83.78384 | node/5033192762 (neighbourhood) | revisar |
| 702-el-porvenir | El Porvenir | Pococí | Rita | 10.447492 | -83.817654 | node/1303941952 (hamlet) | revisar |
| 702-el-porvenir-2 | El Porvenir | Pococí | Guápiles | 10.259844 | -83.848444 | node/5323119508 (neighbourhood) | revisar |
| 702-el-prado | El Prado | Pococí | La Colonia | 10.248846 | -83.778731 | node/2667408370 (neighbourhood) | revisar |
| 702-el-progreso | El Progreso | Pococí | Cariari | 10.377244 | -83.748805 | node/1215773803 (neighbourhood) | revisar |
| 702-el-rescate | El Rescate | Pococí | Roxana | 10.371829 | -83.662122 | node/5325031801 (neighbourhood) | revisar |
| 702-el-sota | El Sota | Pococí | Rita | 10.535751 | -83.742618 | node/8758154729 (hamlet) | revisar |
| 702-el-tractor | El Tractor | Pococí | Guápiles | 10.220004 | -83.8099 | node/3722376462 (neighbourhood) | revisar |
| 702-encina | Encina | Pococí | Rita | 10.491853 | -83.771956 | node/8758770565 (neighbourhood) | revisar |
| 702-espana | España | Pococí | Cariari | 10.36475 | -83.740741 | node/5266153362 (neighbourhood) | revisar |
| 702-espanolita | Españolita | Pococí | Cariari | 10.365427 | -83.748763 | node/8751156971 (neighbourhood) | revisar |
| 702-esperanza | Esperanza | Pococí | Cariari | 10.434038 | -83.678874 | node/3888406057 (hamlet) | revisar |
| 702-finca-1 | Finca 1 | Pococí | Rita | 10.403538 | -83.83134 | node/8758948721 (hamlet) | revisar |
| 702-finca-2 | Finca 2 | Pococí | Rita | 10.428724 | -83.826904 | node/3888349334 (hamlet) | revisar |
| 702-finca-3 | Finca 3 | Pococí | Rita | 10.40673 | -83.84898 | node/2328924110 (hamlet) | revisar |
| 702-finca-frutera | Finca Frutera | Pococí | Cariari | 10.469981 | -83.63722 | node/8747600641 (neighbourhood) | revisar |
| 702-floritas | Floritas | Pococí | Jiménez | 10.262163 | -83.734139 | node/5324442308 (hamlet) | revisar |
| 702-formosa | Formosa | Pococí | Cariari | 10.364763 | -83.753772 | node/1100520609 (neighbourhood) | revisar |
| 702-fortuna | Fortuna | Pococí | Roxana | 10.439133 | -83.584501 | node/5325710505 (hamlet) | revisar |
| 702-frutera-atlantica | Frutera Atlántica | Pococí | Cariari | 10.395912 | -83.752154 | node/1126882308 (hamlet) | revisar |
| 702-garabito | Garabito | Pococí | Guápiles | 10.214956 | -83.800818 | node/5031050383 (neighbourhood) | revisar |
| 702-granja | Granja | Pococí | Jiménez | 10.209977 | -83.763783 | node/5324423298 (neighbourhood) | revisar |
| 702-guadalupe | Guadalupe | Pococí | Roxana | 10.275597 | -83.732837 | node/12189111727 (neighbourhood) | revisar |
| 702-guadalupe-2 | Guadalupe | Pococí | Roxana | 10.310042 | -83.680315 | node/8753753665 (neighbourhood) | revisar |
| 702-guajira | Guajira | Pococí | Rita | 10.27459 | -83.778436 | node/8759007188 (neighbourhood) | revisar |
| 702-guapiles | Guápiles | Pococí | Guápiles | 10.215436 | -83.791363 | node/440676357 (city) | sí |
| 702-hamburgo | Hamburgo | Pococí | Rita | 10.424569 | -83.744683 | node/8758531029 (hamlet) | revisar |
| 702-hojancha | Hojancha | Pococí | Cariari | 10.402925 | -83.724776 | node/4950355881 (neighbourhood) | revisar |
| 702-i-griega | I Griega | Pococí | Rita | 10.358553 | -83.834426 | node/8759005160 (hamlet) | revisar |
| 702-iztaru | Iztarú | Pococí | Rita | 10.369306 | -83.833528 | node/8759005118 (hamlet) | revisar |
| 702-jesus | Jesús | Pococí | Guápiles | 10.228964 | -83.805919 | node/3722396010 (neighbourhood) | revisar |
| 702-jimenez | Jiménez | Pococí | Jiménez | 10.210046 | -83.741861 | node/1215734760 (village) | sí |
| 702-jodema | Jodema | Pococí | Cariari | 10.460888 | -83.66877 | node/8747558565 (neighbourhood) | revisar |
| 702-jordan | Jordán | Pococí | Rita | 10.281661 | -83.775654 | node/11159662134 (neighbourhood) | revisar |
| 702-kennedy-2 | Kennedy 2 | Pococí | Cariari | 10.361863 | -83.732074 | node/5266153358 (neighbourhood) | revisar |
| 702-la-amistad | La Amistad | Pococí | Cariari | 10.361869 | -83.751419 | node/5266156056 (neighbourhood) | revisar |
| 702-la-carlota | La Carlota | Pococí | Rita | 10.448307 | -83.716874 | node/8758463851 (neighbourhood) | revisar |
| 702-la-casona | La Casona | Pococí | Guápiles | 10.215855 | -83.809308 | node/8762881992 (neighbourhood) | revisar |
| 702-la-claudia | La Claudia | Pococí | Roxana | 10.294454 | -83.733808 | node/5324911933 (neighbourhood) | revisar |
| 702-la-cruz | La Cruz | Pococí | Cariari | 10.366053 | -83.73382 | node/5266153360 (neighbourhood) | revisar |
| 702-la-cruz-2 | La Cruz | Pococí | Roxana | 10.271502 | -83.761151 | node/5324870930 (neighbourhood) | revisar |
| 702-la-emilia | La Emilia | Pococí | Guápiles | 10.21435 | -83.778247 | node/1661697550 (neighbourhood) | revisar |
| 702-la-esmeralda | La Esmeralda | Pococí | Guápiles | 10.228309 | -83.793003 | node/3722396014 (neighbourhood) | revisar |
| 702-la-floresta | La Floresta | Pococí | Cariari | 10.357102 | -83.741518 | node/5266153355 (neighbourhood) | revisar |
| 702-la-fortuna | La Fortuna | Pococí | Rita | 10.51252 | -83.791116 | node/8758099288 (hamlet) | revisar |
| 702-la-gloria | La Gloria | Pococí | Roxana | 10.328684 | -83.736673 | node/5266142700 (hamlet) | revisar |
| 702-la-guaria | La Guaria | Pococí | Rita | 10.370403 | -83.85824 | node/1367301364 (neighbourhood) | revisar |
| 702-la-guaria-2 | La Guaria | Pococí | Cariari | 10.364507 | -83.730581 | node/5266153357 (neighbourhood) | revisar |
| 702-la-guaria-3 | La Guaria | Pococí | Guápiles | 10.144803 | -83.807655 | node/5323101866 (hamlet) | revisar |
| 702-la-hilda | La Hilda | Pococí | Rita | 10.276462 | -83.797245 | node/8759007186 (neighbourhood) | revisar |
| 702-la-javillana | La Javillana | Pococí | La Colonia | 10.259516 | -83.806726 | node/8744179974 (neighbourhood) | revisar |
| 702-la-leona | La Leona | Pococí | Guápiles | 10.161443 | -83.808267 | node/5323101825 (hamlet) | revisar |
| 702-la-lidia | La Lidia | Pococí | Roxana | 10.355208 | -83.67034 | node/5325024326 (hamlet) | revisar |
| 702-la-lucha | La Lucha | Pococí | La Colonia | 10.235564 | -83.778668 | node/12197323431 (neighbourhood) | revisar |
| 702-la-lucha-2 | La Lucha | Pococí | Cariari | 10.479437 | -83.625314 | node/5266227529 (hamlet) | revisar |
| 702-la-marina | La Marina | Pococí | Guápiles | 10.213496 | -83.846054 | node/3874209500 (hamlet) | revisar |
| 702-la-nueva-esperanza | La Nueva Esperanza | Pococí | Roxana | 10.274477 | -83.76623 | node/5324873255 (neighbourhood) | revisar |
| 702-la-pajarera | La Pajarera | Pococí | Rita | 10.519007 | -83.836415 | node/5179147223 (hamlet) | revisar |
| 702-la-pavona | La Pavona | Pococí | Cariari | 10.537644 | -83.590782 | node/440399709 (hamlet) | revisar |
| 702-la-ribiera | La Ribiera | Pococí | Cariari | 10.363966 | -83.719223 | node/4950355882 (neighbourhood) | revisar |
| 702-la-sole | La Sole | Pococí | Cariari | 10.34099 | -83.760572 | node/5266082981 (hamlet) | revisar |
| 702-la-sonia | La Sonia | Pococí | Rita | 10.276332 | -83.78912 | node/3874181130 (neighbourhood) | revisar |
| 702-la-suerte | La Suerte | Pococí | Rita | 10.393084 | -83.801372 | node/1331891395 (hamlet) | revisar |
| 702-la-te | La Te | Pococí | Rita | 10.361509 | -83.846004 | node/8758977793 (hamlet) | revisar |
| 702-la-teresa | La Teresa | Pococí | Rita | 10.307942 | -83.807651 | node/1367301358 (hamlet) | revisar |
| 702-la-trinidad | La Trinidad | Pococí | Roxana | 10.29136 | -83.743002 | node/5324885969 (neighbourhood) | revisar |
| 702-la-trocha | La Trocha | Pococí | Guápiles | 10.177146 | -83.797805 | node/5323101824 (hamlet) | revisar |
| 702-la-union | La Unión | Pococí | Guápiles | 10.212953 | -83.87134 | node/1215718117 (hamlet) | revisar |
| 702-la-urba | La Urba | Pococí | Guápiles | 10.211022 | -83.799202 | node/5323135552 (neighbourhood) | revisar |
| 702-lagos-del-caribe | Lagos del Caribe | Pococí | Cariari | 10.377645 | -83.742143 | node/4950355877 (neighbourhood) | revisar |
| 702-lagunilla | Lagunilla | Pococí | Colorado | 10.624457 | -83.811883 | node/4361836717 (hamlet) | revisar |
| 702-las-brisas | Las Brisas | Pococí | Guápiles | 10.209526 | -83.803372 | node/5323135750 (neighbourhood) | revisar |
| 702-las-colinas | Las Colinas | Pococí | Rita | 10.497837 | -83.714393 | node/8758290494 (hamlet) | revisar |
| 702-las-gardenias | Las Gardenias | Pococí | Roxana | 10.285695 | -83.745712 | node/5324884014 (neighbourhood) | revisar |
| 702-las-mercedes | Las Mercedes | Pococí | Rita | 10.317732 | -83.762101 | node/5266042969 (hamlet) | revisar |
| 702-las-minas | Las Minas | Pococí | Guápiles | 10.203875 | -83.904895 | node/8761756866 (hamlet) | revisar |
| 702-las-orquideas | Las Orquídeas | Pococí | Cariari | 10.371355 | -83.7157 | node/5266203139 (neighbourhood) | revisar |
| 702-las-palmas | Las Palmas | Pococí | Guápiles | 10.230978 | -83.784325 | node/3722413014 (neighbourhood) | revisar |
| 702-las-palmas-2 | Las Palmas | Pococí | Roxana | 10.286911 | -83.747771 | node/5324891313 (neighbourhood) | revisar |
| 702-las-palmitas | Las Palmitas | Pococí | Rita | 10.45223 | -83.703762 | node/1215764977 (hamlet) | revisar |
| 702-las-torres | Las Torres | Pococí | Cariari | 10.362428 | -83.741188 | node/5266153363 (neighbourhood) | revisar |
| 702-lesville | Lesville | Pococí | Roxana | 10.265463 | -83.757945 | node/3875060863 (neighbourhood) | revisar |
| 702-leticia | Leticia | Pococí | Roxana | 10.28212 | -83.756398 | node/5324884015 (neighbourhood) | revisar |
| 702-linda-vista | Linda Vista | Pococí | Colorado | 10.598528 | -83.699955 | node/5326296975 (hamlet) | revisar |
| 702-llano-bonito | Llano Bonito | Pococí | Roxana | 10.386877 | -83.651488 | node/5325032443 (hamlet) | revisar |
| 702-lomas-de-sierpe | Lomas de Sierpe | Pococí | Roxana | 10.415889 | -83.602902 | node/1112003351 (hamlet) | revisar |
| 702-lomas-rio-costa-rica | Lomas Río Costa Rica | Pococí | Guápiles | 10.193812 | -83.874506 | node/5323088063 (neighbourhood) | revisar |
| 702-londres | Londres | Pococí | Roxana | 10.427497 | -83.63827 | node/3888249752 (hamlet) | revisar |
| 702-los-almendros | Los Almendros | Pococí | Rita | 10.274586 | -83.780958 | node/5324873257 (neighbourhood) | revisar |
| 702-los-angeles | Los Ángeles | Pococí | Cariari | 10.413376 | -83.713312 | node/3643498147 (hamlet) | revisar |
| 702-los-angeles-2 | Los Ángeles | Pococí | Guápiles | 10.210354 | -83.796792 | node/3722377921 (neighbourhood) | revisar |
| 702-los-bovinos | Los Bovinos | Pococí | Guápiles | 10.204481 | -83.811668 | node/3722347121 (neighbourhood) | revisar |
| 702-los-cedros | Los Cedros | Pococí | Guápiles | 10.218165 | -83.806145 | node/5323135550 (neighbourhood) | revisar |
| 702-los-cholos | Los Cholos | Pococí | Rita | 10.281493 | -83.780934 | node/8759007187 (neighbourhood) | revisar |
| 702-los-diamantes | Los Diamantes | Pococí | Guápiles | 10.212362 | -83.776788 | node/3722384028 (neighbourhood) | revisar |
| 702-los-helechos | Los Helechos | Pococí | Guápiles | 10.190772 | -83.797102 | node/5323119506 (neighbourhood) | revisar |
| 702-los-hermanos | Los Hermanos | Pococí | Cariari | 10.356101 | -83.73867 | node/5266153356 (neighbourhood) | revisar |
| 702-los-laureles | Los Laureles | Pococí | Guápiles | 10.225949 | -83.804218 | node/5019286587 (neighbourhood) | revisar |
| 702-los-laureles-2 | Los Laureles | Pococí | Cariari | 10.348211 | -83.719933 | node/5266116663 (neighbourhood) | revisar |
| 702-los-laureles-3 | Los Laureles | Pococí | Roxana | 10.274829 | -83.748547 | node/8753894723 (neighbourhood) | revisar |
| 702-los-maderos | Los Maderos | Pococí | Guápiles | 10.222859 | -83.789309 | node/3722396007 (neighbourhood) | revisar |
| 702-los-pinos | Los Pinos | Pococí | Rita | 10.297945 | -83.762468 | node/8769562376 (hamlet) | revisar |
| 702-los-sauces | Los Sauces | Pococí | Guápiles | 10.226398 | -83.801439 | node/3722396011 (neighbourhood) | revisar |
| 702-losilla | Losilla | Pococí | La Colonia | 10.281453 | -83.81337 | node/5323128424 (neighbourhood) | revisar |
| 702-luis-xv | Luis XV | Pococí | Roxana | 10.301514 | -83.71074 | node/5324903965 (hamlet) | revisar |
| 702-maravilla | Maravilla | Pococí | Roxana | 10.417495 | -83.655128 | node/8753428826 (hamlet) | revisar |
| 702-maria-isabel | María Isabel | Pococí | La Colonia | 10.259152 | -83.796532 | node/5324478860 (neighbourhood) | revisar |
| 702-mata-de-banano | Mata de Banano | Pococí | Colorado | 10.593269 | -83.677598 | node/5326300650 (hamlet) | revisar |
| 702-mata-de-limon | Mata de Limón | Pococí | Roxana | 10.403472 | -83.631231 | node/1100461792 (hamlet) | revisar |
| 702-millon | Millón | Pococí | Roxana | 10.444933 | -83.620818 | node/3891978833 (hamlet) | revisar |
| 702-milloncito | Milloncito | Pococí | Roxana | 10.414096 | -83.591646 | node/5325701016 (neighbourhood) | revisar |
| 702-montelimar | Montelimar | Pococí | Colorado | 10.569371 | -83.665729 | node/5326302790 (hamlet) | revisar |
| 702-monterrey | Monterrey | Pococí | Cariari | 10.469892 | -83.651837 | node/3888415707 (hamlet) | revisar |
| 702-nazareth | Nazareth | Pococí | Roxana | 10.377161 | -83.601878 | node/3891919110 (hamlet) | revisar |
| 702-nazareth-2 | Nazareth | Pococí | Cariari | 10.333535 | -83.76037 | node/5266082980 (hamlet) | revisar |
| 702-nido-1 | Nido 1 | Pococí | Rita | 10.280293 | -83.779142 | node/8759007185 (neighbourhood) | revisar |
| 702-nido-2 | Nido 2 | Pococí | Rita | 10.27893 | -83.781936 | node/8759007184 (neighbourhood) | revisar |
| 702-nueva-guapiles | Nueva Guápiles | Pococí | Guápiles | 10.198129 | -83.78539 | node/5323239780 (neighbourhood) | revisar |
| 702-nueva-rita | Nueva Rita | Pococí | Rita | 10.281095 | -83.787263 | node/8759051679 (neighbourhood) | revisar |
| 702-nuevo-amanecer | Nuevo Amanecer | Pococí | Roxana | 10.376553 | -83.658333 | node/5325031802 (neighbourhood) | revisar |
| 702-oeste | Oeste | Pococí | Roxana | 10.333468 | -83.675932 | node/8753710891 (hamlet) | revisar |
| 702-palermo | Palermo | Pococí | Cariari | 10.370791 | -83.739304 | node/1215776213 (hamlet) | revisar |
| 702-palma-dorada | Palma Dorada | Pococí | Guápiles | 10.219777 | -83.796969 | node/3722396009 (neighbourhood) | revisar |
| 702-palmera | Palmera | Pococí | Guápiles | 10.211932 | -83.810339 | node/8762847856 (neighbourhood) | revisar |
| 702-palmitas | Palmitas | Pococí | Rita | 10.436986 | -83.800887 | node/5033164667 (hamlet) | revisar |
| 702-parasal | Parasal | Pococí | Jiménez | 10.247531 | -83.73539 | node/5324442309 (neighbourhood) | revisar |
| 702-patio-san-cristobal | Patio San Cristobal | Pococí | Rita | 10.347364 | -83.834261 | node/1367301362 (hamlet) | revisar |
| 702-penitencia | Penitencia | Pococí | Rita | 10.551053 | -83.700041 | node/8758274687 (hamlet) | revisar |
| 702-pinares | Pinares | Pococí | Guápiles | 10.211025 | -83.782351 | node/3722384026 (neighbourhood) | revisar |
| 702-playa-punta-castilla | Playa Punta Castilla | Pococí | Colorado | 10.903021 | -83.644337 | relation/10259356 (beach) | sí |
| 702-primavera | Primavera | Pococí | Rita | 10.429027 | -83.780893 | node/8758620812 (hamlet) | revisar |
| 702-pueblo-nuevo | Pueblo Nuevo | Pococí | Cariari | 10.335309 | -83.742024 | node/4950302726 (neighbourhood) | revisar |
| 702-pueblo-nuevo-2 | Pueblo Nuevo | Pococí | Roxana | 10.268717 | -83.77054 | node/5033192763 (neighbourhood) | revisar |
| 702-pueblo-triste | Pueblo Triste | Pococí | Cariari | 10.373973 | -83.728759 | node/2101624168 (neighbourhood) | revisar |
| 702-puerto-lindo | Puerto Lindo | Pococí | Colorado | 10.682929 | -83.666001 | node/1215762747 (hamlet) | revisar |
| 702-punta-castilla | Punta Castilla | Pococí | Colorado | 10.92799 | -83.668594 | node/9971993594 (hamlet) | revisar |
| 702-punta-de-riel | Punta de Riel | Pococí | Roxana | 10.281622 | -83.747933 | node/5033192764 (neighbourhood) | revisar |
| 702-rancho-redondo | Rancho Redondo | Pococí | Guápiles | 10.178864 | -83.855705 | node/5323088060 (hamlet) | revisar |
| 702-rio-verde | Río Verde | Pococí | Jiménez | 10.200623 | -83.774955 | node/8773370067 (neighbourhood) | revisar |
| 702-rita | Rita | Pococí | Rita | 10.279852 | -83.783602 | node/1367292648 (village) | sí |
| 702-rotulo | Rótulo | Pococí | Rita | 10.412209 | -83.762716 | node/8758620770 (hamlet) | revisar |
| 702-roxana | Roxana | Pococí | Roxana | 10.272741 | -83.751218 | node/1367297000 (village) | sí |
| 702-roxana-dos | Roxana Dos | Pococí | Rita | 10.318853 | -83.755767 | node/8753753661 (neighbourhood) | revisar |
| 702-roxana-tres | Roxana Tres | Pococí | Roxana | 10.321385 | -83.722881 | node/5324990804 (neighbourhood) | revisar |
| 702-roxana-uno | Roxana Uno | Pococí | Roxana | 10.302499 | -83.749948 | node/5324924034 (neighbourhood) | revisar |
| 702-roxanita | Roxanita | Pococí | Cariari | 10.328508 | -83.758615 | node/5266095971 (hamlet) | revisar |
| 702-sagrada-familia | Sagrada Familia | Pococí | Cariari | 10.348655 | -83.715744 | node/3874955599 (hamlet) | revisar |
| 702-san-antonio-de-el-humo | San Antonio de El Humo | Pococí | Roxana | 10.281008 | -83.725398 | node/2766193104 (hamlet) | revisar |
| 702-san-bosco | San Bosco | Pococí | La Colonia | 10.276097 | -83.807803 | node/5323128423 (hamlet) | revisar |
| 702-san-carlos | San Carlos | Pococí | Rita | 10.479199 | -83.754567 | node/8758548454 (hamlet) | revisar |
| 702-san-francisco | San Francisco | Pococí | Colorado | 10.579178 | -83.523939 | node/440653534 (hamlet) | revisar |
| 702-san-francisco-2 | San Francisco | Pococí | Rita | 10.496537 | -83.83044 | node/5179146963 (neighbourhood) | revisar |
| 702-san-francisco-3 | San Francisco | Pococí | Guápiles | 10.215379 | -83.792497 | node/5323261566 (neighbourhood) | revisar |
| 702-san-francisco-4 | San Francisco | Pococí | Roxana | 10.425683 | -83.648698 | node/5325722369 (neighbourhood) | revisar |
| 702-san-gabriel | San Gabriel | Pococí | La Colonia | 10.25003 | -83.797313 | node/5324478861 (neighbourhood) | revisar |
| 702-san-gerardo | San Gerardo | Pococí | Rita | 10.388837 | -83.859049 | node/1331884813 (hamlet) | revisar |
| 702-san-isidro | San Isidro | Pococí | Rita | 10.476222 | -83.717826 | node/3875470454 (hamlet) | revisar |
| 702-san-jorge | San Jorge | Pococí | Roxana | 10.43731 | -83.611923 | node/3888249753 (hamlet) | revisar |
| 702-san-juan | San Juan | Pococí | La Colonia | 10.237923 | -83.80413 | node/3722413015 (neighbourhood) | revisar |
| 702-san-juan-2 | San Juan | Pococí | Cariari | 10.36486 | -83.737286 | node/5266153361 (neighbourhood) | revisar |
| 702-san-juan-de-pococi | San Juan de Pococí | Pococí | Rita | 10.571136 | -83.812482 | node/8758064849 (hamlet) | revisar |
| 702-san-luis | San Luis | Pococí | Jiménez | 10.259745 | -83.710619 | node/3874197072 (hamlet) | revisar |
| 702-san-martin | San Martín | Pococí | Jiménez | 10.217614 | -83.746955 | node/3722386325 (neighbourhood) | revisar |
| 702-san-miguel | San Miguel | Pococí | Guápiles | 10.229102 | -83.797715 | node/3722396013 (neighbourhood) | revisar |
| 702-san-miguel-2 | San Miguel | Pococí | Cariari | 10.337534 | -83.72527 | node/5266116662 (neighbourhood) | revisar |
| 702-san-pablo | San Pablo | Pococí | Colorado | 10.502067 | -83.550929 | node/5326174750 (neighbourhood) | revisar |
| 702-san-pedro | San Pedro | Pococí | Rita | 10.400877 | -83.772406 | node/4196046883 (hamlet) | revisar |
| 702-san-peter | San Peter | Pococí | Rita | 10.410209 | -83.772643 | node/3875452111 (neighbourhood) | revisar |
| 702-san-rafael | San Rafael | Pococí | La Colonia | 10.246567 | -83.802318 | node/2626373044 (village) | sí |
| 702-san-rafael-2 | San Rafael | Pococí | Colorado | 10.546214 | -83.620586 | node/5326307634 (hamlet) | revisar |
| 702-san-roque | San Roque | Pococí | Rita | 10.279674 | -83.789113 | node/8759051678 (neighbourhood) | revisar |
| 702-san-valentin | San Valentín | Pococí | Jiménez | 10.096722 | -83.789223 | node/5324278440 (neighbourhood) | revisar |
| 702-santa-cecilia | Santa Cecilia | Pococí | Guápiles | 10.210145 | -83.792675 | node/3722377923 (neighbourhood) | revisar |
| 702-santa-clara | Santa Clara | Pococí | Roxana | 10.29901 | -83.702999 | node/1133853566 (hamlet) | revisar |
| 702-santa-clara-2 | Santa Clara | Pococí | Roxana | 10.265021 | -83.751908 | node/5324861969 (neighbourhood) | revisar |
| 702-santa-clara-3 | Santa Clara | Pococí | Jiménez | 10.206271 | -83.772245 | node/8746937987 (neighbourhood) | revisar |
| 702-santa-clara-4 | Santa Clara | Pococí | Guápiles | 10.205749 | -83.784461 | node/8766471154 (neighbourhood) | revisar |
| 702-santa-elena | Santa Elena | Pococí | La Colonia | 10.241301 | -83.807625 | node/3722396016 (neighbourhood) | revisar |
| 702-santa-elena-2 | Santa Elena | Pococí | Rita | 10.379952 | -83.797848 | node/8758905757 (hamlet) | revisar |
| 702-santa-rosa | Santa Rosa | Pococí | Rita | 10.351279 | -83.804029 | node/8751019984 (hamlet) | revisar |
| 702-santa-teresita-peoresnada | Santa Teresita (Peoresnada) | Pococí | Colorado | 10.892495 | -83.669389 | node/5181314595 (hamlet) | revisar |
| 702-sardina | Sardina | Pococí | Colorado | 10.629737 | -83.742262 | node/5326293810 (hamlet) | revisar |
| 702-sector-9 | Sector 9 | Pococí | Rita | 10.404575 | -83.852599 | node/8758960746 (hamlet) | revisar |
| 702-sinai | Sinaí | Pococí | Guápiles | 10.204778 | -83.7985 | node/3722377922 (neighbourhood) | revisar |
| 702-sirena | Sirena | Pococí | Rita | 10.356252 | -83.78051 | node/3875447550 (hamlet) | revisar |
| 702-suarez | Suárez | Pococí | Rita | 10.437254 | -83.793662 | node/8758770570 (neighbourhood) | revisar |
| 702-suerre | Suerre | Pococí | Jiménez | 10.187423 | -83.755052 | node/2179217241 (hamlet) | revisar |
| 702-tarire | Tarire | Pococí | Rita | 10.323514 | -83.805981 | node/5033029213 (neighbourhood) | revisar |
| 702-ticaban | Ticabán | Pococí | Rita | 10.395467 | -83.83265 | node/1331890639 (hamlet) | revisar |
| 702-toro-amarillo | Toro Amarillo | Pococí | Guápiles | 10.213165 | -83.807184 | node/1215727905 (neighbourhood) | revisar |
| 702-tortuguero | Tortuguero | Pococí | Colorado | 10.542031 | -83.502762 | node/441421501 (hamlet) | revisar |
| 702-triangulo | Triángulo | Pococí | Rita | 10.47024 | -83.697521 | node/3875470451 (hamlet) | revisar |
| 702-urania | Urania | Pococí | Cariari | 10.353263 | -83.704706 | node/8747649450 (neighbourhood) | revisar |
| 702-valle-del-sol | Valle del Sol | Pococí | La Colonia | 10.246558 | -83.791067 | node/3722396017 (neighbourhood) | revisar |
| 702-valquiria | Valquiria | Pococí | Jiménez | 10.255578 | -83.747711 | node/5324442310 (neighbourhood) | revisar |
| 702-vargas | Vargas | Pococí | Jiménez | 10.211682 | -83.751424 | node/5324423299 (neighbourhood) | revisar |
| 702-vega-de-rio-palacios | Vega de Río Palacios | Pococí | Cariari | 10.498765 | -83.614564 | node/3888249863 (hamlet) | revisar |
| 702-vegas-de-tortuguero | Vegas de Tortuguero | Pococí | Roxana | 10.392377 | -83.669079 | node/5266203151 (hamlet) | revisar |
| 702-verdades | Verdades | Pococí | Rita | 10.601239 | -83.815569 | node/8740551553 (hamlet) | revisar |
| 702-victoria | Victoria | Pococí | La Colonia | 10.288337 | -83.824575 | node/5323125910 (hamlet) | revisar |
| 702-victoria-2 | Victoria | Pococí | Rita | 10.436931 | -83.757362 | node/8758604189 (hamlet) | revisar |
| 702-villa-hermosa | Villa Hermosa | Pococí | Cariari | 10.388848 | -83.717354 | node/1331896909 (neighbourhood) | revisar |
| 702-vuelta-guayabo | Vuelta Guayabo | Pococí | Rita | 10.446815 | -83.840991 | node/8758803632 (neighbourhood) | revisar |
| 702-zacatales | Zacatales | Pococí | Cariari | 10.468955 | -83.591767 | node/5266241646 (neighbourhood) | revisar |
| 702-zurqui | Zurquí | Pococí | Guápiles | 10.221407 | -83.790627 | node/3722396005 (neighbourhood) | revisar |
| 703-3-de-mayo | 3 de Mayo | Siquirres | Siquirres | 10.104368 | -83.502826 | node/4285502970 (neighbourhood) | revisar |
| 703-3-millas | 3 Millas | Siquirres | El Cairo | 10.155573 | -83.51191 | node/3280780580 (hamlet) | revisar |
| 703-4-millas | 4 Millas | Siquirres | El Cairo | 10.169987 | -83.500825 | node/3280780637 (hamlet) | revisar |
| 703-5-millas | 5 Millas | Siquirres | El Cairo | 10.179127 | -83.492099 | node/3280780638 (hamlet) | revisar |
| 703-6-de-mayo | 6 de Mayo | Siquirres | Siquirres | 10.107784 | -83.502064 | node/4285502971 (neighbourhood) | revisar |
| 703-alegria | Alegría | Siquirres | Alegría | 10.088434 | -83.602084 | node/486817129 (village) | sí |
| 703-alto-herediana | Alto Herediana | Siquirres | Alegría | 10.11791 | -83.575717 | node/1342944616 (hamlet) | revisar |
| 703-alto-las-brisas | Alto Las Brisas | Siquirres | Pacuarito | 10.000809 | -83.465215 | node/5249299500 (hamlet) | revisar |
| 703-alto-mirador | Alto Mirador | Siquirres | Pacuarito | 10.079424 | -83.476552 | node/3279698900 (hamlet) | revisar |
| 703-alto-pascua | Alto Pascua | Siquirres | Florida | 10.029769 | -83.643661 | node/4840746790 (hamlet) | revisar |
| 703-altos-de-germania | Altos de Germania | Siquirres | Alegría | 10.132892 | -83.582562 | node/8729178053 (hamlet) | revisar |
| 703-altos-de-pacuarito | Altos de Pacuarito | Siquirres | Pacuarito | 10.016084 | -83.474558 | node/5249299502 (hamlet) | revisar |
| 703-america | América | Siquirres | Germania | 10.151147 | -83.575386 | node/8725508231 (neighbourhood) | revisar |
| 703-asentamiento-acasi | Asentamiento Acasi | Siquirres | El Cairo | 10.215055 | -83.499244 | node/5033334534 (hamlet) | revisar |
| 703-babilonia | Babilonia | Siquirres | Germania | 10.144251 | -83.573728 | node/8725508228 (neighbourhood) | revisar |
| 703-bajo-52-millas | Bajo 52 Millas | Siquirres | Siquirres | 9.991804 | -83.586983 | node/4840751840 (neighbourhood) | revisar |
| 703-bajo-cuarenta-y-siete | Bajo Cuarenta y Siete | Siquirres | Florida | 10.049159 | -83.607609 | node/1342959283 (neighbourhood) | revisar |
| 703-bajo-tigre | Bajo Tigre | Siquirres | Siquirres | 10.006938 | -83.547722 | node/4840805917 (neighbourhood) | revisar |
| 703-barnstorf | Barnstorf | Siquirres | Siquirres | 10.148614 | -83.462072 | node/3279737036 (neighbourhood) | revisar |
| 703-barrio-el-mangal | Barrio El Mangal | Siquirres | Siquirres | 10.095016 | -83.499308 | node/4285491797 (neighbourhood) | revisar |
| 703-barrio-nuevo | Barrio Nuevo | Siquirres | Siquirres | 10.098309 | -83.494454 | node/4285491559 (neighbourhood) | revisar |
| 703-bellavista | Bellavista | Siquirres | El Cairo | 10.196497 | -83.548597 | node/5029856964 (hamlet) | revisar |
| 703-betania | Betania | Siquirres | Siquirres | 10.094326 | -83.490511 | node/4285491578 (neighbourhood) | revisar |
| 703-boca-parismina | Boca Parismina | Siquirres | Reventazón | 10.308747 | -83.352069 | node/3279727061 (hamlet) | revisar |
| 703-boca-rio-jimenez | Boca Río Jiménez | Siquirres | El Cairo | 10.283442 | -83.477325 | node/8723294151 (hamlet) | revisar |
| 703-bonilla | Bonilla | Siquirres | Florida | 10.008433 | -83.608986 | node/1342959877 (hamlet) | revisar |
| 703-brooklin | Brooklin | Siquirres | Siquirres | 10.106996 | -83.519408 | node/1364117554 (neighbourhood) | revisar |
| 703-buenos-aires | Buenos Aires | Siquirres | Pacuarito | 10.16787 | -83.403823 | node/3279706561 (hamlet) | revisar |
| 703-cacao | Cacao | Siquirres | Germania | 10.137547 | -83.557493 | node/8725465576 (neighbourhood) | revisar |
| 703-cadiz | Cádiz | Siquirres | Reventazón | 10.24015 | -83.461758 | node/8720066490 (hamlet) | revisar |
| 703-canada | Canadá | Siquirres | Siquirres | 10.147546 | -83.479222 | node/3279736411 (hamlet) | revisar |
| 703-cano-blanco | Caño Blanco | Siquirres | Reventazón | 10.262751 | -83.3672 | node/1352133805 (hamlet) | revisar |
| 703-carmen-1 | Carmen 1 | Siquirres | Reventazón | 10.19059 | -83.482659 | node/8720089371 (neighbourhood) | revisar |
| 703-carmen-2 | Carmen 2 | Siquirres | Reventazón | 10.201298 | -83.479775 | node/1144975517 (neighbourhood) | revisar |
| 703-carmen-3 | Carmen 3 | Siquirres | Reventazón | 10.205787 | -83.467565 | node/4888021324 (neighbourhood) | revisar |
| 703-casorla | Casorla | Siquirres | Florida | 10.00113 | -83.595902 | node/4840722226 (neighbourhood) | revisar |
| 703-castilla | Castilla | Siquirres | El Cairo | 10.22797 | -83.489188 | node/8723294150 (neighbourhood) | revisar |
| 703-celina | Celina | Siquirres | Reventazón | 10.205718 | -83.370482 | node/6020298255 (hamlet) | revisar |
| 703-cimarrones | Cimarrones | Siquirres | Pacuarito | 10.098192 | -83.424849 | node/440728249 (hamlet) | revisar |
| 703-ciudadela-flores | Ciudadela Flores | Siquirres | Reventazón | 10.195755 | -83.397668 | node/1559814211 (hamlet) | revisar |
| 703-cocal | Cocal | Siquirres | El Cairo | 10.219247 | -83.546922 | node/8723341207 (hamlet) | revisar |
| 703-cocal-2 | Cocal | Siquirres | Siquirres | 10.123952 | -83.510818 | node/8729503498 (hamlet) | revisar |
| 703-codela | Codela | Siquirres | Germania | 10.160403 | -83.595222 | node/3872251315 (hamlet) | revisar |
| 703-colombiana | Colombiana | Siquirres | Germania | 10.156456 | -83.581926 | node/8725508232 (neighbourhood) | revisar |
| 703-culpepper | Culpepper | Siquirres | Pacuarito | 10.100048 | -83.433106 | node/3279686786 (neighbourhood) | revisar |
| 703-cultivez | Cultivez | Siquirres | Pacuarito | 10.140432 | -83.42832 | node/3279702479 (hamlet) | revisar |
| 703-cundinamarca | Cundinamarca | Siquirres | Reventazón | 10.276074 | -83.431125 | node/8720068670 (hamlet) | revisar |
| 703-dorotea | Dorotea | Siquirres | Reventazón | 10.247879 | -83.449204 | node/8720066491 (hamlet) | revisar |
| 703-dos-bocas | Dos Bocas | Siquirres | Reventazón | 10.285653 | -83.406549 | node/3872287645 (hamlet) | revisar |
| 703-dueri | Dueri | Siquirres | Pacuarito | 10.033702 | -83.485991 | node/8430062276 (hamlet) | revisar |
| 703-el-alto | El Alto | Siquirres | Florida | 10.090843 | -83.580275 | node/8725861870 (neighbourhood) | revisar |
| 703-el-cairo | El Cairo | Siquirres | El Cairo | 10.12085 | -83.538229 | node/279241405 (village) | sí |
| 703-el-carmen | El Carmen | Siquirres | Reventazón | 10.199805 | -83.479694 | node/1082080512 (hamlet) | revisar |
| 703-el-coco | El Coco | Siquirres | Siquirres | 10.094378 | -83.537704 | node/7533334759 (neighbourhood) | revisar |
| 703-el-cruce | El Cruce | Siquirres | Alegría | 10.101321 | -83.582702 | node/1342944615 (hamlet) | revisar |
| 703-el-invu | El INVU | Siquirres | Siquirres | 10.100234 | -83.512783 | node/4285491814 (neighbourhood) | revisar |
| 703-el-llano | El Llano | Siquirres | Florida | 10.003741 | -83.60311 | node/4840722753 (hamlet) | revisar |
| 703-el-peje | El Peje | Siquirres | El Cairo | 10.172902 | -83.520498 | node/3280837897 (hamlet) | revisar |
| 703-el-porvenir | El Porvenir | Siquirres | Pacuarito | 10.178095 | -83.395701 | node/8722887212 (hamlet) | revisar |
| 703-el-quebrador | El Quebrador | Siquirres | Siquirres | 10.110345 | -83.521238 | node/4285491816 (neighbourhood) | revisar |
| 703-el-silencio | El Silencio | Siquirres | El Cairo | 10.183611 | -83.536758 | node/3280903696 (hamlet) | revisar |
| 703-el-triunfo | El Triunfo | Siquirres | Siquirres | 10.095018 | -83.508811 | node/4285491802 (neighbourhood) | revisar |
| 703-encanto | Encanto | Siquirres | Reventazón | 10.190637 | -83.394866 | node/8722110828 (neighbourhood) | revisar |
| 703-esperanza | Esperanza | Siquirres | Reventazón | 10.215302 | -83.358586 | node/6020716351 (hamlet) | revisar |
| 703-finca-cocles | Finca Cocles | Siquirres | Pacuarito | 10.131584 | -83.431718 | node/2328920296 (neighbourhood) | revisar |
| 703-finca-corsega | Finca Corsega | Siquirres | Pacuarito | 10.12338 | -83.37023 | node/4046313252 (hamlet) | revisar |
| 703-finca-freeman-1 | Finca Freeman 1 | Siquirres | Pacuarito | 10.200041 | -83.332834 | node/8722795946 (neighbourhood) | revisar |
| 703-finca-freeman-2 | Finca Freeman 2 | Siquirres | Pacuarito | 10.198981 | -83.316959 | node/8722795926 (neighbourhood) | revisar |
| 703-finca-imperio-2 | Finca Imperio 2 | Siquirres | Reventazón | 10.181887 | -83.41333 | node/8722110858 (neighbourhood) | revisar |
| 703-finca-imperio-3 | Finca Imperio 3 | Siquirres | Reventazón | 10.182113 | -83.41573 | node/8722110859 (neighbourhood) | revisar |
| 703-finca-panama | Finca Panamá | Siquirres | Pacuarito | 10.160467 | -83.3767 | node/1559815321 (neighbourhood) | revisar |
| 703-finca-perla-2 | Finca Perla 2 | Siquirres | Pacuarito | 10.190716 | -83.365432 | node/8722887204 (neighbourhood) | revisar |
| 703-finca-perla-3 | Finca Perla 3 | Siquirres | Pacuarito | 10.197974 | -83.358161 | node/1267973728 (neighbourhood) | revisar |
| 703-florida | Florida | Siquirres | Florida | 10.096452 | -83.569924 | node/3070468216 (village) | sí |
| 703-francia | Francia | Siquirres | El Cairo | 10.128195 | -83.543959 | node/1215739414 (neighbourhood) | revisar |
| 703-freehold | Freehold | Siquirres | Pacuarito | 10.104984 | -83.456678 | node/1126836238 (neighbourhood) | revisar |
| 703-freeman | Freeman | Siquirres | Pacuarito | 10.203919 | -83.33029 | node/6020725101 (hamlet) | revisar |
| 703-galicia | Galicia | Siquirres | Pacuarito | 10.155286 | -83.425745 | node/1267980454 (hamlet) | revisar |
| 703-germania | Germania | Siquirres | Germania | 10.147705 | -83.571819 | node/1215738298 (village) | sí |
| 703-grano-de-oro | Grano de Oro | Siquirres | Alegría | 10.108442 | -83.572022 | node/8729252829 (hamlet) | revisar |
| 703-guayabal | Guayabal | Siquirres | Siquirres | 10.107079 | -83.507471 | node/3372696843 (neighbourhood) | revisar |
| 703-guayacan | Guayacán | Siquirres | Siquirres | 10.03546 | -83.548013 | node/1718622118 (hamlet) | revisar |
| 703-hamburgo | Hamburgo | Siquirres | Reventazón | 10.247514 | -83.465069 | node/8720080010 (hamlet) | revisar |
| 703-herediana | Herediana | Siquirres | Germania | 10.133068 | -83.555595 | node/739135984 (hamlet) | revisar |
| 703-huecos | Huecos | Siquirres | Florida | 10.002909 | -83.623005 | node/8726145149 (hamlet) | revisar |
| 703-i-griega | I Griega | Siquirres | Alegría | 10.124389 | -83.565606 | node/8729265323 (neighbourhood) | revisar |
| 703-imperio | Imperio | Siquirres | Reventazón | 10.18283 | -83.418863 | node/1352133565 (hamlet) | revisar |
| 703-imperio-1 | Imperio 1 | Siquirres | Reventazón | 10.182936 | -83.424121 | node/8722110857 (hamlet) | revisar |
| 703-indiana-dos | Indiana Dos | Siquirres | Siquirres | 10.115857 | -83.478924 | node/3279740390 (hamlet) | revisar |
| 703-indiana-tres | Indiana Tres | Siquirres | Siquirres | 10.1277 | -83.458844 | node/1559816965 (hamlet) | revisar |
| 703-indiana-uno | Indiana Uno | Siquirres | Siquirres | 10.10579 | -83.484732 | node/3279737294 (hamlet) | revisar |
| 703-isla-nueva | Isla Nueva | Siquirres | Pacuarito | 10.217492 | -83.281333 | node/8722668415 (neighbourhood) | revisar |
| 703-islona | Islona | Siquirres | Reventazón | 10.232881 | -83.469522 | node/6020690688 (hamlet) | revisar |
| 703-jameikari | Jameikäri | Siquirres | Pacuarito | 10.016192 | -83.497186 | node/8429988247 (hamlet) | revisar |
| 703-junta | Junta | Siquirres | El Cairo | 10.115811 | -83.528881 | node/8723244585 (neighbourhood) | revisar |
| 703-la-amelia | La Amelia | Siquirres | Siquirres | 10.107871 | -83.493311 | node/4285491818 (neighbourhood) | revisar |
| 703-la-catalina | La Catalina | Siquirres | El Cairo | 10.235639 | -83.487808 | node/2328917049 (hamlet) | revisar |
| 703-la-esmeralda | La Esmeralda | Siquirres | Alegría | 10.12179 | -83.587373 | node/8729178023 (neighbourhood) | revisar |
| 703-la-guaria | La Guaria | Siquirres | Siquirres | 10.095713 | -83.502133 | node/4285491796 (neighbourhood) | revisar |
| 703-la-josefina | La Josefina | Siquirres | El Cairo | 10.19649 | -83.507569 | node/5033334581 (hamlet) | revisar |
| 703-la-lucha | La Lucha | Siquirres | Siquirres | 10.151103 | -83.454186 | node/3279738127 (hamlet) | revisar |
| 703-la-mucap | La Mucap | Siquirres | Siquirres | 10.100756 | -83.519758 | node/4285491800 (neighbourhood) | revisar |
| 703-la-recta | La Recta | Siquirres | Reventazón | 10.192692 | -83.446133 | node/8722105627 (neighbourhood) | revisar |
| 703-la-victoria | La Victoria | Siquirres | Siquirres | 10.1066 | -83.513521 | node/3372696842 (neighbourhood) | revisar |
| 703-las-lomas | Las Lomas | Siquirres | Florida | 10.066927 | -83.610666 | node/1342958029 (hamlet) | revisar |
| 703-las-palmiras | Las Palmiras | Siquirres | Siquirres | 10.088545 | -83.504365 | node/4285491798 (neighbourhood) | revisar |
| 703-las-vegas-de-imperio | Las Vegas de Imperio | Siquirres | Reventazón | 10.215003 | -83.323044 | node/6020716352 (hamlet) | revisar |
| 703-leona | Leona | Siquirres | Pacuarito | 10.093404 | -83.471112 | node/3279698674 (hamlet) | revisar |
| 703-linda-vista | Linda Vista | Siquirres | Siquirres | 9.988519 | -83.570166 | node/1718619307 (hamlet) | revisar |
| 703-livingston | Livingston | Siquirres | Siquirres | 10.116375 | -83.516913 | node/8729503505 (hamlet) | revisar |
| 703-los-angeles | Los Ángeles | Siquirres | Reventazón | 10.222998 | -83.440789 | node/6020667636 (hamlet) | revisar |
| 703-los-ceibos | Los Ceibos | Siquirres | Alegría | 10.104685 | -83.596608 | node/4853851599 (hamlet) | revisar |
| 703-los-laureles | Los Laureles | Siquirres | Siquirres | 10.112169 | -83.509195 | node/3372696844 (neighbourhood) | revisar |
| 703-los-trabajadores | Los Trabajadores | Siquirres | Siquirres | 10.106685 | -83.51668 | node/4285491817 (neighbourhood) | revisar |
| 703-louisiana | Louisiana | Siquirres | El Cairo | 10.144315 | -83.520466 | node/3280763751 (hamlet) | revisar |
| 703-madre-de-dios | Madre de Dios | Siquirres | Pacuarito | 10.094113 | -83.399048 | node/1559813575 (hamlet) | revisar |
| 703-manila | Manila | Siquirres | Pacuarito | 10.167284 | -83.414728 | node/3279706562 (hamlet) | revisar |
| 703-maria-auxiliadora | María Auxiliadora | Siquirres | Siquirres | 10.09855 | -83.509384 | node/1439960830 (neighbourhood) | revisar |
| 703-maryland | Maryland | Siquirres | Reventazón | 10.231307 | -83.410924 | node/6020667625 (hamlet) | revisar |
| 703-merayo | Merayo | Siquirres | Siquirres | 10.106945 | -83.499623 | node/4285502972 (neighbourhood) | revisar |
| 703-milano | Milano | Siquirres | Germania | 10.18922 | -83.575472 | node/3279850176 (hamlet) | revisar |
| 703-miraflores | Miraflores | Siquirres | Siquirres | 10.095634 | -83.512641 | node/4285491799 (neighbourhood) | revisar |
| 703-monteverde | Monteverde | Siquirres | Pacuarito | 10.100687 | -83.446263 | node/382113795 (hamlet) | revisar |
| 703-moravia | Moravia | Siquirres | Siquirres | 10.087713 | -83.542035 | node/3279748459 (hamlet) | revisar |
| 703-morazan | Morazán | Siquirres | Siquirres | 10.017945 | -83.576216 | node/1718621032 (hamlet) | revisar |
| 703-nazareth | Nazareth | Siquirres | Siquirres | 10.099496 | -83.48825 | node/4285491579 (neighbourhood) | revisar |
| 703-nueva-esperanza | Nueva Esperanza | Siquirres | Reventazón | 10.203824 | -83.437904 | node/6020287331 (village) | sí |
| 703-nueva-virgina | Nueva Virgina | Siquirres | Reventazón | 10.221797 | -83.452969 | node/6020667648 (hamlet) | revisar |
| 703-ontario | Ontario | Siquirres | El Cairo | 10.250947 | -83.470821 | node/8723294157 (neighbourhood) | revisar |
| 703-pacuarito | Pacuarito | Siquirres | Pacuarito | 10.103204 | -83.466235 | node/1215741759 (village) | sí |
| 703-pascua | Pascua | Siquirres | Florida | 10.026477 | -83.613899 | node/1342959522 (hamlet) | revisar |
| 703-perla | Perla | Siquirres | Pacuarito | 10.177623 | -83.379854 | node/1085151925 (hamlet) | revisar |
| 703-perlita | Perlita | Siquirres | Pacuarito | 10.207757 | -83.350313 | node/3279701318 (hamlet) | revisar |
| 703-porton-de-iberia | Portón de Iberia | Siquirres | Alegría | 10.118971 | -83.601014 | node/5033361567 (hamlet) | revisar |
| 703-rio-hondo | Río Hondo | Siquirres | Pacuarito | 10.096412 | -83.417971 | node/791775304 (hamlet) | revisar |
| 703-rio-peje | Río Peje | Siquirres | Alegría | 10.082052 | -83.595193 | node/8729062442 (neighbourhood) | revisar |
| 703-san-alberto-nuevo | San Alberto Nuevo | Siquirres | Siquirres | 10.153702 | -83.474344 | node/1267982370 (hamlet) | revisar |
| 703-san-alberto-viejo | San Alberto Viejo | Siquirres | Siquirres | 10.148909 | -83.485366 | node/1623249212 (hamlet) | revisar |
| 703-san-antonio | San Antonio | Siquirres | Florida | 10.04674 | -83.613411 | node/1342959518 (hamlet) | revisar |
| 703-san-carlos | San Carlos | Siquirres | Pacuarito | 10.11968 | -83.380271 | node/1352133408 (hamlet) | revisar |
| 703-san-isidro | San Isidro | Siquirres | Pacuarito | 10.129162 | -83.379307 | node/8723075939 (neighbourhood) | revisar |
| 703-san-luis | San Luis | Siquirres | Pacuarito | 10.107242 | -83.439334 | node/8722970021 (hamlet) | revisar |
| 703-san-martin | San Martin | Siquirres | Siquirres | 10.101402 | -83.502551 | node/1077780994 (neighbourhood) | revisar |
| 703-san-pablo | San Pablo | Siquirres | Pacuarito | 10.111732 | -83.380791 | node/8723075974 (hamlet) | revisar |
| 703-san-rafael | San Rafael | Siquirres | Siquirres | 10.103825 | -83.508568 | node/1437639750 (neighbourhood) | revisar |
| 703-santa-marta | Santa Marta | Siquirres | Siquirres | 10.081311 | -83.546435 | node/1661185237 (hamlet) | revisar |
| 703-santa-marta-2 | Santa Marta | Siquirres | Siquirres | 10.010964 | -83.565808 | node/6003323421 (neighbourhood) | revisar |
| 703-santa-rosa | Santa Rosa | Siquirres | Pacuarito | 10.102973 | -83.42765 | node/8722970045 (hamlet) | revisar |
| 703-santo-domingo | Santo Domingo | Siquirres | Reventazón | 10.183632 | -83.481883 | node/3279732377 (hamlet) | revisar |
| 703-seis-amigos | Seis Amigos | Siquirres | El Cairo | 10.255654 | -83.476838 | node/5033305263 (hamlet) | revisar |
| 703-seis-millas | Seis Millas | Siquirres | El Cairo | 10.196187 | -83.497169 | node/8723294147 (hamlet) | revisar |
| 703-siquirres | Siquirres | Siquirres | Siquirres | 10.097997 | -83.50757 | node/279239581 (town) | sí |
| 703-siquirrito | Siquirrito | Siquirres | Siquirres | 10.101951 | -83.514227 | node/4285491815 (neighbourhood) | revisar |
| 703-ten-switch | Ten Switch | Siquirres | Pacuarito | 10.184079 | -83.389044 | node/6020542526 (neighbourhood) | revisar |
| 703-tobias-vaglio | Tobías Vaglio | Siquirres | Siquirres | 10.098766 | -83.491228 | node/4285491560 (neighbourhood) | revisar |
| 703-trinidad | Trinidad | Siquirres | Pacuarito | 10.085513 | -83.442592 | node/8723262407 (hamlet) | revisar |
| 703-trinidad-2 | Trinidad | Siquirres | Germania | 10.148077 | -83.548938 | node/8725508227 (hamlet) | revisar |
| 703-tsinikicha | Tsinikicha | Siquirres | Pacuarito | 9.987307 | -83.462006 | node/8430093457 (hamlet) | revisar |
| 703-tsiobata | Tsiöbata | Siquirres | Pacuarito | 9.984522 | -83.53677 | node/8429984066 (village) | sí |
| 703-union-campesina | Unión Campesina | Siquirres | Pacuarito | 10.102415 | -83.39526 | node/8722970049 (hamlet) | revisar |
| 703-uvita | Uvita | Siquirres | Pacuarito | 10.174984 | -83.403312 | node/2328919964 (neighbourhood) | revisar |
| 703-vueltas | Vueltas | Siquirres | Alegría | 10.094503 | -83.607317 | node/8729062443 (neighbourhood) | revisar |
| 703-waldeck | Waldeck | Siquirres | Pacuarito | 10.149397 | -83.396004 | node/3280959502 (hamlet) | revisar |
| 703-williamsburg | Williamsburg | Siquirres | Germania | 10.159989 | -83.586329 | node/8725508233 (neighbourhood) | revisar |
| 704-akberie-piedra-grande | Akberie (Piedra Grande) | Talamanca | Bratsi | 9.596924 | -82.87583 | node/5154022456 (neighbourhood) | revisar |
| 704-altamira | Altamira | Talamanca | Bratsi | 9.660415 | -82.923641 | node/5034845406 (hamlet) | revisar |
| 704-alto-blei | Alto Blei | Talamanca | Telire | 9.616687 | -83.249217 | node/8433512265 (neighbourhood) | revisar |
| 704-alto-chinahucha | Alto Chinahucha | Talamanca | Telire | 9.44562 | -83.185572 | node/8355662230 (hamlet) | revisar |
| 704-alto-coen | Alto Coen | Talamanca | Telire | 9.501788 | -83.089176 | node/5151074386 (hamlet) | revisar |
| 704-alto-de-catarina | Alto de Catarina | Talamanca | Sixaola | 9.593859 | -82.728114 | node/5155660574 (neighbourhood) | revisar |
| 704-alto-kachabli | Alto Kachabli | Talamanca | Telire | 9.489933 | -82.983282 | node/5150788530 (hamlet) | revisar |
| 704-alto-katsi | Alto Katsi | Talamanca | Telire | 9.494227 | -82.934474 | node/5150835529 (hamlet) | revisar |
| 704-alto-piedra-mesa | Alto Piedra Mesa | Talamanca | Telire | 9.589031 | -83.335601 | node/8433593285 (neighbourhood) | revisar |
| 704-alto-surisan | Alto Surisan | Talamanca | Telire | 9.432577 | -83.187996 | node/8355662231 (hamlet) | revisar |
| 704-alto-telire | Alto Telire | Talamanca | Telire | 9.554708 | -83.311799 | node/5151129739 (village) | sí |
| 704-alto-uren | Alto Uren | Talamanca | Telire | 9.391854 | -82.984831 | node/10093475035 (hamlet) | revisar |
| 704-alto-uren-2 | Alto Urén | Talamanca | Telire | 9.428281 | -82.980716 | node/1467796610 (hamlet) | revisar |
| 704-amubri | Amubri | Talamanca | Telire | 9.517069 | -82.956234 | node/1437254293 (village) | sí |
| 704-ania | Ania | Talamanca | Sixaola | 9.589742 | -82.732402 | node/5155653850 (neighbourhood) | revisar |
| 704-arco-iris | Arco Iris | Talamanca | Telire | 9.527817 | -83.335584 | node/5151156228 (neighbourhood) | revisar |
| 704-arenal | Arenal | Talamanca | Telire | 9.52413 | -83.040683 | node/1467796594 (neighbourhood) | revisar |
| 704-bajo-blei-norte | Bajo Blei Norte | Talamanca | Telire | 9.610905 | -83.215052 | node/5151115161 (neighbourhood) | revisar |
| 704-bajo-blei-sur | Bajo Blei Sur | Talamanca | Telire | 9.604939 | -83.212745 | node/11269541613 (neighbourhood) | revisar |
| 704-bajo-coen | Bajo Coen | Talamanca | Telire | 9.534161 | -83.013468 | node/5150896283 (hamlet) | revisar |
| 704-bajo-piedra-mesa | Bajo Piedra Mesa | Talamanca | Telire | 9.56687 | -83.312829 | node/8433528754 (neighbourhood) | revisar |
| 704-bambu | Bambú | Talamanca | Bratsi | 9.554861 | -82.894142 | node/1363688144 (hamlet) | revisar |
| 704-barrio-aeropuerto | Barrio Aeropuerto | Talamanca | Sixaola | 9.504409 | -82.625256 | node/5156006912 (neighbourhood) | revisar |
| 704-barrio-civil | Barrio Civil | Talamanca | Sixaola | 9.604717 | -82.767024 | node/9932436215 (neighbourhood) | revisar |
| 704-barrio-costa-rica | Barrio Costa Rica | Talamanca | Sixaola | 9.508385 | -82.622047 | node/5155956882 (neighbourhood) | revisar |
| 704-barrio-fields | Barrio Fields | Talamanca | Bratsi | 9.623814 | -82.836835 | node/5154172253 (neighbourhood) | revisar |
| 704-barrio-fields-2 | Barrio Fields 2 | Talamanca | Bratsi | 9.622252 | -82.823884 | node/13276076644 (neighbourhood) | revisar |
| 704-barrio-la-colina | Barrio La Colina | Talamanca | Sixaola | 9.502516 | -82.61557 | node/5156006945 (neighbourhood) | revisar |
| 704-barrio-la-union | Barrio La Unión | Talamanca | Bratsi | 9.633608 | -82.85827 | node/8418733384 (neighbourhood) | revisar |
| 704-barrio-la-union-2 | Barrio La Unión | Talamanca | Sixaola | 9.509445 | -82.616508 | node/9422893245 (neighbourhood) | revisar |
| 704-barrio-las-brisas | Barrio Las Brisas | Talamanca | Sixaola | 9.506994 | -82.614897 | node/5155956883 (neighbourhood) | revisar |
| 704-barrio-las-vegas | Barrio Las Vegas | Talamanca | Sixaola | 9.503084 | -82.611516 | node/5156006959 (neighbourhood) | revisar |
| 704-barrio-lopez-tindal | Barrio López Tíndal | Talamanca | Cahuita | 9.732509 | -82.847809 | node/5156483951 (neighbourhood) | revisar |
| 704-barrio-pueblo-nuevo | Barrio Pueblo Nuevo | Talamanca | Bratsi | 9.611519 | -82.791618 | node/9422907035 (neighbourhood) | revisar |
| 704-barrio-sand-box | Barrio Sand Box | Talamanca | Bratsi | 9.61858 | -82.814976 | node/3634830498 (neighbourhood) | revisar |
| 704-barrio-suiza | Barrio Suiza | Talamanca | Sixaola | 9.60053 | -82.764932 | node/9422907027 (neighbourhood) | revisar |
| 704-barrio-unido | Barrio Unido | Talamanca | Cahuita | 9.652061 | -82.796297 | node/5156192532 (neighbourhood) | revisar |
| 704-bekbata | Bekbata | Talamanca | Telire | 9.580635 | -83.287323 | node/9885953004 (neighbourhood) | revisar |
| 704-bisola | Bisöla | Talamanca | Telire | 9.538607 | -83.33781 | node/9885953005 (neighbourhood) | revisar |
| 704-boca-sixaola | Boca Sixaola | Talamanca | Sixaola | 9.572692 | -82.568289 | node/5155956884 (neighbourhood) | revisar |
| 704-boca-tsuidi | Boca Tsuidi | Talamanca | Telire | 9.533277 | -82.955876 | node/8423831789 (neighbourhood) | revisar |
| 704-boca-uren | Boca Uren | Talamanca | Telire | 9.549487 | -82.926291 | node/1467796324 (hamlet) | revisar |
| 704-bomba-de-agua | Bomba de Agua | Talamanca | Bratsi | 9.611176 | -82.812945 | node/5154092210 (neighbourhood) | revisar |
| 704-bordon | Bordón | Talamanca | Cahuita | 9.754722 | -82.877094 | node/3340976011 (hamlet) | revisar |
| 704-botubata | Botubata | Talamanca | Telire | 9.540902 | -83.322458 | node/11151711465 (neighbourhood) | revisar |
| 704-bribri | Bribrí | Talamanca | Bratsi | 9.626305 | -82.852517 | node/1363682474 (town) | sí |
| 704-bris | Bris | Talamanca | Telire | 9.517238 | -82.911237 | node/8423743141 (hamlet) | revisar |
| 704-brisas-del-rio | Brisas del Río | Talamanca | Cahuita | 9.661901 | -82.803213 | node/8423265187 (neighbourhood) | revisar |
| 704-buena-fe | Buena Fe | Talamanca | Sixaola | 9.562026 | -82.585998 | node/5155956885 (neighbourhood) | revisar |
| 704-buenavista | Buenavista | Talamanca | Cahuita | 9.655203 | -82.868838 | node/8418799954 (hamlet) | revisar |
| 704-cachabri | Cachabri | Talamanca | Telire | 9.511814 | -82.977767 | node/5150770030 (neighbourhood) | revisar |
| 704-cahuita | Cahuita | Talamanca | Cahuita | 9.738481 | -82.840763 | node/308529009 (village) | sí |
| 704-carbon | Carbón | Talamanca | Cahuita | 9.668486 | -82.822677 | node/5156244907 (hamlet) | revisar |
| 704-carbon-1 | Carbón 1 | Talamanca | Cahuita | 9.67178 | -82.83935 | node/5156245723 (hamlet) | revisar |
| 704-carbon-2 | Carbón 2 | Talamanca | Cahuita | 9.700169 | -82.843435 | node/8423265188 (hamlet) | revisar |
| 704-cartago | Cartago | Talamanca | Telire | 9.637379 | -83.140196 | node/9885953003 (neighbourhood) | revisar |
| 704-catarata | Catarata | Talamanca | Cahuita | 9.634005 | -82.812433 | node/1467795212 (hamlet) | revisar |
| 704-catarina | Catarina | Talamanca | Sixaola | 9.578841 | -82.728031 | node/3634830499 (hamlet) | revisar |
| 704-celia | Celia | Talamanca | Sixaola | 9.54195 | -82.68035 | node/3634833587 (hamlet) | revisar |
| 704-chase | Chase | Talamanca | Bratsi | 9.603156 | -82.867222 | node/1467795300 (hamlet) | revisar |
| 704-china-kicha | China Kichá | Talamanca | Bratsi | 9.591293 | -83.006923 | node/5151242021 (neighbourhood) | revisar |
| 704-cocles | Cocles | Talamanca | Cahuita | 9.643783 | -82.730561 | node/3341008519 (hamlet) | sí |
| 704-comadre | Comadre | Talamanca | Cahuita | 9.716602 | -82.824413 | node/5156574544 (neighbourhood) | revisar |
| 704-corbita | Corbita | Talamanca | Telire | 9.503557 | -82.963579 | node/5150770025 (neighbourhood) | revisar |
| 704-coroma | Coroma | Talamanca | Telire | 9.53771 | -82.992806 | node/1467796591 (hamlet) | revisar |
| 704-cruce-de-bribri | Cruce de Bribri | Talamanca | Bratsi | 9.625337 | -82.845351 | node/13276076645 (neighbourhood) | revisar |
| 704-daytonia | Daytonia | Talamanca | Sixaola | 9.52474 | -82.66181 | node/1215760635 (hamlet) | revisar |
| 704-dikoguicha | Dikoguicha | Talamanca | Telire | 9.533846 | -83.313406 | node/1467797592 (neighbourhood) | revisar |
| 704-dindiri | Dindiri | Talamanca | Cahuita | 9.708192 | -82.853677 | node/5156307078 (hamlet) | revisar |
| 704-duchiribata | Düchiribata | Talamanca | Telire | 9.547512 | -83.317081 | node/5151138501 (neighbourhood) | revisar |
| 704-durinak | Duriñak | Talamanca | Telire | 9.47441 | -83.022614 | node/5150900786 (hamlet) | revisar |
| 704-dururpe | Dururpe | Talamanca | Telire | 9.531826 | -82.928377 | node/5150805543 (neighbourhood) | revisar |
| 704-el-bambusal | El Bambusal | Talamanca | Cahuita | 9.721326 | -82.831997 | node/5156574529 (neighbourhood) | revisar |
| 704-el-cacao | El Cacao | Talamanca | Cahuita | 9.733542 | -82.846598 | node/5156483950 (neighbourhood) | revisar |
| 704-el-coquito | El Coquito | Talamanca | Cahuita | 9.657663 | -82.796902 | node/5156192551 (neighbourhood) | revisar |
| 704-el-parque | El Parque | Talamanca | Sixaola | 9.603592 | -82.752364 | node/5155652308 (hamlet) | revisar |
| 704-el-progreso | El Progreso | Talamanca | Bratsi | 9.591597 | -82.979538 | node/1467796167 (neighbourhood) | revisar |
| 704-escalante | Escalante | Talamanca | Telire | 9.549039 | -83.021728 | node/5150925039 (hamlet) | revisar |
| 704-gandoca | Gandoca | Talamanca | Sixaola | 9.585202 | -82.611473 | node/1215761212 (hamlet) | revisar |
| 704-gavilan-canta | Gavilán Canta | Talamanca | Bratsi | 9.595536 | -83.026055 | node/5151202293 (village) | sí |
| 704-gibraltar | Gibraltar | Talamanca | Cahuita | 9.761634 | -82.887008 | node/5156418266 (hamlet) | revisar |
| 704-guachalaba | Guachalaba | Talamanca | Telire | 9.379835 | -82.99431 | node/5151045703 (neighbourhood) | revisar |
| 704-guayabal | Guayabal | Talamanca | Telire | 9.539786 | -83.334776 | node/1467797679 (neighbourhood) | revisar |
| 704-hone-creek | Hone Creek | Talamanca | Cahuita | 9.655125 | -82.800143 | node/2059419966 (hamlet) | sí |
| 704-hotel-creek | Hotel Creek | Talamanca | Cahuita | 9.64719 | -82.787487 | node/3341008097 (hamlet) | revisar |
| 704-jaktokolo | Jäktökölo | Talamanca | Telire | 9.553873 | -83.314987 | node/9885953006 (neighbourhood) | revisar |
| 704-jaktokolo-2 | Jäktökölo | Talamanca | Telire | 9.566565 | -83.316393 | node/9885953007 (neighbourhood) | revisar |
| 704-kakal-kicha | Kakal kichá | Talamanca | Telire | 9.629433 | -83.145383 | node/8433517634 (neighbourhood) | revisar |
| 704-katsi | Katsi | Talamanca | Telire | 9.507949 | -82.936177 | node/1467796528 (hamlet) | revisar |
| 704-katuir | Katuir | Talamanca | Telire | 9.374506 | -83.104846 | node/5150914497 (neighbourhood) | revisar |
| 704-kekoldi | Këköldi | Talamanca | Cahuita | 9.617124 | -82.768208 | node/8416668962 (village) | sí |
| 704-la-fe | La Fe | Talamanca | Cahuita | 9.699888 | -82.815791 | node/8423572125 (neighbourhood) | revisar |
| 704-la-loma | La Loma | Talamanca | Cahuita | 9.726451 | -82.876114 | node/5156339271 (neighbourhood) | revisar |
| 704-la-palma | La Palma | Talamanca | Sixaola | 9.527582 | -82.634278 | node/1123092968 (hamlet) | revisar |
| 704-limonal | Limonal | Talamanca | Cahuita | 9.74717 | -82.867557 | node/4416555159 (hamlet) | revisar |
| 704-los-angeles | Los Ángeles | Talamanca | Sixaola | 9.544663 | -82.64697 | node/5155885872 (neighbourhood) | revisar |
| 704-los-diques | Los Diques | Talamanca | Telire | 9.511761 | -82.955931 | node/8423841947 (neighbourhood) | revisar |
| 704-los-lagos | Los Lagos | Talamanca | Sixaola | 9.533676 | -82.671674 | node/5155828695 (neighbourhood) | revisar |
| 704-manzanillo | Manzanillo | Talamanca | Cahuita | 9.631671 | -82.657207 | node/383293979 (hamlet) | sí |
| 704-margarita | Margarita | Talamanca | Sixaola | 9.60328 | -82.764807 | node/3634831208 (hamlet) | revisar |
| 704-mata-de-limon | Mata de Limón | Talamanca | Sixaola | 9.561223 | -82.61921 | node/3341015122 (hamlet) | revisar |
| 704-mille-creek | Mille Creek | Talamanca | Cahuita | 9.607362 | -82.61376 | node/5156096652 (neighbourhood) | revisar |
| 704-mojoncito | Mojoncito | Talamanca | Telire | 9.562704 | -83.02941 | node/5150934606 (neighbourhood) | revisar |
| 704-monte-de-sion | Monte de Sión | Talamanca | Bratsi | 9.597366 | -82.957319 | node/5151256174 (neighbourhood) | revisar |
| 704-mreduk-1 | Mreduk 1 | Talamanca | Bratsi | 9.600886 | -82.920476 | node/5153980363 (neighbourhood) | revisar |
| 704-mreduk-2 | Mreduk 2 | Talamanca | Bratsi | 9.589755 | -82.893145 | node/5153918299 (neighbourhood) | revisar |
| 704-namuwakir | Namuwakir | Talamanca | Telire | 9.498393 | -82.94892 | node/5150838090 (hamlet) | revisar |
| 704-noventa-y-seis | Noventa y Seis | Talamanca | Sixaola | 9.512112 | -82.641844 | node/3341015822 (hamlet) | revisar |
| 704-olivia | Olivia | Talamanca | Bratsi | 9.613173 | -82.8013 | node/3634831069 (hamlet) | revisar |
| 704-orochico | Orochico | Talamanca | Telire | 9.583392 | -83.063454 | node/5151030440 (hamlet) | revisar |
| 704-orochico-2 | Orochico 2 | Talamanca | Telire | 9.565321 | -83.063142 | node/8425701260 (hamlet) | revisar |
| 704-pan-dulce | Pan Dulce | Talamanca | Cahuita | 9.648841 | -82.76191 | node/5156170084 (neighbourhood) | revisar |
| 704-paraiso | Paraíso | Talamanca | Sixaola | 9.571241 | -82.713662 | node/3634830528 (hamlet) | revisar |
| 704-patino | Patiño | Talamanca | Cahuita | 9.648408 | -82.801206 | node/3340998037 (neighbourhood) | revisar |
| 704-playa-bite | Playa Bite | Talamanca | Cahuita | 9.636612 | -82.636585 | node/13667013204 (beach) | sí |
| 704-playa-chiquita | Playa Chiquita | Talamanca | Cahuita | 9.637403 | -82.703669 | node/383294021 (hamlet) | sí |
| 704-playa-gandoca | Playa Gandoca | Talamanca | Sixaola | 9.599901 | -82.606344 | way/531137120 (beach) | sí |
| 704-playa-grande | Playa Grande | Talamanca | Cahuita | 9.756656 | -82.866209 | way/531170942 (beach) | sí |
| 704-playa-ned-creek | Playa Ned Creek | Talamanca | Cahuita | 9.615478 | -82.616329 | way/531137119 (beach) | sí |
| 704-playa-negra | Playa Negra | Talamanca | Cahuita | 9.664096 | -82.772693 | way/1508748277 (beach) | sí |
| 704-playa-negra-2 | Playa Negra | Talamanca | Cahuita | 9.743362 | -82.853773 | node/5156475226 (neighbourhood) | revisar |
| 704-puerto-viejo | Puerto Viejo | Talamanca | Cahuita | 9.656494 | -82.753565 | node/383293764 (neighbourhood) | sí |
| 704-punta-cahuita | Punta Cahuita | Talamanca | Cahuita | 9.74958 | -82.81581 | node/440855635 (hamlet) | revisar |
| 704-punta-caliente | Punta Caliente | Talamanca | Cahuita | 9.67965 | -82.806475 | node/5156586745 (neighbourhood) | revisar |
| 704-punta-mona | Punta Mona | Talamanca | Cahuita | 9.625074 | -82.620446 | node/5156095165 (neighbourhood) | revisar |
| 704-punta-uva | Punta Uva | Talamanca | Cahuita | 9.640909 | -82.686332 | node/5156130075 (neighbourhood) | sí |
| 704-pura-fruta | Pura Fruta | Talamanca | Cahuita | 9.679938 | -82.83499 | node/13805834577 (hamlet) | revisar |
| 704-purisoui | PURISOUI | Talamanca | Telire | 9.385784 | -82.95345 | node/10093475033 (hamlet) | revisar |
| 704-purita | PURITA | Talamanca | Telire | 9.397752 | -82.979412 | node/10093475034 (hamlet) | revisar |
| 704-rancho-grande | Rancho Grande | Talamanca | Bratsi | 9.62609 | -82.888744 | node/5154192637 (hamlet) | revisar |
| 704-rangalle | Rangalle | Talamanca | Telire | 9.612577 | -83.175203 | node/5151101726 (neighbourhood) | revisar |
| 704-san-jose-cabecar | San José Cabecar | Talamanca | Telire | 9.510395 | -83.139652 | node/5151091485 (hamlet) | revisar |
| 704-san-miguel | San Miguel | Talamanca | Sixaola | 9.565029 | -82.66012 | node/4289361059 (hamlet) | revisar |
| 704-san-miguelito | San Miguelito | Talamanca | Sixaola | 9.562499 | -82.700123 | node/3634833495 (hamlet) | revisar |
| 704-san-rafael | San Rafael | Talamanca | Cahuita | 9.714526 | -82.906198 | node/5156308769 (hamlet) | revisar |
| 704-san-rafael-1 | San Rafael 1 | Talamanca | Sixaola | 9.580106 | -82.716832 | node/5155767672 (neighbourhood) | revisar |
| 704-san-rafael-2 | San Rafael 2 | Talamanca | Sixaola | 9.578132 | -82.704381 | node/5155767671 (neighbourhood) | revisar |
| 704-sepecue | Sepecue | Talamanca | Telire | 9.555107 | -83.008916 | node/5150907896 (hamlet) | revisar |
| 704-sepecue-uno | Sepecue Uno | Talamanca | Telire | 9.558531 | -82.989874 | node/5150918335 (neighbourhood) | revisar |
| 704-shewab | Shewab | Talamanca | Telire | 9.561421 | -83.172954 | node/5151101725 (neighbourhood) | revisar |
| 704-shiroles | Shiroles | Talamanca | Bratsi | 9.58731 | -82.953176 | node/1467796166 (hamlet) | revisar |
| 704-shuabb | Shuabb | Talamanca | Telire | 9.537646 | -82.879346 | node/2415959870 (hamlet) | revisar |
| 704-sibodi | Sibodi | Talamanca | Telire | 9.54133 | -83.018201 | node/5150934595 (hamlet) | revisar |
| 704-sibuju | Sibujú | Talamanca | Bratsi | 9.605943 | -82.982111 | node/5153972160 (hamlet) | revisar |
| 704-sipurio | Sipurio | Talamanca | Telire | 9.528802 | -82.947679 | node/8423831788 (neighbourhood) | revisar |
| 704-sixaola | Sixaola | Talamanca | Sixaola | 9.505422 | -82.614567 | node/185535504 (village) | sí |
| 704-soky | Soky | Talamanca | Telire | 9.487507 | -82.968084 | node/5150788529 (hamlet) | revisar |
| 704-sorokicha | Sorókicha | Talamanca | Telire | 9.511502 | -82.853032 | node/5150855394 (neighbourhood) | revisar |
| 704-suretka | Suretka | Talamanca | Bratsi | 9.567666 | -82.936215 | node/1467796322 (village) | sí |
| 704-telire | Telire | Talamanca | Telire | 9.5066 | -83.1159 | node/1467797549 (hamlet) | revisar |
| 704-tsuiri-dos | Tsuiri Dos | Talamanca | Telire | 9.536279 | -82.944112 | node/5150788946 (neighbourhood) | revisar |
| 704-tsuiri-uno | Tsuiri Uno | Talamanca | Telire | 9.55089 | -82.937229 | node/5150794745 (neighbourhood) | revisar |
| 704-tuba-creek-1 | Tuba Creek 1 | Talamanca | Cahuita | 9.746616 | -82.902384 | node/5156315514 (hamlet) | revisar |
| 704-turrialbeno | Turrialbeño | Talamanca | Cahuita | 9.651543 | -82.76211 | node/5156170083 (neighbourhood) | revisar |
| 704-turubokicha | Turubokicha | Talamanca | Telire | 9.493258 | -82.913942 | node/5150842333 (hamlet) | revisar |
| 704-uatsi | Uatsi | Talamanca | Bratsi | 9.627104 | -82.871481 | node/1467795282 (hamlet) | revisar |
| 704-usekla | Usekla | Talamanca | Telire | 9.53834 | -83.047971 | node/5151009224 (neighbourhood) | revisar |
| 704-yorkin | Yorkín | Talamanca | Telire | 9.517928 | -82.858376 | node/3869622089 (hamlet) | revisar |
| 704-zavala | Zavala | Talamanca | Sixaola | 9.555234 | -82.694067 | node/3634833588 (hamlet) | revisar |
| 705-23-millas | 23 Millas | Matina | Matina | 10.079291 | -83.305656 | node/3279455672 (neighbourhood) | revisar |
| 705-24-millas | 24 Millas | Matina | Batán | 10.081872 | -83.322272 | node/2328920941 (hamlet) | revisar |
| 705-26-millas | 26 Millas | Matina | Batán | 10.087764 | -83.355491 | node/5249078441 (neighbourhood) | revisar |
| 705-27-millas | 27 Millas | Matina | Batán | 10.089383 | -83.367952 | node/3279493519 (neighbourhood) | revisar |
| 705-28-millas | 28 Millas | Matina | Batán | 10.090244 | -83.37376 | node/1352133381 (neighbourhood) | revisar |
| 705-4-millas | 4 Millas | Matina | Matina | 10.105755 | -83.256813 | node/3279514823 (hamlet) | revisar |
| 705-alto-mirador | Alto Mirador | Matina | Batán | 10.003919 | -83.459691 | node/5249299503 (neighbourhood) | revisar |
| 705-alto-palmera | Alto Palmera | Matina | Matina | 9.95824 | -83.306053 | node/8702356951 (hamlet) | revisar |
| 705-b-line | B - Line | Matina | Matina | 10.045432 | -83.313412 | node/791775297 (hamlet) | revisar |
| 705-baltimore | Baltimore | Matina | Matina | 10.014779 | -83.30689 | node/3279470990 (hamlet) | revisar |
| 705-bananita | Bananita | Matina | Carrandi | 10.07636 | -83.223386 | node/5247955304 (hamlet) | revisar |
| 705-barbilla | Barbilla | Matina | Batán | 10.065095 | -83.364793 | node/791775302 (hamlet) | revisar |
| 705-barra-matina-norte | Barra Matina Norte | Matina | Matina | 10.125764 | -83.220312 | node/3279601057 (hamlet) | revisar |
| 705-barra-matina-sur | Barra Matina Sur | Matina | Carrandi | 10.107716 | -83.231342 | node/3279604762 (hamlet) | revisar |
| 705-barrio-los-sosa | Barrio Los Sosa | Matina | Matina | 10.104395 | -83.263503 | node/5248068113 (neighbourhood) | revisar |
| 705-batan | Batán | Matina | Batán | 10.086042 | -83.34175 | node/868002672 (village) | sí |
| 705-bellavista | Bellavista | Matina | Carrandi | 10.033494 | -83.260264 | node/5247863854 (neighbourhood) | revisar |
| 705-berta | Berta | Matina | Batán | 10.138262 | -83.286913 | node/3279508961 (hamlet) | revisar |
| 705-boca-del-pantano | Boca del Pantano | Matina | Carrandi | 10.074056 | -83.159419 | node/3279602190 (hamlet) | revisar |
| 705-boca-del-rio-matina | Boca del Río Matina | Matina | Carrandi | 10.112809 | -83.188151 | node/3279612243 (hamlet) | revisar |
| 705-boca-pacuare | Boca Pacuare | Matina | Batán | 10.217471 | -83.275102 | node/8722129729 (hamlet) | revisar |
| 705-boston | Boston | Matina | Carrandi | 10.01368 | -83.255264 | node/1342970563 (hamlet) | revisar |
| 705-bramadero | Bramadero | Matina | Carrandi | 10.025291 | -83.225798 | node/5247893639 (hamlet) | revisar |
| 705-brisas | Brisas | Matina | Carrandi | 10.037536 | -83.265601 | node/5247863853 (neighbourhood) | revisar |
| 705-bristol | Bristol | Matina | Matina | 10.029736 | -83.302972 | node/3279473813 (hamlet) | revisar |
| 705-calderon | Calderón | Matina | Carrandi | 10.015176 | -83.211824 | node/5247793662 (neighbourhood) | revisar |
| 705-cano-salado | Caño Salado | Matina | Matina | 10.136278 | -83.245173 | node/8699592891 (hamlet) | revisar |
| 705-catorce-millas | Catorce Millas | Matina | Carrandi | 10.073633 | -83.195555 | node/3279648450 (hamlet) | revisar |
| 705-chirripo | Chirripó | Matina | Matina | 9.970091 | -83.295654 | node/8702356948 (hamlet) | revisar |
| 705-chumico | Chumico | Matina | Matina | 9.975955 | -83.306843 | node/5248169726 (hamlet) | revisar |
| 705-ciudadela-miraflores | Ciudadela Miraflores | Matina | Batán | 10.094064 | -83.342659 | node/2894478626 (neighbourhood) | revisar |
| 705-colonia-puriscalena | Colonia Puriscaleña | Matina | Matina | 10.029248 | -83.368598 | node/5248120070 (hamlet) | revisar |
| 705-corina | Corina | Matina | Matina | 9.993935 | -83.315036 | node/3279470991 (hamlet) | revisar |
| 705-costa-rica | Costa Rica | Matina | Batán | 10.081239 | -83.345219 | node/2894479584 (neighbourhood) | revisar |
| 705-cuba-creek-rio-cuba | Cuba Creek (Río Cuba) | Matina | Carrandi | 10.01358 | -83.235532 | node/1342971191 (hamlet) | revisar |
| 705-davao | Davao | Matina | Batán | 10.05996 | -83.34142 | node/1352131460 (hamlet) | revisar |
| 705-dos-ramas | Dos Ramas | Matina | Batán | 10.038406 | -83.412203 | node/5249283541 (hamlet) | revisar |
| 705-el-cacao | El Cacao | Matina | Batán | 10.080754 | -83.332358 | node/5248996927 (neighbourhood) | revisar |
| 705-el-carmen | El Carmen | Matina | Batán | 10.105963 | -83.317887 | node/5248282167 (neighbourhood) | revisar |
| 705-el-castillo | El Castillo | Matina | Batán | 10.081777 | -83.347658 | node/2894479585 (neighbourhood) | revisar |
| 705-el-cenizaro | El Cenízaro | Matina | Batán | 10.088156 | -83.349352 | node/2894480670 (neighbourhood) | revisar |
| 705-el-encanto | El Encanto | Matina | Carrandi | 10.063923 | -83.280234 | node/9283512261 (neighbourhood) | revisar |
| 705-el-jardin | El Jardín | Matina | Batán | 10.096519 | -83.3368 | node/2894476912 (neighbourhood) | revisar |
| 705-espavel | Espavel | Matina | Batán | 10.078985 | -83.402493 | node/5249133119 (hamlet) | revisar |
| 705-esperanza | Esperanza | Matina | Matina | 10.025074 | -83.326374 | node/3279474367 (hamlet) | revisar |
| 705-estrada | Estrada | Matina | Carrandi | 10.05907 | -83.279348 | node/791775299 (village) | sí |
| 705-glasgow | Glasgow | Matina | Matina | 10.048522 | -83.298412 | node/9501133397 (neighbourhood) | revisar |
| 705-goly | Goly | Matina | Matina | 10.082924 | -83.285646 | node/3279455667 (neighbourhood) | revisar |
| 705-goshen | Goshen | Matina | Batán | 10.160281 | -83.321766 | node/3279500200 (hamlet) | revisar |
| 705-hilda | Hilda | Matina | Matina | 10.113362 | -83.255149 | node/3279513957 (hamlet) | revisar |
| 705-imas | Imas | Matina | Batán | 10.082515 | -83.342582 | node/8685058782 (neighbourhood) | revisar |
| 705-indio | Indio | Matina | Carrandi | 10.01603 | -83.280292 | node/3279668798 (hamlet) | revisar |
| 705-la-alegria | La Alegría | Matina | Batán | 10.093598 | -83.370207 | node/9501176914 (neighbourhood) | revisar |
| 705-la-bomba | La Bomba | Matina | Matina | 10.078181 | -83.298373 | node/9281668041 (neighbourhood) | revisar |
| 705-la-fila | La Fila | Matina | Batán | 10.091866 | -83.33942 | node/2894478627 (neighbourhood) | revisar |
| 705-la-trinidad | La Trinidad | Matina | Batán | 10.089692 | -83.34275 | node/2894478628 (neighbourhood) | revisar |
| 705-la-trinidad-2 | La Trinidad | Matina | Carrandi | 10.054145 | -83.280402 | node/9283512256 (neighbourhood) | revisar |
| 705-la-zonita | La Zonita | Matina | Batán | 10.083777 | -83.342088 | node/3279432656 (neighbourhood) | revisar |
| 705-lagartos | Lagartos | Matina | Matina | 10.084698 | -83.283953 | node/9501404516 (neighbourhood) | revisar |
| 705-larga-distancia | Larga Distancia | Matina | Carrandi | 10.027255 | -83.202636 | node/4590926848 (hamlet) | revisar |
| 705-las-brisas | Las Brisas | Matina | Batán | 10.112362 | -83.313242 | node/5248278976 (neighbourhood) | revisar |
| 705-las-palmas | Las Palmas | Matina | Batán | 10.082154 | -83.350536 | node/5249078440 (neighbourhood) | revisar |
| 705-las-vegas | Las Vegas | Matina | Batán | 10.075063 | -83.399441 | node/3279674187 (hamlet) | revisar |
| 705-leyte | Leyte | Matina | Batán | 10.115865 | -83.306944 | node/5248279155 (neighbourhood) | revisar |
| 705-lola | Lola | Matina | Batán | 10.092512 | -83.391129 | node/3279674177 (hamlet) | revisar |
| 705-lomas-del-toro | Lomas del Toro | Matina | Carrandi | 10.004374 | -83.215293 | node/5247784451 (neighbourhood) | revisar |
| 705-los-almendros | Los Almendros | Matina | Batán | 10.097431 | -83.351843 | node/2894480677 (neighbourhood) | revisar |
| 705-los-cocos | Los Cocos | Matina | Carrandi | 10.016169 | -83.230956 | node/9281639019 (neighbourhood) | revisar |
| 705-luisa-este | Luisa Este | Matina | Carrandi | 10.076949 | -83.267992 | node/3279634863 (hamlet) | revisar |
| 705-luisa-oeste | Luisa Oeste | Matina | Matina | 10.095305 | -83.260297 | node/1144993818 (neighbourhood) | revisar |
| 705-luzon | Luzón | Matina | Batán | 10.100449 | -83.318202 | node/3279457985 (hamlet) | revisar |
| 705-makufitey | Makufitey | Matina | Batán | 10.017131 | -83.433642 | node/5249299499 (hamlet) | revisar |
| 705-managuita | Managüita | Matina | Matina | 10.084335 | -83.281915 | node/3279455668 (neighbourhood) | revisar |
| 705-managuita-2 | Managüita | Matina | Matina | 10.105918 | -83.248924 | node/8699592998 (neighbourhood) | revisar |
| 705-maravilla | Maravilla | Matina | Carrandi | 10.045742 | -83.224706 | node/3279658102 (hamlet) | revisar |
| 705-margarita | Margarita | Matina | Batán | 10.074738 | -83.326924 | node/13289332877 (neighbourhood) | revisar |
| 705-maria-aguero | María Agüero | Matina | Batán | 10.084323 | -83.349047 | node/3279427080 (neighbourhood) | revisar |
| 705-matas | Matas | Matina | Batán | 10.096796 | -83.321028 | node/5249088159 (neighbourhood) | revisar |
| 705-matina | Matina | Matina | Matina | 10.076895 | -83.290523 | node/1082105680 (town) | sí |
| 705-matinita | Matinita | Matina | Matina | 10.080682 | -83.286504 | node/5248068645 (neighbourhood) | revisar |
| 705-mondonguillo | Mondonguillo | Matina | Matina | 10.163331 | -83.231639 | node/5248250736 (hamlet) | revisar |
| 705-monte-libano | Monte Líbano | Matina | Batán | 10.085797 | -83.338543 | node/3279428233 (neighbourhood) | revisar |
| 705-moreno-canas | Moreno Cañas | Matina | Carrandi | 10.077048 | -83.219152 | node/5247958348 (neighbourhood) | revisar |
| 705-nimari-de-saseyn | Nimarí de Saseyn | Matina | Matina | 9.943305 | -83.237508 | node/5247858473 (neighbourhood) | revisar |
| 705-nueva-york | Nueva York | Matina | Carrandi | 10.012799 | -83.232447 | node/9281639018 (neighbourhood) | revisar |
| 705-oracabesa | Oracabesa | Matina | Batán | 10.091895 | -83.319064 | node/3279457984 (neighbourhood) | revisar |
| 705-orosi-1 | Orosi 1 | Matina | Batán | 10.1049 | -83.3549 | node/1267981129 (neighbourhood) | revisar |
| 705-palacios | Palacios | Matina | Carrandi | 10.045566 | -83.202731 | node/5247966201 (neighbourhood) | revisar |
| 705-palestina | Palestina | Matina | Carrandi | 9.971986 | -83.260916 | node/5247840820 (hamlet) | revisar |
| 705-palmera | Palmera | Matina | Matina | 9.964532 | -83.29334 | node/5248169724 (hamlet) | revisar |
| 705-peje | Peje | Matina | Carrandi | 9.940305 | -83.223679 | node/5247856856 (hamlet) | revisar |
| 705-peje-2 | Peje | Matina | Carrandi | 9.968292 | -83.237852 | node/8703313477 (hamlet) | revisar |
| 705-pozo-azul | Pozo Azul | Matina | Matina | 9.939252 | -83.270719 | node/5248178891 (hamlet) | revisar |
| 705-pueblo-nuevo | Pueblo Nuevo | Matina | Carrandi | 10.062266 | -83.283639 | node/5247942232 (neighbourhood) | revisar |
| 705-pueblo-nuevo-2 | Pueblo Nuevo | Matina | Matina | 10.004634 | -83.321162 | node/5248178892 (neighbourhood) | revisar |
| 705-pueblo-nuevo-3 | Pueblo Nuevo | Matina | Batán | 10.131999 | -83.36027 | node/5248268929 (neighbourhood) | revisar |
| 705-punta-caliente | Punta Caliente | Matina | Carrandi | 10.024719 | -83.274354 | node/9499156677 (neighbourhood) | revisar |
| 705-punta-de-lanza | Punta de Lanza | Matina | Matina | 9.986132 | -83.363748 | node/5248144641 (neighbourhood) | revisar |
| 705-punta-de-riel | Punta de Riel | Matina | Carrandi | 10.105924 | -83.210587 | node/3279604761 (hamlet) | revisar |
| 705-punta-de-riel-2 | Punta de Riel | Matina | Carrandi | 10.063473 | -83.24653 | node/5247942233 (neighbourhood) | revisar |
| 705-ramal-7 | Ramal 7 | Matina | Batán | 10.07726 | -83.335265 | node/3279428890 (neighbourhood) | revisar |
| 705-saborio | Saborío | Matina | Carrandi | 10.064194 | -83.235232 | node/3279639790 (hamlet) | revisar |
| 705-sahara | Sahara | Matina | Batán | 10.137906 | -83.356268 | node/1559813646 (neighbourhood) | revisar |
| 705-san-antonio | San Antonio | Matina | Batán | 10.081552 | -83.336396 | node/3279428232 (neighbourhood) | revisar |
| 705-san-edmundo | San Edmundo | Matina | Carrandi | 10.068597 | -83.221133 | node/3279644467 (neighbourhood) | revisar |
| 705-san-jose | San José | Matina | Carrandi | 10.061259 | -83.26664 | node/3279621161 (neighbourhood) | revisar |
| 705-san-martin | San Martín | Matina | Matina | 10.08754 | -83.282888 | node/3279455669 (neighbourhood) | revisar |
| 705-san-miguel | San Miguel | Matina | Matina | 10.029217 | -83.343195 | node/3279474228 (hamlet) | revisar |
| 705-santa-maria | Santa María | Matina | Carrandi | 10.070887 | -83.211647 | node/5247955305 (hamlet) | revisar |
| 705-santa-marta | Santa Marta | Matina | Batán | 10.120473 | -83.31561 | node/1352136573 (hamlet) | revisar |
| 705-sterling | Sterling | Matina | Carrandi | 10.003413 | -83.247933 | node/5247803095 (hamlet) | revisar |
| 705-sterling-oeste | Sterling Oeste | Matina | Carrandi | 10.001543 | -83.261563 | node/9499283652 (neighbourhood) | revisar |
| 705-strafford | Strafford | Matina | Carrandi | 10.023876 | -83.253624 | node/5247803081 (hamlet) | revisar |
| 705-titan | Titán | Matina | Batán | 10.057504 | -83.396948 | node/3279477610 (neighbourhood) | revisar |
| 705-toro | Toro | Matina | Carrandi | 10.010531 | -83.215972 | node/3279657561 (hamlet) | revisar |
| 705-trinidad | Trinidad | Matina | Carrandi | 10.037748 | -83.279258 | node/5247863848 (neighbourhood) | revisar |
| 705-venecia | Venecia | Matina | Carrandi | 10.025631 | -83.241056 | node/3248704565 (hamlet) | revisar |
| 705-victoria | Victoria | Matina | Carrandi | 9.975746 | -83.272568 | node/5247846803 (hamlet) | revisar |
| 705-xirinachs | Xirinachs | Matina | Matina | 9.943343 | -83.282268 | node/5248178890 (hamlet) | revisar |
| 705-zent | Zent | Matina | Carrandi | 10.021995 | -83.26618 | node/1342973272 (hamlet) | revisar |
| 706-africa | África | Guácimo | Guácimo | 10.205349 | -83.67113 | node/3606281628 (hamlet) | revisar |
| 706-agrimaga | Agrimaga | Guácimo | Río Jiménez | 10.22768 | -83.62361 | node/5261281357 (hamlet) | revisar |
| 706-aguacate | Aguacate | Guácimo | Guácimo | 10.269563 | -83.673611 | node/3874198457 (hamlet) | revisar |
| 706-aguas-gatas | Aguas Gatas | Guácimo | Duacarí | 10.317731 | -83.573084 | node/3861884241 (hamlet) | revisar |
| 706-angeles | Ángeles | Guácimo | Río Jiménez | 10.290739 | -83.535922 | node/3874118014 (hamlet) | revisar |
| 706-angelina | Angelina | Guácimo | Guácimo | 10.209929 | -83.73464 | node/3720428136 (neighbourhood) | revisar |
| 706-aralias | Aralias | Guácimo | Guácimo | 10.221782 | -83.672382 | node/3720394500 (neighbourhood) | revisar |
| 706-asentamiento-colorado | Asentamiento Colorado | Guácimo | Río Jiménez | 10.30976 | -83.528982 | node/5326241769 (hamlet) | revisar |
| 706-banasol-2 | Banasol 2 | Guácimo | Río Jiménez | 10.2894 | -83.5687 | node/1145010820 (hamlet) | revisar |
| 706-barrio-barzone | Barrio Barzone | Guácimo | Duacarí | 10.28418 | -83.603422 | node/5260581056 (neighbourhood) | revisar |
| 706-barrio-bremen | Barrio Bremen | Guácimo | Mercedes | 10.173262 | -83.609337 | node/5260850699 (neighbourhood) | revisar |
| 706-barrio-camacho | Barrio Camacho | Guácimo | Pocora | 10.176412 | -83.603317 | node/5260732814 (neighbourhood) | revisar |
| 706-barrio-carambola | Barrio Carambola | Guácimo | Duacarí | 10.281194 | -83.615384 | node/3874124604 (neighbourhood) | revisar |
| 706-barrio-carpio | Barrio Carpio | Guácimo | Duacarí | 10.286083 | -83.618065 | node/3874124603 (neighbourhood) | revisar |
| 706-barrio-cristo-rey | Barrio Cristo Rey | Guácimo | Duacarí | 10.30876 | -83.605433 | node/5260594248 (neighbourhood) | revisar |
| 706-barrio-el-carmen-norte | Barrio El Carmen Norte | Guácimo | Pocora | 10.165755 | -83.599865 | node/3281212045 (neighbourhood) | revisar |
| 706-barrio-fruta-de-pan | Barrio Fruta de Pan | Guácimo | Duacarí | 10.29885 | -83.617931 | node/3874134563 (neighbourhood) | revisar |
| 706-barrio-la-precaria | Barrio La Precaria | Guácimo | Duacarí | 10.275468 | -83.603777 | node/5260603020 (neighbourhood) | revisar |
| 706-barrio-los-naranjos | Barrio Los Naranjos | Guácimo | Río Jiménez | 10.250699 | -83.618939 | node/5261239964 (neighbourhood) | revisar |
| 706-barrio-santa-emilia | Barrio Santa Emilia | Guácimo | Pocora | 10.17041 | -83.599632 | node/5260732813 (neighbourhood) | revisar |
| 706-bocas-del-rio-silencio | Bocas del Río Silencio | Guácimo | Río Jiménez | 10.24428 | -83.501747 | node/3863898895 (hamlet) | revisar |
| 706-calinda | Calinda | Guácimo | Duacarí | 10.323303 | -83.606922 | node/5260540316 (neighbourhood) | revisar |
| 706-camaroncito | Camaroncito | Guácimo | Río Jiménez | 10.269301 | -83.517756 | node/5261145921 (neighbourhood) | revisar |
| 706-canada | Canadá | Guácimo | Guácimo | 10.216132 | -83.674244 | node/3720394503 (neighbourhood) | revisar |
| 706-cantarrana | Cantarrana | Guácimo | Guácimo | 10.213426 | -83.684806 | node/5261475742 (neighbourhood) | revisar |
| 706-caribbean | Caribbean | Guácimo | Guácimo | 10.212755 | -83.679496 | node/3720394505 (neighbourhood) | revisar |
| 706-cartagena | Cartagena | Guácimo | Río Jiménez | 10.267251 | -83.643195 | node/5260624834 (hamlet) | revisar |
| 706-castillo | Castillo | Guácimo | Río Jiménez | 10.239053 | -83.604307 | node/5261250059 (neighbourhood) | revisar |
| 706-corazon-de-jesus | Corazón de Jesús | Guácimo | Guácimo | 10.207879 | -83.682524 | node/3720394511 (neighbourhood) | revisar |
| 706-cuatro-millas | Cuatro Millas | Guácimo | Río Jiménez | 10.228021 | -83.613851 | node/5261269438 (neighbourhood) | revisar |
| 706-dos-mil | Dos Mil | Guácimo | Pocora | 10.160245 | -83.616513 | node/5260732810 (neighbourhood) | revisar |
| 706-duacari-cinco | Duacarí Cinco | Guácimo | Duacarí | 10.307006 | -83.6527 | node/3874134562 (hamlet) | revisar |
| 706-duacari-cuatro | Duacarí Cuatro | Guácimo | Duacarí | 10.335256 | -83.650807 | node/2328922062 (hamlet) | revisar |
| 706-duacari-dos | Duacarí Dos | Guácimo | Duacarí | 10.350045 | -83.622255 | node/2328921927 (hamlet) | revisar |
| 706-duacari-tres | Duacarí Tres | Guácimo | Duacarí | 10.348896 | -83.640041 | node/2328921753 (hamlet) | revisar |
| 706-dulce-nombre | Dulce Nombre | Guácimo | Río Jiménez | 10.23019 | -83.596091 | node/5261222225 (neighbourhood) | revisar |
| 706-dulce-nombre-2 | Dulce Nombre | Guácimo | Río Jiménez | 10.245491 | -83.602608 | node/5261252378 (neighbourhood) | revisar |
| 706-durman | Durmán | Guácimo | Guácimo | 10.225008 | -83.674628 | node/3720394501 (neighbourhood) | revisar |
| 706-duruy | Duruy | Guácimo | Pocora | 10.156187 | -83.610924 | node/5260732812 (neighbourhood) | revisar |
| 706-eden | Edén | Guácimo | Guácimo | 10.237796 | -83.721354 | node/2757008173 (hamlet) | revisar |
| 706-el-asentamiento | El Asentamiento | Guácimo | Guácimo | 10.245112 | -83.6636 | node/12926023905 (neighbourhood) | revisar |
| 706-el-bosque | El Bosque | Guácimo | Guácimo | 10.250123 | -83.680839 | node/3281312013 (hamlet) | revisar |
| 706-el-carmen-sur | El Carmen Sur | Guácimo | Pocora | 10.16318 | -83.60408 | node/3281212046 (neighbourhood) | revisar |
| 706-el-cementerio | El Cementerio | Guácimo | Guácimo | 10.217709 | -83.677342 | node/3720394492 (neighbourhood) | revisar |
| 706-el-chiribico | El Chiribico | Guácimo | Guácimo | 10.209547 | -83.678545 | node/3720394507 (neighbourhood) | revisar |
| 706-el-cipres | El Ciprés | Guácimo | Río Jiménez | 10.249005 | -83.599995 | node/5261254327 (neighbourhood) | revisar |
| 706-el-colegio | El Colegio | Guácimo | Guácimo | 10.212273 | -83.674377 | node/3720394506 (neighbourhood) | revisar |
| 706-el-colono | El Colono | Guácimo | Guácimo | 10.21514 | -83.678659 | node/3720394504 (neighbourhood) | revisar |
| 706-el-cruce | El Cruce | Guácimo | Río Jiménez | 10.250569 | -83.651108 | node/5261269437 (neighbourhood) | revisar |
| 706-el-encanto | El Encanto | Guácimo | Guácimo | 10.212221 | -83.69275 | node/5261470210 (neighbourhood) | revisar |
| 706-el-hogar | El Hogar | Guácimo | Guácimo | 10.228042 | -83.707309 | node/3606269350 (hamlet) | revisar |
| 706-el-imas | El Imas | Guácimo | Guácimo | 10.220573 | -83.676504 | node/3720394498 (neighbourhood) | revisar |
| 706-el-invu | El INVU | Guácimo | Guácimo | 10.211259 | -83.680545 | node/3720394508 (neighbourhood) | revisar |
| 706-el-jardin | El Jardín | Guácimo | Río Jiménez | 10.253019 | -83.613272 | node/5261239965 (neighbourhood) | revisar |
| 706-el-mango | El Mango | Guácimo | Guácimo | 10.210355 | -83.682359 | node/3720394509 (neighbourhood) | revisar |
| 706-el-manguito | El Manguito | Guácimo | Guácimo | 10.210923 | -83.687383 | node/3720394513 (neighbourhood) | revisar |
| 706-el-tajo | El Tajo | Guácimo | Río Jiménez | 10.245175 | -83.628993 | node/8695320195 (hamlet) | revisar |
| 706-el-uno | El Uno | Guácimo | Guácimo | 10.250865 | -83.669831 | node/5261527241 (neighbourhood) | revisar |
| 706-escocia | Escocia | Guácimo | Río Jiménez | 10.242277 | -83.590844 | node/3281276133 (neighbourhood) | revisar |
| 706-esperanza | Esperanza | Guácimo | Duacarí | 10.332394 | -83.623106 | node/5260466453 (neighbourhood) | revisar |
| 706-finca-sirena | Finca Sirena | Guácimo | Río Jiménez | 10.303355 | -83.517257 | node/12952134009 (hamlet) | revisar |
| 706-fox-hall | Fox Hall | Guácimo | Guácimo | 10.210053 | -83.721419 | node/3606275761 (neighbourhood) | revisar |
| 706-genesis | Génesis | Guácimo | Río Jiménez | 10.244135 | -83.608115 | node/5261250060 (neighbourhood) | revisar |
| 706-gerifales | Gerifales | Guácimo | Guácimo | 10.219159 | -83.681371 | node/5261475743 (neighbourhood) | revisar |
| 706-guacimo | Guácimo | Guácimo | Guácimo | 10.210589 | -83.685091 | node/444664230 (town) | sí |
| 706-guayacan | Guayacán | Guácimo | Guácimo | 10.20909 | -83.688237 | node/3720394512 (neighbourhood) | revisar |
| 706-irlanda | Irlanda | Guácimo | Río Jiménez | 10.27301 | -83.563681 | node/3281289024 (hamlet) | revisar |
| 706-iroquois | Iroquois | Guácimo | Mercedes | 10.182312 | -83.619516 | node/1215736345 (neighbourhood) | revisar |
| 706-la-argentina | La Argentina | Guácimo | Pocora | 10.140394 | -83.634048 | node/1181516363 (hamlet) | revisar |
| 706-la-aurora | La Aurora | Guácimo | Río Jiménez | 10.344745 | -83.516871 | node/5326200737 (hamlet) | revisar |
| 706-la-cabana | La Cabaña | Guácimo | Guácimo | 10.209241 | -83.690987 | node/3720419164 (neighbourhood) | revisar |
| 706-la-clemencia | La Clemencia | Guácimo | Río Jiménez | 10.255901 | -83.599207 | node/5261239966 (neighbourhood) | revisar |
| 706-la-confianza | La Confianza | Guácimo | Mercedes | 10.1906 | -83.63654 | node/1215736129 (neighbourhood) | revisar |
| 706-la-guaira | La Guaira | Guácimo | Guácimo | 10.227679 | -83.674073 | node/3720394499 (neighbourhood) | revisar |
| 706-la-isleta | La Isleta | Guácimo | Guácimo | 10.138851 | -83.673043 | node/5261393612 (hamlet) | revisar |
| 706-la-ligia | La Ligia | Guácimo | Río Jiménez | 10.259422 | -83.605193 | node/3643510659 (hamlet) | revisar |
| 706-la-lucha | La Lucha | Guácimo | Río Jiménez | 10.247513 | -83.55346 | node/5261180963 (hamlet) | revisar |
| 706-la-lucha-2 | La Lucha | Guácimo | Río Jiménez | 10.380576 | -83.561977 | node/5326174820 (hamlet) | revisar |
| 706-la-manudita | La Manudita | Guácimo | Guácimo | 10.251189 | -83.691133 | node/3281312012 (hamlet) | revisar |
| 706-la-perla | La Perla | Guácimo | Guácimo | 10.184675 | -83.681086 | node/5261359595 (hamlet) | revisar |
| 706-la-roca | La Roca | Guácimo | Río Jiménez | 10.248738 | -83.606733 | node/5261239963 (neighbourhood) | revisar |
| 706-la-roca-2 | La Roca | Guácimo | Guácimo | 10.202288 | -83.739515 | node/5261359594 (neighbourhood) | revisar |
| 706-la-selva | La Selva | Guácimo | Guácimo | 10.213536 | -83.709743 | node/1215735178 (hamlet) | revisar |
| 706-la-union | La Unión | Guácimo | Duacarí | 10.32591 | -83.638169 | node/5260621865 (neighbourhood) | revisar |
| 706-las-colinas | Las Colinas | Guácimo | Guácimo | 10.164631 | -83.666473 | node/5261379686 (hamlet) | revisar |
| 706-las-lomas | Las Lomas | Guácimo | Río Jiménez | 10.315026 | -83.509149 | node/1267986834 (hamlet) | revisar |
| 706-las-lomas-2 | Las Lomas | Guácimo | Río Jiménez | 10.267145 | -83.50408 | node/5261145994 (neighbourhood) | revisar |
| 706-las-orquideas | Las Orquídeas | Guácimo | Río Jiménez | 10.260747 | -83.597162 | node/5261239967 (neighbourhood) | revisar |
| 706-las-palmiras | Las Palmiras | Guácimo | Guácimo | 10.250729 | -83.653322 | node/12954699873 (neighbourhood) | revisar |
| 706-las-vegas-del-camaron | Las Vegas del Camarón | Guácimo | Río Jiménez | 10.271544 | -83.540616 | node/5261167948 (neighbourhood) | revisar |
| 706-limbo | Limbo | Guácimo | Duacarí | 10.32638 | -83.652874 | node/3861871779 (hamlet) | revisar |
| 706-linea-vieja | Línea Vieja | Guácimo | Río Jiménez | 10.306202 | -83.557371 | node/5326207535 (hamlet) | revisar |
| 706-lomas-azules | Lomas Azules | Guácimo | Río Jiménez | 10.358469 | -83.5808 | node/3891871835 (hamlet) | revisar |
| 706-los-cocales | Los Cocales | Guácimo | Guácimo | 10.207378 | -83.68479 | node/3720394510 (neighbourhood) | revisar |
| 706-los-dumbi | Los Dumbi | Guácimo | Guácimo | 10.21832 | -83.67925 | node/3720394493 (neighbourhood) | revisar |
| 706-los-geranios | Los Geranios | Guácimo | Guácimo | 10.214751 | -83.692309 | node/3720394490 (neighbourhood) | revisar |
| 706-los-leones | Los Leones | Guácimo | Guácimo | 10.212724 | -83.676518 | node/5261470211 (neighbourhood) | revisar |
| 706-los-lirios | Los Lirios | Guácimo | Guácimo | 10.20248 | -83.686758 | node/5261559789 (neighbourhood) | revisar |
| 706-los-naranjos | Los Naranjos | Guácimo | Guácimo | 10.213033 | -83.698995 | node/3720394489 (neighbourhood) | revisar |
| 706-los-olivos | Los Olivos | Guácimo | Guácimo | 10.22375 | -83.685885 | node/3720394491 (neighbourhood) | revisar |
| 706-los-pinos | Los Pinos | Guácimo | Río Jiménez | 10.247163 | -83.608125 | node/5261239962 (neighbourhood) | revisar |
| 706-los-polines | Los Polines | Guácimo | Río Jiménez | 10.243104 | -83.609372 | node/5261250061 (neighbourhood) | revisar |
| 706-malanga | Malanga | Guácimo | Río Jiménez | 10.341674 | -83.549207 | node/5326174751 (hamlet) | revisar |
| 706-mascota | Mascota | Guácimo | Pocora | 10.182501 | -83.594999 | node/5260744271 (neighbourhood) | revisar |
| 706-mercedes | Mercedes | Guácimo | Mercedes | 10.176572 | -83.612041 | node/1215737057 (village) | sí |
| 706-monte-de-dios | Monte de Dios | Guácimo | Guácimo | 10.131319 | -83.746774 | node/5261327821 (neighbourhood) | revisar |
| 706-neguer | Neguer | Guácimo | Río Jiménez | 10.230233 | -83.540645 | node/5261180962 (neighbourhood) | revisar |
| 706-ojo-de-agua | Ojo de Agua | Guácimo | Pocora | 10.058355 | -83.657935 | node/5260689622 (hamlet) | revisar |
| 706-palmitas | Palmitas | Guácimo | Guácimo | 10.218351 | -83.671308 | node/3720394502 (neighbourhood) | revisar |
| 706-paraiso | Paraíso | Guácimo | Duacarí | 10.316217 | -83.661886 | node/12954586775 (neighbourhood) | revisar |
| 706-paraiso-2 | Paraíso | Guácimo | Pocora | 10.155072 | -83.619787 | node/3281223098 (neighbourhood) | revisar |
| 706-parismina | Parismina | Guácimo | Guácimo | 10.197149 | -83.647616 | node/1215735783 (hamlet) | revisar |
| 706-pocora | Pocora | Guácimo | Pocora | 10.171951 | -83.604714 | node/382065610 (village) | sí |
| 706-pocora-sur | Pocora Sur | Guácimo | Pocora | 10.168221 | -83.608697 | node/3281215264 (neighbourhood) | revisar |
| 706-providencia | Providencia | Guácimo | Río Jiménez | 10.246339 | -83.604777 | node/12974283643 (neighbourhood) | revisar |
| 706-pueblo-nuevo | Pueblo Nuevo | Guácimo | Duacarí | 10.333857 | -83.596692 | node/3861891796 (hamlet) | revisar |
| 706-puente-negro | Puente Negro | Guácimo | Río Jiménez | 10.236471 | -83.612223 | node/5261227835 (neighbourhood) | revisar |
| 706-quebrada-honda | Quebrada Honda | Guácimo | Pocora | 10.152906 | -83.615009 | node/5260719411 (neighbourhood) | revisar |
| 706-rio-jimenez | Río Jiménez | Guácimo | Río Jiménez | 10.250207 | -83.603605 | node/867658770 (village) | sí |
| 706-rudin | Rudín | Guácimo | Guácimo | 10.201505 | -83.657511 | node/5261529394 (neighbourhood) | revisar |
| 706-san-bosco | San Bosco | Guácimo | Pocora | 10.112376 | -83.617671 | node/739139778 (hamlet) | revisar |
| 706-san-cristobal | San Cristobal | Guácimo | Duacarí | 10.316239 | -83.666547 | node/1144977265 (hamlet) | revisar |
| 706-san-edmundo | San Edmundo | Guácimo | Duacarí | 10.316496 | -83.620908 | node/5260548312 (neighbourhood) | revisar |
| 706-san-francisco | San Francisco | Guácimo | Pocora | 10.110691 | -83.632947 | node/5260690160 (neighbourhood) | revisar |
| 706-san-gerardo | San Gerardo | Guácimo | Duacarí | 10.340493 | -83.647023 | node/12974331617 (neighbourhood) | revisar |
| 706-san-gerardo-2 | San Gerardo | Guácimo | Río Jiménez | 10.316506 | -83.546869 | node/5326200736 (neighbourhood) | revisar |
| 706-san-luis | San Luis | Guácimo | Guácimo | 10.245437 | -83.660078 | node/3281320561 (hamlet) | revisar |
| 706-san-martin | San Martín | Guácimo | Pocora | 10.163631 | -83.61372 | node/5260732811 (neighbourhood) | revisar |
| 706-santa-maria | Santa María | Guácimo | Río Jiménez | 10.269978 | -83.593813 | node/3281279889 (hamlet) | revisar |
| 706-santa-marta | Santa Marta | Guácimo | Guácimo | 10.225984 | -83.669346 | node/5261493116 (neighbourhood) | revisar |
| 706-santa-paula | Santa Paula | Guácimo | Guácimo | 10.210599 | -83.697211 | node/3720394488 (neighbourhood) | revisar |
| 706-santa-rosa | Santa Rosa | Guácimo | Río Jiménez | 10.262642 | -83.547878 | node/3281294380 (hamlet) | revisar |
| 706-socorro | Socorro | Guácimo | Río Jiménez | 10.246821 | -83.646056 | node/5261256966 (neighbourhood) | revisar |
| 706-tames | Tames | Guácimo | Río Jiménez | 10.321816 | -83.490354 | node/2328921641 (hamlet) | revisar |
| 706-tierra-grande | Tierra Grande | Guácimo | Mercedes | 10.122316 | -83.673994 | node/4781673408 (hamlet) | revisar |
| 706-union-de-rio-perla | Unión de Río Perla | Guácimo | Pocora | 10.102288 | -83.629806 | node/5260689965 (hamlet) | revisar |
| 706-villafranca | Villafranca | Guácimo | Duacarí | 10.289323 | -83.608381 | node/1756143777 (village) | sí |
