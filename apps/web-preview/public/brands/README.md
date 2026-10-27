# Recursos de marca

Estos archivos se sirven desde GeoEmpleo para evitar peticiones de imagen a terceros al abrir una oferta. La atribución depende siempre del ID de fuente empresarial del anuncio; no se infiere una marca a partir del título. Los nombres y marcas pertenecen a sus titulares.

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
| `dia.png` | DIA | [Portal de empleo](https://empleo.dia.es/jobs) |
| `carrefour.svg` | Carrefour | [Simple Icons](https://simpleicons.org/?q=carrefour) |
| `lidl.svg` | Lidl | [Simple Icons](https://simpleicons.org/?q=lidl) |
| `disa.png` | Grupo DISA | [Web corporativa](https://www.disagrupo.es/) |

La atribución de imagen se cubre mediante pruebas en `tests/web-employer-brand.test.ts`. Las ofertas públicas, directas y de fuentes sin empleador empresarial identificable usan `geoempleo-neutral.svg`.
