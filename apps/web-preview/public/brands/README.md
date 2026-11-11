# Recursos de marca

Estos archivos se sirven desde GeoEmpleo360 para evitar peticiones de imagen a terceros al abrir una oferta. La atribución depende siempre del ID de fuente empresarial del anuncio; no se infiere una marca a partir del título. Los nombres y marcas pertenecen a sus titulares.

| Archivo | Empresa | Origen público del recurso |
|---|---|---|
| `mcdonalds.svg` | McDonald's | [Simple Icons](https://simpleicons.org/?q=mcdonalds) |
| `burger-king.svg` | Burger King | [Simple Icons](https://simpleicons.org/?q=burgerking) |
| `kfc.svg` | KFC | [Simple Icons](https://simpleicons.org/?q=kfc) |
| `jobandtalent.png` | Job&Talent | [Tablón Lever de Job&Talent](https://jobs.lever.co/jobandtalent) |
| `skydance.jpg` | Skydance | [Tablón Lever de Skydance](https://jobs.lever.co/skydance) |
| `plenergy.png` | Plenergy | [Web corporativa](https://plenergy.es/) |
| `telepizza.svg` | Telepizza | [Web corporativa](https://telepizza.es/) |
| `vithas.png` | Vithas | [Portal de empleo](https://empleo.vithas.es/search/) |
| `mapfre.png` | MAPFRE | [Portal de empleo](https://jobs.mapfre.com/go/PROFESIONALES/3296401/) |
| `capgemini.png` | Capgemini | [Portal de empleo](https://careers.capgemini.com/search/) |
| `melia.svg` | Meliá Hotels International | [Portal de empleo](https://careers.melia.com/go/Profesionales-de-hotel/8861001/) |
| `kpmg.png` | KPMG | [Cabecera del portal de empleo](https://carreras.kpmg.es/search/) |
| `deloitte.png` | Deloitte | [Cabecera del portal de empleo](https://empleo.es.deloitte.com/search/) |
| `ilunion.jpg` | ILUNION | [Cabecera del portal de empleo](https://empleo.ilunion.com/Ilunion/go/TODAS-LAS-OFERTAS-ILUNION/9135102/); el recurso también muestra a Fundación ONCE, cuyas ofertas se excluyen de la fuente ILUNION |
| `leroy-merlin.png` | Leroy Merlin | [Logotipo del portal oficial](https://empleo.leroymerlin.es/jobs); imagen servida por su CDN Teamtailor |
| `alcampo.png` | Alcampo | [Logotipo blanco de la web corporativa oficial](https://alcampocorporativo.es/trabaja-con-nosotros/); las tarjetas usan fondo rojo para conservar contraste |
| `decathlon.png` | Decathlon | [Logotipo azul del portal oficial](https://trabajaconnosotros.decathlon.es/ofertas/) |
| `dia.png` | DIA | [Portal de empleo](https://empleo.dia.es/jobs) |
| `carrefour.svg` | Carrefour | [Simple Icons](https://simpleicons.org/?q=carrefour) |
| `lidl.svg` | Lidl | [Simple Icons](https://simpleicons.org/?q=lidl) |
| `disa.png` | Grupo DISA | [Web corporativa](https://www.disagrupo.es/) |
| `randstad.svg` | Randstad | [Logo vectorial en el portal oficial](https://www.randstad.es/candidatos/) |
| `quironsalud.jpg` | Quirónsalud | [Tablón oficial de TalentClue](https://empleo.quironsalud.es/) |
| `eulen.webp` | Grupo Eulen | [Web corporativa](https://www.eulen.com/es/unete-a-nosotros/) |
| `clece.png` | Clece | [Portal oficial de empleo](https://canaldeempleo.es/CLECE) |
| `domusvi.png` | DomusVi | [Portal oficial de empleo](https://empleo.domusvi.es/jobs) |
| `indra.png` | Indra | [Portal oficial de empleo](https://careers.indragroup.com/) |
| `coviran.png` | Covirán | [Logotipo de la empresa en Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Coviran-Logo.png) |
| `iss.png` | ISS Facility Services | [Portal oficial de empleo](https://jobs.iss.es/jobs) |
| `accenture.svg` | Accenture | [Portal oficial de empleo](https://www.accenture.com/es-es/careers/jobsearch) |
| `el-corte-ingles.svg` | El Corte Inglés | [Portal oficial de empleo](https://empleo.elcorteingles.es/ep/ofertas) |
| `gi-group.jpg` | Gi Group | [Logotipo incluido en el JobPosting del portal oficial](https://es.gigroup.com/ofertas-de-trabajo/) |
| `sacyr.png` | Sacyr | [Logotipo servido por el portal oficial de empleo](https://sacyrpeople.sacyr.com/jobs?country=Spain&query=&split_view=true) |
| `grupo-crit.png` | Grupo Crit | [Logotipo servido por el portal oficial de empleo](https://empleo.grupo-crit.com/) |

La atribución de imagen se cubre mediante pruebas en `tests/web-employer-brand.test.ts`. Las ofertas públicas, directas y de fuentes sin empleador empresarial identificable usan `geoempleo-neutral.svg`.
